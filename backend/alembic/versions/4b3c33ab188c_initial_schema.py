"""initial schema

Revision ID: 4b3c33ab188c
Revises:
Create Date: 2026-08-21 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "4b3c33ab188c"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gyms",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("subdomain", sa.String(length=63), nullable=False),
        sa.Column(
            "status",
            sa.Enum("TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED", name="gym_status"),
            nullable=False,
        ),
        sa.Column(
            "plan_tier",
            sa.Enum("FREE", "BASIC", "PRO", "ENTERPRISE", name="saas_plan_tier"),
            nullable=False,
        ),
        sa.Column("contact_email", sa.String(length=255), nullable=False),
        sa.Column("contact_phone", sa.String(length=30), nullable=True),
        sa.Column("address", sa.String(length=255), nullable=True),
    )
    op.create_index("ix_gyms_subdomain", "gyms", ["subdomain"], unique=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id", ondelete="CASCADE"), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "role",
            sa.Enum("SUPERADMIN", "GYM_ADMIN", "TRAINER", "NUTRITIONIST", "MEMBER", name="user_role"),
            nullable=False,
        ),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("sex", sa.Enum("MALE", "FEMALE", name="sex"), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("gym_id", "email", name="uq_users_gym_id_email"),
    )
    op.create_index("ix_users_gym_id", "users", ["gym_id"])
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "exercises",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id", ondelete="CASCADE"), nullable=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("muscle_group", sa.String(length=100), nullable=False),
        sa.Column("equipment", sa.String(length=150), nullable=True),
        sa.Column("video_url", sa.String(length=500), nullable=True),
    )
    op.create_index("ix_exercises_gym_id", "exercises", ["gym_id"])

    op.create_table(
        "memberships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("duration_days", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_memberships_gym_id", "memberships", ["gym_id"])

    op.create_table(
        "member_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("membership_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("memberships.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("ACTIVE", "EXPIRED", "CANCELLED", "PENDING", name="subscription_status"),
            nullable=False,
        ),
    )
    op.create_index("ix_member_subscriptions_gym_id", "member_subscriptions", ["gym_id"])
    op.create_index("ix_member_subscriptions_user_id", "member_subscriptions", ["user_id"])
    op.create_index("ix_member_subscriptions_membership_id", "member_subscriptions", ["membership_id"])

    op.create_table(
        "check_ins",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("access_granted", sa.Boolean(), nullable=False),
        sa.Column("denial_reason", sa.String(length=255), nullable=True),
    )
    op.create_index("ix_check_ins_gym_id", "check_ins", ["gym_id"])
    op.create_index("ix_check_ins_user_id", "check_ins", ["user_id"])
    op.create_index("ix_check_ins_timestamp", "check_ins", ["timestamp"])

    op.create_table(
        "physical_evaluations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("evaluated_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("weight_kg", sa.Numeric(5, 2), nullable=False),
        sa.Column("height_cm", sa.Numeric(5, 2), nullable=False),
        sa.Column("body_fat_percentage", sa.Numeric(4, 2), nullable=True),
        sa.Column(
            "fitness_goal",
            sa.Enum("FAT_LOSS", "MUSCLE_GAIN", "MAINTENANCE", "REHAB", name="fitness_goal"),
            nullable=False,
        ),
        sa.Column(
            "activity_level",
            sa.Enum("SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE", name="activity_level"),
            nullable=False,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_physical_evaluations_gym_id", "physical_evaluations", ["gym_id"])
    op.create_index("ix_physical_evaluations_user_id", "physical_evaluations", ["user_id"])
    op.create_index("ix_physical_evaluations_evaluated_by_id", "physical_evaluations", ["evaluated_by_id"])

    op.create_table(
        "workout_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column(
            "fitness_goal",
            sa.Enum("FAT_LOSS", "MUSCLE_GAIN", "MAINTENANCE", "REHAB", name="workout_fitness_goal"),
            nullable=False,
        ),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_workout_plans_gym_id", "workout_plans", ["gym_id"])
    op.create_index("ix_workout_plans_user_id", "workout_plans", ["user_id"])
    op.create_index("ix_workout_plans_created_by_id", "workout_plans", ["created_by_id"])

    op.create_table(
        "workout_plan_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workout_plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("workout_plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("exercise_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("exercises.id", ondelete="RESTRICT"), nullable=False),
        sa.Column(
            "day_of_week",
            sa.Enum(
                "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY",
                name="day_of_week",
            ),
            nullable=False,
        ),
        sa.Column("sets", sa.Integer(), nullable=False),
        sa.Column("reps", sa.Integer(), nullable=False),
        sa.Column("rpe", sa.Numeric(3, 1), nullable=True),
        sa.Column("rest_seconds", sa.Integer(), nullable=True),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index("ix_workout_plan_items_workout_plan_id", "workout_plan_items", ["workout_plan_id"])
    op.create_index("ix_workout_plan_items_exercise_id", "workout_plan_items", ["exercise_id"])

    op.create_table(
        "nutrition_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "fitness_goal",
            sa.Enum("FAT_LOSS", "MUSCLE_GAIN", "MAINTENANCE", "REHAB", name="nutrition_fitness_goal"),
            nullable=False,
        ),
        sa.Column("bmr", sa.Numeric(7, 2), nullable=False),
        sa.Column("bmr_formula", sa.String(length=20), nullable=False, server_default="mifflin_st_jeor"),
        sa.Column("tdee", sa.Numeric(7, 2), nullable=False),
        sa.Column("calories", sa.Integer(), nullable=False),
        sa.Column("protein_g", sa.Integer(), nullable=False),
        sa.Column("carbs_g", sa.Integer(), nullable=False),
        sa.Column("fats_g", sa.Integer(), nullable=False),
        sa.Column("water_ml", sa.Integer(), nullable=False, server_default="2000"),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index("ix_nutrition_plans_gym_id", "nutrition_plans", ["gym_id"])
    op.create_index("ix_nutrition_plans_user_id", "nutrition_plans", ["user_id"])
    op.create_index("ix_nutrition_plans_created_by_id", "nutrition_plans", ["created_by_id"])

    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("gym_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("gyms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("subscription_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("member_subscriptions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("processed_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "payment_type",
            sa.Enum("MEMBERSHIP", "RETAIL", "OTHER", name="payment_type"),
            nullable=False,
        ),
        sa.Column(
            "payment_method",
            sa.Enum("CASH", "CARD", "TRANSFER", "OTHER", name="payment_method"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("PENDING", "COMPLETED", "REFUNDED", "FAILED", name="payment_status"),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("reference", sa.String(length=100), nullable=True),
    )
    op.create_index("ix_payments_gym_id", "payments", ["gym_id"])
    op.create_index("ix_payments_user_id", "payments", ["user_id"])
    op.create_index("ix_payments_subscription_id", "payments", ["subscription_id"])
    op.create_index("ix_payments_processed_by_id", "payments", ["processed_by_id"])


def downgrade() -> None:
    op.drop_table("payments")
    op.drop_table("nutrition_plans")
    op.drop_table("workout_plan_items")
    op.drop_table("workout_plans")
    op.drop_table("physical_evaluations")
    op.drop_table("check_ins")
    op.drop_table("member_subscriptions")
    op.drop_table("memberships")
    op.drop_table("exercises")
    op.drop_table("users")
    op.drop_table("gyms")

    bind = op.get_bind()
    for enum_name in (
        "payment_status",
        "payment_method",
        "payment_type",
        "nutrition_fitness_goal",
        "day_of_week",
        "workout_fitness_goal",
        "activity_level",
        "fitness_goal",
        "subscription_status",
        "sex",
        "user_role",
        "saas_plan_tier",
        "gym_status",
    ):
        sa.Enum(name=enum_name).drop(bind, checkfirst=True)
