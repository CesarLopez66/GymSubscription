import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import GymStatus, SaaSPlanTier

_HEX_COLOR_PATTERN = r"^#[0-9a-fA-F]{6}$"


class GymBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    subdomain: str = Field(min_length=2, max_length=63, pattern=r"^[a-z0-9-]+$")
    contact_email: EmailStr
    contact_phone: str | None = None
    address: str | None = None
    # Brand colors applied across that gym's dashboard/trainer/member UI —
    # null keeps the app's default theme. Hex only ("#rrggbb") since that's
    # what an <input type="color"> produces and what gets written straight
    # into a CSS custom property client-side.
    primary_color: str | None = Field(default=None, pattern=_HEX_COLOR_PATTERN)
    secondary_color: str | None = Field(default=None, pattern=_HEX_COLOR_PATTERN)


class GymCreate(GymBase):
    plan_tier: SaaSPlanTier = SaaSPlanTier.FREE


class GymUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    status: GymStatus | None = None
    plan_tier: SaaSPlanTier | None = None
    contact_email: EmailStr | None = None
    contact_phone: str | None = None
    address: str | None = None
    primary_color: str | None = Field(default=None, pattern=_HEX_COLOR_PATTERN)
    secondary_color: str | None = Field(default=None, pattern=_HEX_COLOR_PATTERN)


class GymPaymentQrUpdate(BaseModel):
    payment_qr_image: str | None = Field(default=None, max_length=2_000_000)


class GymBrandingUpdate(BaseModel):
    """Self-service subset of GymUpdate — a gym admin can restyle their own
    dashboard without touching the identity/billing fields (name, subdomain,
    plan_tier, status) that stay superadmin-only."""

    primary_color: str | None = Field(default=None, pattern=_HEX_COLOR_PATTERN)
    secondary_color: str | None = Field(default=None, pattern=_HEX_COLOR_PATTERN)


class GymCheckinQrRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    checkin_qr_token: str


class GymSuspendRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class GymAuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    actor_id: uuid.UUID | None
    action: str
    reason: str | None
    created_at: datetime


class GymPublicRead(BaseModel):
    """Minimal, unauthenticated-safe projection for the login screen's gym
    picker — deliberately excludes everything else on Gym (contact info,
    plan tier, QR images, timestamps) so anonymous visitors only ever see
    the two fields they need to pick a tenant."""

    model_config = ConfigDict(from_attributes=True)

    name: str
    subdomain: str


class GymRead(GymBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: GymStatus
    plan_tier: SaaSPlanTier
    payment_qr_image: str | None = None
    trial_ends_at: date | None = None
    created_at: datetime
    updated_at: datetime
