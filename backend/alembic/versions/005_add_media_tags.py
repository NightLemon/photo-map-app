"""add media_tags table

Revision ID: 005_add_media_tags
Revises: 004_add_trips
Create Date: 2026-03-20 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = "005_add_media_tags"
down_revision: Union[str, None] = "004_add_trips"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "media_tags",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("media_id", UUID(as_uuid=True), sa.ForeignKey("media.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("tag", sa.String(50), nullable=False),
        sa.UniqueConstraint("media_id", "tag", name="uq_media_tag"),
    )
    op.create_index("ix_media_tags_user_tag", "media_tags", ["user_id", "tag"])


def downgrade() -> None:
    op.drop_index("ix_media_tags_user_tag", table_name="media_tags")
    op.drop_table("media_tags")
