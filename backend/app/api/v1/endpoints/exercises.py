import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps.auth import get_current_active_user
from app.deps.pagination import PaginationParams, pagination_params
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.common import Page
from app.schemas.exercise import ExerciseCreate, ExerciseRead, ExerciseUpdate
from app.services import exercise_service
from app.services.exercise_service import ExerciseNotFoundError

router = APIRouter(prefix="/exercises", tags=["exercises"])

MUTATION_ROLES = {UserRole.SUPERADMIN, UserRole.GYM_ADMIN, UserRole.TRAINER}


def _catalog_scope(current_user: User) -> uuid.UUID | None:
    """SUPERADMIN manages the global catalog (gym_id=None); everyone else is
    scoped to their own gym (which also sees the global catalog for reads)."""
    if current_user.role == UserRole.SUPERADMIN:
        return None
    if current_user.gym_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta acción requiere un usuario asignado a un gimnasio",
        )
    return current_user.gym_id


@router.post("", response_model=ExerciseRead, status_code=status.HTTP_201_CREATED)
async def create_exercise(
    payload: ExerciseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ExerciseRead:
    if current_user.role not in MUTATION_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    gym_id = _catalog_scope(current_user)
    exercise = await exercise_service.create_exercise(db, gym_id, payload)
    return ExerciseRead.model_validate(exercise)


@router.get("", response_model=Page[ExerciseRead])
async def list_exercises(
    db: AsyncSession = Depends(get_db),
    pagination: PaginationParams = Depends(pagination_params),
    current_user: User = Depends(get_current_active_user),
) -> Page[ExerciseRead]:
    gym_id = _catalog_scope(current_user)
    exercises, total = await exercise_service.list_exercises(db, gym_id, pagination)
    return Page.create(
        items=[ExerciseRead.model_validate(e) for e in exercises],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/{exercise_id}", response_model=ExerciseRead)
async def get_exercise(
    exercise_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ExerciseRead:
    gym_id = _catalog_scope(current_user)
    try:
        exercise = await exercise_service.get_exercise(db, gym_id, exercise_id)
    except ExerciseNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return ExerciseRead.model_validate(exercise)


@router.patch("/{exercise_id}", response_model=ExerciseRead)
async def update_exercise(
    exercise_id: uuid.UUID,
    payload: ExerciseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ExerciseRead:
    if current_user.role not in MUTATION_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    gym_id = _catalog_scope(current_user)
    try:
        exercise = await exercise_service.update_exercise(db, gym_id, exercise_id, payload)
    except ExerciseNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return ExerciseRead.model_validate(exercise)


@router.delete("/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exercise(
    exercise_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> None:
    if current_user.role not in MUTATION_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")
    gym_id = _catalog_scope(current_user)
    try:
        await exercise_service.delete_exercise(db, gym_id, exercise_id)
    except ExerciseNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
