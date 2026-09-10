import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.deps.pagination import PaginationParams, paginate
from app.models.enums import SAAS_PLAN_MEMBER_LIMITS, UserRole
from app.models.gym import Gym
from app.models.user import User
from app.schemas.user import UserChangePassword, UserCreate, UserUpdate
from app.services.checkin_service import invalidate_checkin_cache


class UserNotFoundError(Exception):
    pass


class EmailAlreadyExistsError(Exception):
    pass


class InvalidPasswordError(Exception):
    pass


class MemberLimitExceededError(Exception):
    pass


async def _ensure_email_available(db: AsyncSession, gym_id: uuid.UUID, email: str) -> None:
    result = await db.execute(
        select(User).where(User.gym_id == gym_id, User.email == email)
    )
    if result.scalar_one_or_none() is not None:
        raise EmailAlreadyExistsError(f"El correo '{email}' ya está registrado en este gimnasio")


async def _ensure_member_limit_not_exceeded(db: AsyncSession, gym_id: uuid.UUID) -> None:
    gym_result = await db.execute(select(Gym).where(Gym.id == gym_id))
    gym = gym_result.scalar_one()
    limit = SAAS_PLAN_MEMBER_LIMITS[gym.plan_tier]
    if limit is None:
        return

    count_result = await db.execute(
        select(func.count()).select_from(User).where(
            User.gym_id == gym_id, User.roles.any(UserRole.MEMBER), User.is_active.is_(True)
        )
    )
    active_members = count_result.scalar_one()
    if active_members >= limit:
        raise MemberLimitExceededError(
            f"El plan '{gym.plan_tier.value}' de este gimnasio permite un máximo de {limit} miembros activos"
        )


async def create_user(db: AsyncSession, gym_id: uuid.UUID, data: UserCreate) -> User:
    await _ensure_email_available(db, gym_id, data.email)
    if UserRole.MEMBER in data.roles:
        await _ensure_member_limit_not_exceeded(db, gym_id)

    user = User(
        gym_id=gym_id,
        branch_id=data.branch_id,
        email=data.email,
        password_hash=hash_password(data.password),
        roles=data.roles,
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        date_of_birth=data.date_of_birth,
        sex=data.sex,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def get_user(db: AsyncSession, gym_id: uuid.UUID, user_id: uuid.UUID) -> User:
    result = await db.execute(
        select(User).where(User.id == user_id, User.gym_id == gym_id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise UserNotFoundError("Usuario no encontrado")
    return user


async def list_users(
    db: AsyncSession,
    gym_id: uuid.UUID,
    pagination: PaginationParams,
    *,
    role: UserRole | None = None,
    branch_id: uuid.UUID | None = None,
) -> tuple[list[User], int]:
    base_query = select(User).where(User.gym_id == gym_id)
    if role is not None:
        base_query = base_query.where(User.roles.any(role))
    if branch_id is not None:
        base_query = base_query.where(User.branch_id == branch_id)

    return await paginate(db, base_query, User.created_at.desc(), User.id, pagination=pagination)


async def update_user(db: AsyncSession, gym_id: uuid.UUID, user_id: uuid.UUID, data: UserUpdate) -> User:
    user = await get_user(db, gym_id, user_id)
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    await db.flush()
    await db.refresh(user)
    if "is_active" in update_data:
        await invalidate_checkin_cache(gym_id, user_id)
    return user


async def change_password(
    db: AsyncSession, gym_id: uuid.UUID, user_id: uuid.UUID, data: UserChangePassword
) -> User:
    user = await get_user(db, gym_id, user_id)
    if not verify_password(data.current_password, user.password_hash):
        raise InvalidPasswordError("La contraseña actual es incorrecta")
    user.password_hash = hash_password(data.new_password)
    user.token_version += 1
    await db.flush()
    await db.refresh(user)
    return user


async def deactivate_user(db: AsyncSession, gym_id: uuid.UUID, user_id: uuid.UUID) -> User:
    user = await get_user(db, gym_id, user_id)
    user.is_active = False
    await db.flush()
    await db.refresh(user)
    await invalidate_checkin_cache(gym_id, user_id)
    return user
