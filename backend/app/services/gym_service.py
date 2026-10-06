import secrets
import uuid
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.pagination import PaginationParams, paginate
from app.models.enums import GymStatus
from app.models.gym import Gym
from app.models.gym_audit_log import GymAuditLog
from app.schemas.gym import GymCreate, GymUpdate
from app.services.db_helpers import ensure_unique, get_or_404

# GymCreate never sets `status` — every gym made through POST /gyms starts on
# TRIAL (the column default) — so this always applies at creation. A gym
# that hasn't converted to a paid, superadmin-approved plan by the time this
# elapses gets auto-suspended by scheduler_service._suspend_expired_trials.
TRIAL_PERIOD_DAYS = 14

# A gym in either of these states is blocked from logging in and from using
# any already-issued token (see auth_service/deps.auth) — enforced since
# this feature shipped; before it, SUSPENDED was a label with no real effect.
BLOCKED_GYM_STATUSES = {GymStatus.SUSPENDED, GymStatus.CANCELLED}


class GymNotFoundError(Exception):
    pass


class GymSubdomainTakenError(Exception):
    pass


class GymNotSuspendedError(Exception):
    pass


async def _ensure_subdomain_available(
    db: AsyncSession, subdomain: str, *, exclude_gym_id: uuid.UUID | None = None
) -> None:
    await ensure_unique(
        db,
        Gym,
        GymSubdomainTakenError,
        f"El subdominio '{subdomain}' ya está en uso",
        exclude_id=exclude_gym_id,
        subdomain=subdomain,
    )


async def create_gym(db: AsyncSession, data: GymCreate) -> Gym:
    await _ensure_subdomain_available(db, data.subdomain)
    gym = Gym(
        **data.model_dump(),
        trial_ends_at=date.today() + timedelta(days=TRIAL_PERIOD_DAYS),
    )
    db.add(gym)
    await db.flush()
    await db.refresh(gym)
    return gym


async def get_gym(db: AsyncSession, gym_id: uuid.UUID) -> Gym:
    return await get_or_404(db, Gym, GymNotFoundError, "Gimnasio no encontrado", id=gym_id)


async def list_public_gyms(db: AsyncSession) -> list[Gym]:
    """Every gym that can still actually be logged into (i.e. not blocked —
    see BLOCKED_GYM_STATUSES), for the unauthenticated login screen's "pick
    your gym" selector (see GymPublicRead — only name + subdomain ever leave
    this function's result). A suspended/cancelled gym would otherwise show
    up as a normal, selectable option and only fail once someone actually
    tries to log into it."""
    result = await db.execute(
        select(Gym).where(Gym.status.not_in(BLOCKED_GYM_STATUSES)).order_by(Gym.name)
    )
    return list(result.scalars().all())


async def list_gyms(
    db: AsyncSession,
    pagination: PaginationParams,
    *,
    search: str | None = None,
    status: GymStatus | None = None,
) -> tuple[list[Gym], int]:
    base_query = select(Gym)
    if search:
        like = f"%{search}%"
        base_query = base_query.where(Gym.name.ilike(like) | Gym.subdomain.ilike(like))
    if status is not None:
        base_query = base_query.where(Gym.status == status)

    return await paginate(
        db, base_query, Gym.created_at.desc(), Gym.id, pagination=pagination
    )


async def log_gym_action(
    db: AsyncSession, gym_id: uuid.UUID, actor_id: uuid.UUID | None, action: str, reason: str | None
) -> None:
    db.add(GymAuditLog(gym_id=gym_id, actor_id=actor_id, action=action, reason=reason))
    await db.flush()


async def update_gym(
    db: AsyncSession, gym_id: uuid.UUID, data: GymUpdate, actor_id: uuid.UUID | None = None
) -> Gym:
    gym = await get_gym(db, gym_id)
    update_data = data.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"] != gym.status:
        await log_gym_action(
            db, gym_id, actor_id, f"status_changed:{gym.status.value}->{update_data['status'].value}", None
        )
        # Moving off TRIAL retires the expiry date — it's meaningless once
        # the gym is active/suspended/cancelled, and would otherwise read as
        # a stale "trial expired" flag if the gym ever moved back to TRIAL.
        if update_data["status"] != GymStatus.TRIAL:
            gym.trial_ends_at = None
    if "plan_tier" in update_data and update_data["plan_tier"] != gym.plan_tier:
        await log_gym_action(
            db,
            gym_id,
            actor_id,
            f"plan_changed:{gym.plan_tier.value}->{update_data['plan_tier'].value}",
            None,
        )

    for field, value in update_data.items():
        setattr(gym, field, value)

    await db.flush()
    await db.refresh(gym)
    return gym


async def suspend_gym(
    db: AsyncSession, gym_id: uuid.UUID, actor_id: uuid.UUID | None, reason: str
) -> Gym:
    """`actor_id` is None for the scheduler's own auto-suspend (expired
    trial, never converted to a paid plan) — every other caller is a
    superadmin acting through the API."""
    gym = await get_gym(db, gym_id)
    gym.status = GymStatus.SUSPENDED
    # Meaningless once suspended, and would otherwise read as a stale
    # "trial expires on X" if the gym is later reactivated straight back
    # onto TRIAL — same reasoning as update_gym's own status-change branch.
    gym.trial_ends_at = None
    await log_gym_action(db, gym_id, actor_id, "suspended", reason)
    await db.flush()
    await db.refresh(gym)
    return gym


async def is_gym_blocked(db: AsyncSession, gym_id: uuid.UUID) -> bool:
    """Used at login and on every authenticated request (see auth_service
    and deps.auth) — a gym in BLOCKED_GYM_STATUSES can't be used at all,
    regardless of how valid the caller's credentials/token otherwise are."""
    result = await db.execute(select(Gym.status).where(Gym.id == gym_id))
    status = result.scalar_one_or_none()
    return status in BLOCKED_GYM_STATUSES


async def reactivate_gym(db: AsyncSession, gym_id: uuid.UUID, actor_id: uuid.UUID) -> Gym:
    gym = await get_gym(db, gym_id)
    gym.status = GymStatus.ACTIVE
    await log_gym_action(db, gym_id, actor_id, "reactivated", None)
    await db.flush()
    await db.refresh(gym)
    return gym


async def list_gym_audit_log(
    db: AsyncSession, gym_id: uuid.UUID, pagination: PaginationParams
) -> tuple[list[GymAuditLog], int]:
    base_query = select(GymAuditLog).where(GymAuditLog.gym_id == gym_id)
    return await paginate(
        db, base_query, GymAuditLog.created_at.desc(), GymAuditLog.id, pagination=pagination
    )


async def update_payment_qr(db: AsyncSession, gym_id: uuid.UUID, image: str | None) -> Gym:
    gym = await get_gym(db, gym_id)
    gym.payment_qr_image = image
    await db.flush()
    await db.refresh(gym)
    return gym


async def update_branding(
    db: AsyncSession, gym_id: uuid.UUID, primary_color: str | None, secondary_color: str | None
) -> Gym:
    gym = await get_gym(db, gym_id)
    gym.primary_color = primary_color
    gym.secondary_color = secondary_color
    await db.flush()
    await db.refresh(gym)
    return gym


async def get_gym_by_checkin_token(db: AsyncSession, token: str) -> Gym | None:
    result = await db.execute(select(Gym).where(Gym.checkin_qr_token == token))
    return result.scalar_one_or_none()


async def regenerate_checkin_qr_token(db: AsyncSession, gym_id: uuid.UUID) -> Gym:
    gym = await get_gym(db, gym_id)
    gym.checkin_qr_token = secrets.token_urlsafe(32)
    await db.flush()
    await db.refresh(gym)
    return gym


async def delete_gym(db: AsyncSession, gym_id: uuid.UUID) -> None:
    gym = await get_gym(db, gym_id)
    # Gym.users (and every other tenant table) cascades on delete — this is
    # permanent, irreversible destruction of every user, payment, and
    # subscription the tenant ever had. Requiring SUSPENDED first forces a
    # deliberate two-step action with its own audit trail, instead of a
    # single unguarded call being able to wipe an active paying gym.
    if gym.status != GymStatus.SUSPENDED:
        raise GymNotSuspendedError(
            "Solo se puede eliminar un gimnasio suspendido. Suspéndelo primero."
        )
    await db.delete(gym)
    await db.flush()
