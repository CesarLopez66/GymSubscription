import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps.auth import get_current_active_user, get_tenant_gym_id, require_role
from app.deps.pagination import PaginationParams, pagination_params
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.common import Page
from app.schemas.nutrition import (
    NutritionLogRead,
    NutritionLogUpsert,
    NutritionPlanCreate,
    NutritionPlanGenerateRequest,
    NutritionPlanGenerateResponse,
    NutritionPlanRead,
    NutritionPlanUpdate,
    WorkoutTemplateRecommendationRead,
)
from app.services import nutrition_plan_service
from app.services.nutrition_plan_service import (
    InvalidNutritionMemberError,
    MissingSexError,
    NutritionPlanNotFoundError,
)

router = APIRouter(prefix="/nutrition", tags=["nutrition"])

# The prescriptive health core is shared coaching territory: trainers and
# nutritionists both work with it, with gym admins retaining oversight.
require_nutritionist = require_role([UserRole.NUTRITIONIST, UserRole.TRAINER, UserRole.GYM_ADMIN])
require_member = require_role([UserRole.MEMBER])


@router.post(
    "/generate", response_model=NutritionPlanGenerateResponse, status_code=status.HTTP_201_CREATED
)
async def generate_nutrition_plan(
    payload: NutritionPlanGenerateRequest,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(require_nutritionist),
) -> NutritionPlanGenerateResponse:
    try:
        plan, workout_template = await nutrition_plan_service.generate_and_create_nutrition_plan(
            db, gym_id, current_user.id, payload
        )
    except InvalidNutritionMemberError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except MissingSexError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return NutritionPlanGenerateResponse(
        **NutritionPlanRead.model_validate(plan).model_dump(),
        recommended_workout_template=WorkoutTemplateRecommendationRead(
            name=workout_template.name,
            sessions_per_week=workout_template.sessions_per_week,
            focus_areas=workout_template.focus_areas,
            description=workout_template.description,
        ),
    )


@router.post("", response_model=NutritionPlanRead, status_code=status.HTTP_201_CREATED)
async def create_nutrition_plan(
    payload: NutritionPlanCreate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(require_nutritionist),
) -> NutritionPlanRead:
    try:
        plan = await nutrition_plan_service.create_nutrition_plan(
            db, gym_id, current_user.id, payload
        )
    except InvalidNutritionMemberError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return NutritionPlanRead.model_validate(plan)


@router.get("", response_model=Page[NutritionPlanRead])
async def list_nutrition_plans(
    user_id: uuid.UUID | None = None,
    branch_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    pagination: PaginationParams = Depends(pagination_params),
    current_user: User = Depends(get_current_active_user),
) -> Page[NutritionPlanRead]:
    if UserRole.MEMBER in current_user.roles:
        user_id = current_user.id
    elif set(current_user.roles).isdisjoint(
        {UserRole.GYM_ADMIN, UserRole.TRAINER, UserRole.NUTRITIONIST}
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    plans, total = await nutrition_plan_service.list_nutrition_plans(
        db, gym_id, pagination, user_id=user_id, branch_id=branch_id
    )
    return Page.create(
        items=[NutritionPlanRead.model_validate(p) for p in plans],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.put("/log", response_model=NutritionLogRead)
async def upsert_log(
    payload: NutritionLogUpsert,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(require_member),
) -> NutritionLogRead:
    log = await nutrition_plan_service.upsert_nutrition_log(
        db,
        gym_id,
        current_user.id,
        payload.log_date,
        payload.protein_g,
        payload.carbs_g,
        payload.fats_g,
    )
    return NutritionLogRead.model_validate(log)


@router.get("/log", response_model=NutritionLogRead | None)
async def get_log(
    target_date: date | None = None,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(require_member),
) -> NutritionLogRead | None:
    log = await nutrition_plan_service.get_nutrition_log(
        db, gym_id, current_user.id, target_date or date.today()
    )
    return NutritionLogRead.model_validate(log) if log else None


@router.get("/{plan_id}", response_model=NutritionPlanRead)
async def get_nutrition_plan(
    plan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(get_current_active_user),
) -> NutritionPlanRead:
    try:
        plan = await nutrition_plan_service.get_nutrition_plan(db, gym_id, plan_id)
    except NutritionPlanNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    if UserRole.MEMBER in current_user.roles and plan.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    return NutritionPlanRead.model_validate(plan)


@router.patch("/{plan_id}", response_model=NutritionPlanRead)
async def update_nutrition_plan(
    plan_id: uuid.UUID,
    payload: NutritionPlanUpdate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_nutritionist),
) -> NutritionPlanRead:
    try:
        plan = await nutrition_plan_service.update_nutrition_plan(db, gym_id, plan_id, payload)
    except NutritionPlanNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return NutritionPlanRead.model_validate(plan)


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_nutrition_plan(
    plan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_nutritionist),
) -> None:
    try:
        await nutrition_plan_service.delete_nutrition_plan(db, gym_id, plan_id)
    except NutritionPlanNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
