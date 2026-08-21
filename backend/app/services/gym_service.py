import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.pagination import PaginationParams
from app.models.gym import Gym
from app.schemas.gym import GymCreate, GymUpdate


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
        raise GymSubdomainTakenError(f"Subdomain '{subdomain}' is already taken")


async def create_gym(db: AsyncSession, data: GymCreate) -> Gym:
    await _ensure_subdomain_available(db, data.subdomain)
    gym = Gym(**data.model_dump())
    db.add(gym)
    await db.flush()
    await db.refresh(gym)
    return gym


async def get_gym(db: AsyncSession, gym_id: uuid.UUID) -> Gym:
    result = await db.execute(select(Gym).where(Gym.id == gym_id))
    gym = result.scalar_one_or_none()
    if gym is None:
        raise GymNotFoundError("Gym not found")
    return gym


async def list_gyms(db: AsyncSession, pagination: PaginationParams) -> tuple[list[Gym], int]:
    count_result = await db.execute(select(func.count()).select_from(Gym))
    total = count_result.scalar_one()

    result = await db.execute(
        select(Gym).order_by(Gym.created_at.desc()).offset(pagination.offset).limit(pagination.limit)
    )
    return list(result.scalars().all()), total


async def update_gym(db: AsyncSession, gym_id: uuid.UUID, data: GymUpdate) -> Gym:
    gym = await get_gym(db, gym_id)
    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(gym, field, value)

    await db.flush()
    await db.refresh(gym)
    return gym


async def delete_gym(db: AsyncSession, gym_id: uuid.UUID) -> None:
    gym = await get_gym(db, gym_id)
    await db.delete(gym)
    await db.flush()
