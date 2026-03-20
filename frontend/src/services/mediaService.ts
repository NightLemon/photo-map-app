import { config } from '../config';
import { mockMedia, mockAlbums, mockGeoMedia } from '../mocks/data';
import type { MediaItem, Album, GeoMediaPoint, ZipUploadResult, MediaCluster } from '../types';
import api from './api';

// ---------- Media ----------

export async function fetchMediaList(params?: {
  type?: string;
  hasLocation?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ items: MediaItem[]; total: number }> {
  if (config.useMockData) {
    let items = [...mockMedia];
    if (params?.type) items = items.filter((m) => m.type === params.type);
    if (params?.hasLocation !== undefined) {
      items = params.hasLocation
        ? items.filter((m) => m.latitude != null)
        : items.filter((m) => m.latitude == null);
    }
    const page = params?.page ?? 1;
    const size = params?.pageSize ?? 20;
    const start = (page - 1) * size;
    return { items: items.slice(start, start + size), total: items.length };
  }
  const res = await api.get('/media', { params });
  return res.data;
}

export async function fetchMediaById(id: string): Promise<MediaItem | undefined> {
  if (config.useMockData) {
    return mockMedia.find((m) => m.id === id);
  }
  const res = await api.get(`/media/${id}`);
  return res.data;
}

export async function fetchGeoMedia(): Promise<GeoMediaPoint[]> {
  if (config.useMockData) {
    return mockGeoMedia;
  }
  const res = await api.get('/media/map');
  return res.data;
}

export async function uploadMedia(file: File, onProgress?: (pct: number) => void): Promise<MediaItem> {
  if (config.useMockData) {
    // Simulate upload delay
    await new Promise((r) => setTimeout(r, 1500));
    onProgress?.(100);
    return mockMedia[0];
  }
  const form = new FormData();
  form.append('file', file);
  const res = await api.post('/media/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100));
    },
  });
  return res.data;
}

export async function deleteMedia(id: string): Promise<void> {
  if (config.useMockData) return;
  await api.delete(`/media/${id}`);
}

export async function uploadZip(file: File, onProgress?: (pct: number) => void): Promise<ZipUploadResult> {
  if (config.useMockData) {
    await new Promise((r) => setTimeout(r, 2000));
    onProgress?.(100);
    return { total: 0, succeeded: 0, failed: 0, skipped: 0, items: [], errors: [] };
  }
  const form = new FormData();
  form.append('file', file);
  const res = await api.post('/media/upload-zip', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100));
    },
  });
  return res.data;
}

export async function updateMedia(id: string, data: Partial<MediaItem>): Promise<MediaItem> {
  if (config.useMockData) {
    const item = mockMedia.find((m) => m.id === id);
    return { ...item!, ...data };
  }
  const res = await api.patch(`/media/${id}`, data);
  return res.data;
}

// ---------- Albums ----------

export async function fetchAlbums(): Promise<Album[]> {
  if (config.useMockData) return mockAlbums;
  const res = await api.get('/albums');
  return res.data;
}

export async function fetchAlbumById(id: string): Promise<Album | undefined> {
  if (config.useMockData) return mockAlbums.find((a) => a.id === id);
  const res = await api.get(`/albums/${id}`);
  return res.data;
}

export async function fetchAlbumMedia(albumId: string): Promise<MediaItem[]> {
  if (config.useMockData) {
    // Return first N media as album content
    return mockMedia.slice(0, 4);
  }
  const res = await api.get(`/albums/${albumId}/media`);
  return res.data;
}

export async function createAlbum(data: { name: string; description: string }): Promise<Album> {
  if (config.useMockData) {
    return {
      id: `album-${Date.now()}`,
      userId: 'user-001',
      ...data,
      mediaCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  const res = await api.post('/albums', data);
  return res.data;
}

export async function deleteAlbum(id: string): Promise<void> {
  if (config.useMockData) return;
  await api.delete(`/albums/${id}`);
}

export async function addMediaToAlbum(albumId: string, mediaId: string, sortOrder: number): Promise<void> {
  if (config.useMockData) return;
  await api.post(`/albums/${albumId}/media`, { media_id: mediaId, sort_order: sortOrder });
}

export async function createAlbumFromCluster(cluster: MediaCluster): Promise<Album> {
  const name = cluster.tripName ?? `行程 ${cluster.startDate.slice(0, 10)}`;
  const description = `${cluster.startDate.slice(0, 10)} — ${cluster.endDate.slice(0, 10)}，共 ${cluster.photos.length} 张`;
  const album = await createAlbum({ name, description });
  for (let i = 0; i < cluster.photos.length; i++) {
    await addMediaToAlbum(album.id, cluster.photos[i].id, i);
  }
  return album;
}
