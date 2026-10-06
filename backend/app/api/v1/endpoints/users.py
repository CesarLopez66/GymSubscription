import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps.auth import (
    get_current_active_user,
    get_effective_branch_id,
    get_tenant_gym_id,
    require_role,
)
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

# Who may assign which role to a new/existing user. GYM_ADMIN can assign
# anything; BRANCH_MANAGER can only staff their own branch with
# trainers/nutritionists/members — never mint another manager or an admin.
ROLE_ASSIGNABLE_BY: dict[UserRole, set[UserRole]] = {
    UserRole.GYM_ADMIN: {UserRole.GYM_ADMIN},
    UserRole.BRANCH_MANAGER: {UserRole.GYM_ADMIN},
    UserRole.TRAINER: {UserRole.GYM_ADMIN, UserRole.BRANCH_MANAGER},
    UserRole.NUTRITIONIST: {UserRole.GYM_ADMIN, UserRole.BRANCH_MANAGER},
    UserRole.MEMBER: {UserRole.GYM_ADMIN, UserRole.BRANCH_MANAGER},
}
# Roles a branch-scoped actor can never touch on another account (deactivate,
# edit, etc.) — a peer manager or the gym's own admin.
_PROTECTED_FROM_SCOPED_ACTORS = {UserRole.GYM_ADMIN, UserRole.BRANCH_MANAGER}
# Roles that require a branch assignment to be usable at all.
_BRANCH_REQUIRING_ROLES = {UserRole.BRANCH_MANAGER, UserRole.TRAINER, UserRole.NUTRITIONIST}


def _validate_roles(roles: list[UserRole], actor_roles: set[UserRole]) -> None:
    if not set(roles) <= ROLE_ASSIGNABLE_BY.keys():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Rol inválido para un usuario del gimnasio"
        )
    for role in roles:
        if actor_roles.isdisjoint(ROLE_ASSIGNABLE_BY[role]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No tienes permiso para asignar el rol '{role.value}'",
            )
    # MEMBER never mixes with a staff role: a client doesn't become "staff"
    # by this feature, and staff (admin/manager/trainer/nutritionist) can
    # combine freely among themselves but never with MEMBER.
    if UserRole.MEMBER in roles and len(roles) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El rol de miembro no se puede combinar con roles de personal",
        )


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    effective_branch: uuid.UUID | None = Depends(get_effective_branch_id),
    current_user: User = Depends(require_role([UserRole.GYM_ADMIN, UserRole.BRANCH_MANAGER])),
) -> UserRead:
    _validate_roles(payload.roles, set(current_user.roles))
    if effective_branch is not None:
        # A branch manager can only ever place new staff/members in their
        # own branch — whatever branch_id they sent is ignored.
        payload = payload.model_copy(update={"branch_id": effective_branch})
    elif set(payload.roles) & _BRANCH_REQUIRING_ROLES and payload.branch_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este rol requiere una sucursal asignada",
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
    branch_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    effective_branch: uuid.UUID | None = Depends(get_effective_branch_id),
    pagination: PaginationParams = Depends(pagination_params),
    _: User = Depends(
        require_role(
            [UserRole.GYM_ADMIN, UserRole.BRANCH_MANAGER, UserRole.TRAINER, UserRole.NUTRITIONIST]
        )
    ),
) -> Page[UserRead]:
    effective = effective_branch if effective_branch is not None else branch_id
    users, total = await user_service.list_users(db, gym_id, pagination, role=role, branch_id=effective)
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
    effective_branch: uuid.UUID | None = Depends(get_effective_branch_id),
    current_user: User = Depends(get_current_active_user),
) -> UserRead:
    if UserRole.MEMBER in current_user.roles and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    try:
        user = await user_service.get_user(db, gym_id, user_id)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if (
        effective_branch is not None
        and user.id != current_user.id
        and user.branch_id != effective_branch
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return UserRead.model_validate(user)


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    effective_branch: uuid.UUID | None = Depends(get_effective_branch_id),
    current_user: User = Depends(get_current_active_user),
) -> UserRead:
    actor_roles = set(current_user.roles)
    can_manage_staff = not actor_roles.isdisjoint({UserRole.GYM_ADMIN, UserRole.BRANCH_MANAGER})
    if not can_manage_staff and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    if not can_manage_staff and payload.is_active is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un administrador de gimnasio o encargado de sucursal puede cambiar el estado de la cuenta",
        )
    if not can_manage_staff and payload.roles is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un administrador de gimnasio o encargado de sucursal puede cambiar los roles de una cuenta",
        )
    # Reassigning someone's branch is an org-level decision — stays admin-only
    # even for a branch manager who can otherwise edit their own staff.
    if UserRole.GYM_ADMIN not in actor_roles and payload.branch_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un administrador de gimnasio puede reasignar la sucursal de una cuenta",
        )
    if payload.roles is not None:
        _validate_roles(payload.roles, actor_roles)
    if payload.is_active is False and current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes desactivar tu propia cuenta",
        )

    if effective_branch is not None and user_id != current_user.id:
        try:
            target = await user_service.get_user(db, gym_id, user_id)
        except UserNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        if target.branch_id != effective_branch:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
        if not set(target.roles).isdisjoint(_PROTECTED_FROM_SCOPED_ACTORS):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No autorizado")

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
    effective_branch: uuid.UUID | None = Depends(get_effective_branch_id),
    current_user: User = Depends(require_role([UserRole.GYM_ADMIN, UserRole.BRANCH_MANAGER])),
) -> UserRead:
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes desactivar tu propia cuenta",
        )
    try:
        target = await user_service.get_user(db, gym_id, user_id)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if effective_branch is not None:
        if target.branch_id != effective_branch:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
        if not set(target.roles).isdisjoint(_PROTECTED_FROM_SCOPED_ACTORS):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No autorizado")
    try:
        user = await user_service.deactivate_user(db, gym_id, user_id)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return UserRead.model_validate(user)
