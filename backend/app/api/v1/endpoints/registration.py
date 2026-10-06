from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.deps.rate_limit import rate_limit
from app.schemas.auth import TokenPair
from app.schemas.registration import GymRegistrationRequest
from app.services.auth_service import issue_token_pair
from app.services.gym_service import GymSubdomainTakenError
from app.services.registration_service import register_gym
from app.services.user_service import EmailAlreadyExistsError

router = APIRouter(prefix="/registration", tags=["registration"])

_registration_rate_limit = rate_limit("gym_registration", settings.RATE_LIMIT_GYM_REGISTRATION)


@router.post(
    "/gyms",
    response_model=TokenPair,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_registration_rate_limit)],
)
async def register_gym_endpoint(
    payload: GymRegistrationRequest, db: AsyncSession = Depends(get_db)
) -> TokenPair:
    """Public self-service signup — no auth required. Creates the gym on
    FREE/TRIAL and its first GYM_ADMIN, then logs that admin in immediately
    so they land straight in their new dashboard instead of having to log in
    separately right after registering."""
    try:
        admin = await register_gym(db, payload)
    except GymSubdomainTakenError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except EmailAlreadyExistsError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return issue_token_pair(admin)
