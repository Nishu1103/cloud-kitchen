'use client';

import { formatMoney, PERMISSIONS } from '@ck/types';
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
import { useCoupons } from '@/hooks/use-admin';

function Coupons() {
  const [page, setPage] = useState(1);
  const coupons = useCoupons(page);

  return (
    <>
      <PageHeader title="Coupons" description="Campus-wide codes. Kitchen-owned coupons live in the vendor portal." />
      {coupons.isError ? (
        <ErrorState title="Could not load coupons" onRetry={() => void coupons.refetch()} />
      ) : (
        <>
          <TableWrap>
            <Table>
              <Thead>
                <Tr>
                  <Th>Code</Th>
                  <Th>Title</Th>
                  <Th>Value</Th>
                  <Th>Active</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(coupons.data?.items ?? []).map((coupon) => (
                  <Tr key={coupon.id}>
                    <Td className="font-medium">{coupon.code}</Td>
                    <Td>{coupon.title}</Td>
                    <Td className="tabular">
                      {coupon.type === 'flat' ? formatMoney(coupon.value) : `${coupon.value}%`}
                    </Td>
                    <Td>
                      <StatusBadge status={coupon.isActive ? 'approved' : 'suspended'} kind="vendor" />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableWrap>
          <Pagination page={page} limit={20} total={coupons.data?.total ?? 0} onPageChange={setPage} />
        </>
      )}
    </>
  );
}

export default function CouponsPage() {
  return (
    <RequireAccess permission={PERMISSIONS.COUPON_MANAGE}>
      <Coupons />
    </RequireAccess>
  );
}
