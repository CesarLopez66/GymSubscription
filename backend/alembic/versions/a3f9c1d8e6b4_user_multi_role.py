"""user multi role

Revision ID: a3f9c1d8e6b4
Revises: f1a2b3c4d5e6
Create Date: 2026-09-10 00:00:00.000000

Replaces the single scalar ``users.role`` column with ``users.roles``, a
Postgres array of the same ``user_role`` enum — a staff member can now hold
more than one role at once (e.g. trainer + nutritionist, or an admin who also
coaches). A plain array is enough here: nothing in the app queries "which
users have role X" as its own lookup, only per-user membership checks and the
occasional aggregate (unnest'd where needed) — so a join table would just add
a join for no benefit.

No RLS policy touches ``role`` (confirmed against
9aa235df7580_row_level_security.py — every policy keys off
``app.current_gym_id`` / ``app.is_superadmin`` only), so this migration is
purely a column swap plus a backfill.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a3f9c1d8e6b4"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_USER_ROLE_ENUM = postgresql.ENUM(
    "SUPERADMIN", "GYM_ADMIN", "TRAINER", "NUTRITIONIST", "MEMBER",
    name="user_role",
    create_type=False,
)


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("roles", postgresql.ARRAY(_USER_ROLE_ENUM), nullable=True),
    )
    op.execute("UPDATE users SET roles = ARRAY[role]")
    op.alter_column("users", "roles", nullable=False)
    op.drop_column("users", "role")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", _USER_ROLE_ENUM, nullable=True),
    )
    # A downgraded user who held more than one role keeps only the first —
    # there is no lossless way back to a scalar column.
    op.execute("UPDATE users SET role = roles[1]")
    op.alter_column("users", "role", nullable=False)
    op.drop_column("users", "roles")
