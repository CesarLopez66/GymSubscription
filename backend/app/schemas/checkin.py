import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CheckInCreate(BaseModel):
    user_id: uuid.UUID
    branch_id: uuid.UUID | None = None


class SelfCheckInCreate(BaseModel):
    qr_token: str


class CheckInRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    user_id: uuid.UUID
    branch_id: uuid.UUID | None
    timestamp: datetime
    access_granted: bool
    denial_reason: str | None
