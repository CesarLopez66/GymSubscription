"""evaluation age

Revision ID: bbf416e5ee3f
Revises: b76b48dc5fc6
Create Date: 2026-08-28 00:00:00.000000

Adds a nullable ``age`` column to ``physical_evaluations``. Age is required
for the nutrition-plan BMR formulas (Mifflin-St Jeor) and, now that a saved
evaluation auto-generates both the workout routine and the nutrition plan in
one step, is captured on the evaluation itself instead of a separate form.
Nullable because existing evaluation rows predate this field.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "bbf416e5ee3f"
down_revision: Union[str, None] = "b76b48dc5fc6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("physical_evaluations", sa.Column("age", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("physical_evaluations", "age")
