from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    branches,
    checkin,
    evaluations,
    exercises,
    gym_subscriptions,
    gyms,
    memberships,
    notifications,
    nutrition,
    payments,
    promotions,
    registration,
    subscriptions,
    superadmin,
    users,
    workouts,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(registration.router)
api_router.include_router(gyms.router)
api_router.include_router(gym_subscriptions.router)
api_router.include_router(branches.router)
api_router.include_router(users.router)
api_router.include_router(memberships.router)
api_router.include_router(promotions.router)
api_router.include_router(subscriptions.router)
api_router.include_router(payments.router)
api_router.include_router(checkin.router)
api_router.include_router(evaluations.router)
api_router.include_router(exercises.router)
api_router.include_router(workouts.router)
api_router.include_router(nutrition.router)
api_router.include_router(superadmin.router)
api_router.include_router(notifications.router)
