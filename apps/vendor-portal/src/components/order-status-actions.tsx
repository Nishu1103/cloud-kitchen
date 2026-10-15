'use client';

import type { OrderDetail } from '@ck/sdk';
import { ORDER_STATUS, ORDER_TYPE, PERMISSIONS, type OrderStatus } from '@ck/types';
import { Button, ConfirmDialog, Field, Textarea } from '@ck/ui';
import { useState } from 'react';
import { useUpdateOrderStatus } from '@/hooks/use-orders';
import { useSession } from '@/lib/session';

/**
 * What this order can become next, from the kitchen's point of view.
 *
 * Only the forward step is offered. The API validates every transition against a
 * forward-only map, so the button set here is a convenience that mirrors it - not the
 * rule itself. A delivery order deliberately stops at "ready": the rider closes it out,
 * and offering "delivered" here would invite a kitchen to mark food delivered that is
 * still on the counter.
 */
function nextStep(order: OrderDetail): { status: OrderStatus; label: string } | null {
  switch (order.status) {
    case ORDER_STATUS.PLACED:
      return { status: ORDER_STATUS.ACCEPTED, label: 'Accept Order' };
    case ORDER_STATUS.ACCEPTED:
      return { status: ORDER_STATUS.PREPARING, label: 'Start cooking' };
    case ORDER_STATUS.PREPARING:
      return { status: ORDER_STATUS.READY, label: 'Mark ready' };
    case ORDER_STATUS.READY:
      return order.type === ORDER_TYPE.PICKUP
        ? { status: ORDER_STATUS.DELIVERED, label: 'Handed over' }
        : null;
    default:
      return null;
  }
}

export function OrderStatusActions({
  order,
  layout = 'row',
}: {
  order: OrderDetail;
  /** Detail screen stacks Reject + Accept as a footer pair. */
  layout?: 'row' | 'stack';
}) {
  const { can } = useSession();
  const update = useUpdateOrderStatus();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const step = nextStep(order);
  const canAdvance = can(PERMISSIONS.ORDER_UPDATE_STATUS);
  const canReject = order.status === ORDER_STATUS.PLACED && canAdvance;
  const showReject = canReject && layout === 'stack';

  if (!canAdvance || (!step && !showReject)) {
    return order.status === ORDER_STATUS.READY && order.type === ORDER_TYPE.DELIVERY ? (
      <p className="text-caption text-ink-muted">Waiting for a delivery partner to collect.</p>
    ) : null;
  }

  return (
    <div className={layout === 'stack' ? 'flex gap-2' : 'flex flex-col gap-2'}>
      {showReject ? (
        <>
          <Button className="flex-1" variant="secondary" size="lg" onClick={() => setRejecting(true)}>
            Reject
          </Button>
          <ConfirmDialog
            open={rejecting}
            onOpenChange={setRejecting}
            title={`Reject order ${order.code}?`}
            description="The student is told immediately and anything they paid is refunded to their campus wallet."
            confirmLabel="Reject order"
            tone="danger"
            loading={update.isPending}
            onConfirm={() =>
              update.mutate(
                {
                  id: order.id,
                  status: ORDER_STATUS.REJECTED,
                  // Sent through so it lands on the order timeline and in the student's
                  // notification: "rejected" with no reason generates a support ticket.
                  note: reason.trim() || undefined,
                },
                {
                  onSuccess: () => {
                    setRejecting(false);
                    setReason('');
                  },
                },
              )
            }
          >
            <Field label="Reason" hint="Shown to the student. Keep it short and honest.">
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={240}
                placeholder="Out of paneer for tonight"
              />
            </Field>
          </ConfirmDialog>
        </>
      ) : null}

      {step ? (
        <Button
          className={layout === 'stack' ? 'flex-[1.6]' : undefined}
          block={layout !== 'stack'}
          size="lg"
          loading={update.isPending}
          onClick={() => update.mutate({ id: order.id, status: step.status })}
        >
          {step.label}
        </Button>
      ) : null}
    </div>
  );
}
