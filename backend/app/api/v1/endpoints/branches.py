import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps.auth import get_tenant_gym_id, require_role
from app.deps.pagination import PaginationParams, pagination_params
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.branch import BranchCheckinQrRead, BranchCreate, BranchRead, BranchUpdate
from app.schemas.common import Page
from app.services import branch_service
from app.services.branch_service import BranchNameTakenError, BranchNotFoundError

router = APIRouter(prefix="/branches", tags=["branches"])

require_gym_admin = require_role([UserRole.GYM_ADMIN])
read_roles = require_role(
    [UserRole.GYM_ADMIN, UserRole.TRAINER, UserRole.NUTRITIONIST, UserRole.MEMBER]
)


@router.post("", response_model=BranchRead, status_code=status.HTTP_201_CREATED)
async def create_branch(
    payload: BranchCreate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_gym_admin),
) -> BranchRead:
    try:
        branch = await branch_service.create_branch(db, gym_id, payload)
    except BranchNameTakenError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return BranchRead.model_validate(branch)


@router.get("", response_model=Page[BranchRead])
async def list_branches(
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    pagination: PaginationParams = Depends(pagination_params),
    _: User = Depends(read_roles),
) -> Page[BranchRead]:
    branches, total = await branch_service.list_branches(db, gym_id, pagination)
    return Page.create(
        items=[BranchRead.model_validate(b) for b in branches],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{branch_id}", response_model=BranchRead)
async def get_branch(
    branch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(read_roles),
) -> BranchRead:
    try:
        branch = await branch_service.get_branch(db, gym_id, branch_id)
    except BranchNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return BranchRead.model_validate(branch)


@router.patch("/{branch_id}", response_model=BranchRead)
async def update_branch(
    branch_id: uuid.UUID,
    payload: BranchUpdate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_gym_admin),
) -> BranchRead:
    try:
        branch = await branch_service.update_branch(db, gym_id, branch_id, payload)
    except BranchNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BranchNameTakenError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return BranchRead.model_validate(branch)


@router.delete("/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_branch(
    branch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_gym_admin),
) -> None:
    try:
        await branch_service.delete_branch(db, gym_id, branch_id)
    except BranchNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{branch_id}/checkin-qr", response_model=BranchCheckinQrRead)
async def get_branch_checkin_qr(
    branch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_gym_admin),
) -> BranchCheckinQrRead:
    try:
        branch = await branch_service.get_branch(db, gym_id, branch_id)
    except BranchNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return BranchCheckinQrRead.model_validate(branch)


@router.post("/{branch_id}/checkin-qr/regenerate", response_model=BranchCheckinQrRead)
async def regenerate_branch_checkin_qr(
    branch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_gym_admin),
) -> BranchCheckinQrRead:
    try:
        branch = await branch_service.regenerate_checkin_qr_token(db, gym_id, branch_id)
    except BranchNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return BranchCheckinQrRead.model_validate(branch)
