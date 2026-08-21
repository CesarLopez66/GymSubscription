"""row level security policies

Revision ID: 9aa235df7580
Revises: 4b3c33ab188c
Create Date: 2026-08-21 00:05:00.000000

Enables PostgreSQL RLS on every tenant-scoped table as defense-in-depth
alongside the application-level ``gym_id`` filtering already enforced in the
service layer. Policies key off two session GUCs set once per request (see
``app.core.database.set_rls_context``):

- ``app.current_gym_id``: the authenticated user's tenant, or '' when unset.
- ``app.is_superadmin``: 'true' for SUPERADMIN requests, which bypass tenant
  scoping entirely (SUPERADMIN manages gyms/global exercises platform-wide).

``nullif(current_setting(...), '')::uuid`` is used everywhere instead of a
bare cast so an empty/unset GUC becomes SQL NULL (no rows match, fail closed)
rather than raising an "invalid input syntax for type uuid" error, which
would otherwise happen on every request that hasn't set the GUC yet.

``FORCE ROW LEVEL SECURITY`` is applied so the policies also bind to the
table owner (the role migrations run as). In a hardened production
deployment the API would instead connect as a separate, non-owner role with
RLS enforced on it by default — FORCE is the pragmatic equivalent here.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9aa235df7580"
down_revision: Union[str, None] = "4b3c33ab188c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_GYM_ID_CONDITION = (
    "gym_id = nullif(current_setting('app.current_gym_id', true), '')::uuid"
)
_SUPERADMIN_CONDITION = "current_setting('app.is_superadmin', true) = 'true'"

# Tables with a non-nullable gym_id, where tenant isolation is a plain match.
_STANDARD_TENANT_TABLES = (
    "memberships",
    "member_subscriptions",
    "check_ins",
    "physical_evaluations",
    "workout_plans",
    "nutrition_plans",
    "payments",
)


def _enable_rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")


def upgrade() -> None:
    for table in _STANDARD_TENANT_TABLES:
        _enable_rls(table)
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
            USING ({_SUPERADMIN_CONDITION} OR {_GYM_ID_CONDITION})
            WITH CHECK ({_SUPERADMIN_CONDITION} OR {_GYM_ID_CONDITION})
            """
        )

    # users: gym_id is nullable (NULL = a SUPERADMIN account). NULL rows only
    # satisfy the superadmin bypass, never the tenant-match condition, so
    # they never leak into a gym-scoped request.
    _enable_rls("users")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON users
        USING ({_SUPERADMIN_CONDITION} OR {_GYM_ID_CONDITION})
        WITH CHECK ({_SUPERADMIN_CONDITION} OR {_GYM_ID_CONDITION})
        """
    )

    # exercises: gym_id is nullable (NULL = global catalog). Global rows are
    # readable by every tenant, but only SUPERADMIN may write them.
    _enable_rls("exercises")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON exercises
        USING ({_SUPERADMIN_CONDITION} OR gym_id IS NULL OR {_GYM_ID_CONDITION})
        WITH CHECK ({_SUPERADMIN_CONDITION} OR {_GYM_ID_CONDITION})
        """
    )

    # workout_plan_items has no gym_id of its own; tenancy is derived from
    # its parent workout_plans row.
    _enable_rls("workout_plan_items")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON workout_plan_items
        USING (
            {_SUPERADMIN_CONDITION}
            OR EXISTS (
                SELECT 1 FROM workout_plans wp
                WHERE wp.id = workout_plan_items.workout_plan_id
                AND wp.{_GYM_ID_CONDITION}
            )
        )
        WITH CHECK (
            {_SUPERADMIN_CONDITION}
            OR EXISTS (
                SELECT 1 FROM workout_plans wp
                WHERE wp.id = workout_plan_items.workout_plan_id
                AND wp.{_GYM_ID_CONDITION}
            )
        )
        """
    )


def downgrade() -> None:
    all_tables = (*_STANDARD_TENANT_TABLES, "users", "exercises", "workout_plan_items")
    for table in all_tables:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
