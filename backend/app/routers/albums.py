import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.album import Album, AlbumMedia
from app.models.media import Media
from app.models.user import User
from app.schemas.album import AlbumCreate, AlbumMediaAdd, AlbumOut, AlbumUpdate
from app.schemas.media import MediaOut
from app.services.storage import get_blob_sas_url

router = APIRouter(prefix="/albums", tags=["albums"])


def _album_to_out(album: Album, media_count: int) -> AlbumOut:
    cover_thumb = None
    if album.cover_media and album.cover_media.thumbnail_url:
        settings = get_settings()
        cover_thumb = get_blob_sas_url(album.cover_media.thumbnail_url, container=settings.azure_storage_thumbnails_container)

    return AlbumOut(
        id=album.id,
        user_id=album.user_id,
        name=album.name,
        description=album.description,
        cover_media_id=album.cover_media_id,
        cover_thumbnail_url=cover_thumb,
        media_count=media_count,
        created_at=album.created_at,
        updated_at=album.updated_at,
    )


async def _album_to_out_with_count(album: Album, db: AsyncSession) -> AlbumOut:
    count_q = select(func.count()).select_from(AlbumMedia).where(AlbumMedia.album_id == album.id)
    count = (await db.execute(count_q)).scalar() or 0
    return _album_to_out(album, count)


@router.post("", response_model=AlbumOut, status_code=status.HTTP_201_CREATED)
async def create_album(
    data: AlbumCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    album = Album(
        id=uuid.uuid4(),
        user_id=current_user.id,
        name=data.name,
        description=data.description,
    )
    db.add(album)
    await db.flush()
    return _album_to_out(album, media_count=0)


@router.get("", response_model=list[AlbumOut])
async def list_albums(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Subquery for media counts to avoid N+1
    count_subq = (
        select(AlbumMedia.album_id, func.count().label("cnt"))
        .group_by(AlbumMedia.album_id)
        .subquery()
    )
    query = (
        select(Album, func.coalesce(count_subq.c.cnt, 0).label("media_count"))
        .outerjoin(count_subq, Album.id == count_subq.c.album_id)
        .where(Album.user_id == current_user.id)
        .order_by(Album.created_at.desc())
    )
    result = await db.execute(query)
    return [_album_to_out(row[0], row[1]) for row in result.all()]


@router.get("/{album_id}", response_model=AlbumOut)
async def get_album(
    album_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Album).where(Album.id == album_id, Album.user_id == current_user.id)
    )
    album = result.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    return await _album_to_out_with_count(album, db)


@router.patch("/{album_id}", response_model=AlbumOut)
async def update_album(
    album_id: uuid.UUID,
    data: AlbumUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Album).where(Album.id == album_id, Album.user_id == current_user.id)
    )
    album = result.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")

    if data.name is not None:
        album.name = data.name
    if data.description is not None:
        album.description = data.description
    if data.cover_media_id is not None:
        media_result = await db.execute(
            select(Media).where(Media.id == data.cover_media_id, Media.user_id == current_user.id)
        )
        cover_media = media_result.scalar_one_or_none()
        if cover_media is None:
            raise HTTPException(status_code=400, detail="Cover media must belong to the current user")

        album_media_result = await db.execute(
            select(AlbumMedia).where(
                AlbumMedia.album_id == album.id,
                AlbumMedia.media_id == data.cover_media_id,
            )
        )
        if album_media_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=400, detail="Cover media must already be in the album")

        album.cover_media_id = data.cover_media_id

    await db.flush()
    return await _album_to_out_with_count(album, db)


@router.delete("/{album_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_album_route(
    album_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Album).where(Album.id == album_id, Album.user_id == current_user.id)
    )
    album = result.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    await db.delete(album)


@router.post("/{album_id}/media", status_code=status.HTTP_201_CREATED)
async def add_media_to_album(
    album_id: uuid.UUID,
    data: AlbumMediaAdd,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Verify album ownership
    album_result = await db.execute(
        select(Album).where(Album.id == album_id, Album.user_id == current_user.id)
    )
    if not album_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Album not found")

    # Verify media ownership
    media_result = await db.execute(
        select(Media).where(Media.id == data.media_id, Media.user_id == current_user.id)
    )
    if not media_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Media not found")

    # Check if already in album
    existing = await db.execute(
        select(AlbumMedia).where(AlbumMedia.album_id == album_id, AlbumMedia.media_id == data.media_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Media already in album")

    am = AlbumMedia(album_id=album_id, media_id=data.media_id, sort_order=data.sort_order)
    db.add(am)
    await db.flush()
    return {"status": "added"}


@router.delete("/{album_id}/media/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_media_from_album(
    album_id: uuid.UUID,
    media_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Verify album ownership
    album_result = await db.execute(
        select(Album).where(Album.id == album_id, Album.user_id == current_user.id)
    )
    if not album_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Album not found")

    result = await db.execute(
        select(AlbumMedia).where(AlbumMedia.album_id == album_id, AlbumMedia.media_id == media_id)
    )
    am = result.scalar_one_or_none()
    if not am:
        raise HTTPException(status_code=404, detail="Media not in album")
    await db.delete(am)


@router.get("/{album_id}/media", response_model=list[MediaOut])
async def list_album_media(
    album_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Verify album ownership
    album_result = await db.execute(
        select(Album).where(Album.id == album_id, Album.user_id == current_user.id)
    )
    if not album_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Album not found")

    result = await db.execute(
        select(AlbumMedia)
        .where(AlbumMedia.album_id == album_id)
        .order_by(AlbumMedia.sort_order)
    )
    album_media_list = result.scalars().all()

    settings = get_settings()
    out = []
    for am in album_media_list:
        m = am.media
        url = get_blob_sas_url(m.blob_url) if m.blob_url else ""
        thumb = get_blob_sas_url(m.thumbnail_url, container=settings.azure_storage_thumbnails_container) if m.thumbnail_url else ""
        out.append(MediaOut(
            id=m.id,
            user_id=m.user_id,
            type=m.type.value,
            filename=m.filename,
            original_filename=m.original_filename,
            url=url,
            thumbnail_url=thumb or (url if m.type.value == "photo" else ""),
            size_bytes=m.size_bytes,
            mime_type=m.mime_type,
            width=m.width,
            height=m.height,
            duration_seconds=m.duration_seconds,
            latitude=m.latitude,
            longitude=m.longitude,
            taken_at=m.taken_at,
            description=m.description,
            created_at=m.created_at,
            updated_at=m.updated_at,
        ))
    return out
