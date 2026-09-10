import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.pagination import PaginationParams, paginate
from app.models.nutrition import NutritionPlan
from app.models.tracking import NutritionLog
from app.models.user import User
from app.schemas.nutrition import (
    NutritionPlanCreate,
    NutritionPlanGenerateRequest,
    NutritionPlanUpdate,
)
from app.services import notification_service
from app.services.health_engine import WorkoutTemplateRecommendation, generate_health_prescription


class NutritionPlanNotFoundError(Exception):
    pass


class InvalidNutritionMemberError(Exception):
    pass


class MissingSexError(Exception):
    pass


async def _get_member(db: AsyncSession, gym_id: uuid.UUID, user_id: uuid.UUID) -> User:
    result = await db.execute(select(User).where(User.id == user_id, User.gym_id == gym_id))
    member = result.scalar_one_or_none()
    if member is None:
        raise InvalidNutritionMemberError("Miembro no encontrado en este gimnasio")
    return member


async def _deactivate_other_plans(db: AsyncSession, gym_id: uuid.UUID, user_id: uuid.UUID) -> None:
    # Every new nutrition plan is created active (there's no way to create one
    # inactive), and the UI only ever shows one "Activo" plan at a time — so
    # without this, older plans would keep showing as active forever with no
    # way to fix it short of a manual PATCH.
    result = await db.execute(
        select(NutritionPlan).where(
            NutritionPlan.gym_id == gym_id,
            NutritionPlan.user_id == user_id,
            NutritionPlan.is_active.is_(True),
        )
    )
    for plan in result.scalars().all():
        plan.is_active = False


async def generate_and_create_nutrition_plan(
    db: AsyncSession, gym_id: uuid.UUID, created_by_id: uuid.UUID, data: NutritionPlanGenerateRequest
) -> tuple[NutritionPlan, WorkoutTemplateRecommendation]:
    member = await _get_member(db, gym_id, data.user_id)
    if member.sex is None:
        raise MissingSexError("El sexo del miembro debe estar registrado para calcular la TMB")

    prescription = generate_health_prescription(
        weight_kg=data.weight_kg,
        height_cm=data.height_cm,
        age=data.age,
        sex=member.sex,
        activity_level=data.activity_level,
        fitness_goal=data.fitness_goal,
        body_fat_percentage=data.body_fat_percentage,
    )

    await _deactivate_other_plans(db, gym_id, data.user_id)

    plan = NutritionPlan(
        gym_id=gym_id,
        user_id=data.user_id,
        branch_id=data.branch_id,
        created_by_id=created_by_id,
        fitness_goal=data.fitness_goal,
        bmr=prescription.bmr,
        bmr_formula=prescription.bmr_formula,
        tdee=prescription.tdee,
        calories=prescription.calories,
        protein_g=prescription.protein_g,
        carbs_g=prescription.carbs_g,
        fats_g=prescription.fats_g,
        water_ml=prescription.water_ml,
        start_date=data.start_date,
        end_date=data.end_date,
        notes=data.notes,
    )
    db.add(plan)
    await db.flush()
    await db.refresh(plan)
    await notification_service.create_notification(
        db,
        gym_id=gym_id,
        user_id=data.user_id,
        kind="nutrition_plan_assigned",
        title="Nuevo plan de nutrición",
        body="Tu nutricionista te armó un nuevo plan — revisa tus macros.",
        related_id=plan.id,
    )
    return plan, prescription.workout_template


async def create_nutrition_plan(
    db: AsyncSession, gym_id: uuid.UUID, created_by_id: uuid.UUID, data: NutritionPlanCreate
) -> NutritionPlan:
    await _get_member(db, gym_id, data.user_id)
    await _deactivate_other_plans(db, gym_id, data.user_id)

    plan = NutritionPlan(gym_id=gym_id, created_by_id=created_by_id, **data.model_dump())
    db.add(plan)
    await db.flush()
    await db.refresh(plan)
    await notification_service.create_notification(
        db,
        gym_id=gym_id,
        user_id=data.user_id,
        kind="nutrition_plan_assigned",
        title="Nuevo plan de nutrición",
        body="Tu nutricionista te armó un nuevo plan — revisa tus macros.",
        related_id=plan.id,
    )
    return plan


async def get_nutrition_plan(db: AsyncSession, gym_id: uuid.UUID, plan_id: uuid.UUID) -> NutritionPlan:
    result = await db.execute(
        select(NutritionPlan).where(NutritionPlan.id == plan_id, NutritionPlan.gym_id == gym_id)
    )
    plan = result.scalar_one_or_none()
    if plan is None:
        raise NutritionPlanNotFoundError("Plan de nutrición no encontrado")
    return plan


async def list_nutrition_plans(
    db: AsyncSession,
    gym_id: uuid.UUID,
    pagination: PaginationParams,
    *,
    user_id: uuid.UUID | None = None,
    branch_id: uuid.UUID | None = None,
) -> tuple[list[NutritionPlan], int]:
    base_query = select(NutritionPlan).where(NutritionPlan.gym_id == gym_id)
    if user_id is not None:
        base_query = base_query.where(NutritionPlan.user_id == user_id)
    if branch_id is not None:
        base_query = base_query.where(NutritionPlan.branch_id == branch_id)

    return await paginate(
        db, base_query, NutritionPlan.created_at.desc(), NutritionPlan.id, pagination=pagination
    )


async def update_nutrition_plan(
    db: AsyncSession, gym_id: uuid.UUID, plan_id: uuid.UUID, data: NutritionPlanUpdate
) -> NutritionPlan:
    plan = await get_nutrition_plan(db, gym_id, plan_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)
    await db.flush()
    await db.refresh(plan)
    return plan


async def delete_nutrition_plan(db: AsyncSession, gym_id: uuid.UUID, plan_id: uuid.UUID) -> None:
    plan = await get_nutrition_plan(db, gym_id, plan_id)
    await db.delete(plan)
    await db.flush()


async def upsert_nutrition_log(
    db: AsyncSession,
    gym_id: uuid.UUID,
    user_id: uuid.UUID,
    log_date: date,
    protein_g: float,
    carbs_g: float,
    fats_g: float,
) -> NutritionLog:
    """Replaces the member's `localStorage`-only macro tally with a real
    per-day row, upserted on (user_id, log_date) — a member correcting a
    typo just re-submits the same date."""
    stmt = (
        pg_insert(NutritionLog)
        .values(
            gym_id=gym_id,
            user_id=user_id,
            log_date=log_date,
            protein_g=protein_g,
            carbs_g=carbs_g,
            fats_g=fats_g,
        )
        .on_conflict_do_update(
            index_elements=["user_id", "log_date"],
            set_={"protein_g": protein_g, "carbs_g": carbs_g, "fats_g": fats_g},
        )
        .returning(NutritionLog.id)
    )
    result = await db.execute(stmt)
    log_id = result.scalar_one()
    await db.flush()
    fetched = await db.execute(select(NutritionLog).where(NutritionLog.id == log_id))
    return fetched.scalar_one()


async def get_nutrition_log(
    db: AsyncSession, gym_id: uuid.UUID, user_id: uuid.UUID, log_date: date
) -> NutritionLog | None:
    result = await db.execute(
        select(NutritionLog).where(
            NutritionLog.gym_id == gym_id,
            NutritionLog.user_id == user_id,
            NutritionLog.log_date == log_date,
        )
    )
    return result.scalar_one_or_none()
