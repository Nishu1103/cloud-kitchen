'use client';

import { Badge } from '@ck/ui';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { unlockAlert } from '@/lib/alert';
import { useRealtimeStatus } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import { RiderTabBar } from './rider-tab-bar';

/** Routes that own the whole viewport: the sign-in screen. */
const BARE_ROUTES = ['/login', '/forgot-password', '/reset-password'];

/**
 * The rider shell.
 *
 * A phone layout at every width, with the navigation at the bottom where a thumb is
 * while walking. Home paints its own header; other screens use `RiderScreen`.
 */
export function RiderFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const status = useRealtimeStatus();
  const { user } = useSession();

  // Browsers block audio until the user has interacted with the page. Unlocking on the
  // first tap anywhere means the first offer chime of the shift actually plays.
  useEffect(() => {
    const unlock = () => unlockAlert();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const bare = BARE_ROUTES.some((route) => pathname.startsWith(route));
  if (bare) {
    return (
      <main id="main" className="min-h-dvh">
        {children}
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <main id="main" className="mx-auto max-w-lg pb-28">
        {user && status === 'disconnected' ? (
          <div className="mx-4 mb-3 mt-3 flex items-center justify-between gap-2 rounded-2xl border border-warning/30 bg-warning-soft px-3 py-2 text-caption text-warning-ink">
            <span>Live updates paused — new jobs may take a few seconds longer.</span>
            <Badge tone="warning" size="sm">
              Offline
            </Badge>
          </div>
        ) : null}
        {children}
      </main>

      <RiderTabBar />
    </div>
  );
}
