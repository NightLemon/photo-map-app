from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr


class UserOut(BaseModel):
    id: UUID
    email: str
    display_name: str
    avatar_url: str
    created_at: datetime

    model_config = {"from_attributes": True}
