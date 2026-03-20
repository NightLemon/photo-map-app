import type { GeoMediaPoint, TripMapPoint, MediaCluster } from '../types';

const CLUSTER_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
  '#84cc16', '#14b8a6',
];

const TIME_GAP_HOURS = 8;
const DISTANCE_GAP_KM = 500;
const MIN_CLUSTER_SIZE = 2;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/** Extract YYYY-MM-DD from an ISO datetime string */
function toDateStr(iso: string): string {
  return iso.slice(0, 10);
}

export function computeClusters(
  photos: GeoMediaPoint[],
  trips: TripMapPoint[],
): MediaCluster[] {
  // Step A: filter and sort
  const valid = photos.filter(
    (p) => p.takenAt && p.latitude != null && p.longitude != null,
  );
  valid.sort((a, b) => a.takenAt!.localeCompare(b.takenAt!));

  if (valid.length === 0) return [];

  // Step B+C: sequential split pass
  const rawGroups: GeoMediaPoint[][] = [];
  let current: GeoMediaPoint[] = [valid[0]];

  for (let i = 1; i < valid.length; i++) {
    const prev = valid[i - 1];
    const curr = valid[i];
    const gapHours =
      (Date.parse(curr.takenAt!) - Date.parse(prev.takenAt!)) / 3_600_000;
    const distKm = haversineKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude);

    if (gapHours > TIME_GAP_HOURS || distKm > DISTANCE_GAP_KM) {
      rawGroups.push(current);
      current = [curr];
    } else {
      current.push(curr);
    }
  }
  rawGroups.push(current);

  // Step D: filter minimum size
  const groups = rawGroups.filter((g) => g.length >= MIN_CLUSTER_SIZE);

  // Step E: match to trip records
  return groups.map((photos, idx) => {
    const startDate = photos[0].takenAt!;
    const endDate = photos[photos.length - 1].takenAt!;
    const startDay = toDateStr(startDate);
    const endDay = toDateStr(endDate);

    const matchedTrips = trips.filter((t) => {
      const d = t.tripDate.slice(0, 10);
      return d >= startDay && d <= endDay;
    });

    let tripName: string | undefined;
    let matchedTripId: string | undefined;

    if (matchedTrips.length === 1) {
      tripName = `${matchedTrips[0].originName}→${matchedTrips[0].destName}`;
      matchedTripId = matchedTrips[0].id;
    } else if (matchedTrips.length > 1) {
      const sorted = [...matchedTrips].sort((a, b) =>
        a.tripDate.localeCompare(b.tripDate),
      );
      const nodes = [
        sorted[0].originName,
        ...sorted.map((t) => t.destName),
      ];
      tripName = nodes.join('→');
      matchedTripId = sorted[0].id;
    }

    return {
      id: `cluster-${idx}`,
      photos,
      startDate,
      endDate,
      tripName,
      matchedTripId,
      color: CLUSTER_COLORS[idx % CLUSTER_COLORS.length],
    };
  });
}
