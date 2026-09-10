import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import DayOfWeek, FitnessGoal
from app.schemas.exercise import ExerciseRead


class WorkoutPlanItemBase(BaseModel):
    exercise_id: uuid.UUID
    day_of_week: DayOfWeek
    sets: int = Field(gt=0, le=50)
    reps: int = Field(gt=0, le=200)
    rpe: float | None = Field(default=None, ge=1, le=10)
    rest_seconds: int | None = Field(default=None, ge=0, le=1800)
    order: int = 0
    notes: str | None = None


class WorkoutPlanItemCreate(WorkoutPlanItemBase):
    pass


class WorkoutPlanItemUpdate(BaseModel):
    exercise_id: uuid.UUID | None = None
    day_of_week: DayOfWeek | None = None
    sets: int | None = Field(default=None, gt=0, le=50)
    reps: int | None = Field(default=None, gt=0, le=200)
    rpe: float | None = Field(default=None, ge=1, le=10)
    rest_seconds: int | None = Field(default=None, ge=0, le=1800)
    order: int | None = None
    notes: str | None = None


class WorkoutPlanItemRead(WorkoutPlanItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workout_plan_id: uuid.UUID
    exercise: ExerciseRead


class WorkoutPlanBase(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    fitness_goal: FitnessGoal
    start_date: date
    end_date: date | None = None
    is_active: bool = True


class WorkoutPlanCreate(WorkoutPlanBase):
    user_id: uuid.UUID
    branch_id: uuid.UUID | None = None
    items: list[WorkoutPlanItemCreate] = Field(default_factory=list)


class WorkoutPlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    fitness_goal: FitnessGoal | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None


class WorkoutPlanRead(WorkoutPlanBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    user_id: uuid.UUID
    branch_id: uuid.UUID | None
    created_by_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    items: list[WorkoutPlanItemRead] = Field(default_factory=list)


class WorkoutCompletionSet(BaseModel):
    completed: bool
    target_date: date | None = None


class WorkoutAdherenceRead(BaseModel):
    active_days: int
    period_days: int
