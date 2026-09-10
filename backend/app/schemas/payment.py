import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import PaymentMethod, PaymentStatus, PaymentType


class PaymentCreate(BaseModel):
    user_id: uuid.UUID | None = None
    subscription_id: uuid.UUID | None = None
    branch_id: uuid.UUID | None = None
    # Required when payment_type == MEMBERSHIP: the plan this payment is for,
    # so the amount can be checked against its real (possibly discounted)
    # price instead of trusting whatever the client sends. Not a Payment
    # column — used only to validate `amount` in the service layer.
    membership_id: uuid.UUID | None = None
    payment_type: PaymentType
    payment_method: PaymentMethod
    amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    currency: str = Field(default="BOB", min_length=3, max_length=3)
    description: str | None = None
    reference: str | None = None


class PaymentUpdate(BaseModel):
    status: PaymentStatus


class PaymentSelfCreate(BaseModel):
    membership_id: uuid.UUID
    payment_method: PaymentMethod = PaymentMethod.QR
    reference: str | None = None
    # Base64 data URI of the transfer receipt — same size cap as
    # GymPaymentQrUpdate.payment_qr_image for the same reason (no object
    # storage in this stack).
    proof_image: str = Field(max_length=2_000_000)


class PaymentRejectRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class PaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    user_id: uuid.UUID | None
    subscription_id: uuid.UUID | None
    branch_id: uuid.UUID | None
    processed_by_id: uuid.UUID | None
    membership_id: uuid.UUID | None
    payment_type: PaymentType
    payment_method: PaymentMethod
    status: PaymentStatus
    amount: Decimal
    currency: str
    description: str | None
    reference: str | None
    proof_image: str | None
    rejection_reason: str | None
    created_at: datetime
    updated_at: datetime
