import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps.auth import get_current_active_user, get_tenant_gym_id, require_role
from app.deps.pagination import PaginationParams, pagination_params
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.common import Page
from app.schemas.workout import (
    WorkoutPlanCreate,
    WorkoutPlanItemCreate,
    WorkoutPlanRead,
    WorkoutPlanUpdate,
)
from app.services import workout_service
from app.services.workout_service import (
    InvalidWorkoutExerciseError,
    InvalidWorkoutMemberError,
    WorkoutPlanNotFoundError,
)

router = APIRouter(prefix="/workouts", tags=["workouts"])

require_trainer = require_role([UserRole.TRAINER, UserRole.GYM_ADMIN])


@router.post("/assign", response_model=WorkoutPlanRead, status_code=status.HTTP_201_CREATED)
async def create_workout_plan(
    payload: WorkoutPlanCreate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(require_trainer),
) -> WorkoutPlanRead:
    try:
        plan = await workout_service.create_workout_plan(db, gym_id, current_user.id, payload)
    except InvalidWorkoutMemberError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except InvalidWorkoutExerciseError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return WorkoutPlanRead.model_validate(plan)


@router.get("", response_model=Page[WorkoutPlanRead])
async def list_workout_plans(
    user_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    pagination: PaginationParams = Depends(pagination_params),
    current_user: User = Depends(get_current_active_user),
) -> Page[WorkoutPlanRead]:
    if current_user.role == UserRole.MEMBER:
        user_id = current_user.id
    elif current_user.role not in {UserRole.GYM_ADMIN, UserRole.TRAINER, UserRole.NUTRITIONIST}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    plans, total = await workout_service.list_workout_plans(db, gym_id, pagination, user_id=user_id)
    return Page.create(
        items=[WorkoutPlanRead.model_validate(p) for p in plans],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{plan_id}", response_model=WorkoutPlanRead)
async def get_workout_plan(
    plan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(get_current_active_user),
) -> WorkoutPlanRead:
    try:
        plan = await workout_service.get_workout_plan(db, gym_id, plan_id)
    except WorkoutPlanNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    if current_user.role == UserRole.MEMBER and plan.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    return WorkoutPlanRead.model_validate(plan)


@router.patch("/{plan_id}", response_model=WorkoutPlanRead)
async def update_workout_plan(
    plan_id: uuid.UUID,
    payload: WorkoutPlanUpdate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_trainer),
) -> WorkoutPlanRead:
    try:
        plan = await workout_service.update_workout_plan(db, gym_id, plan_id, payload)
    except WorkoutPlanNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return WorkoutPlanRead.model_validate(plan)


@router.put("/{plan_id}/items", response_model=WorkoutPlanRead)
async def replace_workout_plan_items(
    plan_id: uuid.UUID,
    items: list[WorkoutPlanItemCreate],
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_trainer),
) -> WorkoutPlanRead:
    try:
        plan = await workout_service.replace_workout_plan_items(db, gym_id, plan_id, items)
    except WorkoutPlanNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidWorkoutExerciseError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return WorkoutPlanRead.model_validate(plan)


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workout_plan(
    plan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_trainer),
) -> None:
    try:
        await workout_service.delete_workout_plan(db, gym_id, plan_id)
    except WorkoutPlanNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
