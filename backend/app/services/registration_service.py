from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_rls_context
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.gym import GymCreate
from app.schemas.registration import GymRegistrationRequest
from app.schemas.user import UserCreate
from app.services import gym_service, user_service


async def register_gym(db: AsyncSession, data: GymRegistrationRequest) -> User:
    """Public self-service signup: creates the gym (starts on FREE/TRIAL,
    same as any superadmin-created gym — see gym_service.create_gym) and its
    first GYM_ADMIN together, so the founder can log in immediately instead
    of waiting on a superadmin to hand-create both. Upgrading past FREE is a
    separate, later step (gym_subscription_service) that the superadmin does
    review, once there's an actual payment to review."""
    # This request has no authenticated user (it's public, pre-account) —
    # every other write path gets its RLS context from the caller's JWT
    # (app/deps/auth.py's get_current_active_user); here there is none, so
    # it's set directly, the same one legitimate bypass create_superadmin.py
    # uses to insert the very first row for a tenant that doesn't exist yet.
    await set_rls_context(db, gym_id=None, is_superadmin=True)
    gym = await gym_service.create_gym(
        db,
        GymCreate(
            name=data.gym_name,
            subdomain=data.subdomain,
            contact_email=data.admin_email,
            contact_phone=data.contact_phone,
            address=data.address,
        ),
    )
    admin = await user_service.create_user(
        db,
        gym.id,
        UserCreate(
            email=data.admin_email,
            first_name=data.admin_first_name,
            last_name=data.admin_last_name,
            password=data.admin_password,
            roles=[UserRole.GYM_ADMIN],
        ),
    )
    return admin
