"""Unit coverage for the "a user can hold more than one role" change:
require_role's set-based check (app/deps/auth.py) instead of the old scalar
`current_user.role`. Calls the dependency function directly with a plain
in-memory User rather than going through the DB/HTTP layer — the interesting
part is the role-set logic itself, not persistence.
"""

import pytest
from fastapi import HTTPException

from app.deps.auth import require_role
from app.models.enums import UserRole
from app.models.user import User


def _staff_user(*roles: UserRole) -> User:
    return User(
        gym_id=None,
        email="staff@example.com",
        password_hash="unused",
        roles=list(roles),
        first_name="Staff",
        last_name="Member",
        is_active=True,
    )


async def test_dual_role_user_passes_require_role_for_either_role():
    user = _staff_user(UserRole.TRAINER, UserRole.NUTRITIONIST)

    check_trainer = require_role([UserRole.TRAINER])
    check_nutritionist = require_role([UserRole.NUTRITIONIST])

    assert await check_trainer(current_user=user) is user
    assert await check_nutritionist(current_user=user) is user


async def test_dual_role_user_still_rejected_for_role_it_lacks():
    user = _staff_user(UserRole.TRAINER, UserRole.NUTRITIONIST)
    check_gym_admin = require_role([UserRole.GYM_ADMIN])

    with pytest.raises(HTTPException) as exc_info:
        await check_gym_admin(current_user=user)
    assert exc_info.value.status_code == 403


async def test_single_role_user_unaffected_by_multi_role_change():
    user = _staff_user(UserRole.MEMBER)
    check_member = require_role([UserRole.MEMBER])
    check_trainer = require_role([UserRole.TRAINER])

    assert await check_member(current_user=user) is user
    with pytest.raises(HTTPException):
        await check_trainer(current_user=user)
