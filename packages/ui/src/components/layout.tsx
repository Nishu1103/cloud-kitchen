'use client';

import { Menu as MenuIcon, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Button } from './button';

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-5 space-y-2', className)}>
      {breadcrumb}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-title-lg text-ink">{title}</h1>
          {description ? (
            <p className="max-w-prose text-body text-ink-muted">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-3', className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            {title ? <h2 className="text-title text-ink">{title}</h2> : null}
            {description ? <p className="text-caption text-ink-muted">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** Live counter, e.g. pending orders awaiting acceptance. */
  badge?: number;
}

export interface NavSection {
  heading?: string;
  items: NavItem[];
}

/**
 * Sidebar shell for the operator portals (vendor, delivery, admin).
 *
 * Navigation is passed in as data and `isActive`/`renderLink` are injected by the app,
 * so this package never imports `next/link` or `next/navigation` and stays framework
 * agnostic and testable.
 */
export function AppShell({
  brand,
  sections,
  isActive,
  renderLink,
  topbar,
  footer,
  children,
}: {
  brand: ReactNode;
  sections: NavSection[];
  isActive: (href: string) => boolean;
  renderLink: (item: NavItem, content: ReactNode, active: boolean) => ReactNode;
  topbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the drawer whenever the route changes underneath it; otherwise tapping a
  // link leaves the overlay covering the page it just navigated to.
  useEffect(() => {
    if (!mobileOpen) return;
    const close = () => setMobileOpen(false);
    window.addEventListener('popstate', close);
    return () => window.removeEventListener('popstate', close);
  }, [mobileOpen]);

  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto p-3">
      {sections.map((section, index) => (
        <div key={section.heading ?? index} className="space-y-1">
          {section.heading ? (
            <p className="px-2.5 py-1 text-micro uppercase tracking-wide text-ink-subtle">
              {section.heading}
            </p>
          ) : null}
          {section.items.map((item) => {
            const active = isActive(item.href);
            return (
              <div key={item.href} onClick={() => setMobileOpen(false)}>
                {renderLink(
                  item,
                  <span
                    className={cn(
                      'flex items-center gap-3 rounded px-2.5 py-2 text-body font-medium transition-colors',
                      active
                        ? 'bg-brand-soft text-brand'
                        : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                    )}
                  >
                    <span className={cn('shrink-0', active ? 'text-brand' : 'text-ink-subtle')}>
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="tabular rounded-full bg-brand px-1.5 py-0.5 text-micro font-semibold text-brand-ink">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    ) : null}
                  </span>,
                  active,
                )}
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-dvh bg-canvas">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-header items-center border-b border-line px-4">{brand}</div>
        {nav}
        {footer ? <div className="border-t border-line p-3">{footer}</div> : null}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-surface shadow-lg">
            <div className="flex h-header items-center justify-between border-b border-line px-4">
              {brand}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
              >
                <X aria-hidden className="h-4 w-4" />
              </Button>
            </div>
            {nav}
            {footer ? <div className="border-t border-line p-3">{footer}</div> : null}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-header items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon aria-hidden className="h-5 w-5" />
          </Button>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">{topbar}</div>
        </header>
        <main className="mx-auto w-full max-w-content flex-1 p-4 sm:p-gutter">{children}</main>
      </div>
    </div>
  );
}

/**
 * Bottom tab bar for the phone-shaped apps.
 *
 * Sits above the iOS home indicator via `env(safe-area-inset-bottom)`, which is the
 * difference between a web app that feels installed and one that does not.
 */
export function TabBar({
  items,
  isActive,
  renderLink,
  hideOnDesktop = true,
}: {
  items: NavItem[];
  isActive: (href: string) => boolean;
  renderLink: (item: NavItem, content: ReactNode, active: boolean) => ReactNode;
  /**
   * The customer site becomes a sidebar layout on a wide screen and hides this. The
   * delivery portal has no wide layout at all - it is a phone app that happens to open
   * in a browser - so it keeps the tab bar at every width.
   */
  hideOnDesktop?: boolean;
}) {
  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur',
        hideOnDesktop && 'lg:hidden',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md items-stretch">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href} className="flex-1">
              {renderLink(
                item,
                <span
                  className={cn(
                    'relative flex flex-col items-center gap-1 py-2.5 text-micro font-medium',
                    active ? 'text-brand' : 'text-ink-subtle',
                  )}
                >
                  <span className="relative">
                    {item.icon}
                    {item.badge ? (
                      <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-danger px-1 text-center text-[0.625rem] font-semibold leading-4 text-white">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    ) : null}
                  </span>
                  {item.label}
                </span>,
                active,
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
