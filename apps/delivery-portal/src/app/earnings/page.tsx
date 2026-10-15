'use client';

import { DELIVERY_STATUS, PERMISSIONS, WALLET_TXN_TYPE, formatMoney } from '@ck/types';
import { Alert, BarChart, EmptyState, ErrorState, Skeleton } from '@ck/ui';
import { Banknote, Bike, Clock, IndianRupee, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { JobHistoryRow } from '@/components/job-card';
import { RequireAccess } from '@/components/require-access';
import { RiderScreen } from '@/components/rider-screen';
import { useWallet, useWalletTransactions } from '@/hooks/use-account';
import { useEarnings, useJobHistory } from '@/hooks/use-jobs';
import { isoDay } from '@/lib/dates';
import { useSession } from '@/lib/session';

function weekPoints(items: { deliveredAt?: string; createdAt: string; earning: number; status: string }[]) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return { key: isoDay(date), label: date.toLocaleDateString('en-IN', { weekday: 'short' }), value: 0 };
  });
  const index = new Map(days.map((day, i) => [day.key, i]));
  for (const item of items) {
    if (item.status !== DELIVERY_STATUS.DELIVERED) continue;
    const key = isoDay(new Date(item.deliveredAt ?? item.createdAt));
    const slot = index.get(key);
    if (slot !== undefined && days[slot]) days[slot].value += item.earning;
  }
  return days.map((day) => ({
    label: day.label,
    value: day.value,
    display: formatMoney(day.value),
  }));
}

function WalletPanel() {
  const { can } = useSession();
  const wallet = useWallet();
  const txns = useWalletTransactions(1);

  if (!can(PERMISSIONS.WALLET_READ_OWN)) return null;

  return (
    <section id="wallet" className="space-y-3 scroll-mt-4">
      <div className="rider-purple rounded-[1.25rem] p-4">
        <p className="text-caption text-white/80">Wallet balance</p>
        <p className="mt-1 tabular text-title-lg font-semibold text-white">
          {wallet.data ? formatMoney(wallet.data.balance) : '—'}
        </p>
        <p className="mt-2 text-caption text-white/70">
          Campus pays delivery earnings on their settlement schedule. There is no withdraw
          button here.
        </p>
      </div>

      {txns.data?.items.length ? (
        <ul className="rounded-[1.25rem] bg-surface px-4">
          {txns.data.items.map((txn) => (
            <li
              key={txn.id}
              className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-body text-ink">{txn.description}</p>
                <p className="text-caption text-ink-subtle">
                  {new Date(txn.createdAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <p
                className={`tabular shrink-0 text-body font-semibold ${
                  txn.type === WALLET_TXN_TYPE.PAYOUT ? 'text-ink-muted' : 'text-brand'
                }`}
              >
                {txn.amount >= 0 ? '+' : ''}
                {formatMoney(txn.amount)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Earnings() {
  const { data, isLoading, isError, refetch } = useEarnings();
  const history = useJobHistory(1);

  const trend = useMemo(
    () => weekPoints(history.data?.items ?? []),
    [history.data?.items],
  );
  const hasTrend = trend.some((point) => point.value > 0);

  if (isError) {
    return <ErrorState title="Could not load your earnings" onRetry={() => void refetch()} />;
  }

  if (isLoading || !data) {
    return (
      <RiderScreen title="Earnings">
        <Skeleton className="h-64 rounded-[1.25rem]" />
      </RiderScreen>
    );
  }

  const breakdown = [
    { label: 'Today', value: formatMoney(data.today.amount), icon: IndianRupee },
    { label: 'Awaiting payout', value: formatMoney(data.unsettled), icon: Clock },
    { label: 'All time', value: formatMoney(data.lifetime), icon: Banknote },
    { label: 'Deliveries', value: String(data.completedDeliveries), icon: Bike },
  ];

  return (
    <RiderScreen title="Earnings">
      <div className="space-y-4">
        <section className="rider-purple rounded-[1.25rem] p-4">
          <p className="text-caption text-white/80">Total earnings</p>
          <p className="tabular text-title-lg font-semibold text-white">
            {formatMoney(data.lifetime)}
          </p>
          <p className="text-caption text-white/70">
            {formatMoney(data.today.amount)} today · {data.today.deliveries}{' '}
            {data.today.deliveries === 1 ? 'delivery' : 'deliveries'}
          </p>
          {hasTrend ? (
            <div className="mt-4">
              <BarChart
                points={trend}
                caption="Earnings this week from completed jobs"
                heightClassName="h-24"
                barClassName="bg-white/35 group-hover:bg-white/70"
                labelClassName="text-white/70"
                emphasisIndex={trend.length - 1}
              />
            </div>
          ) : null}
        </section>

        <ul className="space-y-2">
          {breakdown.map((row) => {
            const Icon = row.icon;
            return (
              <li
                key={row.label}
                className="flex items-center gap-3 rounded-[1.25rem] bg-surface px-4 py-3"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-info-soft text-info">
                  <Icon aria-hidden className="h-4 w-4" />
                </span>
                <span className="flex-1 text-body text-ink">{row.label}</span>
                <span className="tabular text-body font-semibold text-ink">{row.value}</span>
              </li>
            );
          })}
        </ul>

        {data.unsettled > 0 ? (
          <Alert tone="info" title="How payouts work">
            {formatMoney(data.unsettled)} is earned and waiting. The campus team pays it out on
            their settlement schedule — there is nothing you need to do here.
          </Alert>
        ) : null}

        <WalletPanel />

        <section>
          <h2 className="mb-3 text-body font-semibold text-ink">Recent jobs</h2>
          {history.data?.items.length ? (
            <div className="rounded-[1.25rem] bg-surface px-4">
              {history.data.items.slice(0, 8).map((job) => (
                <JobHistoryRow key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Wallet aria-hidden className="h-6 w-6" />}
              title="No finished jobs yet"
              description="Completed deliveries and what you earned show up here."
            />
          )}
        </section>
      </div>
    </RiderScreen>
  );
}

export default function EarningsPage() {
  return (
    <RequireAccess permission={PERMISSIONS.DELIVERY_READ_OWN}>
      <Earnings />
    </RequireAccess>
  );
}
