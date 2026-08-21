import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CheckInCreate(BaseModel):
    user_id: uuid.UUID


class CheckInRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    user_id: uuid.UUID
    timestamp: datetime
    access_granted: bool
    denial_reason: str | None
