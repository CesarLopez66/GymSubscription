"""Integration tests for the code that moves money and grants gym access —
the weakness analysis flagged this area (subscription creation, and the new
member-submitted payment-claim approval flow) as having the least test
coverage relative to its consequences. Needs a real Postgres, same as
test_multitenant_security.py; skipped if unreachable.
"""

import uuid
from decimal import Decimal

import pytest
from sqlalchemy import select, text

from app.core.database import AsyncSessionLocal, set_rls_context
from app.core.security import hash_password
from app.models.enums import SaaSPlanTier, SubscriptionStatus, UserRole
from app.models.gym import Gym
from app.models.membership import Membership
from app.models.payment import Payment
from app.models.subscription import MemberSubscription
from app.models.user import User
from app.schemas.payment import PaymentSelfCreate
from app.schemas.subscription import SubscriptionCreate
from app.services import payment_service, subscription_service


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
async def gym_with_member_and_plan(require_db):
    suffix = uuid.uuid4().hex[:8]

    async with AsyncSessionLocal() as db, db.begin():
        await set_rls_context(db, gym_id=None, is_superadmin=True)

        gym = Gym(
            name=f"Test Gym {suffix}",
            subdomain=f"test-gym-{suffix}",
            contact_email=f"gym-{suffix}@example.com",
            plan_tier=SaaSPlanTier.FREE,
        )
        db.add(gym)
        await db.flush()

        member = User(
            gym_id=gym.id,
            email=f"member@{gym.subdomain}.example",
            password_hash=hash_password("Passw0rd!123"),
            roles=[UserRole.MEMBER],
            first_name="Test",
            last_name="Member",
        )
        plan = Membership(
            gym_id=gym.id, name="Monthly", price=Decimal("100.00"), duration_days=30
        )
        db.add_all([member, plan])
        await db.flush()

        gym_id, member_id, plan_id = gym.id, member.id, plan.id

    yield {"gym_id": gym_id, "member_id": member_id, "plan_id": plan_id}

    async with AsyncSessionLocal() as db, db.begin():
        await set_rls_context(db, gym_id=None, is_superadmin=True)
        existing = (await db.execute(select(Gym).where(Gym.id == gym_id))).scalar_one_or_none()
        if existing is not None:
            await db.delete(existing)


class TestSubscriptionCreation:
    async def test_amount_mismatch_is_rejected(self, gym_with_member_and_plan):
        ctx = gym_with_member_and_plan
        async with AsyncSessionLocal() as db, db.begin():
            await set_rls_context(db, gym_id=ctx["gym_id"], is_superadmin=False)
            with pytest.raises(subscription_service.PaymentAmountMismatchError):
                await subscription_service.create_subscription(
                    db,
                    ctx["gym_id"],
                    ctx["member_id"],
                    SubscriptionCreate(
                        user_id=ctx["member_id"],
                        membership_id=ctx["plan_id"],
                        payment_amount=Decimal("1.00"),
                    ),
                )

    async def test_correct_amount_creates_subscription_and_payment_atomically(
        self, gym_with_member_and_plan
    ):
        ctx = gym_with_member_and_plan
        async with AsyncSessionLocal() as db, db.begin():
            await set_rls_context(db, gym_id=ctx["gym_id"], is_superadmin=False)
            subscription = await subscription_service.create_subscription(
                db,
                ctx["gym_id"],
                ctx["member_id"],
                SubscriptionCreate(
                    user_id=ctx["member_id"],
                    membership_id=ctx["plan_id"],
                    payment_amount=Decimal("100.00"),
                ),
            )
            assert subscription.status == SubscriptionStatus.ACTIVE

            payment_result = await db.execute(
                select(Payment).where(Payment.subscription_id == subscription.id)
            )
            payment = payment_result.scalar_one()
            assert payment.amount == Decimal("100.00")
            assert payment.status.value == "COMPLETED"


class TestPaymentClaimApproval:
    async def test_approve_activates_subscription(self, gym_with_member_and_plan):
        ctx = gym_with_member_and_plan
        async with AsyncSessionLocal() as db, db.begin():
            await set_rls_context(db, gym_id=ctx["gym_id"], is_superadmin=False)
            claim = await payment_service.create_self_payment_claim(
                db,
                ctx["gym_id"],
                ctx["member_id"],
                PaymentSelfCreate(membership_id=ctx["plan_id"], proof_image="data:image/png;base64,Zm9v"),
            )
            assert claim.status.value == "PENDING"

            approved = await payment_service.approve_payment(db, ctx["gym_id"], claim.id)
            assert approved.status.value == "COMPLETED"
            assert approved.subscription_id is not None

            sub_result = await db.execute(
                select(MemberSubscription).where(MemberSubscription.id == approved.subscription_id)
            )
            subscription = sub_result.scalar_one()
            assert subscription.status == SubscriptionStatus.ACTIVE
            assert subscription.user_id == ctx["member_id"]

    async def test_reject_records_reason_and_creates_no_subscription(
        self, gym_with_member_and_plan
    ):
        ctx = gym_with_member_and_plan
        async with AsyncSessionLocal() as db, db.begin():
            await set_rls_context(db, gym_id=ctx["gym_id"], is_superadmin=False)
            claim = await payment_service.create_self_payment_claim(
                db,
                ctx["gym_id"],
                ctx["member_id"],
                PaymentSelfCreate(membership_id=ctx["plan_id"], proof_image="data:image/png;base64,Zm9v"),
            )
            rejected = await payment_service.reject_payment(
                db, ctx["gym_id"], claim.id, "Comprobante ilegible"
            )
            assert rejected.status.value == "FAILED"
            assert rejected.rejection_reason == "Comprobante ilegible"
            assert rejected.subscription_id is None

    async def test_cannot_approve_an_already_completed_payment(self, gym_with_member_and_plan):
        ctx = gym_with_member_and_plan
        async with AsyncSessionLocal() as db, db.begin():
            await set_rls_context(db, gym_id=ctx["gym_id"], is_superadmin=False)
            claim = await payment_service.create_self_payment_claim(
                db,
                ctx["gym_id"],
                ctx["member_id"],
                PaymentSelfCreate(membership_id=ctx["plan_id"], proof_image="data:image/png;base64,Zm9v"),
            )
            await payment_service.approve_payment(db, ctx["gym_id"], claim.id)

            with pytest.raises(payment_service.InvalidPaymentStateError):
                await payment_service.approve_payment(db, ctx["gym_id"], claim.id)
