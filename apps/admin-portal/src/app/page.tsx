'use client';

import { formatMoney, PERMISSIONS, VENDOR_STATUS } from '@ck/types';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  DonutChart,
  ErrorState,
  Skeleton,
  Sparkline,
  StatCard,
  StatusBadge,
  humanizeStatus,
  type ChartPoint,
} from '@ck/ui';
import { Bike, IndianRupee, Megaphone, ReceiptText, Store, Users } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { RequireAccess } from '@/components/require-access';
import { useDashboard, useOrders, useVendors } from '@/hooks/use-admin';
import { formatClock, formatRangeLabel, percentChange, previousRange, rangeForDays } from '@/lib/dates';
import { useSession } from '@/lib/session';

const PRESETS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const;

function Overview() {
  const { user, can } = useSession();
  const [days, setDays] = useState(7);
  const range = useMemo(() => rangeForDays(days), [days]);
  const prior = useMemo(() => previousRange(days), [days]);
  const dashboard = useDashboard(range);
  const previous = useDashboard(prior);
  const orders = useOrders({ page: 1, limit: 6 });
  const vendors = useVendors({ page: 1, limit: 50 });

  const gmvTrend: ChartPoint[] = (dashboard.data?.timeline ?? []).map((day) => ({
    label: new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short' }),
    value: day.gmv,
    display: formatMoney(day.gmv),
  }));

  const paymentMix: ChartPoint[] = (dashboard.data?.paymentMix ?? [])
    .filter((row) => row.count > 0)
    .map((row) => ({
      label: humanizeStatus(row.method),
      value: row.count,
      display: `${row.count} · ${formatMoney(row.amount)}`,
    }));

  if (dashboard.isError) {
    return (
      <ErrorState
        title="Could not load the dashboard"
        message="Try again in a moment."
        onRetry={() => void dashboard.refetch()}
      />
    );
  }

  const totals = dashboard.data?.totals;
  const prev = previous.data?.totals;
  const activeKitchens = dashboard.data?.vendorsByStatus[VENDOR_STATUS.APPROVED] ?? 0;
  const prevKitchens = previous.data?.vendorsByStatus[VENDOR_STATUS.APPROVED] ?? 0;
  const ratingById = new Map((vendors.data?.items ?? []).map((vendor) => [vendor.id, vendor]));

  return (
    <div className="space-y-5">
      <section className="admin-hero relative overflow-hidden rounded-[1.5rem] p-5">
        <p className="text-title font-semibold">
          Welcome back, {user?.name?.split(' ')[0] ?? 'Admin'} 👋
        </p>
        <p className="mt-1 max-w-md text-caption text-white/80">
          Here is what happened {formatRangeLabel(range).toLowerCase()}.
        </p>
        <Bike aria-hidden className="absolute -right-2 bottom-2 h-20 w-20 text-white/20" />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-caption text-ink-muted">{formatRangeLabel(range)}</p>
        <div className="flex gap-1">
          {PRESETS.map((preset) => (
            <Button
              key={preset.days}
              size="sm"
              className="rounded-full"
              variant={days === preset.days ? 'primary' : 'secondary'}
              onClick={() => setDays(preset.days)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {dashboard.isLoading || !totals ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-[1.25rem]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total orders"
            value={String(totals.orders)}
            icon={<ReceiptText aria-hidden className="h-4 w-4" />}
            delta={percentChange(totals.orders, prev?.orders ?? 0)}
          />
          <StatCard
            label="GMV"
            value={formatMoney(totals.gmv)}
            icon={<IndianRupee aria-hidden className="h-4 w-4" />}
            delta={percentChange(totals.gmv, prev?.gmv ?? 0)}
            hint={`Platform ${formatMoney(totals.platformRevenue)}`}
          />
          <StatCard
            label="Active kitchens"
            value={String(activeKitchens)}
            icon={<Store aria-hidden className="h-4 w-4" />}
            delta={percentChange(activeKitchens, prevKitchens)}
            hint={totals.pendingVendors ? `${totals.pendingVendors} waiting` : undefined}
          />
          <StatCard
            label="New users"
            value={String(totals.newUsers)}
            icon={<Users aria-hidden className="h-4 w-4" />}
            delta={percentChange(totals.newUsers, prev?.newUsers ?? 0)}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Revenue overview" description="Gross merchandise value" />
          <CardBody>
            {gmvTrend.some((point) => point.value > 0) ? (
              <Sparkline
                points={gmvTrend}
                caption="GMV over the selected range"
                height={160}
              />
            ) : (
              <p className="text-caption text-ink-muted">No orders in this range.</p>
            )}
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Payments" description="How students paid" />
          <CardBody>
            {paymentMix.length ? (
              <DonutChart points={paymentMix} caption="Orders by payment method" />
            ) : (
              <p className="text-caption text-ink-muted">No payments in this range.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {can(PERMISSIONS.ORDER_READ_ALL) ? (
          <Card className="lg:col-span-3">
            <CardHeader
              title="Recent orders"
              action={
                <Button size="sm" variant="ghost" asChild>
                  <Link href="/orders">See all</Link>
                </Button>
              }
            />
            <CardBody className="space-y-3">
              {orders.isLoading ? (
                <Skeleton className="h-40" />
              ) : orders.data?.items.length ? (
                <ul className="space-y-3">
                  {orders.data.items.map((order) => (
                    <li key={order.id} className="flex items-center gap-3">
                      <Link
                        href={`/orders/${order.id}`}
                        className="min-w-0 flex-1 font-medium text-brand hover:underline"
                      >
                        {order.code}
                      </Link>
                      <span className="hidden min-w-0 truncate text-caption text-ink-muted sm:block">
                        {order.vendorName ?? '—'}
                      </span>
                      <span className="tabular text-caption font-semibold text-ink">
                        {formatMoney(order.breakdown.grandTotal)}
                      </span>
                      <StatusBadge status={order.status} size="sm" />
                      <span className="hidden text-caption text-ink-subtle lg:block">
                        {formatClock(order.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-caption text-ink-muted">No orders yet.</p>
              )}
            </CardBody>
          </Card>
        ) : null}

        <Card className={can(PERMISSIONS.ORDER_READ_ALL) ? 'lg:col-span-2' : 'lg:col-span-5'}>
          <CardHeader
            title="Top kitchens"
            action={
              can(PERMISSIONS.VENDOR_READ) ? (
                <Button size="sm" variant="ghost" asChild>
                  <Link href="/vendors">See all</Link>
                </Button>
              ) : null
            }
          />
          <CardBody className="space-y-3">
            {dashboard.data?.topVendors.length ? (
              <ol className="space-y-3">
                {dashboard.data.topVendors.map((row) => {
                  const vendor = ratingById.get(row.vendorId);
                  return (
                    <li key={row.vendorId} className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-brand-soft text-brand">
                        {vendor?.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={vendor.logoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Store aria-hidden className="h-4 w-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <Link
                          href={`/vendors/${row.vendorId}`}
                          className="block truncate text-body font-medium text-ink hover:text-brand"
                        >
                          {row.name}
                        </Link>
                        <span className="text-caption text-ink-muted">
                          {row.orders} orders
                          {vendor && vendor.rating > 0 ? ` · ${vendor.rating.toFixed(1)}★` : ''}
                        </span>
                      </span>
                      <span className="tabular text-caption font-semibold text-ink">
                        {formatMoney(row.gmv)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-caption text-ink-muted">No kitchen sales in this range.</p>
            )}
          </CardBody>
        </Card>
      </div>

      {can(PERMISSIONS.ANNOUNCEMENT_SEND) ? (
        <Link
          href="/announcements"
          className="admin-hero flex items-center gap-4 rounded-[1.25rem] p-4"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <Megaphone aria-hidden className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold">Announce to all users</span>
            <span className="block text-caption text-white/80">
              A campus-wide push, with a preview before it sends.
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-caption font-semibold text-brand">
            Create announcement
          </span>
        </Link>
      ) : null}
    </div>
  );
}

export default function OverviewPage() {
  return (
    <RequireAccess permission={PERMISSIONS.ANALYTICS_VIEW_ALL}>
      <Overview />
    </RequireAccess>
  );
}
