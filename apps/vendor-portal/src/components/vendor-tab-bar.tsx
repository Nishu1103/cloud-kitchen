'use client';

import { ORDER_STATUS, PERMISSIONS } from '@ck/types';
import { ChefHat, ClipboardList, Home, MoreHorizontal, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useVendorOrders } from '@/hooks/use-orders';
import { useSession } from '@/lib/session';

const TABS: {
  href: string;
  label: string;
  icon: typeof Home;
  match: (path: string) => boolean;
  center?: boolean;
}[] = [
  { href: '/', label: 'Home', icon: Home, match: (path: string) => path === '/' },
  {
    href: '/orders',
    label: 'Orders',
    icon: ClipboardList,
    match: (path: string) => path.startsWith('/orders'),
  },
  {
    href: '/menu?new=1',
    label: 'Add',
    icon: Plus,
    match: () => false,
    center: true,
  },
  {
    href: '/menu',
    label: 'Menu',
    icon: ChefHat,
    match: (path: string) => path.startsWith('/menu'),
  },
  {
    href: '/more',
    label: 'More',
    icon: MoreHorizontal,
    match: (path: string) =>
      path.startsWith('/more') ||
      path.startsWith('/analytics') ||
      path.startsWith('/promotions') ||
      path.startsWith('/coupons') ||
      path.startsWith('/reviews') ||
      path.startsWith('/settings') ||
      path.startsWith('/notifications'),
  },
];

export function VendorTabBar() {
  const pathname = usePathname();
  const { can } = useSession();
  const { data: liveOrders } = useVendorOrders({ live: true, limit: 50 });
  const awaitingCount =
    liveOrders?.items.filter((order) => order.status === ORDER_STATUS.PLACED).length ?? 0;

  const canCreate = can(PERMISSIONS.PRODUCT_CREATE);

  return (
    <nav
      aria-label="Kitchen"
      className="fixed inset-x-0 bottom-0 z-40"
    >
      <div className="mx-auto max-w-lg border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <ul className="grid h-16 grid-cols-5 items-end px-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.match(pathname);
          const href = tab.center && !canCreate ? '/menu' : tab.href;
          const isOrders = tab.href === '/orders';

          if (tab.center) {
            return (
              <li key={tab.label} className="flex justify-center">
                <Link
                  href={href}
                  aria-label="Add a dish"
                  className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-ink shadow-brand"
                >
                  <Icon aria-hidden className="h-7 w-7" strokeWidth={2.4} />
                </Link>
              </li>
            );
          }

          return (
            <li key={tab.label}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-0.5 py-2 text-micro font-medium ${
                  active ? 'text-brand' : 'text-ink-subtle'
                }`}
              >
                <span className="relative">
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                  {isOrders && awaitingCount > 0 ? (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                      {awaitingCount > 9 ? '9+' : awaitingCount}
                    </span>
                  ) : null}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
      </div>
    </nav>
  );
}
