"""add trips table

Revision ID: 004_add_trips
Revises: 003_user_profile
Create Date: 2026-03-18 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = "004_add_trips"
down_revision: Union[str, None] = "003_user_profile"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    transport_type = sa.Enum("flight", "train", "ship", "bus", "drive", "other", name="transporttype")
    op.create_table(
        "trips",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("trip_date", sa.Date, nullable=False),
        sa.Column("transport_type", transport_type, nullable=False),
        sa.Column("carrier", sa.String(100), nullable=False, server_default=""),
        sa.Column("trip_number", sa.String(50), nullable=False, server_default=""),
        sa.Column("origin_name", sa.String(255), nullable=False),
        sa.Column("origin_lat", sa.Float, nullable=False),
        sa.Column("origin_lng", sa.Float, nullable=False),
        sa.Column("dest_name", sa.String(255), nullable=False),
        sa.Column("dest_lat", sa.Float, nullable=False),
        sa.Column("dest_lng", sa.Float, nullable=False),
        sa.Column("notes", sa.Text, nullable=False, server_default=""),
        sa.Column("show_on_map", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("trips")
    sa.Enum(name="transporttype").drop(op.get_bind())
