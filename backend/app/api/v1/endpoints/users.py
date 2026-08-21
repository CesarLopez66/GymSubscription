import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps.auth import get_current_active_user, get_tenant_gym_id, require_role
from app.deps.pagination import PaginationParams, pagination_params
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import TokenPair
from app.schemas.common import Page
from app.schemas.user import UserChangePassword, UserCreate, UserRead, UserUpdate
from app.services import user_service
from app.services.auth_service import issue_token_pair
from app.services.user_service import (
    EmailAlreadyExistsError,
    InvalidPasswordError,
    MemberLimitExceededError,
    UserNotFoundError,
)

router = APIRouter(prefix="/users", tags=["users"])

require_gym_admin = require_role([UserRole.GYM_ADMIN])
STAFF_MANAGED_ROLES = {UserRole.GYM_ADMIN, UserRole.TRAINER, UserRole.NUTRITIONIST, UserRole.MEMBER}


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_gym_admin),
) -> UserRead:
    if payload.role not in STAFF_MANAGED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Rol inválido para un usuario del gimnasio"
        )
    try:
        user = await user_service.create_user(db, gym_id, payload)
    except EmailAlreadyExistsError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except MemberLimitExceededError as exc:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=str(exc)) from exc
    return UserRead.model_validate(user)


@router.get("", response_model=Page[UserRead])
async def list_users(
    role: UserRole | None = None,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    pagination: PaginationParams = Depends(pagination_params),
    _: User = Depends(require_role([UserRole.GYM_ADMIN, UserRole.TRAINER, UserRole.NUTRITIONIST])),
) -> Page[UserRead]:
    users, total = await user_service.list_users(db, gym_id, pagination, role=role)
    return Page.create(
        items=[UserRead.model_validate(u) for u in users],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(get_current_active_user),
) -> UserRead:
    if current_user.role == UserRole.MEMBER and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    try:
        user = await user_service.get_user(db, gym_id, user_id)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return UserRead.model_validate(user)


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(get_current_active_user),
) -> UserRead:
    if current_user.role not in {UserRole.GYM_ADMIN} and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    if current_user.role != UserRole.GYM_ADMIN and payload.is_active is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Solo un administrador de gimnasio puede cambiar el estado de la cuenta"
        )
    try:
        user = await user_service.update_user(db, gym_id, user_id, payload)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return UserRead.model_validate(user)


@router.post("/{user_id}/change-password", response_model=TokenPair)
async def change_password(
    user_id: uuid.UUID,
    payload: UserChangePassword,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(get_current_active_user),
) -> TokenPair:
    if current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    try:
        user = await user_service.change_password(db, gym_id, user_id, payload)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidPasswordError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    # token_version was bumped, so the caller's current access token is about
    # to become invalid — hand back a fresh pair issued under the new version.
    return issue_token_pair(user)


@router.delete("/{user_id}", response_model=UserRead)
async def deactivate_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_gym_admin),
) -> UserRead:
    try:
        user = await user_service.deactivate_user(db, gym_id, user_id)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return UserRead.model_validate(user)
