'use client';

import type { DateRange } from '@ck/sdk';
import { formatMoney, PERMISSIONS } from '@ck/types';
import {
  BarChart,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@ck/ui';
import { BarChart3, ChefHat } from 'lucide-react';
import { useMemo, useState } from 'react';
import { RequireAccess } from '@/components/require-access';
import { VendorScreen } from '@/components/vendor-screen';
import { useDashboard, usePeakHours } from '@/hooks/use-kitchen';
import { rangeForDays } from '@/lib/dates';

const PRESETS = [
  { days: 7, label: 'This Week' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const;

function percentHint(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change >= 0 ? '+' : ''}${change}%`;
}

function AnalyticsScreen() {
  const [days, setDays] = useState<number>(7);
  const range = useMemo(() => rangeForDays(days), [days]);
  const previousRange = useMemo<DateRange>(() => {
    const to = new Date();
    to.setDate(to.getDate() - days);
    const from = new Date(to);
    from.setDate(from.getDate() - (days - 1));
    const iso = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate(),
      ).padStart(2, '0')}`;
    return { from: iso(from), to: iso(to) };
  }, [days]);

  const dashboard = useDashboard(range);
  const previous = useDashboard(previousRange);
  const peaks = usePeakHours(range);

  const revenueTrend = (dashboard.data?.timeline ?? []).map((day) => ({
    label: new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short' }),
    value: day.revenue,
    display: formatMoney(day.revenue),
  }));

  const ordersHint = percentHint(
    dashboard.data?.totals.orders ?? 0,
    previous.data?.totals.orders ?? 0,
  );
  const aovHint = percentHint(
    dashboard.data?.totals.averageOrderValue ?? 0,
    previous.data?.totals.averageOrderValue ?? 0,
  );

  return (
    <VendorScreen title="Analytics" backHref="/more">
      <div role="group" aria-label="Date range" className="mb-4 flex gap-1.5 overflow-x-auto">
        {PRESETS.map((preset) => (
          <Button
            key={preset.days}
            size="sm"
            variant={days === preset.days ? 'primary' : 'secondary'}
            aria-pressed={days === preset.days}
            onClick={() => setDays(preset.days)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {dashboard.isError ? (
        <ErrorState
          message="Could not load your analytics."
          onRetry={() => void dashboard.refetch()}
        />
      ) : dashboard.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-48 rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-24 rounded-2xl" />
            ))}
          </div>
        </div>
      ) : dashboard.data ? (
        <div className="space-y-4">
          <section className="rounded-2xl bg-brand p-4 text-brand-ink shadow-brand">
            <p className="text-caption text-white/80">Revenue</p>
            <p className="tabular text-title-lg font-semibold">
              {formatMoney(dashboard.data.totals.revenue)}
            </p>
            <p className="text-caption text-white/70">
              Payout {formatMoney(dashboard.data.totals.payout)} after commission
            </p>
            {revenueTrend.some((point) => point.value > 0) ? (
              <div className="mt-4">
                <BarChart
                  points={revenueTrend}
                  caption={`Daily sales over the last ${days} days`}
                  heightClassName="h-28"
                  barClassName="bg-white/90 group-hover:bg-white"
                  labelClassName="text-white/70"
                />
              </div>
            ) : (
              <p className="mt-4 text-caption text-white/70">No sales in this range yet.</p>
            )}
          </section>

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: 'Total Orders',
                value: String(dashboard.data.totals.orders),
                hint: ordersHint,
              },
              {
                label: 'Average Order Value',
                value: formatMoney(dashboard.data.totals.averageOrderValue),
                hint: aovHint,
              },
              {
                label: 'Your payout',
                value: formatMoney(dashboard.data.totals.payout),
                hint: 'After commission',
              },
              {
                label: 'Cancelled',
                value: String(dashboard.data.totals.cancelled),
                hint:
                  dashboard.data.totals.orders > 0
                    ? `${Math.round(
                        (dashboard.data.totals.cancelled / dashboard.data.totals.orders) * 100,
                      )}% of orders`
                    : 'None yet',
              },
            ].map((tile) => (
              <div key={tile.label} className="rounded-2xl bg-surface p-3 shadow-sm">
                <p className="text-caption text-ink-muted">{tile.label}</p>
                <p className="mt-1 tabular text-title font-semibold text-ink">{tile.value}</p>
                {tile.hint ? (
                  <p
                    className={`text-caption ${
                      tile.hint.startsWith('+')
                        ? 'text-success'
                        : tile.hint.startsWith('-')
                          ? 'text-danger'
                          : 'text-ink-subtle'
                    }`}
                  >
                    {tile.hint}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          <section className="rounded-2xl bg-surface p-4 shadow-sm">
            <h2 className="mb-3 text-body font-semibold text-ink">Top selling items</h2>
            {dashboard.data.topItems.length ? (
              <ol className="space-y-3">
                {dashboard.data.topItems.map((item, index) => (
                  <li key={item.productId} className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                      <ChefHat aria-hidden className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink">
                        {item.name}
                      </span>
                      <span className="text-caption text-ink-muted">
                        {item.quantity} orders
                      </span>
                    </span>
                    <span className="tabular text-caption font-semibold text-ink">
                      {formatMoney(item.revenue)}
                    </span>
                    <span className="sr-only">#{index + 1}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-caption text-ink-subtle">No dishes sold in this range yet.</p>
            )}
          </section>

          {peaks.data?.some((entry) => entry.orders > 0) ? (
            <section className="rounded-2xl bg-surface p-4 shadow-sm">
              <h2 className="mb-3 text-body font-semibold text-ink">Busiest hours</h2>
              <BarChart
                points={peaks.data.map((entry) => ({
                  label: entry.hour === 0 ? '12a' : entry.hour === 12 ? '12p' : entry.hour < 12 ? `${entry.hour}a` : `${entry.hour - 12}p`,
                  value: entry.orders,
                  display: `${entry.orders} orders`,
                }))}
                caption="Orders by hour of day"
                labelEvery={3}
              />
            </section>
          ) : null}
        </div>
      ) : (
        <EmptyState
          icon={<BarChart3 aria-hidden className="h-6 w-6" />}
          title="No data yet"
          description="Numbers appear here once you start taking orders."
        />
      )}
    </VendorScreen>
  );
}

export default function AnalyticsPage() {
  return (
    <RequireAccess permission={PERMISSIONS.ANALYTICS_VIEW_OWN}>
      <AnalyticsScreen />
    </RequireAccess>
  );
}
