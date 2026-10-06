import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import user_service
from app.services.user_service import UserNotFoundError


async def ensure_user_in_branch(
    db: AsyncSession,
    gym_id: uuid.UUID,
    user_id: uuid.UUID | None,
    effective_branch: uuid.UUID | None,
) -> None:
    """Guards a create endpoint's target member (the one being paid,
    checked in, evaluated, etc.) against a branch-scoped actor reaching
    into another branch. No-op when the actor is unscoped (effective_branch
    is None) or there's no target member (e.g. a RETAIL payment). Raises
    404 rather than 403 on a mismatch, so a scoped actor can't use this to
    probe which users exist in other branches."""
    if effective_branch is None or user_id is None:
        return
    try:
        target = await user_service.get_user(db, gym_id, user_id)
    except UserNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado") from exc
    if target.branch_id != effective_branch:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
