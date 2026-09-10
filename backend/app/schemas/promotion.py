import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import DiscountType


def validate_promotion_fields(
    *, discount_type: DiscountType, discount_value: Decimal, start_date: date, end_date: date
) -> None:
    if end_date < start_date:
        raise ValueError("La fecha de fin no puede ser anterior a la fecha de inicio")
    if discount_type == DiscountType.PERCENTAGE and discount_value > 100:
        raise ValueError("Un descuento porcentual no puede superar 100%")


class PromotionBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    membership_id: uuid.UUID | None = None
    discount_type: DiscountType
    discount_value: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    start_date: date
    end_date: date


class PromotionCreate(PromotionBase):
    is_active: bool = True

    @model_validator(mode="after")
    def _validate(self) -> "PromotionCreate":
        validate_promotion_fields(
            discount_type=self.discount_type,
            discount_value=self.discount_value,
            start_date=self.start_date,
            end_date=self.end_date,
        )
        return self


class PromotionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    membership_id: uuid.UUID | None = None
    discount_type: DiscountType | None = None
    discount_value: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None


class PromotionRead(PromotionBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
