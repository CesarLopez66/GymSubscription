"""gym payment qr

Revision ID: 0035e4e9a451
Revises: 9aa235df7580
Create Date: 2026-08-21 12:00:00.000000

Adds a nullable ``payment_qr_image`` column to ``gyms`` (a base64 data URI of
the gym admin's payment QR code — no object storage exists in this stack, so
the small, single-per-gym image is stored inline) and a ``QR`` value on the
``payment_method`` enum, since payments are now recorded exclusively against
that QR code rather than cash/card/transfer entry.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0035e4e9a451"
down_revision: Union[str, None] = "9aa235df7580"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("gyms", sa.Column("payment_qr_image", sa.Text(), nullable=True))
    op.execute("ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'QR'")


def downgrade() -> None:
    op.drop_column("gyms", "payment_qr_image")
    # Postgres does not support removing a value from an enum type.
