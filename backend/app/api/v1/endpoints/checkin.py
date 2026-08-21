import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.deps.auth import get_current_active_user, get_tenant_gym_id, require_role
from app.deps.pagination import PaginationParams, pagination_params
from app.deps.rate_limit import rate_limit
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.checkin import CheckInCreate, CheckInRead
from app.schemas.common import Page
from app.services import checkin_service
from app.services.checkin_service import CheckInError

router = APIRouter(prefix="/check-in", tags=["check-in"])

_checkin_rate_limit = rate_limit("checkin", settings.RATE_LIMIT_CHECKIN)


async def _verify_check_in(
    payload: CheckInCreate,
    db: AsyncSession,
    gym_id: uuid.UUID,
    current_user: User,
) -> CheckInRead:
    target_user_id = payload.user_id
    if current_user.role == UserRole.MEMBER and target_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    if current_user.role not in {UserRole.MEMBER, UserRole.GYM_ADMIN, UserRole.TRAINER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    try:
        result = await checkin_service.perform_check_in(db, gym_id=gym_id, user_id=target_user_id)
    except CheckInError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return CheckInRead.model_validate(result)


@router.post(
    "/verify",
    response_model=CheckInRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_checkin_rate_limit)],
)
async def verify_check_in(
    payload: CheckInCreate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(get_current_active_user),
) -> CheckInRead:
    """High-speed access verification for the gym entrance: checks the Redis-cached
    subscription status and returns GRANTED/DENIED, while still recording an
    audit CheckIn row."""
    return await _verify_check_in(payload, db, gym_id, current_user)


@router.post(
    "/scan",
    response_model=CheckInRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_checkin_rate_limit)],
)
async def scan_check_in(
    payload: CheckInCreate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(get_current_active_user),
) -> CheckInRead:
    """Alias for /verify — named for the QR-scanner front-desk device flow."""
    return await _verify_check_in(payload, db, gym_id, current_user)


@router.get("", response_model=Page[CheckInRead])
async def list_check_ins(
    user_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    pagination: PaginationParams = Depends(pagination_params),
    current_user: User = Depends(get_current_active_user),
) -> Page[CheckInRead]:
    if current_user.role == UserRole.MEMBER:
        user_id = current_user.id
    elif current_user.role not in {UserRole.GYM_ADMIN, UserRole.TRAINER}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    check_ins, total = await checkin_service.list_check_ins(db, gym_id, pagination, user_id=user_id)

    return Page.create(
        items=[CheckInRead.model_validate(c) for c in check_ins],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
