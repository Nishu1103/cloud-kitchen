'use client';

import { Badge, Button } from '@ck/ui';
import { Menu as MenuIcon, UtensilsCrossed, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useUnreadCount } from '@/hooks/use-admin';
import { env } from '@/lib/env';
import { adminSections, flattenNav, mobileTabs } from '@/lib/nav';
import { useRealtimeStatus } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import { AdminTabBar } from './admin-tab-bar';
import { AdminTopbar } from './admin-topbar';

const BARE_ROUTES = ['/login'];

export function AdminFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { can, user } = useSession();
  const status = useRealtimeStatus();
  const { data: unread } = useUnreadCount();
  const [drawer, setDrawer] = useState(false);

  const sections = useMemo(() => adminSections(can, unread?.unread), [can, unread?.unread]);
  const items = useMemo(() => flattenNav(sections), [sections]);
  const tabs = useMemo(() => mobileTabs(items), [items]);

  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  const bare = BARE_ROUTES.some((route) => pathname.startsWith(route));
  if (bare) {
    return (
      <main id="main" className="min-h-dvh">
        {children}
      </main>
    );
  }

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto p-3">
      {sections.map((section, index) => (
        <div key={section.heading ?? index} className="space-y-1">
          {section.heading ? (
            <p className="px-2.5 py-1 text-micro uppercase tracking-wide text-white/40">
              {section.heading}
            </p>
          ) : null}
          {section.items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-body font-medium ${
                  active
                    ? 'bg-brand text-white'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge ? (
                  <span className="tabular rounded-full bg-white/15 px-1.5 py-0.5 text-micro font-semibold">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const brand = (
    <span className="flex items-center gap-2 font-semibold text-white">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand">
        <UtensilsCrossed aria-hidden className="h-4 w-4" />
      </span>
      {env.appName}
    </span>
  );

  const footer = (
    <div className="flex items-center justify-between gap-2 px-1 text-caption text-white/50">
      <span className="truncate">{user?.name ?? 'Signed out'}</span>
      <Badge tone={status === 'connected' ? 'success' : 'warning'} size="sm">
        {status === 'connected' ? 'Live' : 'Reconnecting'}
      </Badge>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-canvas">
      <aside className="admin-rail sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r lg:flex">
        <div className="flex h-14 items-center border-b border-white/10 px-4">{brand}</div>
        {nav}
        <div className="border-t border-white/10 p-3">{footer}</div>
      </aside>

      {drawer ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawer(false)}
          />
          <aside className="admin-rail absolute inset-y-0 left-0 flex w-72 flex-col shadow-lg">
            <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
              {brand}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close navigation"
                className="text-white hover:bg-white/10"
                onClick={() => setDrawer(false)}
              >
                <X aria-hidden className="h-4 w-4" />
              </Button>
            </div>
            {nav}
            <div className="border-t border-white/10 p-3">{footer}</div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label="Open navigation"
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
          >
            <MenuIcon aria-hidden className="h-5 w-5" />
          </Button>
          <span className="flex items-center gap-2 font-semibold text-ink lg:hidden">
            <UtensilsCrossed aria-hidden className="h-5 w-5 text-brand" />
            {env.appName}
          </span>
          <AdminTopbar jumpItems={items} />
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 p-4 pb-24 sm:p-6 lg:pb-6">
          {children}
        </main>
      </div>

      <AdminTabBar tabs={tabs} />
    </div>
  );
}
