import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps.pagination import PaginationParams
from app.models.exercise import Exercise
from app.models.user import User
from app.models.workout import WorkoutPlan, WorkoutPlanItem
from app.schemas.workout import WorkoutPlanCreate, WorkoutPlanItemCreate, WorkoutPlanUpdate


class WorkoutPlanNotFoundError(Exception):
    pass


class InvalidWorkoutMemberError(Exception):
    pass


class InvalidWorkoutExerciseError(Exception):
    pass


async def _validate_exercise_ids(
    db: AsyncSession, gym_id: uuid.UUID, exercise_ids: set[uuid.UUID]
) -> None:
    if not exercise_ids:
        return
    result = await db.execute(
        select(Exercise.id).where(
            Exercise.id.in_(exercise_ids),
            (Exercise.gym_id == gym_id) | (Exercise.gym_id.is_(None)),
        )
    )
    found_ids = set(result.scalars().all())
    missing = exercise_ids - found_ids
    if missing:
        raise InvalidWorkoutExerciseError(f"Ejercicios no encontrados: {', '.join(str(m) for m in missing)}")


async def create_workout_plan(
    db: AsyncSession, gym_id: uuid.UUID, created_by_id: uuid.UUID, data: WorkoutPlanCreate
) -> WorkoutPlan:
    member_result = await db.execute(
        select(User).where(User.id == data.user_id, User.gym_id == gym_id)
    )
    if member_result.scalar_one_or_none() is None:
        raise InvalidWorkoutMemberError("Miembro no encontrado en este gimnasio")

    await _validate_exercise_ids(db, gym_id, {item.exercise_id for item in data.items})

    plan = WorkoutPlan(
        gym_id=gym_id,
        user_id=data.user_id,
        created_by_id=created_by_id,
        name=data.name,
        fitness_goal=data.fitness_goal,
        start_date=data.start_date,
        end_date=data.end_date,
        is_active=data.is_active,
        items=[WorkoutPlanItem(**item.model_dump()) for item in data.items],
    )
    db.add(plan)
    await db.flush()
    return await get_workout_plan(db, gym_id, plan.id)


async def get_workout_plan(db: AsyncSession, gym_id: uuid.UUID, plan_id: uuid.UUID) -> WorkoutPlan:
    result = await db.execute(
        select(WorkoutPlan)
        .where(WorkoutPlan.id == plan_id, WorkoutPlan.gym_id == gym_id)
        .options(selectinload(WorkoutPlan.items).selectinload(WorkoutPlanItem.exercise))
    )
    plan = result.scalar_one_or_none()
    if plan is None:
        raise WorkoutPlanNotFoundError("Rutina no encontrada")
    return plan


async def list_workout_plans(
    db: AsyncSession,
    gym_id: uuid.UUID,
    pagination: PaginationParams,
    *,
    user_id: uuid.UUID | None = None,
) -> tuple[list[WorkoutPlan], int]:
    base_query = select(WorkoutPlan).where(WorkoutPlan.gym_id == gym_id)
    if user_id is not None:
        base_query = base_query.where(WorkoutPlan.user_id == user_id)

    count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = count_result.scalar_one()

    result = await db.execute(
        base_query.options(selectinload(WorkoutPlan.items).selectinload(WorkoutPlanItem.exercise))
        .order_by(WorkoutPlan.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    return list(result.scalars().unique().all()), total


async def update_workout_plan(
    db: AsyncSession, gym_id: uuid.UUID, plan_id: uuid.UUID, data: WorkoutPlanUpdate
) -> WorkoutPlan:
    plan = await get_workout_plan(db, gym_id, plan_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)
    await db.flush()
    return await get_workout_plan(db, gym_id, plan_id)


async def replace_workout_plan_items(
    db: AsyncSession, gym_id: uuid.UUID, plan_id: uuid.UUID, items: list[WorkoutPlanItemCreate]
) -> WorkoutPlan:
    plan = await get_workout_plan(db, gym_id, plan_id)
    await _validate_exercise_ids(db, gym_id, {item.exercise_id for item in items})

    plan.items.clear()
    await db.flush()
    plan.items = [WorkoutPlanItem(**item.model_dump()) for item in items]

    await db.flush()
    return await get_workout_plan(db, gym_id, plan_id)


async def delete_workout_plan(db: AsyncSession, gym_id: uuid.UUID, plan_id: uuid.UUID) -> None:
    plan = await get_workout_plan(db, gym_id, plan_id)
    await db.delete(plan)
    await db.flush()
