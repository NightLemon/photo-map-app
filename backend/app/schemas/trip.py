from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel
from app.models.trip import TransportType


class TripCreate(BaseModel):
    trip_date: date
    transport_type: TransportType
    carrier: str = ""
    trip_number: str = ""
    origin_name: str
    origin_lat: float
    origin_lng: float
    dest_name: str
    dest_lat: float
    dest_lng: float
    notes: str = ""
    show_on_map: bool = False


class TripUpdate(BaseModel):
    trip_date: date | None = None
    transport_type: TransportType | None = None
    carrier: str | None = None
    trip_number: str | None = None
    origin_name: str | None = None
    origin_lat: float | None = None
    origin_lng: float | None = None
    dest_name: str | None = None
    dest_lat: float | None = None
    dest_lng: float | None = None
    notes: str | None = None
    show_on_map: bool | None = None


class TripOut(BaseModel):
    id: UUID
    user_id: UUID
    trip_date: date
    transport_type: str
    carrier: str
    trip_number: str
    origin_name: str
    origin_lat: float
    origin_lng: float
    dest_name: str
    dest_lat: float
    dest_lng: float
    notes: str
    show_on_map: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TripMapPoint(BaseModel):
    id: UUID
    transport_type: str
    trip_number: str
    trip_date: date
    origin_name: str
    origin_lat: float
    origin_lng: float
    dest_name: str
    dest_lat: float
    dest_lng: float

    model_config = {"from_attributes": True}
