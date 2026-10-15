'use client';

import { formatMoney, PERMISSIONS } from '@ck/types';
import {
  ErrorState,
  PageHeader,
  Pagination,
  StatusBadge,
  Table,
  TableSkeleton,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@ck/ui';
import Link from 'next/link';
import { useState } from 'react';
import { RequireAccess } from '@/components/require-access';
import { useOrders } from '@/hooks/use-admin';

function Orders() {
  const [page, setPage] = useState(1);
  const orders = useOrders({ page, limit: 20 });

  return (
    <>
      <PageHeader title="Orders" description="Every order on this campus. Refunds are audited." />
      {orders.isError ? (
        <ErrorState
          title="Could not load orders"
          message="Try again in a moment."
          onRetry={() => void orders.refetch()}
        />
      ) : orders.isLoading ? (
        <TableWrap>
          <Table>
            <TableSkeleton rows={8} cols={6} />
          </Table>
        </TableWrap>
      ) : (
        <>
          <TableWrap>
            <Table>
              <Thead>
                <Tr>
                  <Th>Code</Th>
                  <Th>Kitchen</Th>
                  <Th>Customer</Th>
                  <Th>Status</Th>
                  <Th>Total</Th>
                  <Th>Placed</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(orders.data?.items ?? []).map((order) => (
                  <Tr key={order.id}>
                    <Td>
                      <Link href={`/orders/${order.id}`} className="font-medium text-brand hover:underline">
                        {order.code}
                      </Link>
                    </Td>
                    <Td>{order.vendorName ?? '—'}</Td>
                    <Td>{order.customerName ?? '—'}</Td>
                    <Td>
                      <StatusBadge status={order.status} />
                    </Td>
                    <Td className="tabular">{formatMoney(order.breakdown.grandTotal)}</Td>
                    <Td className="text-caption text-ink-muted">
                      {new Date(order.createdAt).toLocaleString('en-IN')}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
          <Pagination page={page} limit={20} total={orders.data?.total ?? 0} onPageChange={setPage} />
        </>
      )}
    </>
  );
}

export default function OrdersPage() {
  return (
    <RequireAccess permission={PERMISSIONS.ORDER_READ_ALL}>
      <Orders />
    </RequireAccess>
  );
}
