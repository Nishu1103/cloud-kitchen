'use client';

import { formatMoney } from '@ck/types';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SkeletonText,
  StatusBadge,
  Tab,
  TabList,
  Tabs,
} from '@ck/ui';
import { Receipt } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { RequireAuth } from '@/components/require-auth';
import { isLiveOrder, useOrders } from '@/hooks/use-orders';

function OrderList() {
  const [tab, setTab] = useState<'live' | 'all'>('live');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useOrders({
    page,
    limit: 10,
    live: tab === 'live' ? true : undefined,
  });

  const orders = data?.items ?? [];

  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value as 'live' | 'all');
          setPage(1);
        }}
      >
        <TabList scrollable={false}>
          <Tab value="live" count={orders.filter((order) => isLiveOrder(order.status)).length}>
            In progress
          </Tab>
          <Tab value="all">All orders</Tab>
        </TabList>
      </Tabs>

      {isError ? (
        <ErrorState message="We could not load your orders." onRetry={() => refetch()} />
      ) : isLoading ? (
        <Card className="p-4">
          <SkeletonText lines={6} />
        </Card>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<Receipt aria-hidden className="h-6 w-6" />}
          title={tab === 'live' ? 'Nothing cooking' : 'No orders yet'}
          description={
            tab === 'live'
              ? 'Your live orders show up here with a step-by-step timeline.'
              : 'Once you order, everything you have eaten lives here.'
          }
          action={
            <Button asChild>
              <Link href="/kitchens">Find something to eat</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Card interactive asChild>
                  <Link href={`/orders/${order.id}`} className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-body font-semibold text-ink">
                          {order.vendorName ?? 'Order'}
                        </p>
                        <StatusBadge status={order.status} size="sm" />
                      </div>
                      <p className="tabular text-caption text-ink-muted">
                        #{order.code} ·{' '}
                        {new Date(order.createdAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="truncate text-caption text-ink-subtle">
                        {order.lines.map((line) => `${line.quantity}× ${line.name}`).join(', ')}
                      </p>
                    </div>
                    <p className="tabular shrink-0 text-body font-semibold text-ink">
                      {formatMoney(order.breakdown.grandTotal)}
                    </p>
                  </Link>
                </Card>
              </li>
            ))}
          </ul>

          <Pagination
            page={data!.page}
            limit={data!.limit}
            total={data!.total}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Your orders" />
      <RequireAuth message="Sign in to see your orders.">
        <OrderList />
      </RequireAuth>
    </div>
  );
}
