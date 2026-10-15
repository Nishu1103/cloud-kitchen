'use client';

import { formatMoney, PERMISSIONS } from '@ck/types';
import {
  Button,
  ConfirmDialog,
  ErrorState,
  Field,
  Input,
  PageHeader,
  StatusBadge,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@ck/ui';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { RequireAccess } from '@/components/require-access';
import { useOrder, useRefundOrder } from '@/hooks/use-admin';
import { useSession } from '@/lib/session';

function OrderDetail() {
  const params = useParams<{ id: string }>();
  const { can } = useSession();
  const order = useOrder(params.id);
  const refund = useRefundOrder();
  const [open, setOpen] = useState(false);

  if (order.isError) {
    return (
      <ErrorState
        title="Order not found"
        message="It may belong to another campus."
        onRetry={() => void order.refetch()}
      />
    );
  }

  const data = order.data;
  if (!data) return null;

  return (
    <>
      <PageHeader
        title={data.code}
        description={`${data.vendorName ?? 'Kitchen'} · ${data.customerName ?? 'Customer'}`}
        actions={
          can(PERMISSIONS.ORDER_REFUND) ? (
            <Button variant="danger-soft" onClick={() => setOpen(true)}>
              Refund
            </Button>
          ) : null
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <StatusBadge status={data.status} />
        <StatusBadge status={data.paymentStatus} kind="payment" />
      </div>
      <TableWrap>
        <Table>
          <Thead>
            <Tr>
              <Th>Item</Th>
              <Th>Qty</Th>
              <Th>Line</Th>
            </Tr>
          </Thead>
          <Tbody>
            {data.lines.map((line) => (
              <Tr key={line.id}>
                <Td>{line.name}</Td>
                <Td>{line.quantity}</Td>
                <Td className="tabular">{formatMoney(line.lineTotal)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableWrap>
      <p className="mt-4 text-body">
        Total {formatMoney(data.breakdown.grandTotal)} · payable {formatMoney(data.breakdown.payableNow)}
      </p>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Issue a refund"
        description="Amount is in paise. Partial refunds are allowed; every call is audited."
        confirmLabel="Refund"
        onConfirm={() => {
          const amount = Number((document.getElementById('refund-amount') as HTMLInputElement | null)?.value);
          const reason = (document.getElementById('refund-reason') as HTMLInputElement | null)?.value.trim();
          if (!amount || !reason) return;
          refund.mutate({ id: data.id, amount, reason }, { onSettled: () => setOpen(false) });
        }}
        loading={refund.isPending}
      >
        <div className="space-y-3">
          <Field label="Amount (paise)" required>
            <Input id="refund-amount" type="number" min={1} defaultValue={data.breakdown.payableNow} />
          </Field>
          <Field label="Reason" required>
            <Input id="refund-reason" required maxLength={240} />
          </Field>
        </div>
      </ConfirmDialog>
    </>
  );
}

export default function OrderDetailPage() {
  return (
    <RequireAccess permission={PERMISSIONS.ORDER_READ_ALL}>
      <OrderDetail />
    </RequireAccess>
  );
}
