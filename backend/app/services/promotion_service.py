import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.pagination import PaginationParams, paginate
from app.models.enums import DiscountType
from app.models.membership import Membership
from app.models.promotion import Promotion
from app.schemas.promotion import PromotionCreate, PromotionUpdate, validate_promotion_fields


class PromotionNotFoundError(Exception):
    pass


class InvalidPromotionError(Exception):
    pass


class InvalidPromotionMembershipError(Exception):
    pass


async def _ensure_membership_in_gym(
    db: AsyncSession, gym_id: uuid.UUID, membership_id: uuid.UUID | None
) -> None:
    if membership_id is None:
        return
    result = await db.execute(
        select(Membership).where(Membership.id == membership_id, Membership.gym_id == gym_id)
    )
    if result.scalar_one_or_none() is None:
        raise InvalidPromotionMembershipError("Plan de membresía no encontrado en este gimnasio")


async def create_promotion(db: AsyncSession, gym_id: uuid.UUID, data: PromotionCreate) -> Promotion:
    await _ensure_membership_in_gym(db, gym_id, data.membership_id)

    promotion = Promotion(gym_id=gym_id, **data.model_dump())
    db.add(promotion)
    await db.flush()
    await db.refresh(promotion)
    return promotion


async def get_promotion(db: AsyncSession, gym_id: uuid.UUID, promotion_id: uuid.UUID) -> Promotion:
    result = await db.execute(
        select(Promotion).where(Promotion.id == promotion_id, Promotion.gym_id == gym_id)
    )
    promotion = result.scalar_one_or_none()
    if promotion is None:
        raise PromotionNotFoundError("Promoción no encontrada")
    return promotion


async def list_promotions(
    db: AsyncSession, gym_id: uuid.UUID, pagination: PaginationParams
) -> tuple[list[Promotion], int]:
    base_query = select(Promotion).where(Promotion.gym_id == gym_id)
    return await paginate(
        db, base_query, Promotion.created_at.desc(), Promotion.id, pagination=pagination
    )


async def update_promotion(
    db: AsyncSession, gym_id: uuid.UUID, promotion_id: uuid.UUID, data: PromotionUpdate
) -> Promotion:
    promotion = await get_promotion(db, gym_id, promotion_id)
    update_data = data.model_dump(exclude_unset=True)

    if "membership_id" in update_data:
        await _ensure_membership_in_gym(db, gym_id, update_data["membership_id"])

    for field, value in update_data.items():
        setattr(promotion, field, value)

    try:
        validate_promotion_fields(
            discount_type=promotion.discount_type,
            discount_value=promotion.discount_value,
            start_date=promotion.start_date,
            end_date=promotion.end_date,
        )
    except ValueError as exc:
        raise InvalidPromotionError(str(exc)) from exc

    await db.flush()
    await db.refresh(promotion)
    return promotion


async def delete_promotion(db: AsyncSession, gym_id: uuid.UUID, promotion_id: uuid.UUID) -> None:
    promotion = await get_promotion(db, gym_id, promotion_id)
    await db.delete(promotion)
    await db.flush()


async def get_applicable_promotion(
    db: AsyncSession, gym_id: uuid.UUID, membership_id: uuid.UUID
) -> Promotion | None:
    """The live promotion (if any) for this plan today. A plan-specific
    promotion wins over a gym-wide one; promotions never stack."""
    today = date.today()
    result = await db.execute(
        select(Promotion).where(
            Promotion.gym_id == gym_id,
            Promotion.is_active.is_(True),
            Promotion.start_date <= today,
            Promotion.end_date >= today,
            or_(Promotion.membership_id == membership_id, Promotion.membership_id.is_(None)),
        )
    )
    promotions = list(result.scalars().all())
    if not promotions:
        return None
    specific = [p for p in promotions if p.membership_id == membership_id]
    return specific[0] if specific else promotions[0]


def apply_discount(price: Decimal, promotion: Promotion | None) -> Decimal:
    if promotion is None:
        return price
    if promotion.discount_type == DiscountType.PERCENTAGE:
        discounted = price * (Decimal(1) - promotion.discount_value / Decimal(100))
    else:
        discounted = price - promotion.discount_value
    return max(Decimal("0.00"), discounted).quantize(Decimal("0.01"))
