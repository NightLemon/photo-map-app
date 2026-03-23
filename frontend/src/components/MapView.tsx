import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGeoMedia } from '../hooks/useMedia';
import { useTripMapData } from '../hooks/useTrips';
import { computeClusters } from '../utils/clusterMedia';
import type { GeoMediaPoint, TripMapPoint, TransportType, MediaCluster } from '../types';

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

/** Great-circle arc using spherical linear interpolation (Slerp).
 *  Handles antimeridian crossing and pure N-S routes correctly. */
function greatCircleArc(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  steps = 50,
): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  // Normalise longitude delta to [-180, 180] to avoid going the long way round
  let dLng = lng2 - lng1;
  if (dLng > 180) dLng -= 360;
  if (dLng < -180) dLng += 360;
  const lng2Adj = lng1 + dLng;

  const φ1 = toRad(lat1), λ1 = toRad(lng1);
  const φ2 = toRad(lat2), λ2 = toRad(lng2Adj);

  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const d = 2 * Math.asin(Math.sqrt(
      Math.sin((φ2 - φ1) / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
    ));
    if (d < 1e-9) { points.push([lat1, lng1]); continue; }
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    const lng = toDeg(Math.atan2(y, x));
    points.push([lat, lng]);
  }
  return points;
}

function TripRoute({ trip }: { trip: TripMapPoint }) {
  const color = tripColors[trip.transportType] || '#6b7280';
  const emoji = tripEmoji[trip.transportType] || '📍';
  const pathPositions: [number, number][] = useMemo(() => {
    if (trip.transportType === 'flight') {
      return greatCircleArc(trip.originLat, trip.originLng, trip.destLat, trip.destLng);
    }
    return [
      [trip.originLat, trip.originLng],
      [trip.destLat, trip.destLng],
    ];
  }, [trip.originLat, trip.originLng, trip.destLat, trip.destLng, trip.transportType]);

  const dateStr = new Date(trip.tripDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  const label = trip.tripNumber || transportLabelsMap[trip.transportType];

  function makeEndpointIcon(name: string, isOrigin: boolean) {
    const bg = isOrigin ? '#22c55e' : color;
    const short = name.length > 8 ? name.slice(0, 8) + '…' : name;
    return L.divIcon({
      className: '',
      iconSize: undefined as unknown as [number, number],
      iconAnchor: [0, 14],
      html: `<div style="display:inline-flex;align-items:center;gap:4px;background:${bg};color:#fff;padding:2px 8px;border-radius:14px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.25);border:2px solid #fff;max-width:160px;overflow:hidden;text-overflow:ellipsis;">
        <span style="flex-shrink:0">${isOrigin ? '🛫' : '🛬'}</span>
        <span style="overflow:hidden;text-overflow:ellipsis">${short}</span>
      </div>`,
    });
  }

  return (
    <>
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
      <Polyline
        positions={pathPositions}
        pathOptions={{ color, weight: 8, opacity: 0.15, lineCap: 'round' }}
      />
      <Marker
        position={[trip.originLat, trip.originLng]}
        icon={makeEndpointIcon(trip.originName, true)}
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
      <Marker
        position={[trip.destLat, trip.destLng]}
        icon={makeEndpointIcon(trip.destName, false)}
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

function ClusterTrajectory({ cluster }: { cluster: MediaCluster }) {
  const positions: [number, number][] = cluster.photos.map((p) => [p.latitude, p.longitude]);

  const centroid = useMemo<[number, number]>(() => {
    const lat = cluster.photos.reduce((s, p) => s + p.latitude, 0) / cluster.photos.length;
    const lng = cluster.photos.reduce((s, p) => s + p.longitude, 0) / cluster.photos.length;
    return [lat, lng];
  }, [cluster.photos]);

  const countIcon = useMemo(() => {
    const label = cluster.tripName
      ? cluster.tripName.length > 10
        ? cluster.tripName.slice(0, 10) + '…'
        : cluster.tripName
      : `${cluster.photos.length} 张`;
    return L.divIcon({
      className: '',
      iconSize: [90, 24],
      iconAnchor: [45, 12],
      html: `<div style="display:inline-flex;align-items:center;gap:4px;background:${cluster.color};color:#fff;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.3);border:2px solid #fff;">
        🗂️ ${label}
      </div>`,
    });
  }, [cluster.color, cluster.tripName, cluster.photos.length]);

  const startStr = new Date(cluster.startDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  const endStr = new Date(cluster.endDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });

  return (
    <>
      <Polyline
        positions={positions}
        pathOptions={{ color: cluster.color, weight: 2, opacity: 0.7, dashArray: '4,4' }}
      >
        <Tooltip sticky>
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            {cluster.tripName && <div style={{ fontWeight: 700 }}>{cluster.tripName}</div>}
            <div style={{ color: '#6b7280' }}>{startStr} – {endStr}</div>
            <div>{cluster.photos.length} 张照片</div>
          </div>
        </Tooltip>
      </Polyline>
      <Marker position={centroid} icon={countIcon}>
        <Popup>
          <div style={{ fontSize: 12, lineHeight: 1.6, minWidth: 150 }}>
            {cluster.tripName && (
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{cluster.tripName}</div>
            )}
            <div style={{ color: '#6b7280' }}>{startStr} – {endStr}</div>
            <div>{cluster.photos.length} 张照片</div>
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

type LayerKey = 'photos' | 'trips' | 'clusters';

export default function MapView() {
  const { data: geoMedia, isLoading } = useGeoMedia();
  const { data: tripRoutes } = useTripMapData();
  const navigate = useNavigate();
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    photos: true,
    trips: true,
    clusters: true,
  });

  const toggleLayer = (key: LayerKey) =>
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  const clusters = useMemo(
    () => computeClusters(geoMedia ?? [], tripRoutes ?? []),
    [geoMedia, tripRoutes],
  );

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

  const layerDefs: { key: LayerKey; label: string; emoji: string; count: number }[] = [
    { key: 'photos',   label: '照片',    emoji: '📍', count: geoMedia?.length ?? 0 },
    { key: 'trips',    label: '行程',    emoji: '✈️', count: tripRoutes?.length ?? 0 },
    { key: 'clusters', label: '聚类轨迹', emoji: '🗂️', count: clusters.length },
  ];

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
        {layers.trips && tripRoutes?.map((trip) => (
          <TripRoute key={trip.id} trip={trip} />
        ))}
        {layers.clusters && clusters.map((cluster) => (
          <ClusterTrajectory key={cluster.id} cluster={cluster} />
        ))}
        {layers.photos && geoMedia?.map((point) => (
          <PhotoMarker
            key={point.id}
            point={point}
            onClick={() => navigate(`/media/${point.id}`)}
          />
        ))}
      </MapContainer>

      {/* Layer toggle — top right */}
      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-xl shadow-md z-[1000] px-3 py-2 flex flex-col gap-1.5 min-w-[110px]">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">图层</p>
        {layerDefs.map(({ key, label, emoji, count }) => (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            disabled={count === 0}
            className={[
              'flex items-center gap-2 text-left rounded-lg px-2 py-1 text-xs font-medium transition-colors',
              count === 0
                ? 'text-gray-300 cursor-not-allowed'
                : layers[key]
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-50',
            ].join(' ')}
          >
            <span className="text-sm leading-none">{emoji}</span>
            <span className="flex-1">{label}</span>
            <span className={[
              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
              layers[key] && count > 0 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400',
            ].join(' ')}>{count}</span>
          </button>
        ))}
      </div>

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
