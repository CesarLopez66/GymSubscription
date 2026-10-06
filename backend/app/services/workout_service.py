import uuid
from datetime import date, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps.pagination import PaginationParams, paginate
from app.models.enums import ActivityLevel, DayOfWeek, FitnessGoal
from app.models.evaluation import PhysicalEvaluation
from app.models.exercise import Exercise
from app.models.tracking import WorkoutCompletion
from app.models.user import User
from app.models.workout import WorkoutPlan, WorkoutPlanItem
from app.schemas.workout import WorkoutPlanCreate, WorkoutPlanItemCreate, WorkoutPlanUpdate
from app.services import exercise_service, notification_service
from app.services.db_helpers import deactivate_other_active
from app.services.workout_llm_service import LLMGenerationError, generate_routine_via_llm

# Days-per-week and sets/reps/rest picked by the same criteria the LLM
# prompt itself follows (more sessions for hypertrophy/high activity, fewer
# for rehab/sedentary) — used only when the LLM is unreachable, so a
# physical evaluation never hard-fails just because Ollama is down.
_FALLBACK_DAYS_BY_ACTIVITY: dict[ActivityLevel, list[DayOfWeek]] = {
    ActivityLevel.SEDENTARY: [DayOfWeek.TUESDAY, DayOfWeek.FRIDAY],
    ActivityLevel.LIGHT: [DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY],
    ActivityLevel.MODERATE: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY],
    ActivityLevel.ACTIVE: [
        DayOfWeek.MONDAY,
        DayOfWeek.TUESDAY,
        DayOfWeek.WEDNESDAY,
        DayOfWeek.THURSDAY,
        DayOfWeek.FRIDAY,
    ],
    ActivityLevel.VERY_ACTIVE: [
        DayOfWeek.MONDAY,
        DayOfWeek.TUESDAY,
        DayOfWeek.WEDNESDAY,
        DayOfWeek.THURSDAY,
        DayOfWeek.FRIDAY,
        DayOfWeek.SATURDAY,
    ],
}

_FALLBACK_SETS_REPS_REST_BY_GOAL: dict[FitnessGoal, tuple[int, int, int]] = {
    FitnessGoal.MUSCLE_GAIN: (4, 8, 90),
    FitnessGoal.FAT_LOSS: (3, 15, 45),
    FitnessGoal.MAINTENANCE: (3, 10, 60),
    FitnessGoal.REHAB: (2, 12, 60),
}


def _generate_rule_based_routine(
    evaluation: PhysicalEvaluation, exercises: list[Exercise]
) -> tuple[str, list[dict]]:
    """Deterministic stand-in for generate_routine_via_llm, used only when
    the LLM call fails — round-robins the (already REHAB-filtered) exercise
    catalog across a fixed day split so a physical evaluation always
    produces a usable routine."""
    days = _FALLBACK_DAYS_BY_ACTIVITY[evaluation.activity_level]
    sets, reps, rest = _FALLBACK_SETS_REPS_REST_BY_GOAL[evaluation.fitness_goal]

    items: list[dict] = []
    order = 0
    exercises_per_day = max(1, min(6, len(exercises) // len(days) or 1))
    for day_index, day in enumerate(days):
        day_exercises = [
            exercises[i % len(exercises)]
            for i in range(day_index * exercises_per_day, (day_index + 1) * exercises_per_day)
        ]
        for exercise in day_exercises:
            items.append(
                {
                    "day_of_week": day,
                    "exercise_id": str(exercise.id),
                    "sets": sets,
                    "reps": reps,
                    "rest_seconds": rest,
                    "order": order,
                }
            )
            order += 1

    return "Rutina automática (modo básico)", items


class WorkoutPlanNotFoundError(Exception):
    pass


class InvalidWorkoutMemberError(Exception):
    pass


class InvalidWorkoutExerciseError(Exception):
    pass


class WorkoutItemNotFoundError(Exception):
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

    if data.is_active:
        # The member page (and this UI) only ever shows one "Activa" plan at
        # a time, so leaving older ones flagged active too would make the
        # list look broken/inconsistent with no way to fix it short of a
        # manual PATCH — assigning a new active plan retires the old one.
        await deactivate_other_active(db, WorkoutPlan, gym_id=gym_id, user_id=data.user_id)

    plan = WorkoutPlan(
        gym_id=gym_id,
        user_id=data.user_id,
        branch_id=data.branch_id,
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
    if plan.is_active:
        await notification_service.create_notification(
            db,
            gym_id=gym_id,
            user_id=data.user_id,
            kind="workout_plan_assigned",
            title="Nueva rutina asignada",
            body=f"Tu entrenador te asignó la rutina '{plan.name}'.",
            related_id=plan.id,
        )
    return await get_workout_plan(db, gym_id, plan.id)


async def _get_own_item(
    db: AsyncSession, gym_id: uuid.UUID, user_id: uuid.UUID, item_id: uuid.UUID
) -> WorkoutPlanItem:
    """Confirms `item_id` belongs to a plan owned by `user_id` in `gym_id` —
    the check that keeps the member-self-only completion endpoint from
    marking someone else's (or another gym's) workout item."""
    result = await db.execute(
        select(WorkoutPlanItem)
        .join(WorkoutPlan, WorkoutPlan.id == WorkoutPlanItem.workout_plan_id)
        .where(
            WorkoutPlanItem.id == item_id,
            WorkoutPlan.gym_id == gym_id,
            WorkoutPlan.user_id == user_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise WorkoutItemNotFoundError("Ejercicio no encontrado en tu rutina")
    return item


async def set_item_completion(
    db: AsyncSession,
    gym_id: uuid.UUID,
    user_id: uuid.UUID,
    item_id: uuid.UUID,
    target_date: date,
    completed: bool,
) -> None:
    await _get_own_item(db, gym_id, user_id, item_id)

    if completed:
        stmt = (
            pg_insert(WorkoutCompletion)
            .values(
                gym_id=gym_id, user_id=user_id, workout_plan_item_id=item_id, completed_date=target_date
            )
            .on_conflict_do_nothing(
                index_elements=["user_id", "workout_plan_item_id", "completed_date"]
            )
        )
        await db.execute(stmt)
    else:
        await db.execute(
            delete(WorkoutCompletion).where(
                WorkoutCompletion.user_id == user_id,
                WorkoutCompletion.workout_plan_item_id == item_id,
                WorkoutCompletion.completed_date == target_date,
            )
        )
    await db.flush()


async def list_completed_item_ids(
    db: AsyncSession, gym_id: uuid.UUID, user_id: uuid.UUID, target_date: date
) -> list[uuid.UUID]:
    result = await db.execute(
        select(WorkoutCompletion.workout_plan_item_id).where(
            WorkoutCompletion.gym_id == gym_id,
            WorkoutCompletion.user_id == user_id,
            WorkoutCompletion.completed_date == target_date,
        )
    )
    return list(result.scalars().all())


async def get_adherence_last_n_days(
    db: AsyncSession, gym_id: uuid.UUID, user_id: uuid.UUID, days: int
) -> dict[str, int]:
    """Used by the trainer's client view: how many distinct days in the last
    `days` days the member logged at least one completed item — the
    visibility a trainer never had while this lived only in the member's own
    browser localStorage."""
    since = date.today() - timedelta(days=days - 1)
    result = await db.execute(
        select(func.count(func.distinct(WorkoutCompletion.completed_date))).where(
            WorkoutCompletion.gym_id == gym_id,
            WorkoutCompletion.user_id == user_id,
            WorkoutCompletion.completed_date >= since,
        )
    )
    active_days = result.scalar_one()
    return {"active_days": active_days, "period_days": days}


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
    branch_id: uuid.UUID | None = None,
) -> tuple[list[WorkoutPlan], int]:
    base_query = select(WorkoutPlan).where(WorkoutPlan.gym_id == gym_id)
    if user_id is not None:
        base_query = base_query.where(WorkoutPlan.user_id == user_id)
    if branch_id is not None:
        base_query = base_query.where(WorkoutPlan.branch_id == branch_id)

    base_query = base_query.options(
        selectinload(WorkoutPlan.items).selectinload(WorkoutPlanItem.exercise)
    )
    return await paginate(
        db,
        base_query,
        WorkoutPlan.created_at.desc(),
        WorkoutPlan.id,
        pagination=pagination,
        unique=True,
    )


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


async def _get_latest_workout_plan(
    db: AsyncSession, gym_id: uuid.UUID, user_id: uuid.UUID
) -> WorkoutPlan | None:
    result = await db.execute(
        select(WorkoutPlan)
        .where(WorkoutPlan.gym_id == gym_id, WorkoutPlan.user_id == user_id)
        .options(selectinload(WorkoutPlan.items))
        .order_by(WorkoutPlan.created_at.desc(), WorkoutPlan.id.desc())
        .limit(1)
    )
    return result.scalars().first()


async def generate_workout_plan_from_evaluation(
    db: AsyncSession,
    gym_id: uuid.UUID,
    created_by_id: uuid.UUID,
    evaluation: PhysicalEvaluation,
) -> WorkoutPlan:
    """Builds (or progresses) a WorkoutPlan from a physical evaluation by
    asking an LLM (workout_llm_service) to pick the routine. If the LLM is
    unreachable or returns something unusable, falls back to a deterministic
    rule-based routine (_generate_rule_based_routine) instead of failing the
    whole evaluation — the trainer still gets a routine to review/adjust.
    """
    all_exercises, _ = await exercise_service.list_exercises(
        db, gym_id, PaginationParams(page=1, page_size=200)
    )
    previous_plan = await _get_latest_workout_plan(db, gym_id, evaluation.user_id)

    try:
        routine_name, items = await generate_routine_via_llm(
            evaluation=evaluation, exercises=all_exercises, previous_plan=previous_plan
        )
    except LLMGenerationError:
        usable_exercises = (
            [e for e in all_exercises if e.equipment != "Barbell"]
            if evaluation.fitness_goal == FitnessGoal.REHAB
            else all_exercises
        )
        if not usable_exercises:
            raise
        routine_name, items = _generate_rule_based_routine(evaluation, usable_exercises)

    await deactivate_other_active(db, WorkoutPlan, gym_id=gym_id, user_id=evaluation.user_id)

    plan = WorkoutPlan(
        gym_id=gym_id,
        user_id=evaluation.user_id,
        branch_id=evaluation.branch_id,
        created_by_id=created_by_id,
        name=routine_name,
        fitness_goal=evaluation.fitness_goal,
        start_date=date.today(),
        is_active=True,
        items=[
            WorkoutPlanItem(
                exercise_id=uuid.UUID(item["exercise_id"]),
                day_of_week=item["day_of_week"],
                sets=item["sets"],
                reps=item["reps"],
                rest_seconds=item["rest_seconds"],
                order=item["order"],
            )
            for item in items
        ],
    )
    db.add(plan)
    await db.flush()
    await notification_service.create_notification(
        db,
        gym_id=gym_id,
        user_id=evaluation.user_id,
        kind="workout_plan_assigned",
        title="Nueva rutina asignada",
        body=f"Tu entrenador te asignó la rutina '{plan.name}'.",
        related_id=plan.id,
    )
    return await get_workout_plan(db, gym_id, plan.id)
