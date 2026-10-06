import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps.pagination import PaginationParams, paginate
from app.models.evaluation import PhysicalEvaluation
from app.models.user import User
from app.schemas.evaluation import EvaluationCreate, EvaluationUpdate
from app.services import notification_service
from app.services.db_helpers import get_or_404


class EvaluationNotFoundError(Exception):
    pass


class InvalidEvaluationMemberError(Exception):
    pass


async def create_evaluation(
    db: AsyncSession, gym_id: uuid.UUID, evaluated_by_id: uuid.UUID, data: EvaluationCreate
) -> PhysicalEvaluation:
    await get_or_404(
        db,
        User,
        InvalidEvaluationMemberError,
        "Miembro no encontrado en este gimnasio",
        id=data.user_id,
        gym_id=gym_id,
    )

    evaluation = PhysicalEvaluation(
        gym_id=gym_id,
        evaluated_by_id=evaluated_by_id,
        **data.model_dump(),
    )
    db.add(evaluation)
    await db.flush()
    await db.refresh(evaluation)
    await notification_service.create_notification(
        db,
        gym_id=gym_id,
        user_id=data.user_id,
        kind="evaluation_recorded",
        title="Nueva evaluación física",
        body="Tu entrenador registró una nueva evaluación física — revisa tus resultados.",
        related_id=evaluation.id,
    )
    return evaluation


async def get_evaluation(
    db: AsyncSession, gym_id: uuid.UUID, evaluation_id: uuid.UUID
) -> PhysicalEvaluation:
    return await get_or_404(
        db,
        PhysicalEvaluation,
        EvaluationNotFoundError,
        "Evaluación física no encontrada",
        id=evaluation_id,
        gym_id=gym_id,
    )


async def list_evaluations(
    db: AsyncSession,
    gym_id: uuid.UUID,
    pagination: PaginationParams,
    *,
    user_id: uuid.UUID | None = None,
    branch_id: uuid.UUID | None = None,
) -> tuple[list[PhysicalEvaluation], int]:
    base_query = select(PhysicalEvaluation).where(PhysicalEvaluation.gym_id == gym_id)
    if user_id is not None:
        base_query = base_query.where(PhysicalEvaluation.user_id == user_id)
    if branch_id is not None:
        base_query = base_query.where(PhysicalEvaluation.branch_id == branch_id)

    return await paginate(
        db,
        base_query,
        PhysicalEvaluation.evaluated_at.desc(),
        PhysicalEvaluation.id.desc(),
        pagination=pagination,
    )


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
