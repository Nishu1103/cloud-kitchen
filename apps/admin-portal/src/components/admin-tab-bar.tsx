'use client';

import type { NavItem } from '@ck/ui';
import { MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminTabBar({ tabs }: { tabs: NavItem[] }) {
  const pathname = usePathname();
  const moreActive =
    pathname.startsWith('/more') ||
    tabs.every((tab) => (tab.href === '/' ? pathname !== '/' : !pathname.startsWith(tab.href)));

  const items: NavItem[] = [
    ...tabs,
    { href: '/more', label: 'More', icon: <MoreHorizontal aria-hidden className="h-5 w-5" /> },
  ];

  return (
    <nav
      aria-label="Admin"
      className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul
        className="mx-auto grid max-w-lg border-t border-line bg-surface/95 backdrop-blur-md"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active =
            item.href === '/more'
              ? moreActive
              : item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-0.5 py-2.5 text-micro font-medium ${
                  active ? 'text-brand' : 'text-ink-subtle'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
