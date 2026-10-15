'use client';

import { PERMISSIONS, formatMoney } from '@ck/types';
import { Alert, Button, EmptyState, ErrorState, Skeleton } from '@ck/ui';
import {
  Bell,
  Bike,
  CircleHelp,
  Package,
  Star,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { JobListCard } from '@/components/job-card';
import { OfferCard } from '@/components/offer-card';
import { OnlineSwitch } from '@/components/online-switch';
import { RequireAccess } from '@/components/require-access';
import { useUnreadCount } from '@/hooks/use-account';
import { useActiveJobs, useEarnings, useJobHistory, useOffers } from '@/hooks/use-jobs';
import { useLocationPing } from '@/hooks/use-location-ping';
import { isoDay } from '@/lib/dates';
import { env } from '@/lib/env';
import { useSession } from '@/lib/session';

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function HomeHeader() {
  const { user } = useSession();
  const { data: unread } = useUnreadCount();
  const first = user?.name?.split(' ')[0] ?? 'there';

  return (
    <header
      className="px-5 pb-4 pt-6"
      style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-title font-semibold text-ink">Hey, {first} 👋</p>
          <p className="mt-1 text-caption text-ink-muted">Jobs land here the moment a kitchen is ready.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <OnlineSwitch />
          <Link
            href="/alerts"
            aria-label={unread?.unread ? `${unread.unread} unread alerts` : 'Alerts'}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink"
          >
            <Bell aria-hidden className="h-5 w-5" />
            {unread?.unread ? (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand" />
            ) : null}
          </Link>
        </div>
      </div>
    </header>
  );
}

function EarningsCard() {
  const { data, isLoading } = useEarnings();
  const history = useJobHistory(1);

  if (isLoading) return <Skeleton className="h-28 rounded-[1.25rem]" />;
  if (!data) return null;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = isoDay(yesterday);
  let yesterdayAmount = 0;
  let sawYesterday = false;
  for (const job of history.data?.items ?? []) {
    const key = isoDay(new Date(job.deliveredAt ?? job.createdAt));
    if (key === yesterdayKey) {
      sawYesterday = true;
      yesterdayAmount += job.earning;
    }
  }
  const change = sawYesterday ? percentChange(data.today.amount, yesterdayAmount) : null;

  return (
    <section className="rider-purple rounded-[1.25rem] p-4">
      <p className="text-caption text-white/80">Today's Earnings</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="tabular text-title-lg font-semibold text-white">
          {formatMoney(data.today.amount)}
        </p>
        {change !== null ? (
          <p className={`text-caption font-semibold ${change >= 0 ? 'text-brand' : 'text-white/70'}`}>
            {change >= 0 ? '+' : ''}
            {change}%
          </p>
        ) : null}
      </div>
      <p className="mt-1 text-caption text-white/70">
        {data.today.deliveries} {data.today.deliveries === 1 ? 'delivery' : 'deliveries'} completed
        today
      </p>
    </section>
  );
}

function StatRow() {
  const { data } = useEarnings();
  const history = useJobHistory(1);
  if (!data) return null;

  const todayKey = isoDay(new Date());
  const metres = (history.data?.items ?? []).reduce((sum, job) => {
    const key = isoDay(new Date(job.deliveredAt ?? job.createdAt));
    if (key !== todayKey || job.distanceMeters == null) return sum;
    return sum + job.distanceMeters;
  }, 0);

  const tiles = [
    { label: 'Deliveries', value: String(data.today.deliveries) },
    metres > 0
      ? { label: 'Distance', value: `${(metres / 1000).toFixed(1)} km` }
      : { label: 'Rating', value: data.rating > 0 ? data.rating.toFixed(1) : '—' },
    { label: 'Awaiting payout', value: formatMoney(data.unsettled) },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-[1.25rem] bg-surface px-2 py-3 text-center">
          <p className="tabular text-body font-semibold text-ink">{tile.value}</p>
          <p className="mt-1 text-[11px] leading-tight text-ink-muted">{tile.label}</p>
        </div>
      ))}
    </div>
  );
}

function QuickActions() {
  const { can } = useSession();

  const actions = [
    { href: '/jobs', label: 'My Orders', icon: Package },
    { href: '/earnings', label: 'Earnings', icon: Wallet },
    can(PERMISSIONS.WALLET_READ_OWN)
      ? { href: '/earnings#wallet', label: 'Wallet', icon: Wallet }
      : null,
    env.supportPhone
      ? { href: `tel:${env.supportPhone}`, label: 'Help Center', icon: CircleHelp }
      : { href: '/alerts', label: 'Alerts', icon: Bell },
  ].filter((action): action is { href: string; label: string; icon: typeof Package } =>
    Boolean(action),
  );

  return (
    <div>
      <h2 className="mb-3 text-body font-semibold text-ink">Quick actions</h2>
      <ul className="flex justify-between gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          const external = action.href.startsWith('tel:');
          return (
            <li key={action.label} className="flex-1">
              <Link
                href={action.href}
                className="flex flex-col items-center gap-2"
                {...(external ? { rel: 'nofollow' } : {})}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-info-soft text-info">
                  <Icon aria-hidden className="h-5 w-5" />
                </span>
                <span className="text-center text-[11px] font-medium text-ink-muted">
                  {action.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Run() {
  const { data: jobs, isLoading, isError, refetch } = useActiveJobs();
  const { data: summary } = useEarnings();
  const { data: offers } = useOffers();

  const active = jobs?.items ?? [];
  const incoming = offers?.items ?? [];
  const { permission, isTracking } = useLocationPing(active.length > 0);

  if (isError) {
    return <ErrorState title="Could not load your run" onRetry={() => refetch()} />;
  }

  return (
    <div>
      <HomeHeader />
      <div className="space-y-4 px-4 pb-6">
        <EarningsCard />
        <StatRow />

        {active.length > 0 && permission === 'denied' ? (
          <Alert tone="warning" title="Location is off">
            The customer cannot see you on their map. Allow location for this site in your
            browser settings to turn tracking back on.
          </Alert>
        ) : null}

        {isLoading ? (
          <Skeleton className="h-48 rounded-[1.25rem]" />
        ) : (
          <>
            {incoming.length > 0 ? (
              <section className="space-y-3">
                <h2 className="text-body font-semibold text-ink">Incoming</h2>
                {incoming.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} />
                ))}
              </section>
            ) : null}

            {active.length > 0 ? (
              <section className="space-y-3">
                <h2 className="text-body font-semibold text-ink">On the road</h2>
                {active.map((job) => (
                  <JobListCard key={job.id} job={job} />
                ))}
              </section>
            ) : incoming.length === 0 ? (
              <EmptyState
                icon={<Bike aria-hidden className="h-6 w-6" />}
                title="Nothing in progress"
                description={
                  summary?.isOnline
                    ? 'You are online. A new job appears here the moment a kitchen is ready.'
                    : 'Go online with the switch at the top to start receiving jobs.'
                }
                action={
                  <Button asChild variant="secondary" className="rounded-full">
                    <Link href="/jobs">See available jobs</Link>
                  </Button>
                }
              />
            ) : null}
          </>
        )}

        <QuickActions />

        {summary && summary.rating > 0 ? (
          <p className="flex items-center justify-center gap-1 text-caption text-ink-subtle">
            <Star aria-hidden className="h-3.5 w-3.5 fill-warning text-warning" />
            {summary.rating.toFixed(1)} from students · {summary.completedDeliveries} lifetime
            deliveries
          </p>
        ) : null}

        {isTracking ? (
          <p className="text-center text-caption text-ink-subtle">
            Sharing your location while you deliver. It stops when the job ends.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function RunPage() {
  return (
    <RequireAccess permission={PERMISSIONS.DELIVERY_READ_OWN}>
      <Run />
    </RequireAccess>
  );
}
