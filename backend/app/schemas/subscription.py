import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import PaymentMethod, SubscriptionStatus


class SubscriptionCreate(BaseModel):
    user_id: uuid.UUID
    membership_id: uuid.UUID
    branch_id: uuid.UUID | None = None
    start_date: date = Field(default_factory=date.today)
    # Assigning a plan and charging for it are one atomic step: the amount
    # must match the plan's price (after any live promotion discount) or the
    # request is rejected — a subscription never gets created without a
    # matching completed payment.
    payment_amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    payment_method: PaymentMethod = PaymentMethod.QR


class SubscriptionUpdate(BaseModel):
    end_date: date | None = None
    status: SubscriptionStatus | None = None


class SubscriptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    user_id: uuid.UUID
    membership_id: uuid.UUID
    branch_id: uuid.UUID | None
    start_date: date
    end_date: date
    status: SubscriptionStatus
    created_at: datetime
    updated_at: datetime
