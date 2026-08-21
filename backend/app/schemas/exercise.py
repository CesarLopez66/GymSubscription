import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ExerciseBase(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    muscle_group: str = Field(min_length=1, max_length=100)
    equipment: str | None = None
    video_url: str | None = None


class ExerciseCreate(ExerciseBase):
    pass


class ExerciseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    muscle_group: str | None = Field(default=None, min_length=1, max_length=100)
    equipment: str | None = None
    video_url: str | None = None


class ExerciseRead(ExerciseBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
