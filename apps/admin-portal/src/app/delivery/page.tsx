'use client';

import { PERMISSIONS } from '@ck/types';
import {
  ErrorState,
  PageHeader,
  Pagination,
  StatusBadge,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@ck/ui';
import { useState } from 'react';
import { RequireAccess } from '@/components/require-access';
import { useDeliveries } from '@/hooks/use-admin';

function DeliveryBoard() {
  const [page, setPage] = useState(1);
  const jobs = useDeliveries({ page, limit: 20 });

  return (
    <>
      <PageHeader title="Delivery" description="Live assignments across the campus." />
      {jobs.isError ? (
        <ErrorState title="Could not load deliveries" onRetry={() => void jobs.refetch()} />
      ) : (
        <>
          <TableWrap>
            <Table>
              <Thead>
                <Tr>
                  <Th>Order</Th>
                  <Th>Status</Th>
                  <Th>Partner</Th>
                  <Th>Updated</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(jobs.data?.items ?? []).map((job) => (
                  <Tr key={job.id}>
                    <Td className="font-medium">{job.orderCode ?? job.orderId}</Td>
                    <Td>
                      <StatusBadge status={job.status} kind="delivery" />
                    </Td>
                    <Td>{job.partnerId ? 'Assigned' : 'Unassigned'}</Td>
                    <Td className="text-caption text-ink-muted">
                      {new Date(job.createdAt).toLocaleString('en-IN')}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
          <Pagination page={page} limit={20} total={jobs.data?.total ?? 0} onPageChange={setPage} />
        </>
      )}
    </>
  );
}

export default function DeliveryPage() {
  return (
    <RequireAccess permission={PERMISSIONS.DELIVERY_READ_ALL}>
      <DeliveryBoard />
    </RequireAccess>
  );
}
