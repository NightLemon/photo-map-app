"""add user profile fields

Revision ID: 003_user_profile
Revises: 002_drop_redundant_uq
Create Date: 2026-03-18 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "003_user_profile"
down_revision: Union[str, None] = "002_drop_redundant_uq"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("bio", sa.Text, nullable=False, server_default=""))
    op.add_column("users", sa.Column("location", sa.String(255), nullable=False, server_default=""))
    op.add_column("users", sa.Column("website", sa.String(512), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("users", "website")
    op.drop_column("users", "location")
    op.drop_column("users", "bio")
