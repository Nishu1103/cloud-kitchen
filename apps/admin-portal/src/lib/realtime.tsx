'use client';

import { createRealtimeClient, WS_EVENTS, type RealtimeStatus } from '@ck/sdk';
import { toast } from '@ck/ui';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { env } from './env';
import { keys } from './query-keys';
import { useSession } from './session';

const RealtimeContext = createContext<RealtimeStatus>('disconnected');

/**
 * Keeps operator screens in sync: a new vendor application, a complaint, an order
 * refund. Socket events invalidate React Query caches rather than writing into them,
 * so every table is always rendering server truth.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>('disconnected');

  useEffect(() => {
    if (!user) {
      setStatus('disconnected');
      return;
    }

    const client = createRealtimeClient({
      url: env.wsUrl,
      onStatusChange: setStatus,
    });

    const off = [
      client.on(WS_EVENTS.ORDER_UPDATED, () => {
        void queryClient.invalidateQueries({ queryKey: ['orders'] });
        void queryClient.invalidateQueries({ queryKey: ['analytics'] });
      }),
      client.on<{ title?: string; body?: string }>(WS_EVENTS.NOTIFICATION_NEW, (event) => {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        void queryClient.invalidateQueries({ queryKey: ['vendors'] });
        void queryClient.invalidateQueries({ queryKey: ['tickets'] });
        if (event.title) toast(event.title, { description: event.body });
      }),
      client.on<{ unread: number }>(WS_EVENTS.NOTIFICATION_COUNT, (event) => {
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
