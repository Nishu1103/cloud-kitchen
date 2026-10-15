/**
 * Location reporting.
 *
 * A rider's position is only anybody's business while they are carrying somebody's
 * food, so tracking is bound to having an active job and stops the moment the last one
 * is delivered. Nothing is stored on the device, and the caller decides when to start.
 *
 * Everything degrades quietly. A denied permission is a normal state, not an error: the
 * job still works, the customer just does not see the rider move on the map.
 */

/** GeoJSON order, which is what the API expects. */
export type Coordinates = [longitude: number, latitude: number];

export type GeoPermission = 'unsupported' | 'prompt' | 'granted' | 'denied';

/**
 * Minimum gap between pings.
 *
 * The device reports far more often than this while moving. Sending every fix would
 * drain a phone battery over a shift and pointlessly hammer the API, and the customer's
 * map does not benefit from sub-15-second precision.
 */
const MIN_PING_INTERVAL_MS = 15_000;

/** Below this, the rider has not meaningfully moved and the fix is just GPS jitter. */
const MIN_PING_DISTANCE_M = 40;

export function geoSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/**
 * Reads the permission without prompting, so the UI can explain the situation before
 * asking. The Permissions API is missing on older Safari, where 'prompt' is the honest
 * answer: the only way to find out there is to ask.
 */
export async function readGeoPermission(): Promise<GeoPermission> {
  if (!geoSupported()) return 'unsupported';
  if (!('permissions' in navigator)) return 'prompt';

  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state as GeoPermission;
  } catch {
    return 'prompt';
  }
}

/** Metres between two fixes. Haversine is far more precision than campus distances need. */
export function distanceMetres(a: Coordinates, b: Coordinates): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface LocationTrackerOptions {
  /** Called with a fix worth reporting. Failures are the caller's problem to swallow. */
  onFix: (coordinates: Coordinates) => void;
  onPermissionChange?: (permission: GeoPermission) => void;
}

/**
 * Watches position and calls back only when a fix is worth sending.
 *
 * `watchPosition` rather than an interval of `getCurrentPosition`: the OS batches
 * updates from a watch and can serve them from a fix it already has, which costs
 * noticeably less battery over a two-hour shift.
 */
export function startLocationTracking(options: LocationTrackerOptions): () => void {
  if (!geoSupported()) {
    options.onPermissionChange?.('unsupported');
    return () => {};
  }

  let lastSentAt = 0;
  let lastSent: Coordinates | undefined;

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      options.onPermissionChange?.('granted');

      const fix: Coordinates = [position.coords.longitude, position.coords.latitude];
      const now = Date.now();
      const movedEnough = !lastSent || distanceMetres(lastSent, fix) >= MIN_PING_DISTANCE_M;
      const waitedEnough = now - lastSentAt >= MIN_PING_INTERVAL_MS;

      // The first fix always goes out; after that, both a real move and a real gap are
      // required, so standing still at a hostel gate stops generating traffic.
      if (lastSent && !(movedEnough && waitedEnough)) return;

      lastSent = fix;
      lastSentAt = now;
      options.onFix(fix);
    },
    (error) => {
      options.onPermissionChange?.(
        error.code === error.PERMISSION_DENIED ? 'denied' : 'prompt',
      );
    },
    {
      enableHighAccuracy: true,
      // A fix up to half a minute old is fine for a map pin and avoids waking the GPS.
      maximumAge: 30_000,
      timeout: 20_000,
    },
  );

  return () => navigator.geolocation.clearWatch(watchId);
}

/**
 * A `geo:` link, which hands navigation to whatever map app the rider actually uses
 * instead of embedding a third-party SDK and its trackers in the portal.
 */
export function mapLink(coordinates: Coordinates | undefined, label: string): string | null {
  if (!coordinates) return null;
  const [longitude, latitude] = coordinates;
  return `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(label)})`;
}
