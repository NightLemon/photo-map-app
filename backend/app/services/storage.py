import asyncio
import uuid
import logging

from azure.storage.blob import BlobServiceClient, ContentSettings, generate_blob_sas, BlobSasPermissions, PublicAccess
from datetime import datetime, timedelta, timezone

from app.config import get_settings

logger = logging.getLogger(__name__)


def _get_settings():
    return get_settings()


def _get_blob_service_client() -> BlobServiceClient:
    return BlobServiceClient.from_connection_string(_get_settings().azure_storage_connection_string)


async def ensure_containers():
    """Create blob containers if they don't exist."""
    settings = _get_settings()
    client = _get_blob_service_client()
    _is_azurite = "devstoreaccount1" in settings.azure_storage_connection_string
    for name in [settings.azure_storage_container_name, settings.azure_storage_thumbnails_container]:
        container = client.get_container_client(name)
        if not container.exists():
            if _is_azurite:
                container.create_container(public_access=PublicAccess.Blob)
                logger.info(f"Created blob container (public, Azurite): {name}")
            else:
                container.create_container()
                logger.info(f"Created blob container (private): {name}")
        elif _is_azurite:
            try:
                container.set_container_access_policy(signed_identifiers={}, public_access=PublicAccess.Blob)
            except Exception:
                pass


def _upload_blob_sync(
    data: bytes,
    user_id: uuid.UUID,
    media_id: uuid.UUID,
    filename: str,
    content_type: str,
    container: str | None = None,
) -> str:
    """Synchronous upload — called via asyncio.to_thread."""
    settings = _get_settings()
    container = container or settings.azure_storage_container_name
    blob_path = f"{user_id}/{media_id}/{filename}"

    client = _get_blob_service_client()
    blob_client = client.get_blob_client(container=container, blob=blob_path)
    blob_client.upload_blob(
        data,
        overwrite=True,
        content_settings=ContentSettings(content_type=content_type),
    )
    return blob_path


async def upload_blob(
    data: bytes,
    user_id: uuid.UUID,
    media_id: uuid.UUID,
    filename: str,
    content_type: str,
    container: str | None = None,
) -> str:
    """Upload a blob without blocking the event loop."""
    return await asyncio.to_thread(
        _upload_blob_sync, data, user_id, media_id, filename, content_type, container
    )


def _delete_blob_sync(blob_path: str, container: str | None = None) -> None:
    settings = _get_settings()
    container = container or settings.azure_storage_container_name
    client = _get_blob_service_client()
    blob_client = client.get_blob_client(container=container, blob=blob_path)
    blob_client.delete_blob(delete_snapshots="include")


async def delete_blob(blob_path: str, container: str | None = None) -> None:
    """Delete a blob without blocking the event loop."""
    await asyncio.to_thread(_delete_blob_sync, blob_path, container)


def get_blob_sas_url(blob_path: str, container: str | None = None, expiry_hours: int = 1) -> str:
    """Generate a time-limited SAS URL for accessing a blob."""
    settings = _get_settings()
    container = container or settings.azure_storage_container_name
    client = _get_blob_service_client()
    account_name = client.account_name

    # For Azurite / dev account, just return the direct URL
    if account_name == "devstoreaccount1":
        return f"http://localhost:10000/devstoreaccount1/{container}/{blob_path}"

    blob_client = client.get_blob_client(container=container, blob=blob_path)
    sas_token = generate_blob_sas(
        account_name=account_name,
        account_key=client.credential.account_key,
        container_name=container,
        blob_name=blob_path,
        permission=BlobSasPermissions(read=True),
        expiry=datetime.now(timezone.utc) + timedelta(hours=expiry_hours),
    )
    return f"{blob_client.url}?{sas_token}"
