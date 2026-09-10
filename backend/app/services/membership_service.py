import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.pagination import PaginationParams, paginate
from app.models.membership import Membership
from app.models.subscription import MemberSubscription
from app.schemas.membership import MembershipCreate, MembershipUpdate


class MembershipNotFoundError(Exception):
    pass


class MembershipInUseError(Exception):
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
    return await paginate(
        db, base_query, Membership.created_at.desc(), Membership.id, pagination=pagination
    )


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

    # Membership.subscriptions cascades on delete, so without this guard
    # deleting a plan silently wipes out every subscription ever sold on it
    # (active ones included), instantly denying paying members at the door.
    count_result = await db.execute(
        select(func.count())
        .select_from(MemberSubscription)
        .where(MemberSubscription.membership_id == membership_id)
    )
    if count_result.scalar_one() > 0:
        raise MembershipInUseError(
            "No se puede eliminar: hay suscripciones asociadas a este plan. Desactívalo en su lugar."
        )

    await db.delete(membership)
    await db.flush()
