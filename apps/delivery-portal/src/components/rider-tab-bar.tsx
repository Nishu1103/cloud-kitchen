'use client';

import { Bike, Home, UserRound, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useActiveJobs, useOffers } from '@/hooks/use-jobs';

const TABS: {
  href: string;
  label: string;
  icon: typeof Home;
  match: (path: string) => boolean;
}[] = [
  { href: '/', label: 'Home', icon: Home, match: (path) => path === '/' },
  {
    href: '/jobs',
    label: 'Orders',
    icon: Bike,
    match: (path) => path.startsWith('/jobs') || path.startsWith('/offers') || path.startsWith('/history'),
  },
  {
    href: '/earnings',
    label: 'Earnings',
    icon: Wallet,
    match: (path) => path.startsWith('/earnings'),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: UserRound,
    match: (path) =>
      path.startsWith('/profile') || path.startsWith('/alerts'),
  },
];

export function RiderTabBar() {
  const pathname = usePathname();
  const { data: offers } = useOffers();
  const { data: active } = useActiveJobs();
  const offerCount = offers?.items.length ?? 0;
  const activeCount = active?.items.length ?? 0;

  return (
    <nav aria-label="Rider" className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto max-w-lg border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <ul className="grid h-16 grid-cols-4 items-end px-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const current = tab.match(pathname);
            const badge =
              tab.href === '/jobs' ? offerCount + activeCount : 0;

            return (
              <li key={tab.label}>
                <Link
                  href={tab.href}
                  aria-current={current ? 'page' : undefined}
                  className={`relative flex flex-col items-center gap-0.5 py-2 text-micro font-medium ${
                    current ? 'text-brand' : 'text-ink-subtle'
                  }`}
                >
                  <span className="relative">
                    <Icon aria-hidden className="h-5 w-5" strokeWidth={current ? 2.4 : 1.8} />
                    {badge > 0 ? (
                      <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-ink">
                        {badge > 9 ? '9+' : badge}
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
