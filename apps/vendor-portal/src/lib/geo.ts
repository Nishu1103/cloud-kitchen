import type { GeoPoint } from '@ck/types';

const EARTH_KM = 6371;

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Straight-line distance between two GeoJSON points.
 *
 * Used only as a glanceable figure on an order ticket. Road distance would need a
 * maps provider, which this portal does not call.
 */
export function distanceKm(from: GeoPoint, to: GeoPoint): number {
  const [lng1, lat1] = from.coordinates;
  const [lng2, lat2] = to.coordinates;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function formatKm(km: number): string {
  if (km < 0.1) return '< 0.1 km';
  return `${km.toFixed(1)} km`;
}
