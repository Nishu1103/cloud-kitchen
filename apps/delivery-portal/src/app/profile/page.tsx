'use client';

import { PERMISSIONS, USER_STATUS, formatMoney } from '@ck/types';
import { Badge, Button } from '@ck/ui';
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  LogOut,
  Phone,
  Star,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { OnlineSwitch } from '@/components/online-switch';
import { RequireAccess } from '@/components/require-access';
import { RiderScreen } from '@/components/rider-screen';
import { useEarnings } from '@/hooks/use-jobs';
import { env } from '@/lib/env';
import { useLogout, useSession } from '@/lib/session';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function Profile() {
  const { user, can } = useSession();
  const { data: summary } = useEarnings();
  const logout = useLogout();
  const name = user?.name ?? 'Rider';
  const active = user?.status === USER_STATUS.ACTIVE;

  const links = [
    { href: '/alerts', label: 'Notifications', icon: Bell },
    { href: '/earnings', label: 'Earnings', icon: Wallet },
    can(PERMISSIONS.WALLET_READ_OWN)
      ? { href: '/earnings#wallet', label: 'Wallet', icon: Wallet }
      : null,
    env.supportPhone
      ? { href: `tel:${env.supportPhone}`, label: 'Help & support', icon: Phone }
      : null,
  ].filter((item): item is { href: string; label: string; icon: typeof Bell } => Boolean(item));

  return (
    <RiderScreen title="Profile" actions={<OnlineSwitch />}>
      <div className="space-y-4">
        <section className="flex items-center gap-3 rounded-[1.25rem] bg-surface p-4">
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-info-soft text-title font-semibold text-info">
              {initials(name)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-title font-semibold text-ink">{name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone="success" size="sm">
                Delivery partner
              </Badge>
              {active && (user?.phoneVerified || user?.emailVerified) ? (
                <span className="inline-flex items-center gap-1 text-caption text-ink-muted">
                  <BadgeCheck aria-hidden className="h-3.5 w-3.5 text-brand" />
                  {user.phoneVerified ? 'Phone verified' : 'Email verified'}
                </span>
              ) : null}
              {summary && summary.rating > 0 ? (
                <span className="inline-flex items-center gap-1 text-caption text-ink-muted">
                  <Star aria-hidden className="h-3.5 w-3.5 fill-warning text-warning" />
                  {summary.rating.toFixed(1)}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        {summary ? (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-[1.25rem] bg-surface p-3 text-center">
              <p className="tabular text-title font-semibold text-ink">
                {summary.completedDeliveries}
              </p>
              <p className="mt-1 text-[11px] text-ink-muted">Deliveries</p>
            </div>
            <div className="rounded-[1.25rem] bg-surface p-3 text-center">
              <p className="tabular text-title font-semibold text-ink">
                {summary.rating > 0 ? summary.rating.toFixed(1) : '—'}
              </p>
              <p className="mt-1 text-[11px] text-ink-muted">Rating</p>
            </div>
            <div className="rounded-[1.25rem] bg-surface p-3 text-center">
              <p className="tabular text-title font-semibold text-ink">
                {formatMoney(summary.lifetime)}
              </p>
              <p className="mt-1 text-[11px] text-ink-muted">Lifetime</p>
            </div>
          </div>
        ) : null}

        <ul className="overflow-hidden rounded-[1.25rem] bg-surface">
          {links.map((item) => {
            const Icon = item.icon;
            const external = item.href.startsWith('tel:');
            return (
              <li key={item.label} className="border-b border-line last:border-0">
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3.5 text-body text-ink"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-info-soft text-info">
                    <Icon aria-hidden className="h-4 w-4" />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {external ? null : <ChevronRight aria-hidden className="h-4 w-4 text-ink-subtle" />}
                </Link>
              </li>
            );
          })}
        </ul>

        <Button
          variant="danger-soft"
          block
          className="rounded-full"
          onClick={() => logout.mutate()}
          loading={logout.isPending}
        >
          <LogOut aria-hidden className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </RiderScreen>
  );
}

export default function ProfilePage() {
  return (
    <RequireAccess permission={PERMISSIONS.DELIVERY_READ_OWN}>
      <Profile />
    </RequireAccess>
  );
}
