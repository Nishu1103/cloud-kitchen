'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import {
  readGeoPermission,
  startLocationTracking,
  type Coordinates,
  type GeoPermission,
} from '@/lib/geo';

/**
 * Reports the rider's position to the API while a job is in progress.
 *
 * `active` is the privacy switch and the battery switch at once: it is true only when
 * the rider is actually carrying an order, so an idle rider with the app open is never
 * tracked. Nothing here is retried - the SDK sends pings with retries off, because a
 * dropped fix is superseded by the next one seconds later and replaying it would report
 * a position the rider has already left.
 */
export function useLocationPing(active: boolean) {
  const [permission, setPermission] = useState<GeoPermission>('prompt');
  const [lastFix, setLastFix] = useState<Coordinates>();
  // Held in a ref so a re-render mid-run does not tear down the watch and restart the
  // GPS, which is the expensive part.
  const stopRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    void readGeoPermission().then(setPermission);
  }, []);

  useEffect(() => {
    if (!active) {
      stopRef.current?.();
      stopRef.current = undefined;
      return;
    }

    stopRef.current = startLocationTracking({
      onPermissionChange: setPermission,
      onFix: (coordinates) => {
        setLastFix(coordinates);
        // Fire and forget: a failed ping must never surface as an error toast on a
        // screen the rider is using to find a hostel.
        void api.delivery.pingLocation(coordinates[0], coordinates[1]).catch(() => {});
      },
    });

    return () => {
      stopRef.current?.();
      stopRef.current = undefined;
    };
  }, [active]);

  return { permission, lastFix, isTracking: active && permission === 'granted' };
}
