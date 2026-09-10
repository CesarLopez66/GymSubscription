import logging
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps.auth import require_role
from app.deps.pagination import PaginationParams, pagination_params
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import ImpersonationResponse
from app.schemas.common import Page
from app.schemas.superadmin import GymDetail, PlatformOverview
from app.schemas.user import UserRead
from app.services import superadmin_service, user_service
from app.services.auth_service import issue_impersonation_access_token
from app.services.superadmin_service import CannotImpersonateError, GymNotFoundError
from app.services.user_service import UserNotFoundError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/superadmin", tags=["superadmin"])

require_superadmin = require_role([UserRole.SUPERADMIN])


@router.get("/overview", response_model=PlatformOverview)
async def get_overview(
    days: int = 30,
    gym_id: uuid.UUID | None = None,
    payments_date: date | None = None,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_superadmin),
) -> PlatformOverview:
    return await superadmin_service.get_platform_overview(
        db, days=days, gym_id=gym_id, payments_date=payments_date
    )


@router.get("/gyms/{gym_id}", response_model=GymDetail)
async def get_gym_detail(
    gym_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_superadmin),
) -> GymDetail:
    try:
        return await superadmin_service.get_gym_detail(db, gym_id)
    except GymNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/gyms/{gym_id}/users", response_model=Page[UserRead])
async def list_gym_users(
    gym_id: uuid.UUID,
    role: UserRole | None = None,
    db: AsyncSession = Depends(get_db),
    pagination: PaginationParams = Depends(pagination_params),
    _: User = Depends(require_superadmin),
) -> Page[UserRead]:
    users, total = await user_service.list_users(db, gym_id, pagination, role=role)
    return Page.create(
        items=[UserRead.model_validate(u) for u in users],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.post("/impersonate/{user_id}", response_model=ImpersonationResponse)
async def impersonate_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superadmin),
) -> ImpersonationResponse:
    try:
        target = await superadmin_service.get_impersonation_target(db, user_id)
    except UserNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except CannotImpersonateError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    logger.info(
        "Superadmin %s started impersonating user %s (roles=%s, gym=%s)",
        current_user.id,
        target.id,
        ",".join(r.value for r in target.roles),
        target.gym_id,
    )
    token = issue_impersonation_access_token(target)
    return ImpersonationResponse(access_token=token, user=UserRead.model_validate(target))
