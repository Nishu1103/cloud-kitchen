'use client';

import { formatMoney, ORDER_STATUS, PERMISSIONS, VENDOR_STATUS } from '@ck/types';
import { Badge, ErrorState, Skeleton, Sparkline, type ChartPoint } from '@ck/ui';
import {
  BadgeCheck,
  BarChart3,
  Bell,
  ChefHat,
  ClipboardList,
  MapPin,
  Megaphone,
  Tags,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { KitchenOpenSwitch } from '@/components/kitchen-open-switch';
import { RequireAccess } from '@/components/require-access';
import { useUnreadCount } from '@/hooks/use-account';
import { useDashboard, useKitchen } from '@/hooks/use-kitchen';
import { useVendorOrders } from '@/hooks/use-orders';
import { formatClock, greeting, rangeForDays, todayRange } from '@/lib/dates';
import { useSession } from '@/lib/session';

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function HomeHeader() {
  const { user } = useSession();
  const { data: kitchen } = useKitchen();
  const { data: unread } = useUnreadCount();
  const name = user?.name ?? 'there';

  return (
    <header className="vendor-header rounded-b-[2rem] px-5 pb-16 pt-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-title font-semibold text-white">
            <span className="truncate">
              {greeting()} 👋 {name}
            </span>
            {kitchen?.status === VENDOR_STATUS.APPROVED ? (
              <BadgeCheck aria-label="Verified kitchen" className="h-5 w-5 shrink-0 text-white" />
            ) : null}
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-caption text-white/90">
            <MapPin aria-hidden className="h-3.5 w-3.5" />
            <span className="truncate">{kitchen?.name ?? 'Your kitchen'}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <KitchenOpenSwitch inverted />
          <Link
            href="/notifications"
            aria-label={unread?.unread ? `${unread.unread} unread alerts` : 'Alerts'}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
          >
            <Bell aria-hidden className="h-5 w-5" />
            {unread?.unread ? (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" />
            ) : null}
          </Link>
        </div>
      </div>
    </header>
  );
}

function RevenueCard() {
  const week = useDashboard(rangeForDays(7));
  const today = useDashboard(todayRange());

  if (week.isLoading || today.isLoading) {
    return <Skeleton className="h-36 rounded-2xl" />;
  }

  if (week.isError || today.isError) {
    return (
      <ErrorState
        message="Could not load today's revenue."
        onRetry={() => {
          void week.refetch();
          void today.refetch();
        }}
      />
    );
  }

  const revenue = today.data?.totals.revenue ?? 0;
  const timeline = week.data?.timeline ?? [];
  const yesterday = timeline.length >= 2 ? timeline[timeline.length - 2]?.revenue ?? 0 : 0;
  const change = percentChange(revenue, yesterday);

  const trend: ChartPoint[] = timeline.map((day) => ({
    label: new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short' }),
    value: day.revenue,
    display: formatMoney(day.revenue),
  }));

  return (
    <section className="rounded-2xl bg-surface p-4 shadow-md">
      <p className="text-caption text-ink-muted">Today's Revenue</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div>
          <p className="tabular text-title-lg font-semibold text-ink">{formatMoney(revenue)}</p>
          {change !== null ? (
            <p
              className={`mt-1 text-caption font-medium ${
                change >= 0 ? 'text-success' : 'text-danger'
              }`}
            >
              {change >= 0 ? '+' : ''}
              {change}% vs yesterday
            </p>
          ) : (
            <p className="mt-1 text-caption text-ink-subtle">Compared with yesterday once you have two days of sales.</p>
          )}
        </div>
        {trend.length > 1 ? (
          <div className="w-28 shrink-0">
            <Sparkline
              points={trend}
              caption="Daily sales for the last 7 days"
              height={48}
              className="text-success"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function StatusGrid() {
  const { can } = useSession();
  const showAnalytics = can(PERMISSIONS.ANALYTICS_VIEW_OWN);
  const { data: live } = useVendorOrders({ live: true, limit: 100 });
  const today = useDashboard(todayRange(), showAnalytics);
  const orders = live?.items ?? [];

  const counts = {
    orders: orders.length,
    preparing: orders.filter(
      (order) =>
        order.status === ORDER_STATUS.ACCEPTED || order.status === ORDER_STATUS.PREPARING,
    ).length,
    onTheWay: orders.filter(
      (order) =>
        order.status === ORDER_STATUS.READY ||
        order.status === ORDER_STATUS.PICKED_UP ||
        order.status === ORDER_STATUS.OUT_FOR_DELIVERY,
    ).length,
    delivered: today.data?.byStatus[ORDER_STATUS.DELIVERED] ?? 0,
  };

  const tiles = [
    { label: 'Orders', value: counts.orders, href: '/orders', tone: 'bg-brand-soft text-brand' },
    {
      label: 'Preparing',
      value: counts.preparing,
      href: '/orders?tab=preparing',
      tone: 'bg-warning-soft text-warning-ink',
    },
    {
      label: 'On the way',
      value: counts.onTheWay,
      href: '/orders?tab=on_the_way',
      tone: 'bg-info-soft text-info-ink',
    },
    {
      label: 'Delivered',
      value: counts.delivered,
      href: '/orders?tab=history',
      tone: 'bg-success-soft text-success-ink',
    },
  ] as const;

  return (
    <div className="grid grid-cols-4 gap-2">
      {tiles.map((tile) => (
        <Link
          key={tile.label}
          href={tile.href}
          className="flex flex-col items-center rounded-2xl bg-surface px-1 py-3 text-center shadow-sm"
        >
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl text-body font-semibold tabular ${tile.tone}`}
          >
            {tile.value}
          </span>
          <span className="mt-1.5 text-[11px] font-medium leading-tight text-ink-muted">
            {tile.label}
          </span>
        </Link>
      ))}
    </div>
  );
}

function BoostBanner({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-brand-hover p-4 text-brand-ink shadow-brand"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
        <Megaphone aria-hidden className="h-7 w-7" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-semibold">Weekend Boost</span>
        <span className="block text-caption text-white/80">Fill the kitchen with a timed offer.</span>
      </span>
      <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-caption font-semibold text-brand">
        Create Offer
      </span>
    </Link>
  );
}

function QuickActions() {
  const { can } = useSession();

  const actions = [
    { href: '/menu', label: 'Menu', icon: ChefHat, show: true },
    { href: '/orders', label: 'Orders', icon: ClipboardList, show: true },
    {
      href: '/analytics',
      label: 'Analytics',
      icon: BarChart3,
      show: can(PERMISSIONS.ANALYTICS_VIEW_OWN),
    },
    {
      href: can(PERMISSIONS.COUPON_MANAGE) ? '/coupons' : '/promotions',
      label: 'Promotions',
      icon: Tags,
      show: can(PERMISSIONS.COUPON_MANAGE) || can(PERMISSIONS.ANNOUNCEMENT_SEND_VENDOR_SCOPE),
    },
    {
      href: '/analytics',
      label: 'Payouts',
      icon: Wallet,
      show: can(PERMISSIONS.ANALYTICS_VIEW_OWN),
    },
  ].filter((action) => action.show);

  return (
    <div>
      <h2 className="mb-3 text-body font-semibold text-ink">Quick Actions</h2>
      <ul className="flex justify-between gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <li key={action.label} className="flex-1">
              <Link href={action.href} className="flex flex-col items-center gap-2">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
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

const HOME_STATUS: Partial<
  Record<string, { tone: 'danger' | 'warning' | 'info' | 'success'; label: string }>
> = {
  [ORDER_STATUS.PLACED]: { tone: 'danger', label: 'New' },
  [ORDER_STATUS.ACCEPTED]: { tone: 'warning', label: 'Processing' },
  [ORDER_STATUS.PREPARING]: { tone: 'warning', label: 'Preparing' },
  [ORDER_STATUS.READY]: { tone: 'info', label: 'Ready' },
  [ORDER_STATUS.PICKED_UP]: { tone: 'info', label: 'On the way' },
  [ORDER_STATUS.OUT_FOR_DELIVERY]: { tone: 'info', label: 'On the way' },
  [ORDER_STATUS.DELIVERED]: { tone: 'success', label: 'Delivered' },
};

function TodaysOrders() {
  const { data, isLoading } = useVendorOrders({ live: true, limit: 8 });
  const orders = data?.items ?? [];

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-body font-semibold text-ink">Today's Orders</h2>
        <Link href="/orders" className="text-caption font-medium text-brand">
          See all
        </Link>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-6 text-center text-caption text-ink-subtle shadow-sm">
          New tickets appear here the moment a student places an order.
        </p>
      ) : (
        <ul className="space-y-2">
          {orders.slice(0, 6).map((order) => {
            const chip = HOME_STATUS[order.status];
            return (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-sm"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-semibold text-ink">{order.code}</span>
                    <span className="text-caption text-ink-muted">{formatClock(order.createdAt)}</span>
                  </span>
                  <span className="tabular text-body font-semibold text-ink">
                    {formatMoney(order.breakdown.grandTotal)}
                  </span>
                  {chip ? (
                    <Badge tone={chip.tone} size="sm">
                      {chip.label}
                    </Badge>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function TodayPage() {
  const { can } = useSession();
  const showMoney = can(PERMISSIONS.ANALYTICS_VIEW_OWN);
  const offerHref = can(PERMISSIONS.COUPON_MANAGE)
    ? '/coupons'
    : can(PERMISSIONS.ANNOUNCEMENT_SEND_VENDOR_SCOPE)
      ? '/promotions'
      : undefined;

  return (
    <RequireAccess permission={PERMISSIONS.ORDER_READ_VENDOR}>
      <HomeHeader />
      <div className="-mt-10 space-y-4 px-4 pb-6">
        {showMoney ? <RevenueCard /> : null}
        <StatusGrid />
        {offerHref ? <BoostBanner href={offerHref} /> : null}
        <QuickActions />
        <TodaysOrders />
      </div>
    </RequireAccess>
  );
}
