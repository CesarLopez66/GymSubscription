"""gym brand colors

Revision ID: 0827106e2037
Revises: b5d2e9f1a7c3
Create Date: 2026-09-13 17:11:51.666548

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0827106e2037'
down_revision: Union[str, None] = 'b5d2e9f1a7c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("gyms", sa.Column("primary_color", sa.String(length=7), nullable=True))
    op.add_column("gyms", sa.Column("secondary_color", sa.String(length=7), nullable=True))


def downgrade() -> None:
    op.drop_column("gyms", "secondary_color")
    op.drop_column("gyms", "primary_color")
