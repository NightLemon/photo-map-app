import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGeoMedia } from '../hooks/useMedia';
import type { GeoMediaPoint } from '../types';

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

export default function MapView() {
  const { data: geoMedia, isLoading } = useGeoMedia();
  const navigate = useNavigate();

  // Calculate map center from data, default to world center
  const center = useMemo<[number, number]>(() => {
    if (!geoMedia || geoMedia.length === 0) return [30, 105]; // Default: China
    const avgLat = geoMedia.reduce((s, p) => s + p.latitude, 0) / geoMedia.length;
    const avgLng = geoMedia.reduce((s, p) => s + p.longitude, 0) / geoMedia.length;
    return [avgLat, avgLng];
  }, [geoMedia]);

  const zoom = useMemo(() => {
    if (!geoMedia || geoMedia.length === 0) return 3;
    if (geoMedia.length === 1) return 12;
    // Calculate bounding box spread to determine zoom
    const lats = geoMedia.map((p) => p.latitude);
    const lngs = geoMedia.map((p) => p.longitude);
    const latSpread = Math.max(...lats) - Math.min(...lats);
    const lngSpread = Math.max(...lngs) - Math.min(...lngs);
    const maxSpread = Math.max(latSpread, lngSpread);
    if (maxSpread > 100) return 2;
    if (maxSpread > 50) return 3;
    if (maxSpread > 20) return 4;
    if (maxSpread > 10) return 5;
    if (maxSpread > 5) return 7;
    return 10;
  }, [geoMedia]);

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
      </MapContainer>

      {/* Stats overlay */}
      <div className="absolute top-3 left-12 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-sm z-[1000]">
        <p className="text-sm font-medium text-gray-700">
          📍 {geoMedia?.length ?? 0} 个定位媒体
        </p>
      </div>

      {/* Empty state */}
      {(!geoMedia || geoMedia.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center z-[1000] pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 text-center shadow-lg">
            <p className="text-lg font-medium text-gray-700">还没有带定位的照片</p>
            <p className="text-sm text-gray-500 mt-1">上传包含 GPS 信息的照片后，会自动标记在地图上</p>
          </div>
        </div>
      )}
    </div>
  );
}
