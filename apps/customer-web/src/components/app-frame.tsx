'use client';

import { useUnreadCount } from '@/hooks/use-account';
import { useOrders, isLiveOrder } from '@/hooks/use-orders';
import { useRealtimeStatus } from '@/lib/realtime';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { CartBar } from './cart-bar';
import { CustomerTabBar } from './customer-tab-bar';
import { SiteHeader } from './site-header';

const BARE_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
];

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: unread } = useUnreadCount();
  const liveOrders = useOrders({ live: true, limit: 10 });
  const status = useRealtimeStatus();

  const bare = BARE_ROUTES.some((route) => pathname.startsWith(route));

  if (bare) {
    return (
      <main id="main" className="min-h-dvh">
        {children}
      </main>
    );
  }

  const liveCount =
    liveOrders.data?.items.filter((order) => isLiveOrder(order.status)).length ?? 0;

  const home = pathname === '/';
  const accountFlow =
    pathname.startsWith('/account') ||
    pathname === '/wallet' ||
    pathname === '/support' ||
    pathname === '/offers';
  const kitchen = /^\/kitchens\/[^/]+$/.test(pathname);

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <SiteHeader unread={unread?.unread ?? 0} />

      {status === 'disconnected' ? (
        <div className="border-b border-warning/30 bg-warning-soft px-4 py-1.5 text-center text-caption text-warning-ink">
          Live updates paused — reconnecting
        </div>
      ) : null}

      <main
        id="main"
        className={
          home || accountFlow
            ? 'mx-auto w-full max-w-6xl flex-1 px-0 pb-36 lg:px-8 lg:pb-12 lg:pt-4'
            : kitchen
              ? 'mx-auto w-full max-w-6xl flex-1 px-4 pb-36 sm:px-6 lg:px-8 lg:pb-12 lg:pt-4'
              : 'mx-auto w-full max-w-6xl flex-1 px-4 pb-36 pt-4 sm:px-6 lg:px-8 lg:pb-12'
        }
      >
        {children}
      </main>

      <CartBar />
      <CustomerTabBar ordersBadge={liveCount || undefined} />
    </div>
  );
}
