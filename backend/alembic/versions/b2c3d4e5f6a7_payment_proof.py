"""payment proof

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-06 02:00:00.000000

Adds `proof_image` (a base64 data URI of the member's transfer receipt,
inline like `gyms.payment_qr_image` — no object storage exists in this
stack) and `rejection_reason` to `payments`, backing the new member-initiated
"submit payment claim -> admin approves/rejects" flow that replaces blind
trust with an actual review step.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("payments", sa.Column("proof_image", sa.Text(), nullable=True))
    op.add_column("payments", sa.Column("rejection_reason", sa.Text(), nullable=True))
    op.add_column(
        "payments",
        sa.Column("membership_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_payments_membership_id",
        "payments",
        "memberships",
        ["membership_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_payments_membership_id", "payments", ["membership_id"])


def downgrade() -> None:
    op.drop_index("ix_payments_membership_id", table_name="payments")
    op.drop_constraint("fk_payments_membership_id", "payments", type_="foreignkey")
    op.drop_column("payments", "membership_id")
    op.drop_column("payments", "rejection_reason")
    op.drop_column("payments", "proof_image")
