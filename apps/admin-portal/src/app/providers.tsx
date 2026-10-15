'use client';

import { isApiError } from '@ck/sdk';
import { Toaster, TooltipProvider } from '@ck/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { RealtimeProvider } from '@/lib/realtime';
import { SessionProvider } from '@/lib/session';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: true,
            retry: (failureCount, error) => {
              if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
              return failureCount < 2;
            },
          },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RealtimeProvider>
          <TooltipProvider>
            {children}
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </RealtimeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
