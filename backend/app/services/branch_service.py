import secrets
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.pagination import PaginationParams, paginate
from app.models.branch import Branch
from app.schemas.branch import BranchCreate, BranchUpdate


class BranchNotFoundError(Exception):
    pass


class BranchNameTakenError(Exception):
    pass


async def _ensure_name_available(
    db: AsyncSession, gym_id: uuid.UUID, name: str, *, exclude_branch_id: uuid.UUID | None = None
) -> None:
    query = select(Branch).where(Branch.gym_id == gym_id, Branch.name == name)
    if exclude_branch_id is not None:
        query = query.where(Branch.id != exclude_branch_id)
    result = await db.execute(query)
    if result.scalar_one_or_none() is not None:
        raise BranchNameTakenError(f"Ya existe una sucursal llamada '{name}'")


async def create_branch(db: AsyncSession, gym_id: uuid.UUID, data: BranchCreate) -> Branch:
    await _ensure_name_available(db, gym_id, data.name)
    branch = Branch(gym_id=gym_id, **data.model_dump())
    db.add(branch)
    await db.flush()
    await db.refresh(branch)
    return branch


async def get_branch(db: AsyncSession, gym_id: uuid.UUID, branch_id: uuid.UUID) -> Branch:
    result = await db.execute(select(Branch).where(Branch.id == branch_id, Branch.gym_id == gym_id))
    branch = result.scalar_one_or_none()
    if branch is None:
        raise BranchNotFoundError("Sucursal no encontrada")
    return branch


async def get_branch_by_checkin_token(db: AsyncSession, token: str) -> Branch | None:
    result = await db.execute(select(Branch).where(Branch.checkin_qr_token == token))
    return result.scalar_one_or_none()


async def list_branches(
    db: AsyncSession, gym_id: uuid.UUID, pagination: PaginationParams
) -> tuple[list[Branch], int]:
    base_query = select(Branch).where(Branch.gym_id == gym_id)

    return await paginate(db, base_query, Branch.name, pagination=pagination)


async def update_branch(
    db: AsyncSession, gym_id: uuid.UUID, branch_id: uuid.UUID, data: BranchUpdate
) -> Branch:
    branch = await get_branch(db, gym_id, branch_id)
    update_data = data.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] != branch.name:
        await _ensure_name_available(db, gym_id, update_data["name"], exclude_branch_id=branch_id)
    for field, value in update_data.items():
        setattr(branch, field, value)
    await db.flush()
    await db.refresh(branch)
    return branch


async def delete_branch(db: AsyncSession, gym_id: uuid.UUID, branch_id: uuid.UUID) -> None:
    branch = await get_branch(db, gym_id, branch_id)
    await db.delete(branch)
    await db.flush()


async def regenerate_checkin_qr_token(db: AsyncSession, gym_id: uuid.UUID, branch_id: uuid.UUID) -> Branch:
    branch = await get_branch(db, gym_id, branch_id)
    branch.checkin_qr_token = secrets.token_urlsafe(32)
    await db.flush()
    await db.refresh(branch)
    return branch
