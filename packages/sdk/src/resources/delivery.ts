import type {
  DeliveryAssignment,
  DeliveryOffer,
  DeliveryProfileSummary,
  PaginatedResult,
} from '@ck/types';
import type { ApiClient } from '../client';
import type { DeliveryStatusPayload, PageQuery } from '../contracts';

/** The delivery partner app: offers, active jobs, handover and earnings. */
export function deliveryResource(client: ApiClient) {
  return {
    /**
     * The open pool, oldest first.
     *
     * `reason: 'offline'` comes back with an empty list rather than an error, because
     * "you are offline" is a state the screen should explain, not a failure.
     */
    offers(): Promise<{ items: DeliveryOffer[]; reason?: 'offline' }> {
      return client.get('/delivery/offers');
    },

    /** `active: true` (the default) is the current run; `false` is history. */
    jobs(
      query?: PageQuery & { active?: boolean },
    ): Promise<PaginatedResult<DeliveryAssignment>> {
      return client.get('/delivery/jobs', { query });
    },

    /** First accept wins; losing the race returns `CONFLICT`, which is not retriable. */
    accept(id: string): Promise<DeliveryAssignment> {
      return client.post(`/delivery/jobs/${id}/accept`);
    },

    /** Removes the job from this partner's pool for good; others still see it. */
    decline(id: string): Promise<{ declined: boolean }> {
      return client.post(`/delivery/jobs/${id}/decline`);
    },

    /**
     * Moves a job forward. Completing it requires the customer's handover code, which is
     * checked against the order server-side and capped at five attempts.
     */
    updateStatus(id: string, payload: DeliveryStatusPayload): Promise<DeliveryAssignment> {
      return client.patch(`/delivery/jobs/${id}/status`, payload);
    },

    setOnline(isOnline: boolean): Promise<{ isOnline: boolean }> {
      return client.patch('/delivery/availability', { isOnline });
    },

    /**
     * Location ping while on a job, in GeoJSON order.
     *
     * No retries: a dropped ping is superseded by the next one seconds later, and
     * replaying it would report a position the rider has already left.
     */
    pingLocation(longitude: number, latitude: number): Promise<{ updated: boolean }> {
      return client.patch(
        '/delivery/location',
        { coordinates: [longitude, latitude] },
        { retries: 0, timeoutMs: 8_000 },
      );
    },

    /** Earnings plus the availability and rating shown on the rider's own screen. */
    earnings(): Promise<DeliveryProfileSummary> {
      return client.get('/delivery/earnings');
    },
  };
}
