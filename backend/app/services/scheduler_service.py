"""Background periodic job, run in-process (see main.py's lifespan) on a
plain asyncio loop — no Celery/APScheduler: the app has no other background
worker, and one more container isn't worth it for a job that runs hourly.

Does four things every gym has needed since day one and never had:
1. Flips subscriptions past their end_date to EXPIRED (previously nothing
   ever set that status — see SubscriptionStatus.EXPIRED's docstring history
   in the original weakness analysis) and invalidates their check-in cache.
2. Warns members (and gym admins) a subscription is about to expire, via an
   in-app Notification, a few days before it actually happens instead of the
   member finding out at the door.
3. Warns a gym's own admin(s) a few days before ITS trial period runs out —
   same reasoning as #2, one level up.
4. Auto-suspends a gym still on TRIAL once trial_ends_at has passed — it
   never converted to a paid, superadmin-approved plan in that window (see
   gym_service.TRIAL_PERIOD_DAYS). Blocking is real (see deps.auth /
   auth_service): every user of that gym is locked out of login and the API
   until a superadmin reactivates it.
"""

import logging
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, set_rls_context
from app.models.enums import GymStatus, SubscriptionStatus, UserRole
from app.models.gym import Gym
from app.models.subscription import MemberSubscription
from app.models.user import User
from app.services import gym_service, notification_service
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


async def _notify_trial_expiring_soon(db: AsyncSession) -> int:
    today = date.today()
    max_bucket = max(_REMINDER_BUCKETS)
    result = await db.execute(
        select(Gym).where(
            Gym.status == GymStatus.TRIAL,
            Gym.trial_ends_at.is_not(None),
            Gym.trial_ends_at >= today,
            Gym.trial_ends_at <= today + timedelta(days=max_bucket),
        )
    )
    gyms = list(result.scalars().all())

    created = 0
    for gym in gyms:
        days_left = (gym.trial_ends_at - today).days
        if days_left not in _REMINDER_BUCKETS:
            continue

        when = "hoy" if days_left == 0 else f"en {days_left} día(s)"
        body = (
            f"Tu periodo de prueba termina {when} ({gym.trial_ends_at.isoformat()}). "
            "Activa un plan pagado para no perder el acceso."
        )
        admins_result = await db.execute(
            select(User).where(User.gym_id == gym.id, User.roles.any(UserRole.GYM_ADMIN))
        )
        for admin in admins_result.scalars().all():
            notification = await notification_service.create_notification(
                db,
                gym_id=gym.id,
                user_id=admin.id,
                kind="gym_trial_expiring",
                title="Tu periodo de prueba está por vencer",
                body=body,
                related_id=gym.id,
                dedup_key=f"gym-trial-expiring:{gym.id}:{days_left}d:{admin.id}",
            )
            if notification is not None:
                created += 1

    return created


async def _suspend_expired_trials(db: AsyncSession) -> list[Gym]:
    today = date.today()
    result = await db.execute(
        select(Gym).where(
            Gym.status == GymStatus.TRIAL,
            Gym.trial_ends_at.is_not(None),
            Gym.trial_ends_at < today,
        )
    )
    gyms = list(result.scalars().all())

    for gym in gyms:
        await gym_service.suspend_gym(
            db,
            gym.id,
            actor_id=None,
            reason=(
                f"Periodo de prueba de {gym_service.TRIAL_PERIOD_DAYS} días vencido "
                "sin un plan pagado aprobado (bloqueo automático)."
            ),
        )
        admins_result = await db.execute(
            select(User).where(User.gym_id == gym.id, User.roles.any(UserRole.GYM_ADMIN))
        )
        for admin in admins_result.scalars().all():
            await notification_service.create_notification(
                db,
                gym_id=gym.id,
                user_id=admin.id,
                kind="gym_trial_expired",
                title="Tu cuenta fue suspendida",
                body=(
                    "Tu periodo de prueba venció sin activar un plan pagado. "
                    "Contacta al soporte de la plataforma para reactivar tu cuenta."
                ),
                related_id=gym.id,
                dedup_key=f"gym-trial-expired:{gym.id}:{admin.id}",
            )

    return gyms


async def run_periodic_tasks(db: AsyncSession) -> None:
    await set_rls_context(db, gym_id=None, is_superadmin=True)
    expired = await _expire_stale_subscriptions(db)
    notified = await _notify_expiring_soon(db)
    trial_notified = await _notify_trial_expiring_soon(db)
    suspended_gyms = await _suspend_expired_trials(db)
    if expired or notified or trial_notified or suspended_gyms:
        logger.info(
            "scheduler_service: expired %d subscription(s), created %d notification(s), "
            "warned %d gym(s) about trial expiry, auto-suspended %d gym(s)",
            len(expired),
            notified,
            trial_notified,
            len(suspended_gyms),
        )


async def run_periodic_tasks_standalone() -> None:
    """Opens its own session/transaction — used by the background loop in
    main.py, which has no request-scoped session to reuse."""
    async with AsyncSessionLocal() as db, db.begin():
        await run_periodic_tasks(db)
