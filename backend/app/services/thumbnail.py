import io
import logging
from PIL import Image

from app.config import get_settings

logger = logging.getLogger(__name__)


def generate_thumbnail(file_bytes: bytes, content_type: str) -> bytes | None:
    """Generate a thumbnail from image bytes. Returns JPEG bytes or None on failure."""
    try:
        if content_type.startswith("image/"):
            return _thumbnail_from_image(file_bytes)
        elif content_type.startswith("video/"):
            # Video thumbnails require ffmpeg; skip for now, return None
            logger.info("Video thumbnail generation not implemented yet (needs ffmpeg)")
            return None
        return None
    except Exception as e:
        logger.warning(f"Thumbnail generation failed: {e}")
        return None


def _thumbnail_from_image(file_bytes: bytes) -> bytes:
    settings = get_settings()
    max_size = settings.thumbnail_max_size
    img = Image.open(io.BytesIO(file_bytes))
    img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

    # Convert to RGB if necessary (e.g. RGBA, P mode)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85, optimize=True)
    return buf.getvalue()
