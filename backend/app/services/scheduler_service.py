"""Background periodic job, run in-process (see main.py's lifespan) on a
plain asyncio loop — no Celery/APScheduler: the app has no other background
worker, and one more container isn't worth it for a job that runs hourly.

Does two things every gym has needed since day one and never had:
1. Flips subscriptions past their end_date to EXPIRED (previously nothing
   ever set that status — see SubscriptionStatus.EXPIRED's docstring history
   in the original weakness analysis) and invalidates their check-in cache.
2. Warns members (and gym admins) a subscription is about to expire, via an
   in-app Notification, a few days before it actually happens instead of the
   member finding out at the door.
"""

import logging
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, set_rls_context
from app.models.enums import SubscriptionStatus, UserRole
from app.models.subscription import MemberSubscription
from app.models.user import User
from app.services import notification_service
from app.services.checkin_service import invalidate_checkin_cache

logger = logging.getLogger(__name__)

# Days-before-expiry at which a reminder fires. Each is its own dedup bucket
# so a member gets warned once at 3 days out and once again at 1 day out,
# never twice for the same bucket no matter how often the loop runs.
_REMINDER_BUCKETS = (3, 1, 0)


async def _expire_stale_subscriptions(db: AsyncSession) -> list[MemberSubscription]:
    today = date.today()
    result = await db.execute(
        select(MemberSubscription).where(
            MemberSubscription.status.in_([SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING]),
            MemberSubscription.end_date < today,
        )
    )
    expired = list(result.scalars().all())
    for sub in expired:
        sub.status = SubscriptionStatus.EXPIRED
        await invalidate_checkin_cache(sub.gym_id, sub.user_id)
    if expired:
        await db.flush()
    return expired


async def _notify_expiring_soon(db: AsyncSession) -> int:
    today = date.today()
    max_bucket = max(_REMINDER_BUCKETS)
    result = await db.execute(
        select(MemberSubscription).where(
            MemberSubscription.status == SubscriptionStatus.ACTIVE,
            MemberSubscription.end_date >= today,
            MemberSubscription.end_date <= today + timedelta(days=max_bucket),
        )
    )
    subscriptions = list(result.scalars().all())

    created = 0
    for sub in subscriptions:
        days_left = (sub.end_date - today).days
        if days_left not in _REMINDER_BUCKETS:
            continue

        member_result = await db.execute(select(User).where(User.id == sub.user_id))
        member = member_result.scalar_one_or_none()
        if member is None:
            continue

        when = "hoy" if days_left == 0 else f"en {days_left} día(s)"
        member_notification = await notification_service.create_notification(
            db,
            gym_id=sub.gym_id,
            user_id=sub.user_id,
            kind="subscription_expiring",
            title="Tu membresía está por vencer",
            body=f"Tu membresía vence {when} ({sub.end_date.isoformat()}). Renueva para no perder tu acceso.",
            related_id=sub.id,
            dedup_key=f"sub-expiring-member:{sub.id}:{days_left}d",
        )
        if member_notification is not None:
            created += 1

        admins_result = await db.execute(
            select(User).where(User.gym_id == sub.gym_id, User.roles.any(UserRole.GYM_ADMIN))
        )
        for admin in admins_result.scalars().all():
            admin_notification = await notification_service.create_notification(
                db,
                gym_id=sub.gym_id,
                user_id=admin.id,
                kind="subscription_expiring",
                title="Membresía de un miembro por vencer",
                body=f"{member.full_name} vence {when} ({sub.end_date.isoformat()}).",
                related_id=sub.id,
                dedup_key=f"sub-expiring-admin:{sub.id}:{days_left}d:{admin.id}",
            )
            if admin_notification is not None:
                created += 1

    return created


async def run_periodic_tasks(db: AsyncSession) -> None:
    await set_rls_context(db, gym_id=None, is_superadmin=True)
    expired = await _expire_stale_subscriptions(db)
    notified = await _notify_expiring_soon(db)
    if expired or notified:
        logger.info(
            "scheduler_service: expired %d subscription(s), created %d notification(s)",
            len(expired),
            notified,
        )


async def run_periodic_tasks_standalone() -> None:
    """Opens its own session/transaction — used by the background loop in
    main.py, which has no request-scoped session to reuse."""
    async with AsyncSessionLocal() as db, db.begin():
        await run_periodic_tasks(db)
