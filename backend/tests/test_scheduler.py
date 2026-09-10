"""Integration tests for scheduler_service.run_periodic_tasks — the
weakness analysis found no background job of any kind existed anywhere in
this codebase, so SubscriptionStatus.EXPIRED was defined but never actually
assigned. Needs a real Postgres, same as test_multitenant_security.py.
"""

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import func, select, text

from app.core.database import AsyncSessionLocal, set_rls_context
from app.core.security import hash_password
from app.models.enums import SaaSPlanTier, SubscriptionStatus, UserRole
from app.models.gym import Gym
from app.models.membership import Membership
from app.models.notification import Notification
from app.models.subscription import MemberSubscription
from app.models.user import User
from app.services.scheduler_service import run_periodic_tasks


async def _db_reachable() -> bool:
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


@pytest.fixture
async def require_db():
    if not await _db_reachable():
        pytest.skip("Postgres is not reachable at settings.DATABASE_URL; skipping tests")


@pytest.fixture
async def gym_with_subscriptions(require_db):
    suffix = uuid.uuid4().hex[:8]
    today = date.today()

    async with AsyncSessionLocal() as db, db.begin():
        await set_rls_context(db, gym_id=None, is_superadmin=True)

        gym = Gym(
            name=f"Scheduler Gym {suffix}",
            subdomain=f"scheduler-gym-{suffix}",
            contact_email=f"gym-{suffix}@example.com",
            plan_tier=SaaSPlanTier.FREE,
        )
        admin = User(
            gym_id=None,
            email=f"admin-{suffix}@example.com",
            password_hash=hash_password("Passw0rd!123"),
            roles=[UserRole.GYM_ADMIN],
            first_name="Gym",
            last_name="Admin",
        )
        db.add_all([gym, admin])
        await db.flush()
        admin.gym_id = gym.id

        plan = Membership(gym_id=gym.id, name="Monthly", price=Decimal("100.00"), duration_days=30)
        expired_member = User(
            gym_id=gym.id,
            email=f"expired@{gym.subdomain}.example",
            password_hash=hash_password("Passw0rd!123"),
            roles=[UserRole.MEMBER],
            first_name="Expired",
            last_name="Member",
        )
        expiring_member = User(
            gym_id=gym.id,
            email=f"expiring@{gym.subdomain}.example",
            password_hash=hash_password("Passw0rd!123"),
            roles=[UserRole.MEMBER],
            first_name="Expiring",
            last_name="Member",
        )
        db.add_all([plan, expired_member, expiring_member])
        await db.flush()

        expired_sub = MemberSubscription(
            gym_id=gym.id,
            user_id=expired_member.id,
            membership_id=plan.id,
            start_date=today - timedelta(days=40),
            end_date=today - timedelta(days=1),
            status=SubscriptionStatus.ACTIVE,
        )
        expiring_sub = MemberSubscription(
            gym_id=gym.id,
            user_id=expiring_member.id,
            membership_id=plan.id,
            start_date=today - timedelta(days=27),
            end_date=today + timedelta(days=3),
            status=SubscriptionStatus.ACTIVE,
        )
        db.add_all([expired_sub, expiring_sub])
        await db.flush()

        ctx = {
            "gym_id": gym.id,
            "expired_sub_id": expired_sub.id,
            "expiring_sub_id": expiring_sub.id,
            "expiring_member_id": expiring_member.id,
        }

    yield ctx

    async with AsyncSessionLocal() as db, db.begin():
        await set_rls_context(db, gym_id=None, is_superadmin=True)
        existing = (await db.execute(select(Gym).where(Gym.id == ctx["gym_id"]))).scalar_one_or_none()
        if existing is not None:
            await db.delete(existing)


class TestScheduler:
    async def test_expired_subscription_is_flipped_to_expired(self, gym_with_subscriptions):
        ctx = gym_with_subscriptions
        async with AsyncSessionLocal() as db, db.begin():
            await run_periodic_tasks(db)

        async with AsyncSessionLocal() as db, db.begin():
            await set_rls_context(db, gym_id=None, is_superadmin=True)
            sub = (
                await db.execute(
                    select(MemberSubscription).where(MemberSubscription.id == ctx["expired_sub_id"])
                )
            ).scalar_one()
            assert sub.status == SubscriptionStatus.EXPIRED

    async def test_expiring_soon_subscription_is_not_touched(self, gym_with_subscriptions):
        ctx = gym_with_subscriptions
        async with AsyncSessionLocal() as db, db.begin():
            await run_periodic_tasks(db)

        async with AsyncSessionLocal() as db, db.begin():
            await set_rls_context(db, gym_id=None, is_superadmin=True)
            sub = (
                await db.execute(
                    select(MemberSubscription).where(MemberSubscription.id == ctx["expiring_sub_id"])
                )
            ).scalar_one()
            assert sub.status == SubscriptionStatus.ACTIVE

    async def test_notification_created_once_and_not_duplicated_on_rerun(
        self, gym_with_subscriptions
    ):
        ctx = gym_with_subscriptions
        async with AsyncSessionLocal() as db, db.begin():
            await run_periodic_tasks(db)
        async with AsyncSessionLocal() as db, db.begin():
            await run_periodic_tasks(db)

        async with AsyncSessionLocal() as db, db.begin():
            await set_rls_context(db, gym_id=None, is_superadmin=True)
            count_result = await db.execute(
                select(func.count(Notification.id)).where(
                    Notification.user_id == ctx["expiring_member_id"],
                    Notification.kind == "subscription_expiring",
                )
            )
            assert count_result.scalar_one() == 1
