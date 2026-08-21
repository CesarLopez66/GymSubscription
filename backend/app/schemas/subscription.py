import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import SubscriptionStatus


class SubscriptionCreate(BaseModel):
    user_id: uuid.UUID
    membership_id: uuid.UUID
    start_date: date = Field(default_factory=date.today)


class SubscriptionUpdate(BaseModel):
    end_date: date | None = None
    status: SubscriptionStatus | None = None


class SubscriptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    user_id: uuid.UUID
    membership_id: uuid.UUID
    start_date: date
    end_date: date
    status: SubscriptionStatus
    created_at: datetime
    updated_at: datetime
