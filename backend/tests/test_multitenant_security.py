"""Integration tests proving PostgreSQL Row-Level Security actually enforces
tenant isolation at the database layer — not just in application code.

These need a real Postgres reachable at settings.DATABASE_URL with the
migrations (including the RLS policies) applied, e.g.:

    docker compose up -d postgres
    cd backend && alembic upgrade head && pytest tests/test_multitenant_security.py

If the database is unreachable, every test in this module is skipped rather
than failing the suite outright — RLS is a property of the database, so it
can only be verified against a real one.
"""

import uuid

import pytest
import sqlalchemy.exc
from sqlalchemy import select, text

from app.core.database import AsyncSessionLocal, set_rls_context
from app.core.security import hash_password
from app.models.enums import SaaSPlanTier, UserRole
from app.models.gym import Gym
from app.models.user import User


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
        pytest.skip("Postgres is not reachable at settings.DATABASE_URL; skipping RLS tests")


@pytest.fixture
async def two_tenants(require_db):
    """Creates two gyms, each with one user, as SUPERADMIN (bypasses RLS),
    and deletes both (cascading to their users) on teardown."""
    suffix = uuid.uuid4().hex[:8]

    async with AsyncSessionLocal() as db, db.begin():
        await set_rls_context(db, gym_id=None, is_superadmin=True)

        gym_a = Gym(
            name=f"Tenant A {suffix}",
            subdomain=f"tenant-a-{suffix}",
            contact_email=f"a-{suffix}@example.com",
            plan_tier=SaaSPlanTier.FREE,
        )
        gym_b = Gym(
            name=f"Tenant B {suffix}",
            subdomain=f"tenant-b-{suffix}",
            contact_email=f"b-{suffix}@example.com",
            plan_tier=SaaSPlanTier.FREE,
        )
        db.add_all([gym_a, gym_b])
        await db.flush()

        user_a = User(
            gym_id=gym_a.id,
            email=f"member@{gym_a.subdomain}.example",
            password_hash=hash_password("Passw0rd!123"),
            roles=[UserRole.MEMBER],
            first_name="Alice",
            last_name="TenantA",
        )
        user_b = User(
            gym_id=gym_b.id,
            email=f"member@{gym_b.subdomain}.example",
            password_hash=hash_password("Passw0rd!123"),
            roles=[UserRole.MEMBER],
            first_name="Bob",
            last_name="TenantB",
        )
        db.add_all([user_a, user_b])
        await db.flush()

        gym_a_id, gym_b_id, user_a_id, user_b_id = gym_a.id, gym_b.id, user_a.id, user_b.id

    yield {
        "gym_a_id": gym_a_id,
        "gym_b_id": gym_b_id,
        "user_a_id": user_a_id,
        "user_b_id": user_b_id,
    }

    async with AsyncSessionLocal() as db, db.begin():
        await set_rls_context(db, gym_id=None, is_superadmin=True)
        for gym_id in (gym_a_id, gym_b_id):
            gym = (await db.execute(select(Gym).where(Gym.id == gym_id))).scalar_one_or_none()
            if gym is not None:
                await db.delete(gym)


class TestRowLevelSecurity:
    async def test_tenant_a_context_only_sees_its_own_users(self, two_tenants):
        async with AsyncSessionLocal() as db, db.begin():
            await set_rls_context(db, gym_id=two_tenants["gym_a_id"], is_superadmin=False)
            result = await db.execute(select(User.id).where(User.gym_id == two_tenants["gym_a_id"]))
            visible_own = {row[0] for row in result.all()}

            result = await db.execute(select(User.id).where(User.gym_id == two_tenants["gym_b_id"]))
            visible_other = {row[0] for row in result.all()}

        assert two_tenants["user_a_id"] in visible_own
        assert visible_other == set(), "tenant A's RLS context leaked tenant B's rows"

    async def test_tenant_b_context_only_sees_its_own_users(self, two_tenants):
        async with AsyncSessionLocal() as db, db.begin():
            await set_rls_context(db, gym_id=two_tenants["gym_b_id"], is_superadmin=False)
            result = await db.execute(select(User.id).where(User.gym_id == two_tenants["gym_a_id"]))
            visible_other = {row[0] for row in result.all()}

        assert visible_other == set(), "tenant B's RLS context leaked tenant A's rows"

    async def test_unscoped_select_star_still_only_returns_own_tenant(self, two_tenants):
        """Even a query with no explicit gym_id filter at all — simulating a
        bug that forgot the application-level filter — must not leak."""
        async with AsyncSessionLocal() as db, db.begin():
            await set_rls_context(db, gym_id=two_tenants["gym_a_id"], is_superadmin=False)
            result = await db.execute(select(User.id, User.gym_id))
            rows = result.all()

        assert all(row[1] == two_tenants["gym_a_id"] for row in rows)

    async def test_no_context_set_denies_all_rows_fail_closed(self, two_tenants):
        """A session that never calls set_rls_context (e.g. a bug in the auth
        dependency chain) must see nothing, not everything."""
        async with AsyncSessionLocal() as db, db.begin():
            result = await db.execute(
                select(User.id).where(
                    User.id.in_([two_tenants["user_a_id"], two_tenants["user_b_id"]])
                )
            )
            rows = result.all()

        assert rows == []

    async def test_cannot_insert_row_into_a_different_tenant(self, two_tenants):
        """WITH CHECK must block cross-tenant writes, not just reads."""
        with pytest.raises(sqlalchemy.exc.DBAPIError):
            async with AsyncSessionLocal() as db, db.begin():
                await set_rls_context(db, gym_id=two_tenants["gym_a_id"], is_superadmin=False)
                rogue_user = User(
                    gym_id=two_tenants["gym_b_id"],  # attempting to write into tenant B
                    email="intruder@example.com",
                    password_hash=hash_password("Passw0rd!123"),
                    roles=[UserRole.MEMBER],
                    first_name="Intruder",
                    last_name="Attempt",
                )
                db.add(rogue_user)
                await db.flush()

    async def test_superadmin_context_sees_both_tenants(self, two_tenants):
        async with AsyncSessionLocal() as db, db.begin():
            await set_rls_context(db, gym_id=None, is_superadmin=True)
            result = await db.execute(
                select(User.id).where(
                    User.id.in_([two_tenants["user_a_id"], two_tenants["user_b_id"]])
                )
            )
            visible = {row[0] for row in result.all()}

        assert visible == {two_tenants["user_a_id"], two_tenants["user_b_id"]}
