import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps.auth import get_current_active_user, get_tenant_gym_id, require_role
from app.deps.pagination import PaginationParams, pagination_params
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.common import Page
from app.schemas.evaluation import EvaluationCreate, EvaluationRead, EvaluationUpdate
from app.services import evaluation_service
from app.services.evaluation_service import EvaluationNotFoundError, InvalidEvaluationMemberError

router = APIRouter(prefix="/evaluations", tags=["evaluations"])

# Nutritionists need body-composition data (weight, body fat %) to prescribe
# accurate macros, so they share write access with trainers here.
require_trainer = require_role([UserRole.TRAINER, UserRole.NUTRITIONIST, UserRole.GYM_ADMIN])


@router.post("", response_model=EvaluationRead, status_code=status.HTTP_201_CREATED)
async def create_evaluation(
    payload: EvaluationCreate,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(require_trainer),
) -> EvaluationRead:
    try:
        evaluation = await evaluation_service.create_evaluation(
            db, gym_id, current_user.id, payload
        )
    except InvalidEvaluationMemberError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return EvaluationRead.model_validate(evaluation)


@router.get("", response_model=Page[EvaluationRead])
async def list_evaluations(
    user_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    pagination: PaginationParams = Depends(pagination_params),
    current_user: User = Depends(get_current_active_user),
) -> Page[EvaluationRead]:
    if current_user.role == UserRole.MEMBER:
        user_id = current_user.id
    elif current_user.role not in {UserRole.GYM_ADMIN, UserRole.TRAINER, UserRole.NUTRITIONIST}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    evaluations, total = await evaluation_service.list_evaluations(
        db, gym_id, pagination, user_id=user_id
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

    if current_user.role == UserRole.MEMBER and evaluation.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

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
