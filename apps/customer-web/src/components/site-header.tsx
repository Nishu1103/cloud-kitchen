'use client';

import { Avatar, Button, cn } from '@ck/ui';
import { Bell, MapPin, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { env } from '@/lib/env';
import { campusLabel } from '@/lib/greeting';
import { useCampus } from '@/hooks/use-catalog';
import { useSession } from '@/lib/session';
import { ThemeToggle } from './theme-toggle';

const DESKTOP_NAV = [
  { href: '/', label: 'Home' },
  { href: '/kitchens', label: 'Explore' },
  { href: '/orders', label: 'Orders' },
  { href: '/saved', label: 'Favourites' },
  { href: '/account', label: 'Profile' },
] as const;

export function SiteHeader({ unread }: { unread: number }) {
  const { user, isLoading } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const campus = useCampus();
  const place = campus.data?.name ?? campusLabel(env.campusSlug);

  const hideMobileChrome =
    pathname === '/' ||
    pathname.startsWith('/account') ||
    pathname === '/wallet' ||
    pathname === '/support' ||
    pathname === '/offers';

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b border-line/70 bg-canvas/80 backdrop-blur-xl',
        hideMobileChrome && 'hidden lg:block',
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-display text-title text-ink"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-brand text-caption font-bold text-brand-ink">
            CK
          </span>
          <span className="hidden font-display sm:inline">{env.appName}</span>
        </Link>

        <p className="hidden min-w-0 items-center gap-1 truncate text-caption text-ink-muted md:flex">
          <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0 text-brand" />
          {place}
        </p>

        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Primary">
          {DESKTOP_NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-full px-3 py-1.5 text-caption font-medium transition-colors',
                  active ? 'bg-brand text-brand-ink' : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <form
          role="search"
          className="ml-auto hidden flex-1 max-w-sm lg:block"
          onSubmit={(event) => {
            event.preventDefault();
            const query = new FormData(event.currentTarget).get('q');
            router.push(query ? `/search?q=${encodeURIComponent(String(query))}` : '/search');
          }}
        >
          <label className="relative block">
            <span className="sr-only">Search dishes and kitchens</span>
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
            />
            <input
              name="q"
              type="search"
              placeholder="What are you craving today?"
              className="h-10 w-full rounded-full border border-line bg-surface pl-10 pr-3 text-body placeholder:text-ink-subtle"
            />
          </label>
        </form>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <Button variant="ghost" size="icon-sm" asChild className="lg:hidden">
            <Link href="/search" aria-label="Search">
              <Search aria-hidden className="h-5 w-5" />
            </Link>
          </Button>

          <ThemeToggle />

          <Button variant="ghost" size="icon-sm" asChild className="relative">
            <Link
              href="/notifications"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
            >
              <Bell aria-hidden className="h-5 w-5" />
              {unread > 0 ? (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger" />
              ) : null}
            </Link>
          </Button>

          {isLoading ? (
            <div className="ck-skeleton h-9 w-9 rounded-full" />
          ) : user ? (
            <Link href="/account" className="rounded-full" aria-label={`Profile, ${user.name}`}>
              <Avatar name={user.name} src={user.avatarUrl} size="sm" />
            </Link>
          ) : (
            <Button size="sm" className="rounded-full" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
