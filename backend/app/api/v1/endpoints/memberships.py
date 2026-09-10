import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps.auth import get_tenant_gym_id, require_role
from app.deps.pagination import PaginationParams, pagination_params
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.common import Page
from app.schemas.membership import MembershipCreate, MembershipRead, MembershipUpdate
from app.services import membership_service
from app.services.membership_service import MembershipInUseError, MembershipNotFoundError

router = APIRouter(prefix="/memberships", tags=["memberships"])

require_gym_admin = require_role([UserRole.GYM_ADMIN])
read_roles = require_role(
    [UserRole.GYM_ADMIN, UserRole.TRAINER, UserRole.NUTRITIONIST, UserRole.MEMBER]
)


@router.post("", response_model=MembershipRead, status_code=status.HTTP_201_CREATED)
async def create_membership(
    payload: MembershipCreate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_gym_admin),
) -> MembershipRead:
    membership = await membership_service.create_membership(db, gym_id, payload)
    return MembershipRead.model_validate(membership)


@router.get("", response_model=Page[MembershipRead])
async def list_memberships(
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    pagination: PaginationParams = Depends(pagination_params),
    _: User = Depends(read_roles),
) -> Page[MembershipRead]:
    memberships, total = await membership_service.list_memberships(db, gym_id, pagination)
    return Page.create(
        items=[MembershipRead.model_validate(m) for m in memberships],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{membership_id}", response_model=MembershipRead)
async def get_membership(
    membership_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(read_roles),
) -> MembershipRead:
    try:
        membership = await membership_service.get_membership(db, gym_id, membership_id)
    except MembershipNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return MembershipRead.model_validate(membership)


@router.patch("/{membership_id}", response_model=MembershipRead)
async def update_membership(
    membership_id: uuid.UUID,
    payload: MembershipUpdate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_gym_admin),
) -> MembershipRead:
    try:
        membership = await membership_service.update_membership(db, gym_id, membership_id, payload)
    except MembershipNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return MembershipRead.model_validate(membership)


@router.delete("/{membership_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_membership(
    membership_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_gym_admin),
) -> None:
    try:
        await membership_service.delete_membership(db, gym_id, membership_id)
    except MembershipNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except MembershipInUseError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
