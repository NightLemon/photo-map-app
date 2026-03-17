import { useQuery } from '@tanstack/react-query';
import { fetchAlbums, fetchAlbumById, fetchAlbumMedia } from '../services/mediaService';

export function useAlbums() {
  return useQuery({
    queryKey: ['albums'],
    queryFn: fetchAlbums,
  });
}

export function useAlbumById(id: string | undefined) {
  return useQuery({
    queryKey: ['album', id],
    queryFn: () => fetchAlbumById(id!),
    enabled: !!id,
  });
}

export function useAlbumMedia(albumId: string | undefined) {
  return useQuery({
    queryKey: ['albumMedia', albumId],
    queryFn: () => fetchAlbumMedia(albumId!),
    enabled: !!albumId,
  });
}
