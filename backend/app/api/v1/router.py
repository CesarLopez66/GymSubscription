from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    checkin,
    evaluations,
    exercises,
    gyms,
    memberships,
    nutrition,
    payments,
    subscriptions,
    users,
    workouts,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(gyms.router)
api_router.include_router(users.router)
api_router.include_router(memberships.router)
api_router.include_router(subscriptions.router)
api_router.include_router(payments.router)
api_router.include_router(checkin.router)
api_router.include_router(evaluations.router)
api_router.include_router(exercises.router)
api_router.include_router(workouts.router)
api_router.include_router(nutrition.router)
