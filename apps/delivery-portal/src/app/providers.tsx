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
 * its own cache during server rendering; a shared one would leak one rider's jobs into
 * another's response.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Short: every list here is a working document, and a job that has already
            // been taken must not linger on screen as something to tap.
            staleTime: 10_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: true,
            // Coming back from the map app is the most common way this screen is
            // revisited, and the run may have changed while it was in the background.
            refetchOnReconnect: true,
            retry: (failureCount, error) => {
              // A rejected request is a decision, not a hiccup: retrying a 403, a 409 or
              // a validation failure just burns the rate limit. The SDK already retries
              // transport failures.
              if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
              return failureCount < 2;
            },
          },
          mutations: {
            // Writes are never retried automatically; accepting a job twice or replaying
            // a handover is exactly what must not happen.
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
            {/* Top, not bottom: the tab bar and the primary action own the bottom edge. */}
            <Toaster position="top-center" />
          </TooltipProvider>
        </RealtimeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
