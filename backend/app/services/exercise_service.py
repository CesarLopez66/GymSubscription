import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.pagination import PaginationParams
from app.models.exercise import Exercise
from app.schemas.exercise import ExerciseCreate, ExerciseUpdate


class ExerciseNotFoundError(Exception):
    pass


async def create_exercise(
    db: AsyncSession, gym_id: uuid.UUID | None, data: ExerciseCreate
) -> Exercise:
    """gym_id is None for global exercises (SUPERADMIN only); otherwise scoped to the gym."""
    exercise = Exercise(gym_id=gym_id, **data.model_dump())
    db.add(exercise)
    await db.flush()
    await db.refresh(exercise)
    return exercise


async def get_exercise(
    db: AsyncSession, gym_id: uuid.UUID | None, exercise_id: uuid.UUID
) -> Exercise:
    query = select(Exercise).where(Exercise.id == exercise_id)
    if gym_id is not None:
        query = query.where(or_(Exercise.gym_id == gym_id, Exercise.gym_id.is_(None)))
    result = await db.execute(query)
    exercise = result.scalar_one_or_none()
    if exercise is None:
        raise ExerciseNotFoundError("Ejercicio no encontrado")
    return exercise


async def list_exercises(
    db: AsyncSession, gym_id: uuid.UUID | None, pagination: PaginationParams
) -> tuple[list[Exercise], int]:
    """Returns exercises visible to the tenant: global catalog entries plus the
    gym's own custom exercises. gym_id=None (SUPERADMIN) lists only the global catalog."""
    if gym_id is not None:
        base_query = select(Exercise).where(
            or_(Exercise.gym_id == gym_id, Exercise.gym_id.is_(None))
        )
    else:
        base_query = select(Exercise).where(Exercise.gym_id.is_(None))

    count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = count_result.scalar_one()

    result = await db.execute(
        base_query.order_by(Exercise.name).offset(pagination.offset).limit(pagination.limit)
    )
    return list(result.scalars().all()), total


async def _get_owned_exercise(
    db: AsyncSession, gym_id: uuid.UUID | None, exercise_id: uuid.UUID
) -> Exercise:
    """Like get_exercise, but only returns exercises actually owned by the caller's
    tenant (or the global catalog for SUPERADMIN) — used to gate mutations."""
    result = await db.execute(
        select(Exercise).where(Exercise.id == exercise_id, Exercise.gym_id == gym_id)
    )
    exercise = result.scalar_one_or_none()
    if exercise is None:
        raise ExerciseNotFoundError("Ejercicio no encontrado")
    return exercise


async def update_exercise(
    db: AsyncSession, gym_id: uuid.UUID | None, exercise_id: uuid.UUID, data: ExerciseUpdate
) -> Exercise:
    exercise = await _get_owned_exercise(db, gym_id, exercise_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(exercise, field, value)
    await db.flush()
    await db.refresh(exercise)
    return exercise


async def delete_exercise(db: AsyncSession, gym_id: uuid.UUID | None, exercise_id: uuid.UUID) -> None:
    exercise = await _get_owned_exercise(db, gym_id, exercise_id)
    await db.delete(exercise)
    await db.flush()
