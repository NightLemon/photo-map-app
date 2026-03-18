import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGeoMedia } from '../hooks/useMedia';
import { useTripMapData } from '../hooks/useTrips';
import type { GeoMediaPoint, TripMapPoint, TransportType } from '../types';

// Fix default Leaflet marker icon issue with bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

/** Create a card-style map marker with thumbnail and info */
function createMediaIcon(thumbnailUrl: string, description: string, takenAt?: string) {
  const dateStr = takenAt
    ? new Date(takenAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    : '';
  const label = description || dateStr || '📷';

  const inner = thumbnailUrl
    ? `<img src="${thumbnailUrl}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'" />`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#1e293b;color:white;font-size:16px;">▶</div>`;

  return L.divIcon({
    className: '',
    iconSize: [72, 90],
    iconAnchor: [36, 90],
    popupAnchor: [0, -90],
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.35));">
        <div style="width:64px;border-radius:10px;overflow:hidden;border:3px solid #fff;background:#e5e7eb;">
          <div style="width:100%;height:52px;">${inner}</div>
          <div style="background:#fff;padding:2px 4px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            <span style="font-size:10px;font-weight:600;color:#334155;line-height:1.2;">${label}</span>
          </div>
        </div>
        <div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:10px solid #fff;margin-top:-1px;"></div>
      </div>
    `,
  });
}

function PhotoMarker({ point, onClick }: { point: GeoMediaPoint; onClick: () => void }) {
  const icon = useMemo(
    () => createMediaIcon(point.thumbnailUrl, point.description, point.takenAt),
    [point.thumbnailUrl, point.description, point.takenAt],
  );

  return (
    <Marker position={[point.latitude, point.longitude]} icon={icon} eventHandlers={{ click: onClick }}>
      <Popup>
        <div style={{ width: 200, padding: 0 }}>
          {point.thumbnailUrl ? (
            <img
              src={point.thumbnailUrl}
              alt={point.description}
              style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 6 }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: 130,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0f172a',
                color: 'white',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              视频文件
            </div>
          )}
          <div style={{ padding: '6px 2px' }}>
            <div style={{ fontWeight: 600, fontSize: 13, margin: '4px 0 2px' }}>
              {point.description || point.originalFilename}
            </div>
            {point.takenAt && (
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                {new Date(point.takenAt).toLocaleDateString('zh-CN')}
              </div>
            )}
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

const tripColors: Record<TransportType, string> = {
  flight: '#ef4444',
  train: '#3b82f6',
  ship: '#06b6d4',
  bus: '#f59e0b',
  drive: '#8b5cf6',
  other: '#6b7280',
};

const tripEmoji: Record<TransportType, string> = {
  flight: '✈️',
  train: '🚄',
  ship: '🚢',
  bus: '🚌',
  drive: '🚗',
  other: '📍',
};

function TripRoute({ trip }: { trip: TripMapPoint }) {
  const color = tripColors[trip.transportType] || '#6b7280';
  const emoji = tripEmoji[trip.transportType] || '📍';
  // Create a curved path for flights (great circle approximation)
  const pathPositions: [number, number][] = useMemo(() => {
    const pts: [number, number][] = [
      [trip.originLat, trip.originLng],
      [trip.destLat, trip.destLng],
    ];
    if (trip.transportType !== 'flight') return pts;
    const steps = 40;
    const points: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lat = pts[0][0] + t * (pts[1][0] - pts[0][0]);
      const lng = pts[0][1] + t * (pts[1][1] - pts[0][1]);
      const arc = Math.sin(t * Math.PI) * Math.max(2, Math.abs(pts[1][1] - pts[0][1]) * 0.1);
      points.push([lat + arc, lng]);
    }
    return points;
  }, [trip.originLat, trip.originLng, trip.destLat, trip.destLng, trip.transportType]);

  const dateStr = new Date(trip.tripDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  const label = trip.tripNumber || transportLabelsMap[trip.transportType];

  function makeEndpointIcon(name: string, isOrigin: boolean) {
    const bg = isOrigin ? '#22c55e' : color;
    return L.divIcon({
      className: '',
      iconSize: [100, 28],
      iconAnchor: [50, 14],
      html: `<div style="display:inline-flex;align-items:center;gap:4px;background:${bg};color:#fff;padding:2px 8px;border-radius:14px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.25);border:2px solid #fff;">
        <span>${isOrigin ? '🛫' : '🛬'}</span>
        <span>${name}</span>
      </div>`,
    });
  }

  return (
    <>
      {/* Route line */}
      <Polyline
        positions={pathPositions}
        pathOptions={{
          color,
          weight: 3,
          opacity: 0.85,
          dashArray: trip.transportType === 'flight' ? '10,8' : undefined,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      >
        <Tooltip sticky>
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>
            <strong>{emoji} {label}</strong><br/>
            {trip.originName} → {trip.destName}<br/>
            <span style={{ color: '#6b7280', fontSize: 11 }}>{dateStr}</span>
          </div>
        </Tooltip>
      </Polyline>

      {/* Glow effect (wider semi-transparent line underneath) */}
      <Polyline
        positions={pathPositions}
        pathOptions={{
          color,
          weight: 8,
          opacity: 0.15,
          lineCap: 'round',
        }}
      />

      {/* Origin marker */}
      <Marker
        position={[trip.originLat, trip.originLng]}
        icon={makeEndpointIcon(trip.originName.length > 6 ? trip.originName.slice(0, 6) : trip.originName, true)}
      >
        <Popup>
          <div style={{ fontSize: 12, lineHeight: 1.5, minWidth: 140 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>🛫 出发</div>
            <div>{trip.originName}</div>
            {trip.tripNumber && <div style={{ fontFamily: 'monospace', color: '#3b82f6' }}>{trip.tripNumber}</div>}
            <div style={{ color: '#6b7280', marginTop: 2 }}>{dateStr}</div>
          </div>
        </Popup>
      </Marker>

      {/* Destination marker */}
      <Marker
        position={[trip.destLat, trip.destLng]}
        icon={makeEndpointIcon(trip.destName.length > 6 ? trip.destName.slice(0, 6) : trip.destName, false)}
      >
        <Popup>
          <div style={{ fontSize: 12, lineHeight: 1.5, minWidth: 140 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>🛬 到达</div>
            <div>{trip.destName}</div>
            {trip.tripNumber && <div style={{ fontFamily: 'monospace', color: '#3b82f6' }}>{trip.tripNumber}</div>}
            <div style={{ color: '#6b7280', marginTop: 2 }}>{dateStr}</div>
          </div>
        </Popup>
      </Marker>
    </>
  );
}

const transportLabelsMap: Record<string, string> = {
  flight: '飞机',
  train: '火车',
  ship: '轮船',
  bus: '大巴',
  drive: '自驾',
  other: '其他',
};

export default function MapView() {
  const { data: geoMedia, isLoading } = useGeoMedia();
  const { data: tripRoutes } = useTripMapData();
  const navigate = useNavigate();

  // Collect all map points (photos + trip endpoints) for center/zoom calculation
  const allPoints = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [];
    geoMedia?.forEach((p) => pts.push({ lat: p.latitude, lng: p.longitude }));
    tripRoutes?.forEach((t) => {
      pts.push({ lat: t.originLat, lng: t.originLng });
      pts.push({ lat: t.destLat, lng: t.destLng });
    });
    return pts;
  }, [geoMedia, tripRoutes]);

  const center = useMemo<[number, number]>(() => {
    if (allPoints.length === 0) return [30, 105];
    const avgLat = allPoints.reduce((s, p) => s + p.lat, 0) / allPoints.length;
    const avgLng = allPoints.reduce((s, p) => s + p.lng, 0) / allPoints.length;
    return [avgLat, avgLng];
  }, [allPoints]);

  const zoom = useMemo(() => {
    if (allPoints.length === 0) return 3;
    if (allPoints.length === 1) return 12;
    const lats = allPoints.map((p) => p.lat);
    const lngs = allPoints.map((p) => p.lng);
    const latSpread = Math.max(...lats) - Math.min(...lats);
    const lngSpread = Math.max(...lngs) - Math.min(...lngs);
    const maxSpread = Math.max(latSpread, lngSpread);
    if (maxSpread > 100) return 2;
    if (maxSpread > 50) return 3;
    if (maxSpread > 20) return 4;
    if (maxSpread > 10) return 5;
    if (maxSpread > 5) return 7;
    return 10;
  }, [allPoints]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[500px] rounded-xl overflow-hidden">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%', minHeight: 500, borderRadius: 12 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {geoMedia?.map((point) => (
          <PhotoMarker
            key={point.id}
            point={point}
            onClick={() => navigate(`/media/${point.id}`)}
          />
        ))}
        {tripRoutes?.map((trip) => (
          <TripRoute key={trip.id} trip={trip} />
        ))}
      </MapContainer>

      {/* Stats overlay */}
      <div className="absolute top-3 left-12 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-sm z-[1000]">
        <p className="text-sm font-medium text-gray-700">
          📍 {geoMedia?.length ?? 0} 个定位媒体
          {(tripRoutes?.length ?? 0) > 0 && ` · ✈️ ${tripRoutes!.length} 条行程`}
        </p>
      </div>

      {/* Empty state — only show if no photos AND no trips */}
      {(!geoMedia || geoMedia.length === 0) && (!tripRoutes || tripRoutes.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center z-[1000] pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 text-center shadow-lg">
            <p className="text-lg font-medium text-gray-700">地图上还没有内容</p>
            <p className="text-sm text-gray-500 mt-1">上传带 GPS 的照片或添加旅行行程，即可在地图上展示</p>
          </div>
        </div>
      )}
    </div>
  );
}
