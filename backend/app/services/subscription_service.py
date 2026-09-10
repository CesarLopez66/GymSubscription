import uuid
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.pagination import PaginationParams, paginate
from app.models.enums import PaymentStatus, PaymentType, SubscriptionStatus
from app.models.payment import Payment
from app.models.subscription import MemberSubscription
from app.models.user import User
from app.schemas.subscription import SubscriptionCreate, SubscriptionUpdate
from app.services import promotion_service
from app.services.checkin_service import invalidate_checkin_cache
from app.services.membership_service import get_membership


class SubscriptionNotFoundError(Exception):
    pass


class InvalidSubscriptionMemberError(Exception):
    pass


class MembershipInactiveError(Exception):
    pass


class PaymentAmountMismatchError(Exception):
    pass


async def _supersede_active_subscriptions(
    db: AsyncSession, gym_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    """Cancels any ACTIVE/PENDING subscription this member already has in
    this gym before a new one is created — covers both a plan switch
    mid-cycle (no proration: the old one just stops, the new one is billed
    in full, same as before) and a renewal (the expiring/expired sub gets
    formally closed instead of two subscriptions silently coexisting)."""
    result = await db.execute(
        select(MemberSubscription).where(
            MemberSubscription.gym_id == gym_id,
            MemberSubscription.user_id == user_id,
            MemberSubscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING]),
        )
    )
    for existing in result.scalars().all():
        existing.status = SubscriptionStatus.CANCELLED


async def create_subscription_row(
    db: AsyncSession,
    gym_id: uuid.UUID,
    user_id: uuid.UUID,
    membership_id: uuid.UUID,
    start_date: date,
    *,
    branch_id: uuid.UUID | None = None,
) -> MemberSubscription:
    """Just the MemberSubscription insert, with no payment attached — shared
    by the admin-recorded flow below (which creates a COMPLETED Payment in
    the same call) and payment_service.approve_payment (which is approving a
    Payment that already exists as a member-submitted claim)."""
    membership = await get_membership(db, gym_id, membership_id)
    if not membership.is_active:
        raise MembershipInactiveError(
            f"El plan '{membership.name}' está desactivado y no admite nuevas suscripciones"
        )

    await _supersede_active_subscriptions(db, gym_id, user_id)

    end_date = start_date + timedelta(days=membership.duration_days)
    status = SubscriptionStatus.ACTIVE if start_date <= date.today() else SubscriptionStatus.PENDING

    subscription = MemberSubscription(
        gym_id=gym_id,
        user_id=user_id,
        membership_id=membership_id,
        branch_id=branch_id,
        start_date=start_date,
        end_date=end_date,
        status=status,
    )
    db.add(subscription)
    await db.flush()
    await db.refresh(subscription)
    await invalidate_checkin_cache(gym_id, user_id)
    return subscription


async def create_subscription(
    db: AsyncSession, gym_id: uuid.UUID, processed_by_id: uuid.UUID, data: SubscriptionCreate
) -> MemberSubscription:
    member_result = await db.execute(
        select(User).where(User.id == data.user_id, User.gym_id == gym_id)
    )
    if member_result.scalar_one_or_none() is None:
        raise InvalidSubscriptionMemberError("Miembro no encontrado en este gimnasio")

    membership = await get_membership(db, gym_id, data.membership_id)
    if not membership.is_active:
        raise MembershipInactiveError(
            f"El plan '{membership.name}' está desactivado y no admite nuevas suscripciones"
        )

    promotion = await promotion_service.get_applicable_promotion(db, gym_id, data.membership_id)
    expected_amount = promotion_service.apply_discount(membership.price, promotion)
    if data.payment_amount != expected_amount:
        raise PaymentAmountMismatchError(
            f"El monto a cobrar debe ser exactamente {expected_amount} "
            f"({'con la promoción aplicada' if promotion else 'precio del plan'})"
        )

    subscription = await create_subscription_row(
        db, gym_id, data.user_id, data.membership_id, data.start_date, branch_id=data.branch_id
    )

    payment = Payment(
        gym_id=gym_id,
        user_id=data.user_id,
        subscription_id=subscription.id,
        branch_id=data.branch_id,
        processed_by_id=processed_by_id,
        payment_type=PaymentType.MEMBERSHIP,
        payment_method=data.payment_method,
        status=PaymentStatus.COMPLETED,
        amount=data.payment_amount,
        description=f"Suscripción a {membership.name}",
    )
    db.add(payment)
    await db.flush()

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
    branch_id: uuid.UUID | None = None,
) -> tuple[list[MemberSubscription], int]:
    base_query = select(MemberSubscription).where(MemberSubscription.gym_id == gym_id)
    if user_id is not None:
        base_query = base_query.where(MemberSubscription.user_id == user_id)
    if branch_id is not None:
        base_query = base_query.where(MemberSubscription.branch_id == branch_id)

    return await paginate(
        db,
        base_query,
        MemberSubscription.created_at.desc(),
        MemberSubscription.id,
        pagination=pagination,
    )


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
