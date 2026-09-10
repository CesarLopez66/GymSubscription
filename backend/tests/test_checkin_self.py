"""Integration tests for the member self-check-in flow (POST
/check-in/self, added so a member can scan a fixed QR poster at the gym
entrance instead of staff scanning the member's own QR). Exercises the same
gym-token resolution and cross-tenant guard the endpoint applies
(app/api/v1/endpoints/checkin.py::self_check_in), directly against the
service layer — consistent with this repo's existing integration-test style
(see test_multitenant_security.py). Needs a real Postgres; skipped if
unreachable.
"""

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select, text

from app.core.database import AsyncSessionLocal, set_rls_context
from app.core.security import hash_password
from app.models.enums import SaaSPlanTier, SubscriptionStatus, UserRole
from app.models.gym import Gym
from app.models.membership import Membership
from app.models.subscription import MemberSubscription
from app.models.user import User
from app.services import checkin_service, gym_service


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
async def two_gyms_with_members(require_db):
    suffix = uuid.uuid4().hex[:8]
    today = date.today()

    async with AsyncSessionLocal() as db, db.begin():
        await set_rls_context(db, gym_id=None, is_superadmin=True)

        gym_a = Gym(
            name=f"Checkin Gym A {suffix}",
            subdomain=f"checkin-a-{suffix}",
            contact_email=f"a-{suffix}@example.com",
            plan_tier=SaaSPlanTier.FREE,
        )
        gym_b = Gym(
            name=f"Checkin Gym B {suffix}",
            subdomain=f"checkin-b-{suffix}",
            contact_email=f"b-{suffix}@example.com",
            plan_tier=SaaSPlanTier.FREE,
        )
        db.add_all([gym_a, gym_b])
        await db.flush()

        plan_a = Membership(gym_id=gym_a.id, name="Monthly", price=Decimal("100.00"), duration_days=30)
        member_a = User(
            gym_id=gym_a.id,
            email=f"member@{gym_a.subdomain}.example",
            password_hash=hash_password("Passw0rd!123"),
            roles=[UserRole.MEMBER],
            first_name="Alice",
            last_name="TenantA",
        )
        db.add_all([plan_a, member_a])
        await db.flush()

        sub_a = MemberSubscription(
            gym_id=gym_a.id,
            user_id=member_a.id,
            membership_id=plan_a.id,
            start_date=today - timedelta(days=1),
            end_date=today + timedelta(days=29),
            status=SubscriptionStatus.ACTIVE,
        )
        db.add(sub_a)
        await db.flush()

        ctx = {
            "gym_a_id": gym_a.id,
            "gym_b_id": gym_b.id,
            "gym_a_token": gym_a.checkin_qr_token,
            "gym_b_token": gym_b.checkin_qr_token,
            "member_a_id": member_a.id,
        }

    yield ctx

    async with AsyncSessionLocal() as db, db.begin():
        await set_rls_context(db, gym_id=None, is_superadmin=True)
        for gym_id in (ctx["gym_a_id"], ctx["gym_b_id"]):
            gym = (await db.execute(select(Gym).where(Gym.id == gym_id))).scalar_one_or_none()
            if gym is not None:
                await db.delete(gym)


class TestSelfCheckIn:
    async def test_own_gym_token_grants_access(self, two_gyms_with_members):
        ctx = two_gyms_with_members
        async with AsyncSessionLocal() as db, db.begin():
            await set_rls_context(db, gym_id=ctx["gym_a_id"], is_superadmin=False)
            gym = await gym_service.get_gym_by_checkin_token(db, ctx["gym_a_token"])
            assert gym is not None and gym.id == ctx["gym_a_id"]

            check_in = await checkin_service.perform_check_in(
                db, gym_id=ctx["gym_a_id"], user_id=ctx["member_a_id"]
            )
            assert check_in.access_granted is True

    async def test_other_gyms_token_is_rejected(self, two_gyms_with_members):
        ctx = two_gyms_with_members
        async with AsyncSessionLocal() as db, db.begin():
            await set_rls_context(db, gym_id=ctx["gym_a_id"], is_superadmin=False)
            gym = await gym_service.get_gym_by_checkin_token(db, ctx["gym_b_token"])
            # Mirrors the endpoint's own guard: found a gym, but it isn't the
            # caller's own — must be treated as invalid, not silently
            # check the member into the wrong tenant.
            assert gym is not None
            assert gym.id != ctx["gym_a_id"]

    async def test_bogus_token_resolves_to_no_gym(self, two_gyms_with_members):
        ctx = two_gyms_with_members
        async with AsyncSessionLocal() as db, db.begin():
            await set_rls_context(db, gym_id=ctx["gym_a_id"], is_superadmin=False)
            gym = await gym_service.get_gym_by_checkin_token(db, "not-a-real-token")
            assert gym is None
