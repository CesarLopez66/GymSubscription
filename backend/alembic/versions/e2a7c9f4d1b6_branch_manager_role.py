"""branch manager role

Revision ID: e2a7c9f4d1b6
Revises: 99b4e8f3e480
Create Date: 2026-09-14 15:00:00.000000

Adds BRANCH_MANAGER to the user_role Postgres enum. Unlike
a3f9c1d8e6b4 (which swapped the column from scalar to array — a structural
change), this only adds a new label to the existing type, so no column
rebuild is needed.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e2a7c9f4d1b6'
down_revision: Union[str, None] = '99b4e8f3e480'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Safe inside this migration's own transaction as long as the new
    # value isn't also *used* (inserted/compared) here — it isn't; that
    # happens in a later, separate migration.
    op.execute("ALTER TYPE user_role ADD VALUE 'BRANCH_MANAGER'")


def downgrade() -> None:
    # Postgres has no DROP VALUE for enums short of rebuilding the type
    # (rename it, recreate the old set, cast every column that uses it) —
    # substantially riskier than what this migration does. If
    # BRANCH_MANAGER ever needs to be retired, write that as its own
    # forward migration, not a downgrade of this one.
    pass
