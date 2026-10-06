import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.deps.auth import get_current_active_user, get_effective_branch_id, get_tenant_gym_id, require_role
from app.deps.branch_scope import ensure_user_in_branch
from app.deps.pagination import PaginationParams, pagination_params
from app.deps.rate_limit import rate_limit
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.checkin import CheckInCreate, CheckInRead, SelfCheckInCreate
from app.schemas.common import Page
from app.services import branch_service, checkin_service, gym_service
from app.services.checkin_service import CheckInError

router = APIRouter(prefix="/check-in", tags=["check-in"])

_checkin_rate_limit = rate_limit("checkin", settings.RATE_LIMIT_CHECKIN)


async def _verify_check_in(
    payload: CheckInCreate,
    db: AsyncSession,
    gym_id: uuid.UUID,
    current_user: User,
    effective_branch: uuid.UUID | None,
) -> CheckInRead:
    target_user_id = payload.user_id
    if UserRole.MEMBER in current_user.roles and target_user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    if set(current_user.roles).isdisjoint(
        {UserRole.MEMBER, UserRole.GYM_ADMIN, UserRole.BRANCH_MANAGER, UserRole.TRAINER}
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    # A branch-scoped operator always checks members in at their own branch —
    # whatever branch_id the payload carries is ignored in favor of it.
    branch_id = effective_branch if effective_branch is not None else payload.branch_id

    if branch_id is not None:
        # get_branch already scopes by gym_id, so a branch belonging to
        # another tenant surfaces as "not found" rather than leaking which
        # gyms exist.
        try:
            await branch_service.get_branch(db, gym_id, branch_id)
        except branch_service.BranchNotFoundError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if effective_branch is not None:
        await ensure_user_in_branch(db, gym_id, target_user_id, effective_branch)

    try:
        result = await checkin_service.perform_check_in(
            db, gym_id=gym_id, user_id=target_user_id, branch_id=branch_id
        )
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
    effective_branch: uuid.UUID | None = Depends(get_effective_branch_id),
    current_user: User = Depends(get_current_active_user),
) -> CheckInRead:
    """High-speed access verification for the gym entrance: checks the Redis-cached
    subscription status and returns GRANTED/DENIED, while still recording an
    audit CheckIn row."""
    return await _verify_check_in(payload, db, gym_id, current_user, effective_branch)


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
    effective_branch: uuid.UUID | None = Depends(get_effective_branch_id),
    current_user: User = Depends(get_current_active_user),
) -> CheckInRead:
    """Alias for /verify — named for the QR-scanner front-desk device flow."""
    return await _verify_check_in(payload, db, gym_id, current_user, effective_branch)


@router.post(
    "/self",
    response_model=CheckInRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_checkin_rate_limit)],
)
async def self_check_in(
    payload: SelfCheckInCreate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(require_role([UserRole.MEMBER])),
) -> CheckInRead:
    """Member-initiated check-in: scanning a fixed QR poster proves physical
    presence, so the member checks themself in instead of a staff member
    scanning the member's own QR at the door. The scanned token may belong
    to a specific branch (checked first, so multi-location gyms attribute
    the visit correctly) or to the gym's own single entrance QR."""
    branch = await branch_service.get_branch_by_checkin_token(db, payload.qr_token)
    branch_id: uuid.UUID | None = None
    if branch is not None:
        if branch.gym_id != gym_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código QR de acceso inválido")
        branch_id = branch.id
    else:
        gym = await gym_service.get_gym_by_checkin_token(db, payload.qr_token)
        if gym is None or gym.id != gym_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código QR de acceso inválido")

    try:
        result = await checkin_service.perform_check_in(
            db, gym_id=gym_id, user_id=current_user.id, branch_id=branch_id
        )
    except CheckInError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return CheckInRead.model_validate(result)


@router.get("", response_model=Page[CheckInRead])
async def list_check_ins(
    user_id: uuid.UUID | None = None,
    branch_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    effective_branch: uuid.UUID | None = Depends(get_effective_branch_id),
    pagination: PaginationParams = Depends(pagination_params),
    current_user: User = Depends(get_current_active_user),
) -> Page[CheckInRead]:
    if UserRole.MEMBER in current_user.roles:
        user_id = current_user.id
    elif set(current_user.roles).isdisjoint(
        {UserRole.GYM_ADMIN, UserRole.BRANCH_MANAGER, UserRole.TRAINER}
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    effective = effective_branch if effective_branch is not None else branch_id
    check_ins, total = await checkin_service.list_check_ins(
        db, gym_id, pagination, user_id=user_id, branch_id=effective
    )

    return Page.create(
        items=[CheckInRead.model_validate(c) for c in check_ins],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )
