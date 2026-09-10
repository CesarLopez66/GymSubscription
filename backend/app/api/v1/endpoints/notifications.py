import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps.auth import get_current_active_user, get_tenant_gym_id
from app.deps.pagination import PaginationParams, pagination_params
from app.models.user import User
from app.schemas.common import Page
from app.schemas.notification import NotificationRead
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=Page[NotificationRead])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    pagination: PaginationParams = Depends(pagination_params),
    current_user: User = Depends(get_current_active_user),
) -> Page[NotificationRead]:
    items, total = await notification_service.list_my_notifications(
        db, gym_id, current_user.id, pagination
    )
    return Page.create(
        items=[NotificationRead.model_validate(n) for n in items],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, int]:
    count = await notification_service.unread_count(db, gym_id, current_user.id)
    return {"unread": count}


@router.post("/{notification_id}/read", status_code=204)
async def mark_notification_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(get_current_active_user),
) -> None:
    await notification_service.mark_read(db, gym_id, current_user.id, notification_id)


@router.post("/read-all", status_code=204)
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    gym_id: uuid.UUID = Depends(get_tenant_gym_id),
    current_user: User = Depends(get_current_active_user),
) -> None:
    await notification_service.mark_all_read(db, gym_id, current_user.id)
