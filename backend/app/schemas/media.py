from datetime import datetime
from typing import Any
from uuid import UUID
from pydantic import BaseModel, model_serializer


class MediaOut(BaseModel):
    id: UUID
    user_id: UUID
    type: str
    filename: str
    original_filename: str
    url: str = ""
    thumbnail_url: str = ""
    size_bytes: int
    mime_type: str
    width: int
    height: int
    duration_seconds: float | None = None
    latitude: float | None = None
    longitude: float | None = None
    taken_at: datetime | None = None
    description: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MediaUpdate(BaseModel):
    description: str | None = None
    latitude: float | None = None
    longitude: float | None = None

    def get_update_fields(self) -> dict[str, Any]:
        """Return only explicitly provided fields, allowing null to clear values."""
        return {k: getattr(self, k) for k in self.model_fields_set}


class MediaListOut(BaseModel):
    items: list[MediaOut]
    total: int


class GeoMediaPoint(BaseModel):
    id: UUID
    latitude: float
    longitude: float
    thumbnail_url: str
    filename: str
    original_filename: str
    taken_at: datetime | None = None
    description: str

    model_config = {"from_attributes": True}


class ZipUploadError(BaseModel):
    filename: str
    reason: str


class ZipUploadResult(BaseModel):
    total: int
    succeeded: int
    failed: int
    skipped: int
    items: list[MediaOut]
    errors: list[ZipUploadError]
