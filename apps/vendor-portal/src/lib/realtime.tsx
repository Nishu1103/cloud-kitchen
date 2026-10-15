'use client';

import { createRealtimeClient, WS_EVENTS, type RealtimeStatus } from '@ck/sdk';
import { toast } from '@ck/ui';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { playNewOrderAlert } from './alert-sound';
import { env } from './env';
import { keys } from './query-keys';
import { useSession } from './session';

const RealtimeContext = createContext<RealtimeStatus>('disconnected');

interface OrderEvent {
  orderId?: string;
  code?: string;
  status?: string;
}

/**
 * Keeps the open board in sync.
 *
 * This matters more here than on the customer side: a kitchen leaves this screen open
 * for a whole service, and an order it never sees is an order it never cooks. Socket
 * events invalidate React Query caches rather than writing into them, so the board is
 * always rendering server truth rather than a notification payload.
 *
 * Push notifications cover the case where the tablet screen is off; this covers the
 * case where somebody is looking at it.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>('disconnected');

  useEffect(() => {
    // Signed out: the handshake would be rejected, and there is no kitchen to watch.
    if (!user) {
      setStatus('disconnected');
      return;
    }

    const client = createRealtimeClient({
      url: env.wsUrl,
      onStatusChange: setStatus,
    });

    const off = [
      client.on<OrderEvent>(WS_EVENTS.ORDER_NEW, (event) => {
        void queryClient.invalidateQueries({ queryKey: ['orders'] });
        void queryClient.invalidateQueries({ queryKey: ['analytics'] });
        playNewOrderAlert();
        toast('New order', {
          description: event.code ? `Order ${event.code} is waiting to be accepted.` : undefined,
        });
      }),
      client.on<OrderEvent>(WS_EVENTS.ORDER_UPDATED, (event) => {
        void queryClient.invalidateQueries({ queryKey: ['orders'] });
        if (event.orderId) {
          void queryClient.invalidateQueries({ queryKey: keys.order(event.orderId) });
        }
      }),
      client.on(WS_EVENTS.VENDOR_STOCK_UPDATED, () => {
        // Another device in the same kitchen changed stock; keep the menu honest.
        void queryClient.invalidateQueries({ queryKey: ['products'] });
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
