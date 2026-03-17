export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  createdAt: string;
}

export type MediaType = 'photo' | 'video';

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
