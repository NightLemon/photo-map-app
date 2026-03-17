import asyncio
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.media import Media, MediaType
from app.models.user import User
from app.schemas.media import GeoMediaPoint, MediaListOut, MediaOut, MediaUpdate
from app.services.exif import extract_exif
from app.services.storage import delete_blob, get_blob_sas_url, upload_blob
from app.services.thumbnail import generate_thumbnail

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/media", tags=["media"])

# Magic bytes for file type validation
_IMAGE_SIGNATURES = {
    b'\xff\xd8\xff': 'image/jpeg',
    b'\x89PNG\r\n\x1a\n': 'image/png',
    b'GIF87a': 'image/gif',
    b'GIF89a': 'image/gif',
    b'RIFF': 'image/webp',  # WebP (RIFF....WEBP)
}
_VIDEO_SIGNATURES = {
    b'\x00\x00\x00': 'video/',  # MP4/MOV (ftyp box)
    b'\x1a\x45\xdf\xa3': 'video/webm',  # WebM/MKV
}


def _validate_magic_bytes(contents: bytes, content_type: str) -> bool:
    """Validate file content matches its declared content type via magic bytes."""
    header = contents[:16]
    if content_type.startswith("image/"):
        for sig in _IMAGE_SIGNATURES:
            if header.startswith(sig):
                return True
        # HEIC: check for 'ftyp' box with heic/heix brand
        if len(header) >= 12 and header[4:8] == b'ftyp':
            brand = header[8:12].lower()
            if brand in (b'heic', b'heix', b'mif1'):
                return True
        return False
    elif content_type.startswith("video/"):
        for sig in _VIDEO_SIGNATURES:
            if header.startswith(sig):
                return True
        # MP4/MOV: check for 'ftyp' box
        if len(header) >= 8 and header[4:8] == b'ftyp':
            return True
        # AVI: RIFF....AVI
        if header.startswith(b'RIFF') and len(header) >= 12 and header[8:11] == b'AVI':
            return True
        return False
    return False


def _media_to_out(m: Media) -> MediaOut:
    """Convert ORM Media to response schema, injecting SAS URLs."""
    url = get_blob_sas_url(m.blob_url) if m.blob_url else ""
    thumb = get_blob_sas_url(m.thumbnail_url, container=get_settings().azure_storage_thumbnails_container) if m.thumbnail_url else ""
    return MediaOut(
        id=m.id,
        user_id=m.user_id,
        type=m.type.value,
        filename=m.filename,
        original_filename=m.original_filename,
        url=url,
        thumbnail_url=thumb or (url if m.type == MediaType.photo else ""),
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
    )


@router.post("/upload", response_model=MediaOut, status_code=status.HTTP_201_CREATED)
async def upload_media(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'mp4', 'mov', 'avi', 'mkv', 'webm'}

    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Validate file extension
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type .{ext} not allowed")

    # Read file
    contents = await file.read()
    size = len(contents)

    if size > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File too large. Max {settings.max_upload_size_mb}MB")

    content_type = file.content_type or "application/octet-stream"
    media_id = uuid.uuid4()

    # Determine type
    if content_type.startswith("image/"):
        media_type = MediaType.photo
    elif content_type.startswith("video/"):
        media_type = MediaType.video
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload images or videos.")

    # Validate magic bytes match declared content type
    if not _validate_magic_bytes(contents, content_type):
        raise HTTPException(status_code=400, detail="File content does not match its declared type")

    # Extract EXIF (for images) — run in thread to avoid blocking event loop
    exif = await asyncio.to_thread(extract_exif, contents) if media_type == MediaType.photo else None

    # Upload to blob storage — use only UUID + extension, strip original filename
    safe_filename = f"{media_id}.{ext}"
    blob_path = await upload_blob(
        data=contents,
        user_id=current_user.id,
        media_id=media_id,
        filename=safe_filename,
        content_type=content_type,
    )

    # Generate and upload thumbnail — run in thread to avoid blocking event loop
    thumb_path = ""
    thumb_bytes = await asyncio.to_thread(generate_thumbnail, contents, content_type)
    if thumb_bytes:
        thumb_filename = f"thumb_{media_id}.jpg"
        thumb_path = await upload_blob(
            data=thumb_bytes,
            user_id=current_user.id,
            media_id=media_id,
            filename=thumb_filename,
            content_type="image/jpeg",
            container=settings.azure_storage_thumbnails_container,
        )

    # Save to DB
    media = Media(
        id=media_id,
        user_id=current_user.id,
        type=media_type,
        filename=safe_filename,
        original_filename=file.filename,
        blob_url=blob_path,
        thumbnail_url=thumb_path,
        size_bytes=size,
        mime_type=content_type,
        width=exif.width if exif else 0,
        height=exif.height if exif else 0,
        latitude=exif.latitude if exif else None,
        longitude=exif.longitude if exif else None,
        taken_at=exif.taken_at if exif else None,
        description="",
    )
    db.add(media)
    await db.flush()

    return _media_to_out(media)


@router.get("", response_model=MediaListOut)
async def list_media(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    type: str | None = Query(None),
    has_location: bool | None = Query(None, alias="hasLocation"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100, alias="pageSize"),
):
    query = select(Media).where(Media.user_id == current_user.id)
    count_query = select(func.count()).select_from(Media).where(Media.user_id == current_user.id)

    if type:
        query = query.where(Media.type == type)
        count_query = count_query.where(Media.type == type)

    if has_location is True:
        query = query.where(Media.latitude.isnot(None))
        count_query = count_query.where(Media.latitude.isnot(None))
    elif has_location is False:
        query = query.where(Media.latitude.is_(None))
        count_query = count_query.where(Media.latitude.is_(None))

    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Media.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    items = [_media_to_out(m) for m in result.scalars().all()]

    return MediaListOut(items=items, total=total)


@router.get("/map", response_model=list[GeoMediaPoint])
async def get_geo_media(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(5000, ge=1, le=10000),
):
    query = (
        select(Media)
        .where(Media.user_id == current_user.id)
        .where(Media.latitude.isnot(None))
        .where(Media.longitude.isnot(None))
        .order_by(Media.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    points = []
    settings = get_settings()
    for m in result.scalars().all():
        thumb = get_blob_sas_url(m.thumbnail_url, container=settings.azure_storage_thumbnails_container) if m.thumbnail_url else ""
        points.append(GeoMediaPoint(
            id=m.id,
            latitude=m.latitude,  # type: ignore
            longitude=m.longitude,  # type: ignore
            thumbnail_url=thumb,
            filename=m.filename,
            original_filename=m.original_filename,
            taken_at=m.taken_at,
            description=m.description,
        ))
    return points


@router.get("/{media_id}", response_model=MediaOut)
async def get_media(
    media_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Media).where(Media.id == media_id, Media.user_id == current_user.id)
    )
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    return _media_to_out(media)


@router.patch("/{media_id}", response_model=MediaOut)
async def update_media(
    media_id: uuid.UUID,
    data: MediaUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Media).where(Media.id == media_id, Media.user_id == current_user.id)
    )
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")

    for field, value in data.get_update_fields().items():
        setattr(media, field, value)

    await db.flush()
    return _media_to_out(media)


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media_item(
    media_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Media).where(Media.id == media_id, Media.user_id == current_user.id)
    )
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")

    # Capture blob paths before deleting the DB record
    blob_url = media.blob_url
    thumbnail_url = media.thumbnail_url

    # Delete DB record first — DB is the source of truth.
    # If blob deletion later fails we get orphaned blobs (recoverable via cleanup),
    # but if we deleted blobs first and the DB commit failed we'd lose files silently.
    await db.delete(media)
    await db.flush()

    # Best-effort blob cleanup after DB state is committed-ready
    try:
        await delete_blob(blob_url)
        if thumbnail_url:
            await delete_blob(thumbnail_url, container=get_settings().azure_storage_thumbnails_container)
    except Exception as e:
        logger.warning(f"Orphaned blob after media {media_id} DB delete: {e}")
