'use client';

import { Badge } from '@ck/ui';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { unlockAlertSound } from '@/lib/alert-sound';
import { useRealtimeStatus } from '@/lib/realtime';
import { VendorTabBar } from './vendor-tab-bar';

/** Routes that own the whole viewport: the sign-in screen. */
const BARE_ROUTES = ['/login', '/forgot-password', '/reset-password'];

export function KitchenFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const status = useRealtimeStatus();

  // Browsers block audio until the user has interacted with the page. Unlocking on the
  // first click anywhere means the first new-order chime of the shift actually plays.
  useEffect(() => {
    const unlock = () => unlockAlertSound();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const bare = BARE_ROUTES.some((route) => pathname.startsWith(route));
  const usesOwnChrome =
    pathname === '/' ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/menu') ||
    pathname.startsWith('/analytics') ||
    pathname.startsWith('/promotions') ||
    pathname.startsWith('/coupons') ||
    pathname.startsWith('/more');
  if (bare) {
    return (
      <main id="main" className="min-h-dvh">
        {children}
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto min-h-dvh w-full max-w-lg pb-[calc(theme(spacing.tabbar)+env(safe-area-inset-bottom))]">
        {status === 'disconnected' ? (
          // Honest about degraded live updates rather than silently going stale. The board
          // also polls, so orders still arrive — just a little later.
          <div className="border-b border-warning/30 bg-warning-soft px-4 py-2 text-caption text-warning-ink">
            Live updates paused — reconnecting. New orders may take up to 30 seconds to appear.
          </div>
        ) : null}
        {status === 'connected' ? (
          <span className="sr-only">
            <Badge tone="success" size="sm">
              Live
            </Badge>
          </span>
        ) : null}
        <div id="main" className={usesOwnChrome ? undefined : 'px-4 pb-6 pt-5'}>
          {children}
        </div>
      </div>
      <VendorTabBar />
    </div>
  );
}
