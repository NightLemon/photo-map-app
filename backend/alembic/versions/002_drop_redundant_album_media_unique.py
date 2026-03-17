"""drop redundant album_media unique constraint

Revision ID: 002_drop_redundant_uq
Revises: 001_initial
Create Date: 2026-03-17 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "002_drop_redundant_uq"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for constraint in inspector.get_unique_constraints("album_media"):
        if set(constraint.get("column_names", [])) == {"album_id", "media_id"}:
            op.drop_constraint(constraint["name"], "album_media", type_="unique")


def downgrade() -> None:
    op.create_unique_constraint(
        "album_media_album_id_media_id_key",
        "album_media",
        ["album_id", "media_id"],
    )