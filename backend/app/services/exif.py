import io
import logging
from dataclasses import dataclass
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
from datetime import datetime

import exifread

logger = logging.getLogger(__name__)


@dataclass
class ExifData:
    latitude: float | None = None
    longitude: float | None = None
    taken_at: datetime | None = None
    width: int = 0
    height: int = 0
    camera_make: str = ""
    camera_model: str = ""


def _convert_to_degrees(value) -> float:
    """Convert GPS DMS (degrees, minutes, seconds) to decimal degrees."""
    d, m, s = value
    return float(d) + float(m) / 60.0 + float(s) / 3600.0


def _exifread_to_degrees(dms_tag) -> float:
    """Convert exifread IfdTag DMS values to decimal degrees."""
    values = dms_tag.values
    d = float(values[0].num) / float(values[0].den) if values[0].den else float(values[0].num)
    m = float(values[1].num) / float(values[1].den) if values[1].den else float(values[1].num)
    s = float(values[2].num) / float(values[2].den) if values[2].den else float(values[2].num)
    return d + m / 60.0 + s / 3600.0


def _extract_with_exifread(file_bytes: bytes, result: ExifData) -> ExifData:
    """Fallback EXIF extraction using exifread library (better format support)."""
    try:
        tags = exifread.process_file(io.BytesIO(file_bytes), details=False)
        if not tags:
            return result

        # Camera info
        if not result.camera_make:
            result.camera_make = str(tags.get("Image Make", ""))
        if not result.camera_model:
            result.camera_model = str(tags.get("Image Model", ""))

        # Date taken
        if not result.taken_at:
            date_str = tags.get("EXIF DateTimeOriginal") or tags.get("Image DateTime")
            if date_str:
                try:
                    result.taken_at = datetime.strptime(str(date_str), "%Y:%m:%d %H:%M:%S")
                except ValueError:
                    pass

        # GPS info — only fill if Pillow didn't find it
        if result.latitude is None or result.longitude is None:
            lat_tag = tags.get("GPS GPSLatitude")
            lat_ref = tags.get("GPS GPSLatitudeRef")
            lon_tag = tags.get("GPS GPSLongitude")
            lon_ref = tags.get("GPS GPSLongitudeRef")

            if lat_tag and lon_tag and lat_ref and lon_ref:
                lat = _exifread_to_degrees(lat_tag)
                lon = _exifread_to_degrees(lon_tag)
                if str(lat_ref) == "S":
                    lat = -lat
                if str(lon_ref) == "W":
                    lon = -lon
                result.latitude = lat
                result.longitude = lon

    except Exception as e:
        logger.warning(f"exifread fallback failed: {e}")

    return result


def extract_exif(file_bytes: bytes) -> ExifData:
    """Extract EXIF metadata from an image file."""
    result = ExifData()

    try:
        img = Image.open(io.BytesIO(file_bytes))
        result.width = img.width
        result.height = img.height

        exif_data = img._getexif()
        if exif_data is None:
            # Pillow found no EXIF, try exifread as fallback
            return _extract_with_exifread(file_bytes, result)

        exif = {}
        for tag_id, value in exif_data.items():
            tag_name = TAGS.get(tag_id, tag_id)
            exif[tag_name] = value

        # Camera info
        result.camera_make = str(exif.get("Make", ""))
        result.camera_model = str(exif.get("Model", ""))

        # Date taken
        date_str = exif.get("DateTimeOriginal") or exif.get("DateTime")
        if date_str:
            try:
                result.taken_at = datetime.strptime(str(date_str), "%Y:%m:%d %H:%M:%S")
            except ValueError:
                pass

        # GPS info
        gps_info = exif.get("GPSInfo")
        if gps_info:
            gps = {}
            for key, val in gps_info.items():
                gps_tag = GPSTAGS.get(key, key)
                gps[gps_tag] = val

            lat = gps.get("GPSLatitude")
            lat_ref = gps.get("GPSLatitudeRef")
            lon = gps.get("GPSLongitude")
            lon_ref = gps.get("GPSLongitudeRef")

            if lat and lon and lat_ref and lon_ref:
                latitude = _convert_to_degrees(lat)
                longitude = _convert_to_degrees(lon)
                if lat_ref == "S":
                    latitude = -latitude
                if lon_ref == "W":
                    longitude = -longitude
                result.latitude = latitude
                result.longitude = longitude

        # If Pillow didn't find GPS, try exifread as fallback
        if result.latitude is None or result.longitude is None:
            result = _extract_with_exifread(file_bytes, result)

    except Exception as e:
        logger.warning(f"EXIF extraction failed: {e}")

    return result
