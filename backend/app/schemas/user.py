from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr


class UserOut(BaseModel):
    id: UUID
    email: str
    display_name: str
    avatar_url: str
    bio: str
    location: str
    website: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UserProfileUpdate(BaseModel):
    bio: str | None = None
    location: str | None = None
    website: str | None = None
