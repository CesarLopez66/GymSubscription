"""backfill staff and member branch assignment

Revision ID: e5b8f2a9c3d7
Revises: e2a7c9f4d1b6
Create Date: 2026-09-14 15:05:00.000000

Branch-based authorization now applies to TRAINER/NUTRITIONIST/MEMBER (and
the new BRANCH_MANAGER) — a staff member with no branch_id gets a hard 403
instead of gym-wide access (see app.deps.auth.get_effective_branch_id), and
a member with no branch_id is simply invisible to any branch manager's
people list. branch_id was previously optional/cosmetic, so most existing
rows of all three roles have it NULL. This backfills every such row so
nobody is locked out — or made invisible to their own branch's manager —
the moment this ships:
  - a gym that already has at least one Branch: assign its oldest branch.
  - a gym with zero branches: create one ("Sucursal principal") first.

Deliberately a separate migration from e2a7c9f4d1b6 (which only adds the
BRANCH_MANAGER enum label) — Postgres forbids using a brand-new enum value
in the same transaction that adds it, and while this migration doesn't use
that particular value, keeping enum-structure and data changes in separate
migrations is the safer, simpler rule to follow. GYM_ADMIN rows are left
untouched — that role is always unscoped, branch_id is irrelevant to it.
"""
import secrets
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e5b8f2a9c3d7'
down_revision: Union[str, None] = 'e2a7c9f4d1b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SCOPED_ROLES = "ARRAY['TRAINER', 'NUTRITIONIST', 'MEMBER']::user_role[]"


def upgrade() -> None:
    bind = op.get_bind()

    gym_ids = bind.execute(
        sa.text(
            f"""
            SELECT DISTINCT gym_id FROM users
            WHERE branch_id IS NULL
              AND gym_id IS NOT NULL
              AND (roles && {_SCOPED_ROLES})
            """
        )
    ).scalars().all()

    for gym_id in gym_ids:
        branch_id = bind.execute(
            sa.text(
                "SELECT id FROM branches WHERE gym_id = :gym_id ORDER BY created_at LIMIT 1"
            ),
            {"gym_id": gym_id},
        ).scalar_one_or_none()

        if branch_id is None:
            branch_id = uuid.uuid4()
            bind.execute(
                sa.text(
                    """
                    INSERT INTO branches
                        (id, gym_id, name, address, phone, is_active, checkin_qr_token, created_at, updated_at)
                    VALUES
                        (:id, :gym_id, 'Sucursal principal', NULL, NULL, true, :token, now(), now())
                    """
                ),
                {"id": branch_id, "gym_id": gym_id, "token": secrets.token_urlsafe(32)},
            )

        bind.execute(
            sa.text(
                f"""
                UPDATE users SET branch_id = :branch_id
                WHERE gym_id = :gym_id
                  AND branch_id IS NULL
                  AND (roles && {_SCOPED_ROLES})
                """
            ),
            {"branch_id": branch_id, "gym_id": gym_id},
        )


def downgrade() -> None:
    # Backfilled branch_id values are indistinguishable from ones a gym
    # admin set by hand afterward — there's nothing safe to revert to.
    pass
