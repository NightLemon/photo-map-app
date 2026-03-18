import api from './api';
import type { Trip, TripMapPoint, UserStats, Airport, Station } from '../types';

/** Convert camelCase keys to snake_case for backend */
function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

// ── Trips ──

export async function fetchTrips(params?: { transportType?: string }): Promise<Trip[]> {
  const res = await api.get('/trips', { params: params ? toSnakeCase(params as Record<string, unknown>) : undefined });
  return res.data;
}

export async function fetchTripById(id: string): Promise<Trip> {
  const res = await api.get(`/trips/${id}`);
  return res.data;
}

export async function fetchTripMapData(): Promise<TripMapPoint[]> {
  const res = await api.get('/trips/map');
  return res.data;
}

export async function createTrip(data: Omit<Trip, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Trip> {
  const res = await api.post('/trips', toSnakeCase(data as unknown as Record<string, unknown>));
  return res.data;
}

export async function updateTrip(id: string, data: Partial<Trip>): Promise<Trip> {
  const res = await api.patch(`/trips/${id}`, toSnakeCase(data as unknown as Record<string, unknown>));
  return res.data;
}

export async function toggleTripMap(id: string): Promise<Trip> {
  const res = await api.patch(`/trips/${id}/toggle-map`);
  return res.data;
}

export async function deleteTrip(id: string): Promise<void> {
  await api.delete(`/trips/${id}`);
}

export async function importTripsFromExcel(file: File): Promise<{ imported: number; errors: string[]; totalRows: number }> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post('/trips/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export function getTemplateDownloadUrl(): string {
  return `${api.defaults.baseURL}/trips/template`;
}

// ── Profile ──

export async function updateProfile(data: { bio?: string; location?: string; website?: string }) {
  const res = await api.patch('/auth/profile', data);
  return res.data;
}

export async function fetchUserStats(): Promise<UserStats> {
  const res = await api.get('/auth/stats');
  return res.data;
}

// ── Transport Autocomplete ──

export async function searchAirports(query: string): Promise<Airport[]> {
  if (!query || query.length < 1) return [];
  const res = await api.get('/transport/airports', { params: { q: query, limit: 8 } });
  return res.data;
}

export async function searchStations(query: string): Promise<Station[]> {
  if (!query || query.length < 1) return [];
  const res = await api.get('/transport/stations', { params: { q: query, limit: 8 } });
  return res.data;
}
