import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps.auth import get_current_active_user, get_tenant_gym_id, require_role
from app.deps.pagination import PaginationParams, pagination_params
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.common import Page
from app.schemas.evaluation import (
    EvaluationCreate,
    EvaluationCreateResponse,
    EvaluationRead,
    EvaluationUpdate,
)
from app.schemas.nutrition import NutritionPlanGenerateRequest, NutritionPlanRead
from app.schemas.workout import WorkoutPlanRead
from app.services import evaluation_service, nutrition_plan_service, workout_service
from app.services.evaluation_service import EvaluationNotFoundError, InvalidEvaluationMemberError
from app.services.nutrition_plan_service import InvalidNutritionMemberError, MissingSexError
from app.services.workout_llm_service import LLMGenerationError

router = APIRouter(prefix="/evaluations", tags=["evaluations"])

# Nutritionists need body-composition data (weight, body fat %) to prescribe
# accurate macros, so they share write access with trainers here.
require_trainer = require_role([UserRole.TRAINER, UserRole.NUTRITIONIST, UserRole.GYM_ADMIN])


@router.post("", response_model=EvaluationCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_evaluation(
    payload: EvaluationCreate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(require_trainer),
) -> EvaluationCreateResponse:
    try:
        evaluation = await evaluation_service.create_evaluation(
            db, gym_id, current_user.id, payload
        )
    except InvalidEvaluationMemberError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    # Auto-generates (or progresses, if the member already had one) a
    # workout routine from this evaluation, via the LLM with a deterministic
    # rule-based fallback when it's unreachable (see
    # workout_service.generate_workout_plan_from_evaluation) — so this only
    # raises when even the fallback has nothing to work with (empty catalog).
    # Same request transaction as the evaluation insert above, so a failure
    # here rolls back the evaluation too instead of leaving it without a routine.
    try:
        workout_plan = await workout_service.generate_workout_plan_from_evaluation(
            db, gym_id, current_user.id, evaluation
        )
    except LLMGenerationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    # Same idea for the nutrition plan — the evaluation already carries
    # everything the BMR/macro formulas need except age, which
    # EvaluationCreate now requires for exactly this purpose.
    try:
        nutrition_request = NutritionPlanGenerateRequest(
            user_id=evaluation.user_id,
            branch_id=evaluation.branch_id,
            weight_kg=float(evaluation.weight_kg),
            height_cm=float(evaluation.height_cm),
            age=evaluation.age,
            activity_level=evaluation.activity_level,
            fitness_goal=evaluation.fitness_goal,
            body_fat_percentage=(
                float(evaluation.body_fat_percentage)
                if evaluation.body_fat_percentage is not None
                else None
            ),
            notes=evaluation.notes,
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    try:
        nutrition_plan, _ = await nutrition_plan_service.generate_and_create_nutrition_plan(
            db, gym_id, current_user.id, nutrition_request
        )
    except MissingSexError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except InvalidNutritionMemberError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return EvaluationCreateResponse(
        **EvaluationRead.model_validate(evaluation).model_dump(),
        generated_workout_plan=WorkoutPlanRead.model_validate(workout_plan),
        generated_nutrition_plan=NutritionPlanRead.model_validate(nutrition_plan),
    )


@router.get("", response_model=Page[EvaluationRead])
async def list_evaluations(
    user_id: uuid.UUID | None = None,
    branch_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    pagination: PaginationParams = Depends(pagination_params),
    current_user: User = Depends(get_current_active_user),
) -> Page[EvaluationRead]:
    if UserRole.MEMBER in current_user.roles:
        user_id = current_user.id
    elif set(current_user.roles).isdisjoint(
        {UserRole.GYM_ADMIN, UserRole.TRAINER, UserRole.NUTRITIONIST}
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    evaluations, total = await evaluation_service.list_evaluations(
        db, gym_id, pagination, user_id=user_id, branch_id=branch_id
    )
    return Page.create(
        items=[EvaluationRead.model_validate(e) for e in evaluations],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{evaluation_id}", response_model=EvaluationRead)
async def get_evaluation(
    evaluation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(get_current_active_user),
) -> EvaluationRead:
    try:
        evaluation = await evaluation_service.get_evaluation(db, gym_id, evaluation_id)
    except EvaluationNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    if UserRole.MEMBER in current_user.roles and evaluation.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    return EvaluationRead.model_validate(evaluation)


@router.patch("/{evaluation_id}", response_model=EvaluationRead)
async def update_evaluation(
    evaluation_id: uuid.UUID,
    payload: EvaluationUpdate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_trainer),
) -> EvaluationRead:
    try:
        evaluation = await evaluation_service.update_evaluation(db, gym_id, evaluation_id, payload)
    except EvaluationNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return EvaluationRead.model_validate(evaluation)


@router.delete("/{evaluation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_evaluation(
    evaluation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    _: User = Depends(require_trainer),
) -> None:
    try:
        await evaluation_service.delete_evaluation(db, gym_id, evaluation_id)
    except EvaluationNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
