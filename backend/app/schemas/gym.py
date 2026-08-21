import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import GymStatus, SaaSPlanTier


class GymBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    subdomain: str = Field(min_length=2, max_length=63, pattern=r"^[a-z0-9-]+$")
    contact_email: EmailStr
    contact_phone: str | None = None
    address: str | None = None


class GymCreate(GymBase):
    plan_tier: SaaSPlanTier = SaaSPlanTier.FREE


class GymUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    status: GymStatus | None = None
    plan_tier: SaaSPlanTier | None = None
    contact_email: EmailStr | None = None
    contact_phone: str | None = None
    address: str | None = None


class GymRead(GymBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: GymStatus
    plan_tier: SaaSPlanTier
    created_at: datetime
    updated_at: datetime
