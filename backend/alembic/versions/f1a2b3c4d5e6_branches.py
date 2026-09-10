"""branches

Revision ID: f1a2b3c4d5e6
Revises: d4e5f6a7b8c9
Create Date: 2026-09-09 00:00:00.000000

Adds the ``branches`` table (a gym's physical locations, each with its own
check-in QR poster — mirrors ``gyms.checkin_qr_token``) plus a nullable
``branch_id`` FK on every table the product needs to classify by location:
users, check_ins, payments, member_subscriptions, physical_evaluations,
workout_plans, nutrition_plans.

``branch_id`` is nullable everywhere and ON DELETE SET NULL: a gym that never
creates a branch (the common case) keeps working exactly as before, and
deleting a branch demotes its rows to "no specific branch" instead of
cascading data loss. Tenant isolation stays keyed on ``gym_id`` as before —
branch is an optional sub-classification *within* an already-enforced
tenant, not a new security boundary, so none of the existing RLS policies on
those 7 tables need to change. ``branches`` itself gets the same
tenant_isolation policy as memberships/promotions/etc.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_BRANCH_ID_TABLES = (
    "users",
    "check_ins",
    "payments",
    "member_subscriptions",
    "physical_evaluations",
    "workout_plans",
    "nutrition_plans",
)

_TENANT_ISOLATION_SQL = """
    current_setting('app.is_superadmin', true) = 'true'
    OR gym_id = nullif(current_setting('app.current_gym_id', true), '')::uuid
"""


def upgrade() -> None:
    op.create_table(
        "branches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("address", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("checkin_qr_token", sa.String(length=64), nullable=False),
        sa.UniqueConstraint("gym_id", "name", name="uq_branches_gym_id_name"),
    )
    op.create_index("ix_branches_gym_id", "branches", ["gym_id"])
    op.create_index("ix_branches_checkin_qr_token", "branches", ["checkin_qr_token"], unique=True)

    op.execute("ALTER TABLE branches ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE branches FORCE ROW LEVEL SECURITY")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON branches
        USING ({_TENANT_ISOLATION_SQL})
        WITH CHECK ({_TENANT_ISOLATION_SQL})
        """
    )

    for table in _BRANCH_ID_TABLES:
        op.add_column(
            table,
            sa.Column(
                "branch_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("branches.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        op.create_index(f"ix_{table}_branch_id", table, ["branch_id"])


def downgrade() -> None:
    for table in _BRANCH_ID_TABLES:
        op.drop_index(f"ix_{table}_branch_id", table_name=table)
        op.drop_column(table, "branch_id")

    op.execute("DROP POLICY IF EXISTS tenant_isolation ON branches")
    op.drop_table("branches")
