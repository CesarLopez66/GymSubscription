"""promotions

Revision ID: b76b48dc5fc6
Revises: 0035e4e9a451
Create Date: 2026-08-27 00:00:00.000000

Adds the ``promotions`` table: time-boxed discounts a GYM_ADMIN can offer on
one specific membership plan (``membership_id`` set) or on every plan in the
gym (``membership_id`` NULL). Nothing else references a promotion — it's
applied as a price preview in the UI, not persisted onto subscriptions or
payments — so RLS + a plain tenant FK to ``gyms`` is all that's needed, same
as ``memberships``.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "b76b48dc5fc6"
down_revision: Union[str, None] = "0035e4e9a451"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "promotions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("membership_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("memberships.id", ondelete="CASCADE"), nullable=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "discount_type",
            sa.Enum("PERCENTAGE", "FIXED_AMOUNT", name="discount_type"),
            nullable=False,
        ),
        sa.Column("discount_value", sa.Numeric(10, 2), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_promotions_gym_id", "promotions", ["gym_id"])
    op.create_index("ix_promotions_membership_id", "promotions", ["membership_id"])

    op.execute("ALTER TABLE promotions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE promotions FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON promotions
        USING (
            current_setting('app.is_superadmin', true) = 'true'
            OR gym_id = nullif(current_setting('app.current_gym_id', true), '')::uuid
        )
        WITH CHECK (
            current_setting('app.is_superadmin', true) = 'true'
            OR gym_id = nullif(current_setting('app.current_gym_id', true), '')::uuid
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON promotions")
    op.drop_table("promotions")
    sa.Enum(name="discount_type").drop(op.get_bind(), checkfirst=True)
