'use client';

import { createRealtimeClient, WS_EVENTS, type RealtimeStatus } from '@ck/sdk';
import { toast } from '@ck/ui';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { env } from './env';
import { keys } from './query-keys';
import { useSession } from './session';

const RealtimeContext = createContext<RealtimeStatus>('disconnected');

interface OrderEvent {
  orderId?: string;
  status?: string;
  message?: string;
}

/**
 * Keeps the open tab in sync.
 *
 * Socket events invalidate React Query caches rather than writing into them: the server
 * is the source of truth for a price or a status, and a payload shaped for a
 * notification is not the same shape as the order detail screen. Push notifications
 * cover the case where no tab is open; this covers the case where one is.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>('disconnected');

  useEffect(() => {
    // Anonymous visitors have nothing to subscribe to; the handshake would be rejected.
    if (!user) {
      setStatus('disconnected');
      return;
    }

    const client = createRealtimeClient({
      url: env.wsUrl,
      onStatusChange: setStatus,
    });

    const off = [
      client.on<OrderEvent>(WS_EVENTS.ORDER_UPDATED, (event) => {
        void queryClient.invalidateQueries({ queryKey: ['orders'] });
        if (event.orderId) {
          void queryClient.invalidateQueries({ queryKey: keys.order(event.orderId) });
        }
      }),
      client.on<{ title?: string; body?: string }>(WS_EVENTS.NOTIFICATION_NEW, (event) => {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        if (event.title) {
          toast(event.title, { description: event.body });
        }
      }),
      client.on<{ unread: number }>(WS_EVENTS.NOTIFICATION_COUNT, (event) => {
        // Counts are authoritative and cheap, so write them straight into the cache.
        queryClient.setQueryData(keys.unreadCount, { unread: event.unread });
      }),
      client.on(WS_EVENTS.DELIVERY_UPDATED, () => {
        void queryClient.invalidateQueries({ queryKey: ['orders'] });
      }),
      client.on(WS_EVENTS.VENDOR_STOCK_UPDATED, () => {
        void queryClient.invalidateQueries({ queryKey: ['vendor-menu'] });
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
