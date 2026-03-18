from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.media import Media
from app.models.album import Album
from app.models.trip import Trip
from app.schemas.user import UserOut, UserProfileUpdate

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserOut)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
):
    return current_user


@router.patch("/profile", response_model=UserOut)
async def update_profile(
    data: UserProfileUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if data.bio is not None:
        current_user.bio = data.bio
    if data.location is not None:
        current_user.location = data.location
    if data.website is not None:
        current_user.website = data.website
    await db.flush()
    return current_user


@router.get("/stats")
async def get_user_stats(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    media_count = (await db.execute(
        select(func.count()).select_from(Media).where(Media.user_id == current_user.id)
    )).scalar() or 0

    geo_count = (await db.execute(
        select(func.count()).select_from(Media).where(Media.user_id == current_user.id, Media.latitude.isnot(None))
    )).scalar() or 0

    album_count = (await db.execute(
        select(func.count()).select_from(Album).where(Album.user_id == current_user.id)
    )).scalar() or 0

    trip_count = (await db.execute(
        select(func.count()).select_from(Trip).where(Trip.user_id == current_user.id)
    )).scalar() or 0

    return {
        "media_count": media_count,
        "geo_count": geo_count,
        "album_count": album_count,
        "trip_count": trip_count,
    }
