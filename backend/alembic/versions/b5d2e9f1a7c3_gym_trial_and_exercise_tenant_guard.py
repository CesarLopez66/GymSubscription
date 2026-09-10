"""gym trial and exercise tenant guard

Revision ID: b5d2e9f1a7c3
Revises: a3f9c1d8e6b4
Create Date: 2026-09-11 00:00:00.000000

Two independent additions:

1. ``gyms.trial_ends_at`` — a TRIAL gym previously had no expiry date at
   all; the status was just a label. Backfills every currently-TRIAL gym to
   30 days from its own `created_at` so the field has real values instead
   of starting universally null.

2. A BEFORE INSERT/UPDATE trigger on ``workout_plan_items`` that rejects a
   row whose ``exercise_id`` points at another gym's custom exercise. This
   was previously enforced only in application code
   (workout_service._validate_exercise_ids) — real but trusted-application
   protection, found insufficient when two rows in the demo data ended up
   with a cross-tenant exercise reference (fixed by hand; this trigger is
   the structural fix so it can't happen again, from any code path or a
   raw SQL script). A plain FK can't express this: Postgres has no way to
   constrain "this column must equal a column on a different, indirectly
   related table" — that requires either a trigger or denormalizing gym_id
   onto workout_plan_items and a composite FK. The trigger is the smaller
   change and doesn't touch the existing schema shape.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b5d2e9f1a7c3"
down_revision: Union[str, None] = "a3f9c1d8e6b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TRIGGER_FUNCTION_SQL = """
CREATE OR REPLACE FUNCTION check_workout_plan_item_exercise_tenant()
RETURNS trigger AS $$
DECLARE
    plan_gym_id uuid;
    ex_gym_id uuid;
BEGIN
    SELECT gym_id INTO plan_gym_id FROM workout_plans WHERE id = NEW.workout_plan_id;
    SELECT gym_id INTO ex_gym_id FROM exercises WHERE id = NEW.exercise_id;
    -- ex_gym_id IS NULL means the global catalog — visible to every gym, so
    -- only a *non-null*, *mismatched* gym_id is the violation.
    IF ex_gym_id IS NOT NULL AND ex_gym_id != plan_gym_id THEN
        RAISE EXCEPTION 'exercise % belongs to a different gym than workout_plan %', NEW.exercise_id, NEW.workout_plan_id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

_TRIGGER_SQL = """
CREATE TRIGGER trg_check_workout_plan_item_exercise_tenant
BEFORE INSERT OR UPDATE OF workout_plan_id, exercise_id ON workout_plan_items
FOR EACH ROW EXECUTE FUNCTION check_workout_plan_item_exercise_tenant();
"""


def upgrade() -> None:
    op.add_column("gyms", sa.Column("trial_ends_at", sa.Date(), nullable=True))
    op.execute(
        "UPDATE gyms SET trial_ends_at = (created_at + INTERVAL '30 days')::date "
        "WHERE status = 'TRIAL'"
    )

    op.execute(_TRIGGER_FUNCTION_SQL)
    op.execute(_TRIGGER_SQL)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_check_workout_plan_item_exercise_tenant ON workout_plan_items")
    op.execute("DROP FUNCTION IF EXISTS check_workout_plan_item_exercise_tenant()")
    op.drop_column("gyms", "trial_ends_at")
