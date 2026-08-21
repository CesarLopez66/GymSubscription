import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.pagination import PaginationParams
from app.models.evaluation import PhysicalEvaluation
from app.models.user import User
from app.schemas.evaluation import EvaluationCreate, EvaluationUpdate


class EvaluationNotFoundError(Exception):
    pass


class InvalidEvaluationMemberError(Exception):
    pass


async def create_evaluation(
    db: AsyncSession, gym_id: uuid.UUID, evaluated_by_id: uuid.UUID, data: EvaluationCreate
) -> PhysicalEvaluation:
    member_result = await db.execute(
        select(User).where(User.id == data.user_id, User.gym_id == gym_id)
    )
    if member_result.scalar_one_or_none() is None:
        raise InvalidEvaluationMemberError("Miembro no encontrado en este gimnasio")

    evaluation = PhysicalEvaluation(
        gym_id=gym_id,
        evaluated_by_id=evaluated_by_id,
        **data.model_dump(),
    )
    db.add(evaluation)
    await db.flush()
    await db.refresh(evaluation)
    return evaluation


async def get_evaluation(
    db: AsyncSession, gym_id: uuid.UUID, evaluation_id: uuid.UUID
) -> PhysicalEvaluation:
    result = await db.execute(
        select(PhysicalEvaluation).where(
            PhysicalEvaluation.id == evaluation_id, PhysicalEvaluation.gym_id == gym_id
        )
    )
    evaluation = result.scalar_one_or_none()
    if evaluation is None:
        raise EvaluationNotFoundError("Evaluación física no encontrada")
    return evaluation


async def list_evaluations(
    db: AsyncSession,
    gym_id: uuid.UUID,
    pagination: PaginationParams,
    *,
    user_id: uuid.UUID | None = None,
) -> tuple[list[PhysicalEvaluation], int]:
    base_query = select(PhysicalEvaluation).where(PhysicalEvaluation.gym_id == gym_id)
    if user_id is not None:
        base_query = base_query.where(PhysicalEvaluation.user_id == user_id)

    count_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = count_result.scalar_one()

    result = await db.execute(
        base_query.order_by(PhysicalEvaluation.evaluated_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    return list(result.scalars().all()), total


async def update_evaluation(
    db: AsyncSession, gym_id: uuid.UUID, evaluation_id: uuid.UUID, data: EvaluationUpdate
) -> PhysicalEvaluation:
    evaluation = await get_evaluation(db, gym_id, evaluation_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(evaluation, field, value)
    await db.flush()
    await db.refresh(evaluation)
    return evaluation


async def delete_evaluation(db: AsyncSession, gym_id: uuid.UUID, evaluation_id: uuid.UUID) -> None:
    evaluation = await get_evaluation(db, gym_id, evaluation_id)
    await db.delete(evaluation)
    await db.flush()
