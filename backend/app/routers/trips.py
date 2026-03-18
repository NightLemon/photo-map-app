import io
import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from app.database import get_db
from app.dependencies import get_current_user
from app.models.trip import Trip, TransportType
from app.models.user import User
from app.schemas.trip import TripCreate, TripMapPoint, TripOut, TripUpdate

router = APIRouter(prefix="/trips", tags=["trips"])

TEMPLATE_COLUMNS = [
    ("日期", "trip_date", "2026-01-15"),
    ("交通方式", "transport_type", "flight / train / ship / bus / drive / other"),
    ("航司/铁路", "carrier", "东方航空"),
    ("航班号/车次", "trip_number", "MU5101"),
    ("出发地", "origin_name", "PVG 或 上海虹桥 (机场用IATA代码或城市名，火车站用站名)"),
    ("到达地", "dest_name", "PEK 或 北京南"),
    ("备注", "notes", "出差"),
    ("显示在地图", "show_on_map", "是 / 否"),
]


@router.get("/template")
async def download_template():
    """Download an Excel template for batch trip import."""
    from app.services.transport import _load_airports, _load_stations

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "行程模板"

    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
    example_fill = PatternFill(start_color="F0F4FF", end_color="F0F4FF", fill_type="solid")
    thin_border = Border(
        left=Side(style="thin"), right=Side(style="thin"),
        top=Side(style="thin"), bottom=Side(style="thin"),
    )

    for col_idx, (label, _, example) in enumerate(TEMPLATE_COLUMNS, 1):
        cell = ws.cell(row=1, column=col_idx, value=label)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")
        cell.border = thin_border
        ex_cell = ws.cell(row=2, column=col_idx, value=example)
        ex_cell.fill = example_fill
        ex_cell.border = thin_border
        ws.column_dimensions[chr(64 + col_idx) if col_idx <= 26 else 'A'].width = max(len(label) * 2, 20)

    # Add reference sheet with airport codes and station names
    ref_ws = wb.create_sheet("机场和车站参考")
    ref_header_fill = PatternFill(start_color="059669", end_color="059669", fill_type="solid")

    # Airports
    ref_ws.cell(row=1, column=1, value="IATA代码").font = Font(bold=True, color="FFFFFF")
    ref_ws.cell(row=1, column=1).fill = ref_header_fill
    ref_ws.cell(row=1, column=2, value="机场名称").font = Font(bold=True, color="FFFFFF")
    ref_ws.cell(row=1, column=2).fill = ref_header_fill
    ref_ws.cell(row=1, column=3, value="城市").font = Font(bold=True, color="FFFFFF")
    ref_ws.cell(row=1, column=3).fill = ref_header_fill
    ref_ws.cell(row=1, column=4, value="国家").font = Font(bold=True, color="FFFFFF")
    ref_ws.cell(row=1, column=4).fill = ref_header_fill

    # Only include major airports (China + major international hubs)
    airports = _load_airports()
    major_countries = {"China", "Japan", "South Korea", "Thailand", "Singapore", "United States", "United Kingdom", "France", "Germany", "Australia"}
    filtered = [a for a in airports if a.get("country") in major_countries]
    filtered.sort(key=lambda a: (a.get("country", ""), a.get("city", "")))
    for i, a in enumerate(filtered[:500], start=2):
        ref_ws.cell(row=i, column=1, value=a["iata"])
        ref_ws.cell(row=i, column=2, value=a["name"])
        ref_ws.cell(row=i, column=3, value=a["city"])
        ref_ws.cell(row=i, column=4, value=a["country"])

    # Stations (separate columns)
    ref_ws.cell(row=1, column=6, value="车站名称").font = Font(bold=True, color="FFFFFF")
    ref_ws.cell(row=1, column=6).fill = ref_header_fill
    ref_ws.cell(row=1, column=7, value="站码").font = Font(bold=True, color="FFFFFF")
    ref_ws.cell(row=1, column=7).fill = ref_header_fill

    stations = _load_stations()
    for i, s in enumerate(stations, start=2):
        ref_ws.cell(row=i, column=6, value=s["name"])
        ref_ws.cell(row=i, column=7, value=s.get("code", ""))

    ref_ws.column_dimensions['A'].width = 10
    ref_ws.column_dimensions['B'].width = 35
    ref_ws.column_dimensions['C'].width = 15
    ref_ws.column_dimensions['D'].width = 15
    ref_ws.column_dimensions['F'].width = 15
    ref_ws.column_dimensions['G'].width = 10

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=trip_template.xlsx"},
    )


@router.post("/import")
async def import_trips(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Batch import trips from an Excel file. Automatically resolves location coordinates."""
    from app.services.transport import search_airports, search_stations

    if not file.filename or not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="请上传 .xlsx 格式的 Excel 文件")

    contents = await file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(contents), read_only=True)
    except Exception:
        raise HTTPException(status_code=400, detail="无法解析 Excel 文件")

    ws = wb.active
    if ws is None:
        raise HTTPException(status_code=400, detail="Excel 文件没有工作表")

    rows = list(ws.iter_rows(min_row=2, values_only=True))  # Skip header
    if not rows:
        raise HTTPException(status_code=400, detail="Excel 文件没有数据行")

    def resolve_location(name: str, transport: str) -> tuple[str, float, float]:
        """Resolve a location name to (display_name, lat, lng) using airport/station data."""
        name = name.strip()
        if not name:
            raise ValueError("地点名称不能为空")

        # Try airport lookup first (for flights, or if name looks like IATA code)
        if transport == "flight" or (len(name) == 3 and name.isalpha()):
            results = search_airports(name, limit=1)
            if results:
                a = results[0]
                return f"{a['city']} {a['name']}", a["lat"], a["lng"]

        # Try station lookup (for trains)
        if transport == "train":
            results = search_stations(name, limit=1)
            if results:
                s = results[0]
                return f"{s['name']}站", s["lat"], s["lng"]

        # Fallback: try airports by city name for any transport type
        results = search_airports(name, limit=1)
        if results:
            a = results[0]
            return f"{a['city']} {a['name']}", a["lat"], a["lng"]

        # Try stations as last resort
        results = search_stations(name, limit=1)
        if results:
            s = results[0]
            return f"{s['name']}站", s["lat"], s["lng"]

        raise ValueError(f"无法识别地点 '{name}'，请使用机场IATA代码(如PVG)或车站名(如上海虹桥)")

    created = []
    errors = []
    valid_types = {t.value for t in TransportType}

    for row_idx, row in enumerate(rows, start=2):
        try:
            if not row[0]:  # Skip empty rows
                continue

            # Parse date
            trip_date_val = row[0]
            if isinstance(trip_date_val, str):
                trip_date_val = date.fromisoformat(trip_date_val.strip())
            elif hasattr(trip_date_val, 'date'):
                trip_date_val = trip_date_val.date() if callable(getattr(trip_date_val, 'date', None)) else trip_date_val

            # Parse transport type
            transport = str(row[1] or "other").strip().lower()
            if transport not in valid_types:
                errors.append(f"第{row_idx}行: 交通方式 '{row[1]}' 无效，可选: flight/train/ship/bus/drive/other")
                continue

            # Resolve origin and destination coordinates automatically
            origin_name = str(row[4] or "").strip()
            dest_name = str(row[5] or "").strip()

            try:
                origin_display, origin_lat, origin_lng = resolve_location(origin_name, transport)
            except ValueError as e:
                errors.append(f"第{row_idx}行 出发地: {e}")
                continue

            try:
                dest_display, dest_lat, dest_lng = resolve_location(dest_name, transport)
            except ValueError as e:
                errors.append(f"第{row_idx}行 到达地: {e}")
                continue

            # Parse show_on_map
            show_val = str(row[7] or "").strip().lower() if len(row) > 7 and row[7] else ""
            show_on_map = show_val in ("是", "yes", "true", "1")

            trip = Trip(
                id=uuid.uuid4(),
                user_id=current_user.id,
                trip_date=trip_date_val,
                transport_type=TransportType(transport),
                carrier=str(row[2] or "").strip(),
                trip_number=str(row[3] or "").strip(),
                origin_name=origin_display,
                origin_lat=origin_lat,
                origin_lng=origin_lng,
                dest_name=dest_display,
                dest_lat=dest_lat,
                dest_lng=dest_lng,
                notes=str(row[6] or "").strip() if len(row) > 6 else "",
                show_on_map=show_on_map,
            )
            db.add(trip)
            created.append(trip.id)
        except Exception as e:
            errors.append(f"第{row_idx}行: {str(e)}")

    if created:
        await db.flush()

    return {
        "imported": len(created),
        "errors": errors,
        "total_rows": len(rows),
    }


@router.post("", response_model=TripOut, status_code=status.HTTP_201_CREATED)
async def create_trip(
    data: TripCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    trip = Trip(
        id=uuid.uuid4(),
        user_id=current_user.id,
        trip_date=data.trip_date,
        transport_type=data.transport_type,
        carrier=data.carrier,
        trip_number=data.trip_number,
        origin_name=data.origin_name,
        origin_lat=data.origin_lat,
        origin_lng=data.origin_lng,
        dest_name=data.dest_name,
        dest_lat=data.dest_lat,
        dest_lng=data.dest_lng,
        notes=data.notes,
        show_on_map=data.show_on_map,
    )
    db.add(trip)
    await db.flush()
    await db.refresh(trip)
    return trip


@router.get("", response_model=list[TripOut])
async def list_trips(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    transport_type: str | None = Query(None, alias="transportType"),
):
    query = select(Trip).where(Trip.user_id == current_user.id)
    if transport_type:
        query = query.where(Trip.transport_type == transport_type)
    query = query.order_by(Trip.trip_date.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/map", response_model=list[TripMapPoint])
async def get_trip_map_data(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    query = (
        select(Trip)
        .where(Trip.user_id == current_user.id, Trip.show_on_map.is_(True))
        .order_by(Trip.trip_date.desc())
    )
    result = await db.execute(query)
    return [
        TripMapPoint(
            id=t.id,
            transport_type=t.transport_type.value,
            trip_number=t.trip_number,
            trip_date=t.trip_date,
            origin_name=t.origin_name,
            origin_lat=t.origin_lat,
            origin_lng=t.origin_lng,
            dest_name=t.dest_name,
            dest_lat=t.dest_lat,
            dest_lng=t.dest_lng,
        )
        for t in result.scalars().all()
    ]


@router.get("/{trip_id}", response_model=TripOut)
async def get_trip(
    trip_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.user_id == current_user.id)
    )
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@router.patch("/{trip_id}", response_model=TripOut)
async def update_trip(
    trip_id: uuid.UUID,
    data: TripUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.user_id == current_user.id)
    )
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    for field in data.model_fields_set:
        value = getattr(data, field)
        setattr(trip, field, value)

    await db.flush()
    await db.refresh(trip)
    return trip


@router.patch("/{trip_id}/toggle-map", response_model=TripOut)
async def toggle_trip_map(
    trip_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.user_id == current_user.id)
    )
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    trip.show_on_map = not trip.show_on_map
    await db.flush()
    await db.refresh(trip)
    return trip


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(
    trip_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.user_id == current_user.id)
    )
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    await db.delete(trip)
