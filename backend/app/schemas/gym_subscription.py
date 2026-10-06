import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import SaaSPlanTier, SubscriptionRequestStatus


class GymSubscriptionPaymentCreate(BaseModel):
    requested_plan_tier: SaaSPlanTier
    # Base64 data URI of the transfer receipt — same size cap as
    # PaymentSelfCreate.proof_image for the same reason (no object storage
    # in this stack).
    proof_image: str = Field(max_length=2_000_000)


class GymSubscriptionRejectRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class GymSubscriptionPaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    requested_plan_tier: SaaSPlanTier
    amount: Decimal
    proof_image: str
    status: SubscriptionRequestStatus
    rejection_reason: str | None
    reviewed_by_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class GymSubscriptionPaymentWithGymRead(GymSubscriptionPaymentRead):
    """Same as GymSubscriptionPaymentRead plus the gym's name — used in the
    superadmin's cross-tenant review queue, where the gym isn't implied by
    the caller's own session the way it is for a GYM_ADMIN."""

    gym_name: str
