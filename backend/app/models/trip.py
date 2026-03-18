import uuid
import enum
from datetime import date, datetime

from sqlalchemy import String, Date, DateTime, Float, Boolean, Enum, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TransportType(str, enum.Enum):
    flight = "flight"
    train = "train"
    ship = "ship"
    bus = "bus"
    drive = "drive"
    other = "other"


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    trip_date: Mapped[date] = mapped_column(Date, nullable=False)
    transport_type: Mapped[TransportType] = mapped_column(Enum(TransportType), nullable=False)
    carrier: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    trip_number: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    origin_name: Mapped[str] = mapped_column(String(255), nullable=False)
    origin_lat: Mapped[float] = mapped_column(Float, nullable=False)
    origin_lng: Mapped[float] = mapped_column(Float, nullable=False)
    dest_name: Mapped[str] = mapped_column(String(255), nullable=False)
    dest_lat: Mapped[float] = mapped_column(Float, nullable=False)
    dest_lng: Mapped[float] = mapped_column(Float, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    show_on_map: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref="trips", lazy="selectin")
