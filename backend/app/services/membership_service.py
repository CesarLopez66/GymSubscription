import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.pagination import PaginationParams
from app.models.membership import Membership
from app.schemas.membership import MembershipCreate, MembershipUpdate


class MembershipNotFoundError(Exception):
    pass


async def create_membership(db: AsyncSession, gym_id: uuid.UUID, data: MembershipCreate) -> Membership:
    membership = Membership(gym_id=gym_id, **data.model_dump())
    db.add(membership)
    await db.flush()
    await db.refresh(membership)
    return membership


async def get_membership(db: AsyncSession, gym_id: uuid.UUID, membership_id: uuid.UUID) -> Membership:
    result = await db.execute(
        select(Membership).where(Membership.id == membership_id, Membership.gym_id == gym_id)
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise MembershipNotFoundError("Plan de membresía no encontrado")
    return membership


async def list_memberships(
    db: AsyncSession, gym_id: uuid.UUID, pagination: PaginationParams
) -> tuple[list[Membership], int]:
    base_query = select(Membership).where(Membership.gym_id == gym_id)

    count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = count_result.scalar_one()

    result = await db.execute(
        base_query.order_by(Membership.created_at.desc(), Membership.id)
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    return list(result.scalars().all()), total


async def update_membership(
    db: AsyncSession, gym_id: uuid.UUID, membership_id: uuid.UUID, data: MembershipUpdate
) -> Membership:
    membership = await get_membership(db, gym_id, membership_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(membership, field, value)
    await db.flush()
    await db.refresh(membership)
    return membership


async def delete_membership(db: AsyncSession, gym_id: uuid.UUID, membership_id: uuid.UUID) -> None:
    membership = await get_membership(db, gym_id, membership_id)
    await db.delete(membership)
    await db.flush()
