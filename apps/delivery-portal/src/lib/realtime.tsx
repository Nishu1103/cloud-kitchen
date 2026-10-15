'use client';

import { createRealtimeClient, WS_EVENTS, type DeliveryOfferEvent, type RealtimeStatus } from '@ck/sdk';
import { formatMoney } from '@ck/types';
import { toast } from '@ck/ui';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { playOfferAlert } from './alert';
import { env } from './env';
import { keys } from './query-keys';
import { useSession } from './session';

const RealtimeContext = createContext<RealtimeStatus>('disconnected');

/**
 * Keeps the job list live.
 *
 * Offers go to every online rider at once and the first to accept wins, so seconds
 * matter: a rider who learns about a job on the next poll has already lost it. Socket
 * events invalidate React Query caches rather than writing into them, so the list is
 * always rendering server truth - by the time it repaints, somebody else may have taken
 * the job, and the refetch is what reveals that.
 *
 * Push notifications cover the case where the app is backgrounded; this covers the case
 * where the rider is looking at it.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>('disconnected');

  useEffect(() => {
    // Signed out: the handshake would be rejected, and there are no jobs to watch.
    if (!user) {
      setStatus('disconnected');
      return;
    }

    const client = createRealtimeClient({
      url: env.wsUrl,
      onStatusChange: setStatus,
    });

    const off = [
      client.on<DeliveryOfferEvent>(WS_EVENTS.DELIVERY_OFFER, (event) => {
        void queryClient.invalidateQueries({ queryKey: keys.offers });
        playOfferAlert();
        toast('New delivery available', {
          description: `${event.pickup} → ${event.drop} · ${formatMoney(event.earning)}`,
        });
      }),
      client.on(WS_EVENTS.DELIVERY_UPDATED, () => {
        // Covers an admin reassigning a job and the pool shrinking as others accept.
        void queryClient.invalidateQueries({ queryKey: ['jobs'] });
        void queryClient.invalidateQueries({ queryKey: keys.offers });
        void queryClient.invalidateQueries({ queryKey: keys.earnings });
      }),
      client.on(WS_EVENTS.ORDER_UPDATED, () => {
        // A cancelled order pulls the job out from under the rider mid-run.
        void queryClient.invalidateQueries({ queryKey: ['jobs'] });
      }),
      client.on<{ title?: string; body?: string }>(WS_EVENTS.NOTIFICATION_NEW, (event) => {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        if (event.title) toast(event.title, { description: event.body });
      }),
      client.on<{ unread: number }>(WS_EVENTS.NOTIFICATION_COUNT, (event) => {
        // Counts are authoritative and cheap, so write them straight into the cache.
        queryClient.setQueryData(keys.unreadCount, { unread: event.unread });
      }),
    ];

    return () => {
      off.forEach((unsubscribe) => unsubscribe());
      client.disconnect();
    };
  }, [user, queryClient]);

  return <RealtimeContext.Provider value={status}>{children}</RealtimeContext.Provider>;
}

export function useRealtimeStatus(): RealtimeStatus {
  return useContext(RealtimeContext);
}
