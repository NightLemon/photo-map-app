import { useQuery } from '@tanstack/react-query';
import { fetchTrips, fetchTripById, fetchTripMapData, fetchUserStats } from '../services/tripService';

export function useTrips(params?: { transportType?: string }) {
  return useQuery({
    queryKey: ['trips', params],
    queryFn: () => fetchTrips(params),
  });
}

export function useTripById(id: string | undefined) {
  return useQuery({
    queryKey: ['trips', id],
    queryFn: () => fetchTripById(id!),
    enabled: !!id,
  });
}

export function useTripMapData() {
  return useQuery({
    queryKey: ['tripMap'],
    queryFn: fetchTripMapData,
  });
}

export function useUserStats() {
  return useQuery({
    queryKey: ['userStats'],
    queryFn: fetchUserStats,
  });
}
