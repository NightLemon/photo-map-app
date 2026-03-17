from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class AlbumCreate(BaseModel):
    name: str
    description: str = ""


class AlbumUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    cover_media_id: UUID | None = None


class AlbumOut(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    description: str
    cover_media_id: UUID | None = None
    cover_thumbnail_url: str | None = None
    media_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AlbumMediaAdd(BaseModel):
    media_id: UUID
    sort_order: int = 0
