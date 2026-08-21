import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.pagination import PaginationParams
from app.models.enums import PaymentStatus
from app.models.payment import Payment
from app.models.subscription import MemberSubscription
from app.models.user import User
from app.schemas.payment import PaymentCreate, PaymentUpdate


class PaymentNotFoundError(Exception):
    pass


class InvalidPaymentReferenceError(Exception):
    pass


async def create_payment(
    db: AsyncSession, gym_id: uuid.UUID, processed_by_id: uuid.UUID, data: PaymentCreate
) -> Payment:
    if data.user_id is not None:
        user_result = await db.execute(
            select(User).where(User.id == data.user_id, User.gym_id == gym_id)
        )
        if user_result.scalar_one_or_none() is None:
            raise InvalidPaymentReferenceError("Member not found in this gym")

    if data.subscription_id is not None:
        sub_result = await db.execute(
            select(MemberSubscription).where(
                MemberSubscription.id == data.subscription_id,
                MemberSubscription.gym_id == gym_id,
            )
        )
        if sub_result.scalar_one_or_none() is None:
            raise InvalidPaymentReferenceError("Subscription not found in this gym")

    payment = Payment(gym_id=gym_id, processed_by_id=processed_by_id, **data.model_dump())
    db.add(payment)
    await db.flush()
    await db.refresh(payment)
    return payment


async def get_payment(db: AsyncSession, gym_id: uuid.UUID, payment_id: uuid.UUID) -> Payment:
    result = await db.execute(
        select(Payment).where(Payment.id == payment_id, Payment.gym_id == gym_id)
    )
    payment = result.scalar_one_or_none()
    if payment is None:
        raise PaymentNotFoundError("Payment not found")
    return payment


async def list_payments(
    db: AsyncSession,
    gym_id: uuid.UUID,
    pagination: PaginationParams,
    *,
    user_id: uuid.UUID | None = None,
) -> tuple[list[Payment], int]:
    base_query = select(Payment).where(Payment.gym_id == gym_id)
    if user_id is not None:
        base_query = base_query.where(Payment.user_id == user_id)

    count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = count_result.scalar_one()

    result = await db.execute(
        base_query.order_by(Payment.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    return list(result.scalars().all()), total


async def update_payment_status(
    db: AsyncSession, gym_id: uuid.UUID, payment_id: uuid.UUID, data: PaymentUpdate
) -> Payment:
    payment = await get_payment(db, gym_id, payment_id)
    payment.status = data.status
    await db.flush()
    await db.refresh(payment)
    return payment


async def get_revenue_summary(db: AsyncSession, gym_id: uuid.UUID) -> dict[str, float]:
    result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.gym_id == gym_id, Payment.status == PaymentStatus.COMPLETED
        )
    )
    total_revenue = result.scalar_one()
    return {"total_revenue": float(total_revenue)}
