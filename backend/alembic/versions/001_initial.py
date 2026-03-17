"""initial tables

Revision ID: 001_initial
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("auth0_sub", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False, server_default=""),
        sa.Column("avatar_url", sa.String(1024), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Media
    media_type = sa.Enum("photo", "video", name="mediatype")
    op.create_table(
        "media",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("type", media_type, nullable=False),
        sa.Column("filename", sa.String(512), nullable=False),
        sa.Column("original_filename", sa.String(512), nullable=False),
        sa.Column("blob_url", sa.String(2048), nullable=False),
        sa.Column("thumbnail_url", sa.String(2048), nullable=False, server_default=""),
        sa.Column("size_bytes", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("mime_type", sa.String(128), nullable=False, server_default=""),
        sa.Column("width", sa.Integer, nullable=False, server_default="0"),
        sa.Column("height", sa.Integer, nullable=False, server_default="0"),
        sa.Column("duration_seconds", sa.Float, nullable=True),
        sa.Column("latitude", sa.Float, nullable=True, index=True),
        sa.Column("longitude", sa.Float, nullable=True, index=True),
        sa.Column("taken_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Albums
    op.create_table(
        "albums",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.Column("cover_media_id", UUID(as_uuid=True), sa.ForeignKey("media.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Album-Media join table
    op.create_table(
        "album_media",
        sa.Column("album_id", UUID(as_uuid=True), sa.ForeignKey("albums.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("media_id", UUID(as_uuid=True), sa.ForeignKey("media.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.UniqueConstraint("album_id", "media_id"),
    )


def downgrade() -> None:
    op.drop_table("album_media")
    op.drop_table("albums")
    op.drop_table("media")
    sa.Enum(name="mediatype").drop(op.get_bind())
    op.drop_table("users")
