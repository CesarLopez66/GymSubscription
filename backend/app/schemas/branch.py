import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BranchBase(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    address: str | None = None
    phone: str | None = None


class BranchCreate(BranchBase):
    pass


class BranchUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    address: str | None = None
    phone: str | None = None
    is_active: bool | None = None


class BranchRead(BranchBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime


class BranchCheckinQrRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    checkin_qr_token: str
