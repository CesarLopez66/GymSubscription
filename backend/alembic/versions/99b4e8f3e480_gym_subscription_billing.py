"""gym subscription billing

Revision ID: 99b4e8f3e480
Revises: 0827106e2037
Create Date: 2026-09-13 20:42:03.045186

Adds the platform-billing counterpart to a gym's own member payments: a gym
submits a proof of payment for its monthly SaaS plan, the superadmin
approves (bumps gyms.plan_tier/status/subscription_ends_at) or rejects it.
Same shape as ``payments`` (proof_image + status + rejection_reason), scoped
to one gym via a plain tenant FK, RLS'd the same way as ``promotions``.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '99b4e8f3e480'
down_revision: Union[str, None] = '0827106e2037'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Pre-existing type (created in the initial schema migration) — reused here,
# not recreated.
_SAAS_PLAN_TIER_ENUM = postgresql.ENUM(
    "FREE", "BASIC", "PRO", "ENTERPRISE",
    name="saas_plan_tier",
    create_type=False,
)


def upgrade() -> None:
    op.add_column("gyms", sa.Column("subscription_ends_at", sa.Date(), nullable=True))

    op.create_table(
        "gym_subscription_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("requested_plan_tier", _SAAS_PLAN_TIER_ENUM, nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("proof_image", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("PENDING", "APPROVED", "REJECTED", name="subscription_request_status"),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column(
            "reviewed_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_gym_subscription_payments_gym_id", "gym_subscription_payments", ["gym_id"])

    op.execute("ALTER TABLE gym_subscription_payments ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE gym_subscription_payments FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON gym_subscription_payments
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
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON gym_subscription_payments")
    op.drop_table("gym_subscription_payments")
    sa.Enum(name="subscription_request_status").drop(op.get_bind(), checkfirst=True)
    op.drop_column("gyms", "subscription_ends_at")
