import uuid
from datetime import datetime

from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Album(Base):
    __tablename__ = "albums"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    cover_media_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("media.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref="albums", lazy="selectin")
    cover_media = relationship("Media", foreign_keys=[cover_media_id], lazy="selectin")
    album_media = relationship("AlbumMedia", back_populates="album", lazy="selectin", cascade="all, delete-orphan")


class AlbumMedia(Base):
    __tablename__ = "album_media"

    album_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("albums.id", ondelete="CASCADE"), primary_key=True)
    media_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("media.id", ondelete="CASCADE"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    album = relationship("Album", back_populates="album_media")
    media = relationship("Media", lazy="selectin")
