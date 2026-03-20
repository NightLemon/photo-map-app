import type { User, MediaItem, Album, GeoMediaPoint } from '../types';

// ---- Sample thumbnail URLs (Unsplash placeholder images) ----
const SAMPLE_PHOTOS = [
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1540979388789-6cee28a1cdc9?w=400&h=300&fit=crop',
];

// Famous landmarks / city locations for realistic demo pins
const LOCATIONS: { name: string; lat: number; lng: number; desc: string }[] = [
  { name: 'Tokyo Tower', lat: 35.6586, lng: 139.7454, desc: '东京塔日落' },
  { name: 'Eiffel Tower', lat: 48.8584, lng: 2.2945, desc: '巴黎铁塔夜景' },
  { name: 'Statue of Liberty', lat: 40.6892, lng: -74.0445, desc: '自由女神像' },
  { name: 'Sydney Opera House', lat: -33.8568, lng: 151.2153, desc: '悉尼歌剧院' },
  { name: 'Great Wall', lat: 40.4319, lng: 116.5704, desc: '长城秋色' },
  { name: 'Machu Picchu', lat: -13.1631, lng: -72.545, desc: '马丘比丘晨雾' },
  { name: 'Colosseum', lat: 41.8902, lng: 12.4922, desc: '罗马斗兽场' },
  { name: 'Taj Mahal', lat: 27.1751, lng: 78.0421, desc: '泰姬陵黎明' },
  { name: 'Santorini', lat: 36.3932, lng: 25.4615, desc: '圣托里尼蓝顶教堂' },
  { name: 'Mount Fuji', lat: 35.3606, lng: 138.7274, desc: '富士山樱花季' },
  { name: 'Banff', lat: 51.1784, lng: -115.5708, desc: 'Banff 国家公园湖景' },
  { name: 'Iceland', lat: 64.1466, lng: -21.9426, desc: '冰岛极光' },
];

export const mockUser: User = {
  id: 'user-001',
  email: 'demo@photomap.app',
  displayName: 'Demo User',
  avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
  bio: '',
  location: '',
  website: '',
  createdAt: '2025-01-15T08:00:00Z',
};

// takenAt grouped into realistic trips so the clustering algorithm fires:
//   Trip A: Japan  2025-03-10 ~ 03-13  (Tokyo Tower, Mount Fuji)
//   Trip B: Europe 2025-06-05 ~ 06-09  (Eiffel Tower, Colosseum, Santorini)
//   Trip C: Nature 2025-09-20 ~ 09-22  (Banff, Iceland)
//   Singletons: Great Wall, Statue of Liberty, Sydney Opera House, Machu Picchu, Taj Mahal
const TAKEN_ATS: string[] = [
  '2025-03-10T09:30:00Z', // Tokyo Tower
  '2025-06-05T14:00:00Z', // Eiffel Tower
  '2025-11-01T10:00:00Z', // Statue of Liberty  (singleton)
  '2025-11-15T08:00:00Z', // Sydney Opera House (singleton)
  '2025-04-20T07:00:00Z', // Great Wall         (singleton)
  '2025-09-20T11:00:00Z', // Machu Picchu — reuse as Banff stand-in for cluster C
  '2025-06-07T16:00:00Z', // Colosseum
  '2025-12-01T06:00:00Z', // Taj Mahal          (singleton)
  '2025-06-09T12:00:00Z', // Santorini
  '2025-03-13T07:00:00Z', // Mount Fuji
  '2025-09-22T15:00:00Z', // Banff
  '2025-09-21T09:00:00Z', // Iceland
];

export const mockMedia: MediaItem[] = LOCATIONS.map((loc, i) => ({
  id: `media-${String(i + 1).padStart(3, '0')}`,
  userId: 'user-001',
  type: i === 5 ? 'video' as const : 'photo' as const,
  filename: `${loc.name.toLowerCase().replace(/\s/g, '-')}.jpg`,
  originalFilename: `IMG_${2000 + i}.jpg`,
  url: SAMPLE_PHOTOS[i % SAMPLE_PHOTOS.length],
  thumbnailUrl: SAMPLE_PHOTOS[i % SAMPLE_PHOTOS.length],
  sizeBytes: 2_000_000 + i * 512_000,
  mimeType: i === 5 ? 'video/mp4' : 'image/jpeg',
  width: 4032,
  height: 3024,
  durationSeconds: i === 5 ? 30 : undefined,
  latitude: loc.lat,
  longitude: loc.lng,
  takenAt: TAKEN_ATS[i],
  description: loc.desc,
  createdAt: TAKEN_ATS[i],
  updatedAt: TAKEN_ATS[i],
}));

// Add some media without location
for (let i = 0; i < 4; i++) {
  mockMedia.push({
    id: `media-noloc-${i + 1}`,
    userId: 'user-001',
    type: 'photo',
    filename: `studio-shot-${i + 1}.jpg`,
    originalFilename: `STUDIO_${i + 1}.jpg`,
    url: SAMPLE_PHOTOS[(i + 6) % SAMPLE_PHOTOS.length],
    thumbnailUrl: SAMPLE_PHOTOS[(i + 6) % SAMPLE_PHOTOS.length],
    sizeBytes: 1_500_000 + Math.floor(Math.random() * 3_000_000),
    mimeType: 'image/jpeg',
    width: 3000,
    height: 2000,
    takenAt: new Date(2025, 6, i + 1).toISOString(),
    description: `工作室拍摄 #${i + 1}`,
    createdAt: new Date(2025, 6, i + 1).toISOString(),
    updatedAt: new Date(2025, 6, i + 1).toISOString(),
  });
}

export const mockAlbums: Album[] = [
  {
    id: 'album-001',
    userId: 'user-001',
    name: '2025 亚洲之旅',
    description: '日本、中国旅行照片合集',
    coverMediaId: 'media-001',
    coverThumbnailUrl: SAMPLE_PHOTOS[0],
    mediaCount: 3,
    createdAt: '2025-03-01T00:00:00Z',
    updatedAt: '2025-03-15T00:00:00Z',
  },
  {
    id: 'album-002',
    userId: 'user-001',
    name: '欧洲经典',
    description: '巴黎、罗马、圣托里尼',
    coverMediaId: 'media-002',
    coverThumbnailUrl: SAMPLE_PHOTOS[1],
    mediaCount: 3,
    createdAt: '2025-06-01T00:00:00Z',
    updatedAt: '2025-06-20T00:00:00Z',
  },
  {
    id: 'album-003',
    userId: 'user-001',
    name: '自然风光',
    description: '国家公园和自然景观',
    coverMediaId: 'media-011',
    coverThumbnailUrl: SAMPLE_PHOTOS[4],
    mediaCount: 4,
    createdAt: '2025-09-01T00:00:00Z',
    updatedAt: '2025-09-10T00:00:00Z',
  },
];

export const mockGeoMedia: GeoMediaPoint[] = mockMedia
  .filter((m) => m.latitude != null && m.longitude != null)
  .map((m) => ({
    id: m.id,
    latitude: m.latitude!,
    longitude: m.longitude!,
    thumbnailUrl: m.thumbnailUrl,
    filename: m.filename,
    originalFilename: m.originalFilename,
    takenAt: m.takenAt,
    description: m.description,
  }));
