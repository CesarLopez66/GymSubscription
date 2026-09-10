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
from app.schemas.workout import (
    WorkoutAdherenceRead,
    WorkoutCompletionSet,
    WorkoutPlanCreate,
    WorkoutPlanItemCreate,
    WorkoutPlanRead,
    WorkoutPlanUpdate,
)
from app.services import workout_service
from app.services.workout_service import (
    InvalidWorkoutExerciseError,
    InvalidWorkoutMemberError,
    WorkoutItemNotFoundError,
    WorkoutPlanNotFoundError,
)

router = APIRouter(prefix="/workouts", tags=["workouts"])

require_trainer = require_role([UserRole.TRAINER, UserRole.GYM_ADMIN])
require_member = require_role([UserRole.MEMBER])
require_coach_or_admin = require_role([UserRole.TRAINER, UserRole.NUTRITIONIST, UserRole.GYM_ADMIN])


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
    branch_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    pagination: PaginationParams = Depends(pagination_params),
    current_user: User = Depends(get_current_active_user),
) -> Page[WorkoutPlanRead]:
    if UserRole.MEMBER in current_user.roles:
        user_id = current_user.id
    elif set(current_user.roles).isdisjoint(
        {UserRole.GYM_ADMIN, UserRole.TRAINER, UserRole.NUTRITIONIST}
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    plans, total = await workout_service.list_workout_plans(
        db, gym_id, pagination, user_id=user_id, branch_id=branch_id
    )
    return Page.create(
        items=[WorkoutPlanRead.model_validate(p) for p in plans],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.put("/items/{item_id}/completion", status_code=status.HTTP_204_NO_CONTENT)
async def set_item_completion(
    item_id: uuid.UUID,
    payload: WorkoutCompletionSet,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(require_member),
) -> None:
    try:
        await workout_service.set_item_completion(
            db, gym_id, current_user.id, item_id, payload.target_date or date.today(), payload.completed
        )
    except WorkoutItemNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/completions", response_model=list[uuid.UUID])
async def list_completions(
    target_date: date | None = None,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(require_member),
) -> list[uuid.UUID]:
    return await workout_service.list_completed_item_ids(
        db, gym_id, current_user.id, target_date or date.today()
    )


@router.get("/adherence/{user_id}", response_model=WorkoutAdherenceRead)
async def get_adherence(
    user_id: uuid.UUID,
    days: int = 7,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_coach_or_admin),
) -> WorkoutAdherenceRead:
    result = await workout_service.get_adherence_last_n_days(db, gym_id, user_id, days)
    return WorkoutAdherenceRead(**result)


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

    if UserRole.MEMBER in current_user.roles and plan.user_id != current_user.id:
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
