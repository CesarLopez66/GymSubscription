"""Seeds demo data for local development / Docker Compose.

Creates 1 SUPERADMIN, 2 gym tenants (each with a GYM_ADMIN, membership plans,
trainers, and members with active subscriptions), and a 50-exercise global
catalog.

Usage (from backend/):
    python -m app.scripts.seed_data
"""

import asyncio
from datetime import date, timedelta

from sqlalchemy import select

from app.core.database import AsyncSessionLocal, set_rls_context
from app.core.security import hash_password
from app.models.enums import SaaSPlanTier, Sex, SubscriptionStatus, UserRole
from app.models.exercise import Exercise
from app.models.gym import Gym
from app.models.membership import Membership
from app.models.subscription import MemberSubscription
from app.models.user import User

EXERCISE_LIBRARY: list[tuple[str, str, str | None]] = [
    ("Barbell Bench Press", "Chest", "Barbell"),
    ("Incline Dumbbell Press", "Chest", "Dumbbell"),
    ("Decline Barbell Press", "Chest", "Barbell"),
    ("Push-Up", "Chest", None),
    ("Cable Chest Fly", "Chest", "Cable"),
    ("Dumbbell Pullover", "Chest", "Dumbbell"),
    ("Machine Chest Press", "Chest", "Machine"),
    ("Deadlift", "Back", "Barbell"),
    ("Pull-Up", "Back", None),
    ("Barbell Row", "Back", "Barbell"),
    ("Lat Pulldown", "Back", "Cable"),
    ("Seated Cable Row", "Back", "Cable"),
    ("T-Bar Row", "Back", "Barbell"),
    ("Single-Arm Dumbbell Row", "Back", "Dumbbell"),
    ("Back Extension", "Back", None),
    ("Squat", "Legs", "Barbell"),
    ("Front Squat", "Legs", "Barbell"),
    ("Leg Press", "Legs", "Machine"),
    ("Walking Lunge", "Legs", "Dumbbell"),
    ("Romanian Deadlift", "Legs", "Barbell"),
    ("Leg Extension", "Legs", "Machine"),
    ("Leg Curl", "Legs", "Machine"),
    ("Calf Raise", "Legs", "Machine"),
    ("Bulgarian Split Squat", "Legs", "Dumbbell"),
    ("Hip Thrust", "Legs", "Barbell"),
    ("Overhead Press", "Shoulders", "Barbell"),
    ("Dumbbell Shoulder Press", "Shoulders", "Dumbbell"),
    ("Lateral Raise", "Shoulders", "Dumbbell"),
    ("Front Raise", "Shoulders", "Dumbbell"),
    ("Rear Delt Fly", "Shoulders", "Dumbbell"),
    ("Face Pull", "Shoulders", "Cable"),
    ("Arnold Press", "Shoulders", "Dumbbell"),
    ("Barbell Curl", "Arms", "Barbell"),
    ("Dumbbell Curl", "Arms", "Dumbbell"),
    ("Hammer Curl", "Arms", "Dumbbell"),
    ("Preacher Curl", "Arms", "Barbell"),
    ("Triceps Pushdown", "Arms", "Cable"),
    ("Skull Crusher", "Arms", "Barbell"),
    ("Overhead Triceps Extension", "Arms", "Dumbbell"),
    ("Dip", "Arms", None),
    ("Plank", "Core", None),
    ("Hanging Leg Raise", "Core", None),
    ("Cable Crunch", "Core", "Cable"),
    ("Russian Twist", "Core", "Dumbbell"),
    ("Ab Wheel Rollout", "Core", None),
    ("Side Plank", "Core", None),
    ("Treadmill Run", "Cardio", "Treadmill"),
    ("Rowing Machine", "Cardio", "Rower"),
    ("Stationary Bike", "Cardio", "Bike"),
    ("Jump Rope", "Cardio", None),
]

GYM_SPECS = [
    {
        "name": "Iron Paradise",
        "subdomain": "ironparadise",
        "contact_email": "admin@ironparadise.example",
        "trainer_count": 3,
        "member_count": 10,
    },
    {
        "name": "Zen Fitness",
        "subdomain": "zenfitness",
        "contact_email": "admin@zenfitness.example",
        "member_count": 10,
        "trainer_count": 2,
    },
]

DEFAULT_PASSWORD = "SubGym123!"


async def seed() -> None:
    async with AsyncSessionLocal() as db, db.begin():
        await set_rls_context(db, gym_id=None, is_superadmin=True)

        existing = await db.execute(
            select(User).where(User.gym_id.is_(None), User.email == "superadmin@subgym.dev")
        )
        if existing.scalar_one_or_none() is not None:
            print("Seed data already present (superadmin exists) — skipping.")
            return

        superadmin = User(
            gym_id=None,
            email="superadmin@subgym.dev",
            password_hash=hash_password(DEFAULT_PASSWORD),
            role=UserRole.SUPERADMIN,
            first_name="Ada",
            last_name="Lovelace",
        )
        db.add(superadmin)

        db.add_all(
            Exercise(gym_id=None, name=name, muscle_group=group, equipment=equipment)
            for name, group, equipment in EXERCISE_LIBRARY
        )

        for gym_spec in GYM_SPECS:
            gym = Gym(
                name=gym_spec["name"],
                subdomain=gym_spec["subdomain"],
                contact_email=gym_spec["contact_email"],
                plan_tier=SaaSPlanTier.PRO,
            )
            db.add(gym)
            await db.flush()

            gym_admin = User(
                gym_id=gym.id,
                email=f"admin@{gym_spec['subdomain']}.example",
                password_hash=hash_password(DEFAULT_PASSWORD),
                role=UserRole.GYM_ADMIN,
                first_name="Gym",
                last_name="Admin",
            )
            db.add(gym_admin)

            monthly = Membership(
                gym_id=gym.id,
                name="Monthly",
                description="Rolling monthly membership.",
                price=39.99,
                duration_days=30,
            )
            annual = Membership(
                gym_id=gym.id,
                name="Annual",
                description="12-month membership at a discount.",
                price=399.99,
                duration_days=365,
            )
            db.add_all([monthly, annual])
            await db.flush()

            for i in range(1, gym_spec["trainer_count"] + 1):
                db.add(
                    User(
                        gym_id=gym.id,
                        email=f"trainer{i}@{gym_spec['subdomain']}.example",
                        password_hash=hash_password(DEFAULT_PASSWORD),
                        role=UserRole.TRAINER,
                        first_name=f"Trainer{i}",
                        last_name=gym_spec["name"].split()[0],
                    )
                )

            for i in range(1, gym_spec["member_count"] + 1):
                member = User(
                    gym_id=gym.id,
                    email=f"member{i}@{gym_spec['subdomain']}.example",
                    password_hash=hash_password(DEFAULT_PASSWORD),
                    role=UserRole.MEMBER,
                    first_name=f"Member{i}",
                    last_name=gym_spec["name"].split()[0],
                    sex=Sex.MALE if i % 2 == 0 else Sex.FEMALE,
                )
                db.add(member)
                await db.flush()

                start = date.today() - timedelta(days=5)
                db.add(
                    MemberSubscription(
                        gym_id=gym.id,
                        user_id=member.id,
                        membership_id=monthly.id,
                        start_date=start,
                        end_date=start + timedelta(days=monthly.duration_days),
                        status=SubscriptionStatus.ACTIVE,
                    )
                )

        print(
            "Seeded: 1 SUPERADMIN, "
            f"{len(GYM_SPECS)} gyms, "
            f"{sum(g['trainer_count'] for g in GYM_SPECS)} trainers, "
            f"{sum(g['member_count'] for g in GYM_SPECS)} members, "
            f"{len(EXERCISE_LIBRARY)} exercises."
        )
        print(f"All seeded users share the password: {DEFAULT_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed())
