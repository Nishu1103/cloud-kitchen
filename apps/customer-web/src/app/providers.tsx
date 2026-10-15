'use client';

import { isApiError } from '@ck/sdk';
import { Toaster, TooltipProvider } from '@ck/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { RealtimeProvider } from '@/lib/realtime';
import { SessionProvider } from '@/lib/session';

/**
 * Client-side providers.
 *
 * The QueryClient is created in state rather than at module scope so each request gets
 * its own cache during server rendering; a shared one would leak one student's orders
 * into another's response.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Campus menus change on the order of minutes, not seconds.
            staleTime: 60_000,
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: true,
            retry: (failureCount, error) => {
              // A rejected request is a decision, not a hiccup: retrying a 403 or a
              // validation failure just burns the rate limit. The SDK already retries
              // transport failures.
              if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
              return failureCount < 2;
            },
          },
          mutations: {
            // Writes are never retried automatically; the ones that are safe to repeat
            // carry an idempotency key and are retried inside the SDK.
            retry: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RealtimeProvider>
          <TooltipProvider>
            {children}
            <Toaster position="top-center" />
          </TooltipProvider>
        </RealtimeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
