import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ActivityLevel, FitnessGoal
from app.schemas.nutrition import NutritionPlanRead
from app.schemas.workout import WorkoutPlanRead


class EvaluationBase(BaseModel):
    weight_kg: float = Field(gt=0, le=500)
    height_cm: float = Field(gt=0, le=300)
    body_fat_percentage: float | None = Field(default=None, ge=0, le=100)
    fitness_goal: FitnessGoal
    activity_level: ActivityLevel
    notes: str | None = None


class EvaluationCreate(EvaluationBase):
    user_id: uuid.UUID
    branch_id: uuid.UUID | None = None
    # Required for the nutrition-plan BMR formula, auto-generated alongside
    # the workout routine from this same evaluation.
    age: int = Field(gt=0, le=120)


class EvaluationUpdate(BaseModel):
    weight_kg: float | None = Field(default=None, gt=0, le=500)
    height_cm: float | None = Field(default=None, gt=0, le=300)
    body_fat_percentage: float | None = Field(default=None, ge=0, le=100)
    fitness_goal: FitnessGoal | None = None
    activity_level: ActivityLevel | None = None
    age: int | None = Field(default=None, gt=0, le=120)
    notes: str | None = None


class EvaluationRead(EvaluationBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    user_id: uuid.UUID
    branch_id: uuid.UUID | None
    evaluated_by_id: uuid.UUID | None
    # Nullable only because evaluations created before this field existed
    # don't have one — every new evaluation always sets it.
    age: int | None
    evaluated_at: datetime
    created_at: datetime


class EvaluationCreateResponse(EvaluationRead):
    """Response for POST /evaluations: the saved evaluation plus the workout
    routine and nutrition plan auto-generated (or progressed) from it — see
    workout_service.generate_workout_plan_from_evaluation and
    nutrition_plan_service.generate_and_create_nutrition_plan."""

    generated_workout_plan: WorkoutPlanRead
    generated_nutrition_plan: NutritionPlanRead
