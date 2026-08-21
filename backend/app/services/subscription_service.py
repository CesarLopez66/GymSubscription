import uuid
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.pagination import PaginationParams
from app.models.enums import SubscriptionStatus
from app.models.subscription import MemberSubscription
from app.models.user import User
from app.schemas.subscription import SubscriptionCreate, SubscriptionUpdate
from app.services.checkin_service import invalidate_checkin_cache
from app.services.membership_service import get_membership


class SubscriptionNotFoundError(Exception):
    pass


class InvalidSubscriptionMemberError(Exception):
    pass


async def create_subscription(
    db: AsyncSession, gym_id: uuid.UUID, data: SubscriptionCreate
) -> MemberSubscription:
    member_result = await db.execute(
        select(User).where(User.id == data.user_id, User.gym_id == gym_id)
    )
    if member_result.scalar_one_or_none() is None:
        raise InvalidSubscriptionMemberError("Miembro no encontrado en este gimnasio")

    membership = await get_membership(db, gym_id, data.membership_id)

    end_date = data.start_date + timedelta(days=membership.duration_days)
    status = (
        SubscriptionStatus.ACTIVE if data.start_date <= date.today() else SubscriptionStatus.PENDING
    )

    subscription = MemberSubscription(
        gym_id=gym_id,
        user_id=data.user_id,
        membership_id=data.membership_id,
        start_date=data.start_date,
        end_date=end_date,
        status=status,
    )
    db.add(subscription)
    await db.flush()
    await db.refresh(subscription)
    await invalidate_checkin_cache(gym_id, data.user_id)
    return subscription


async def get_subscription(
    db: AsyncSession, gym_id: uuid.UUID, subscription_id: uuid.UUID
) -> MemberSubscription:
    result = await db.execute(
        select(MemberSubscription).where(
            MemberSubscription.id == subscription_id, MemberSubscription.gym_id == gym_id
        )
    )
    subscription = result.scalar_one_or_none()
    if subscription is None:
        raise SubscriptionNotFoundError("Suscripción no encontrada")
    return subscription


async def list_subscriptions(
    db: AsyncSession,
    gym_id: uuid.UUID,
    pagination: PaginationParams,
    *,
    user_id: uuid.UUID | None = None,
) -> tuple[list[MemberSubscription], int]:
    base_query = select(MemberSubscription).where(MemberSubscription.gym_id == gym_id)
    if user_id is not None:
        base_query = base_query.where(MemberSubscription.user_id == user_id)

    count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = count_result.scalar_one()

    result = await db.execute(
        base_query.order_by(MemberSubscription.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    return list(result.scalars().all()), total


async def update_subscription(
    db: AsyncSession, gym_id: uuid.UUID, subscription_id: uuid.UUID, data: SubscriptionUpdate
) -> MemberSubscription:
    subscription = await get_subscription(db, gym_id, subscription_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(subscription, field, value)
    await db.flush()
    await db.refresh(subscription)
    await invalidate_checkin_cache(gym_id, subscription.user_id)
    return subscription
