'use client';

import { cn } from '@ck/ui';
import { Heart, Search, ShoppingBag, User, Zap } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Home', icon: Zap },
  { href: '/kitchens', label: 'Explore', icon: Search },
  { href: '/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/saved', label: 'Favourite', icon: Heart },
  { href: '/account', label: 'Profile', icon: User },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

export function CustomerTabBar({ ordersBadge }: { ordersBadge?: number }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/8 bg-black/80 backdrop-blur-xl lg:hidden"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -28px 56px hsl(var(--brand) / 0.22)',
      }}
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-md items-stretch px-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(pathname, tab.href);
          const badge = tab.href === '/orders' ? ordersBadge : undefined;

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 py-2.5 text-micro font-medium transition-colors',
                  active ? 'text-brand' : 'text-white/45',
                )}
              >
                <span className="relative">
                  <Icon
                    aria-hidden
                    className="h-5 w-5"
                    strokeWidth={active ? 2.4 : 1.8}
                    fill={active && tab.href === '/' ? 'currentColor' : 'none'}
                  />
                  {badge ? (
                    <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-danger px-1 text-center text-[0.625rem] font-semibold leading-4 text-white">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  ) : null}
                </span>
                {tab.label}
                {active ? (
                  <span className="absolute inset-x-7 bottom-1 h-0.5 rounded-full bg-brand" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
