import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ActivityLevel, FitnessGoal


class EvaluationBase(BaseModel):
    weight_kg: float = Field(gt=0, le=500)
    height_cm: float = Field(gt=0, le=300)
    body_fat_percentage: float | None = Field(default=None, ge=0, le=100)
    fitness_goal: FitnessGoal
    activity_level: ActivityLevel
    notes: str | None = None


class EvaluationCreate(EvaluationBase):
    user_id: uuid.UUID


class EvaluationUpdate(BaseModel):
    weight_kg: float | None = Field(default=None, gt=0, le=500)
    height_cm: float | None = Field(default=None, gt=0, le=300)
    body_fat_percentage: float | None = Field(default=None, ge=0, le=100)
    fitness_goal: FitnessGoal | None = None
    activity_level: ActivityLevel | None = None
    notes: str | None = None


class EvaluationRead(EvaluationBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    user_id: uuid.UUID
    evaluated_by_id: uuid.UUID | None
    evaluated_at: datetime
    created_at: datetime
