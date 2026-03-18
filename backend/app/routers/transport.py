from fastapi import APIRouter, Query

from app.services.transport import search_airports, search_stations

router = APIRouter(prefix="/transport", tags=["transport"])


@router.get("/airports")
async def search_airports_endpoint(
    q: str = Query(..., min_length=1, max_length=50),
    limit: int = Query(10, ge=1, le=50),
):
    return search_airports(q, limit)


@router.get("/stations")
async def search_stations_endpoint(
    q: str = Query(..., min_length=1, max_length=50),
    limit: int = Query(10, ge=1, le=50),
):
    return search_stations(q, limit)
