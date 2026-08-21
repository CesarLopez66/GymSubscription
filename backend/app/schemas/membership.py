import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class MembershipBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    duration_days: int = Field(gt=0)
    is_active: bool = True


class MembershipCreate(MembershipBase):
    pass


class MembershipUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    price: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    duration_days: int | None = Field(default=None, gt=0)
    is_active: bool | None = None


class MembershipRead(MembershipBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
