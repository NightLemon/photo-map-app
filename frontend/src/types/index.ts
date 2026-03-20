export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  location: string;
  website: string;
  createdAt: string;
}

export type MediaType = 'photo' | 'video';
export type TransportType = 'flight' | 'train' | 'ship' | 'bus' | 'drive' | 'other';

export interface MediaItem {
  id: string;
  userId: string;
  type: MediaType;
  filename: string;
  originalFilename: string;
  url: string;
  thumbnailUrl: string;
  sizeBytes: number;
  mimeType: string;
  width: number;
  height: number;
  durationSeconds?: number;
  latitude?: number;
  longitude?: number;
  takenAt?: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Album {
  id: string;
  userId: string;
  name: string;
  description: string;
  coverMediaId?: string;
  coverThumbnailUrl?: string;
  mediaCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GeoMediaPoint {
  id: string;
  latitude: number;
  longitude: number;
  thumbnailUrl: string;
  filename: string;
  originalFilename: string;
  takenAt?: string;
  description: string;
}

export interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  mediaId?: string;
  error?: string;
}

export interface ZipUploadError {
  filename: string;
  reason: string;
}

export interface ZipUploadResult {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  items: MediaItem[];
  errors: ZipUploadError[];
}

export interface UserStats {
  mediaCount: number;
  geoCount: number;
  albumCount: number;
  tripCount: number;
}

export interface Trip {
  id: string;
  userId: string;
  tripDate: string;
  transportType: TransportType;
  carrier: string;
  tripNumber: string;
  originName: string;
  originLat: number;
  originLng: number;
  destName: string;
  destLat: number;
  destLng: number;
  notes: string;
  showOnMap: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TripMapPoint {
  id: string;
  transportType: TransportType;
  tripNumber: string;
  tripDate: string;
  originName: string;
  originLat: number;
  originLng: number;
  destName: string;
  destLat: number;
  destLng: number;
}

export interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

export interface Station {
  name: string;
  code: string;
  lat: number;
  lng: number;
}

export interface MediaCluster {
  id: string;
  photos: GeoMediaPoint[];
  startDate: string;
  endDate: string;
  tripName?: string;
  matchedTripId?: string;
  color: string;
}
