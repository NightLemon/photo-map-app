import { useQuery } from '@tanstack/react-query';
import { fetchMediaList, fetchMediaById, fetchGeoMedia } from '../services/mediaService';

export function useMediaList(params?: {
  type?: string;
  hasLocation?: boolean;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: ['media', params],
    queryFn: () => fetchMediaList(params),
  });
}

export function useMediaById(id: string | undefined) {
  return useQuery({
    queryKey: ['media', id],
    queryFn: () => fetchMediaById(id!),
    enabled: !!id,
  });
}

export function useGeoMedia() {
  return useQuery({
    queryKey: ['geoMedia'],
    queryFn: fetchGeoMedia,
  });
}
