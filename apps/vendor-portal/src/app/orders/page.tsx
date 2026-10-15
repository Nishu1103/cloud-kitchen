'use client';

import { ORDER_STATUS, PERMISSIONS, type OrderStatus } from '@ck/types';
import {
  EmptyState,
  ErrorState,
  Pagination,
  Select,
  Skeleton,
} from '@ck/ui';
import { CheckCircle2, UtensilsCrossed } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { OrderTicket } from '@/components/order-ticket';
import { RequireAccess } from '@/components/require-access';
import { VendorScreen } from '@/components/vendor-screen';
import { useVendorOrders } from '@/hooks/use-orders';

const LIVE_TABS = [
  {
    id: 'new',
    label: 'New',
    statuses: [ORDER_STATUS.PLACED] as OrderStatus[],
  },
  {
    id: 'preparing',
    label: 'Preparing',
    statuses: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING] as OrderStatus[],
  },
  {
    id: 'on_the_way',
    label: 'On the way',
    statuses: [
      ORDER_STATUS.READY,
      ORDER_STATUS.PICKED_UP,
      ORDER_STATUS.OUT_FOR_DELIVERY,
    ] as OrderStatus[],
  },
] as const;

const HISTORY_STATUSES: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: ORDER_STATUS.DELIVERED, label: 'Delivered' },
  { value: ORDER_STATUS.COMPLETED, label: 'Completed' },
  { value: ORDER_STATUS.CANCELLED, label: 'Cancelled' },
  { value: ORDER_STATUS.REJECTED, label: 'Rejected' },
  { value: ORDER_STATUS.REFUNDED, label: 'Refunded' },
];

function History() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');

  const { data, isLoading, isError, refetch } = useVendorOrders({
    page,
    limit: 20,
    status: (status === 'all' ? undefined : status) as OrderStatus | undefined,
  });

  return (
    <div className="space-y-4">
      <div className="max-w-56">
        <Select
          value={status}
          onValueChange={(next) => {
            setStatus(next);
            setPage(1);
          }}
          options={HISTORY_STATUSES}
          aria-label="Filter by status"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message="We could not load these orders." onRetry={() => void refetch()} />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed aria-hidden className="h-6 w-6" />}
          title="No orders here yet"
          description="Finished orders show up in this list."
        />
      ) : (
        <>
          <div className="space-y-3">
            {data?.items.map((order) => (
              <OrderTicket key={order.id} order={order} />
            ))}
          </div>
          <Pagination
            page={data?.page ?? 1}
            limit={data?.limit ?? 20}
            total={data?.total ?? 0}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

function LiveList({ statuses, heading }: { statuses: OrderStatus[]; heading: string }) {
  const { data, isLoading, isError, refetch } = useVendorOrders({ live: true, limit: 100 });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-36 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="We could not load your orders." onRetry={() => void refetch()} />;
  }

  const orders = (data?.items ?? []).filter((order) =>
    statuses.includes(order.status as OrderStatus),
  );

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 aria-hidden className="h-6 w-6" />}
        title="Nothing here"
        description="New orders appear the moment they are placed, with a sound."
      />
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-body font-semibold text-ink">{heading}</h2>
      {orders.map((order) => (
        <OrderTicket key={order.id} order={order} />
      ))}
    </div>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get('tab') ?? 'new';
  const isHistory = tab === 'history';
  const liveTab = LIVE_TABS.find((item) => item.id === tab) ?? LIVE_TABS[0];
  const { data: live } = useVendorOrders({ live: true, limit: 100 });
  const liveItems = live?.items ?? [];

  const counts: Record<string, number> = Object.fromEntries(
    LIVE_TABS.map((item) => [
      item.id,
      liveItems.filter((order) => item.statuses.includes(order.status as OrderStatus)).length,
    ]),
  );

  return (
    <RequireAccess permission={PERMISSIONS.ORDER_READ_VENDOR}>
      <VendorScreen title="Orders">
        <div
          role="tablist"
          aria-label="Order status"
          className="mb-4 flex gap-1.5 overflow-x-auto pb-1"
        >
          {[...LIVE_TABS, { id: 'history', label: 'History' }].map((item) => {
            const active = item.id === (isHistory ? 'history' : liveTab.id);
            const count = counts[item.id];
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => router.replace(`/orders?tab=${item.id}`)}
                className={`shrink-0 rounded-full px-4 py-2 text-caption font-medium transition-colors ${
                  active ? 'bg-brand text-brand-ink shadow-brand' : 'bg-surface text-ink-muted'
                }`}
              >
                {count !== undefined ? `${item.label} (${count})` : item.label}
              </button>
            );
          })}
        </div>

        {isHistory ? (
          <History />
        ) : (
          <LiveList
            statuses={[...liveTab.statuses]}
            heading={`${liveTab.label} (${counts[liveTab.id] ?? 0})`}
          />
        )}
      </VendorScreen>
    </RequireAccess>
  );
}
