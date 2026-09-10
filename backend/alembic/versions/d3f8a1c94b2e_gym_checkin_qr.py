"""gym checkin qr

Revision ID: d3f8a1c94b2e
Revises: bbf416e5ee3f
Create Date: 2026-09-06 00:00:00.000000

Adds a per-gym secret token (``checkin_qr_token``) displayed as a fixed QR
poster at the gym entrance. Members scan it with their own phone to
self-check-in, proving physical presence, instead of a staff member scanning
the member's QR at a front-desk device. Existing gyms are backfilled with a
random token so a poster can be printed immediately after upgrading.
"""
import secrets
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d3f8a1c94b2e"
down_revision: Union[str, None] = "bbf416e5ee3f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("gyms", sa.Column("checkin_qr_token", sa.String(length=64), nullable=True))

    conn = op.get_bind()
    gym_ids = [row[0] for row in conn.execute(sa.text("SELECT id FROM gyms"))]
    for gym_id in gym_ids:
        conn.execute(
            sa.text("UPDATE gyms SET checkin_qr_token = :token WHERE id = :id"),
            {"token": secrets.token_urlsafe(32), "id": gym_id},
        )

    op.alter_column("gyms", "checkin_qr_token", nullable=False)
    op.create_index("ix_gyms_checkin_qr_token", "gyms", ["checkin_qr_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_gyms_checkin_qr_token", table_name="gyms")
    op.drop_column("gyms", "checkin_qr_token")
