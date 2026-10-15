'use client';

import { PERMISSIONS, VENDOR_STATUS, type VendorStatus } from '@ck/types';
import {
  Button,
  ErrorState,
  PageHeader,
  Pagination,
  Select,
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
import { KitchenActions } from '@/components/kitchen-actions';
import { RequireAccess } from '@/components/require-access';
import { useVendors } from '@/hooks/use-admin';

function Kitchens() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const vendors = useVendors({
    page,
    limit: 20,
    status: status === 'all' ? undefined : (status as VendorStatus),
  });

  return (
    <>
      <PageHeader
        title="Kitchens"
        description="Open a kitchen for the full profile. Suspend pauses it campus-wide until you reinstate it."
        actions={
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: VENDOR_STATUS.PENDING_APPROVAL, label: 'Waiting' },
              { value: VENDOR_STATUS.APPROVED, label: 'Approved' },
              { value: VENDOR_STATUS.REJECTED, label: 'Rejected' },
              { value: VENDOR_STATUS.SUSPENDED, label: 'Suspended' },
            ]}
            aria-label="Filter by status"
          />
        }
      />

      {vendors.isError ? (
        <ErrorState
          title="Could not load kitchens"
          message="Try again in a moment."
          onRetry={() => void vendors.refetch()}
        />
      ) : vendors.isLoading ? (
        <TableWrap>
          <Table>
            <TableSkeleton rows={8} cols={5} />
          </Table>
        </TableWrap>
      ) : (
        <>
          <TableWrap>
            <Table>
              <Thead>
                <Tr>
                  <Th>Kitchen</Th>
                  <Th>Status</Th>
                  <Th>Open</Th>
                  <Th>Rating</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(vendors.data?.items ?? []).map((kitchen) => (
                  <Tr key={kitchen.id}>
                    <Td>
                      <Link
                        href={`/vendors/${kitchen.id}`}
                        className="font-medium text-brand hover:underline"
                      >
                        {kitchen.name}
                      </Link>
                      <p className="text-caption text-ink-muted">{kitchen.slug}</p>
                    </Td>
                    <Td>
                      <StatusBadge status={kitchen.status} kind="vendor" />
                    </Td>
                    <Td>{kitchen.isOpen ? 'Open' : 'Closed'}</Td>
                    <Td className="tabular">
                      {kitchen.ratingCount
                        ? `${kitchen.rating.toFixed(1)} (${kitchen.ratingCount})`
                        : '—'}
                    </Td>
                    <Td className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button size="xs" variant="secondary" asChild>
                          <Link href={`/vendors/${kitchen.id}`}>Details</Link>
                        </Button>
                        <KitchenActions kitchen={kitchen} />
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
          <Pagination
            page={page}
            limit={20}
            total={vendors.data?.total ?? 0}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}

export default function KitchensPage() {
  return (
    <RequireAccess permission={PERMISSIONS.VENDOR_READ}>
      <Kitchens />
    </RequireAccess>
  );
}
