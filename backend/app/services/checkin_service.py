import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.redis_client import redis_client
from app.deps.pagination import PaginationParams
from app.models.checkin import CheckIn
from app.models.enums import SubscriptionStatus
from app.models.subscription import MemberSubscription
from app.models.user import User


class CheckInError(Exception):
    pass


def _access_cache_key(gym_id: uuid.UUID, user_id: uuid.UUID) -> str:
    return f"checkin:access:{gym_id}:{user_id}"


async def invalidate_checkin_cache(gym_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Call whenever a member's subscription or active status changes, so a
    stale GRANTED/DENIED verdict can't outlive the change that caused it."""
    await redis_client.delete(_access_cache_key(gym_id, user_id))


async def _resolve_access(db: AsyncSession, *, gym_id: uuid.UUID, user_id: uuid.UUID) -> User:
    """Raises CheckInError if the member doesn't exist; otherwise returns the
    user row (still needed by the caller to persist the CheckIn audit row)."""
    user_result = await db.execute(select(User).where(User.id == user_id, User.gym_id == gym_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise CheckInError("Miembro no encontrado en este gimnasio")
    return user


async def _compute_access(db: AsyncSession, *, gym_id: uuid.UUID, user: User) -> tuple[bool, str | None]:
    if not user.is_active:
        return False, "La cuenta del miembro está inactiva"

    today = date.today()
    subscription_result = await db.execute(
        select(MemberSubscription)
        .where(
            MemberSubscription.gym_id == gym_id,
            MemberSubscription.user_id == user.id,
            MemberSubscription.status == SubscriptionStatus.ACTIVE,
            MemberSubscription.start_date <= today,
            MemberSubscription.end_date >= today,
        )
        .order_by(MemberSubscription.end_date.desc())
    )
    active_subscription = subscription_result.scalars().first()

    if active_subscription is None:
        return False, "No tiene una suscripción activa"
    return True, None


async def perform_check_in(db: AsyncSession, *, gym_id: uuid.UUID, user_id: uuid.UUID) -> CheckIn:
    """Verifies access and always writes an audit CheckIn row. The GRANTED/DENIED
    verdict itself is cached in Redis (short TTL) so repeat scans at the door
    stay well under 200ms without re-querying subscriptions every time."""
    user = await _resolve_access(db, gym_id=gym_id, user_id=user_id)

    cache_key = _access_cache_key(gym_id, user_id)
    cached = await redis_client.hgetall(cache_key)

    if cached:
        access_granted = cached["access_granted"] == "1"
        denial_reason = cached["denial_reason"] or None
    else:
        access_granted, denial_reason = await _compute_access(db, gym_id=gym_id, user=user)
        await redis_client.hset(
            cache_key,
            mapping={"access_granted": "1" if access_granted else "0", "denial_reason": denial_reason or ""},
        )
        await redis_client.expire(cache_key, settings.CHECKIN_CACHE_TTL_SECONDS)

    check_in = CheckIn(
        gym_id=gym_id,
        user_id=user_id,
        access_granted=access_granted,
        denial_reason=denial_reason,
    )
    db.add(check_in)
    await db.flush()
    await db.refresh(check_in)
    return check_in


async def list_check_ins(
    db: AsyncSession,
    gym_id: uuid.UUID,
    pagination: PaginationParams,
    *,
    user_id: uuid.UUID | None = None,
) -> tuple[list[CheckIn], int]:
    base_query = select(CheckIn).where(CheckIn.gym_id == gym_id)
    if user_id is not None:
        base_query = base_query.where(CheckIn.user_id == user_id)

    count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = count_result.scalar_one()

    result = await db.execute(
        base_query.order_by(CheckIn.timestamp.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    return list(result.scalars().all()), total
