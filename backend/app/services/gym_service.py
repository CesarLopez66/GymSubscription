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

# GymCreate never sets `status` — every gym made through POST /gyms starts on
# TRIAL (the column default) — so this always applies at creation.
TRIAL_PERIOD_DAYS = 30


class GymNotFoundError(Exception):
    pass


class GymSubdomainTakenError(Exception):
    pass


async def _ensure_subdomain_available(
    db: AsyncSession, subdomain: str, *, exclude_gym_id: uuid.UUID | None = None
) -> None:
    query = select(Gym).where(Gym.subdomain == subdomain)
    if exclude_gym_id is not None:
        query = query.where(Gym.id != exclude_gym_id)
    result = await db.execute(query)
    if result.scalar_one_or_none() is not None:
        raise GymSubdomainTakenError(f"El subdominio '{subdomain}' ya está en uso")


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
    result = await db.execute(select(Gym).where(Gym.id == gym_id))
    gym = result.scalar_one_or_none()
    if gym is None:
        raise GymNotFoundError("Gimnasio no encontrado")
    return gym


async def list_public_gyms(db: AsyncSession) -> list[Gym]:
    """Every non-cancelled gym's name + subdomain, for the unauthenticated
    login screen's "pick your gym" selector (see GymPublicRead — only those
    two fields ever leave this function's result)."""
    result = await db.execute(
        select(Gym).where(Gym.status != GymStatus.CANCELLED).order_by(Gym.name)
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


async def _log_gym_action(
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
        await _log_gym_action(
            db, gym_id, actor_id, f"status_changed:{gym.status.value}->{update_data['status'].value}", None
        )
        # Moving off TRIAL retires the expiry date — it's meaningless once
        # the gym is active/suspended/cancelled, and would otherwise read as
        # a stale "trial expired" flag if the gym ever moved back to TRIAL.
        if update_data["status"] != GymStatus.TRIAL:
            gym.trial_ends_at = None
    if "plan_tier" in update_data and update_data["plan_tier"] != gym.plan_tier:
        await _log_gym_action(
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


async def suspend_gym(db: AsyncSession, gym_id: uuid.UUID, actor_id: uuid.UUID, reason: str) -> Gym:
    gym = await get_gym(db, gym_id)
    gym.status = GymStatus.SUSPENDED
    await _log_gym_action(db, gym_id, actor_id, "suspended", reason)
    await db.flush()
    await db.refresh(gym)
    return gym


async def reactivate_gym(db: AsyncSession, gym_id: uuid.UUID, actor_id: uuid.UUID) -> Gym:
    gym = await get_gym(db, gym_id)
    gym.status = GymStatus.ACTIVE
    await _log_gym_action(db, gym_id, actor_id, "reactivated", None)
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
    await db.delete(gym)
    await db.flush()
