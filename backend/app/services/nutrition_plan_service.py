import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.pagination import PaginationParams
from app.models.nutrition import NutritionPlan
from app.models.user import User
from app.schemas.nutrition import (
    NutritionPlanCreate,
    NutritionPlanGenerateRequest,
    NutritionPlanUpdate,
)
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

    plan = NutritionPlan(
        gym_id=gym_id,
        user_id=data.user_id,
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
    return plan, prescription.workout_template


async def create_nutrition_plan(
    db: AsyncSession, gym_id: uuid.UUID, created_by_id: uuid.UUID, data: NutritionPlanCreate
) -> NutritionPlan:
    await _get_member(db, gym_id, data.user_id)

    plan = NutritionPlan(gym_id=gym_id, created_by_id=created_by_id, **data.model_dump())
    db.add(plan)
    await db.flush()
    await db.refresh(plan)
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
) -> tuple[list[NutritionPlan], int]:
    base_query = select(NutritionPlan).where(NutritionPlan.gym_id == gym_id)
    if user_id is not None:
        base_query = base_query.where(NutritionPlan.user_id == user_id)

    count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = count_result.scalar_one()

    result = await db.execute(
        base_query.order_by(NutritionPlan.created_at.desc(), NutritionPlan.id)
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    return list(result.scalars().all()), total


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
