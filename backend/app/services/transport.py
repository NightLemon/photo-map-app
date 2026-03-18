"""Lightweight airport and train station lookup for trip autocomplete.

Data is loaded once into memory on first request (lazy).
Provides search by name, code, or city.
"""

import json
import logging
from pathlib import Path
from functools import lru_cache

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).parent / "data"


@lru_cache
def _load_airports() -> list[dict]:
    path = _DATA_DIR / "airports.json"
    if not path.exists():
        logger.warning(f"Airport data not found at {path}")
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@lru_cache
def _load_stations() -> list[dict]:
    path = _DATA_DIR / "stations.json"
    if not path.exists():
        logger.warning(f"Station data not found at {path}")
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def search_airports(query: str, limit: int = 10) -> list[dict]:
    """Search airports by IATA code, city, or name."""
    q = query.lower().strip()
    if not q:
        return []

    results = []
    for airport in _load_airports():
        iata = airport.get("iata", "").lower()
        name = airport.get("name", "").lower()
        city = airport.get("city", "").lower()

        # Exact IATA match gets top priority
        if iata == q:
            results.insert(0, airport)
        elif q in iata or q in name or q in city:
            results.append(airport)

        if len(results) >= limit:
            break

    return results[:limit]


def search_stations(query: str, limit: int = 10) -> list[dict]:
    """Search train stations by name or code."""
    q = query.lower().strip()
    if not q:
        return []

    results = []
    for station in _load_stations():
        name = station.get("name", "").lower()
        code = station.get("code", "").lower()

        if q in name or q in code:
            results.append(station)

        if len(results) >= limit:
            break

    return results[:limit]
