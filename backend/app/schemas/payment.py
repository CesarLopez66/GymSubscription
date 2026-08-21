import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import PaymentMethod, PaymentStatus, PaymentType


class PaymentCreate(BaseModel):
    user_id: uuid.UUID | None = None
    subscription_id: uuid.UUID | None = None
    payment_type: PaymentType
    payment_method: PaymentMethod
    amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    description: str | None = None
    reference: str | None = None


class PaymentUpdate(BaseModel):
    status: PaymentStatus


class PaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    user_id: uuid.UUID | None
    subscription_id: uuid.UUID | None
    processed_by_id: uuid.UUID | None
    payment_type: PaymentType
    payment_method: PaymentMethod
    status: PaymentStatus
    amount: Decimal
    currency: str
    description: str | None
    reference: str | None
    created_at: datetime
    updated_at: datetime
