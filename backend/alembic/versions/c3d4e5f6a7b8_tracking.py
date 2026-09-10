"""tracking

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-06 03:00:00.000000

Adds `workout_completions` and `nutrition_logs` so a member's daily
adherence (which exercises they finished, what they logged for macros) is
persisted server-side instead of living only in that device's localStorage
— today the trainer has no visibility into whether a member actually
followed the routine they were given.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_GYM_ID_CONDITION = "gym_id = nullif(current_setting('app.current_gym_id', true), '')::uuid"
_SUPERADMIN_CONDITION = "current_setting('app.is_superadmin', true) = 'true'"


def _enable_rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON {table}
        USING ({_SUPERADMIN_CONDITION} OR {_GYM_ID_CONDITION})
        WITH CHECK ({_SUPERADMIN_CONDITION} OR {_GYM_ID_CONDITION})
        """
    )


def upgrade() -> None:
    op.create_table(
        "workout_completions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workout_plan_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("completed_date", sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(["gym_id"], ["gyms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["workout_plan_item_id"], ["workout_plan_items.id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint(
            "user_id", "workout_plan_item_id", "completed_date", name="uq_workout_completion"
        ),
    )
    op.create_index("ix_workout_completions_gym_id", "workout_completions", ["gym_id"])
    op.create_index("ix_workout_completions_user_id", "workout_completions", ["user_id"])
    op.create_index(
        "ix_workout_completions_item_id", "workout_completions", ["workout_plan_item_id"]
    )
    _enable_rls("workout_completions")

    op.create_table(
        "nutrition_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("log_date", sa.Date(), nullable=False),
        sa.Column("protein_g", sa.Numeric(6, 1), server_default="0", nullable=False),
        sa.Column("carbs_g", sa.Numeric(6, 1), server_default="0", nullable=False),
        sa.Column("fats_g", sa.Numeric(6, 1), server_default="0", nullable=False),
        sa.ForeignKeyConstraint(["gym_id"], ["gyms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "log_date", name="uq_nutrition_log"),
    )
    op.create_index("ix_nutrition_logs_gym_id", "nutrition_logs", ["gym_id"])
    op.create_index("ix_nutrition_logs_user_id", "nutrition_logs", ["user_id"])
    _enable_rls("nutrition_logs")


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON nutrition_logs")
    op.drop_table("nutrition_logs")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON workout_completions")
    op.drop_table("workout_completions")
