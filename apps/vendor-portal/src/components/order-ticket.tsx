'use client';

import type { OrderDetail } from '@ck/sdk';
import { formatMoney, ORDER_STATUS, ORDER_TYPE, PAYMENT_METHOD } from '@ck/types';
import { Badge } from '@ck/ui';
import Link from 'next/link';
import { formatClock } from '@/lib/dates';
import { DishPhoto } from './dish-photo';
import { OrderStatusActions } from './order-status-actions';

const STATUS_BADGE: Partial<
  Record<string, { tone: 'danger' | 'warning' | 'info' | 'success'; label: string }>
> = {
  [ORDER_STATUS.PLACED]: { tone: 'danger', label: 'NEW' },
  [ORDER_STATUS.ACCEPTED]: { tone: 'warning', label: 'Processing' },
  [ORDER_STATUS.PREPARING]: { tone: 'warning', label: 'Preparing' },
  [ORDER_STATUS.READY]: { tone: 'info', label: 'Ready' },
  [ORDER_STATUS.PICKED_UP]: { tone: 'info', label: 'On the way' },
  [ORDER_STATUS.OUT_FOR_DELIVERY]: { tone: 'info', label: 'On the way' },
  [ORDER_STATUS.DELIVERED]: { tone: 'success', label: 'Delivered' },
};

/**
 * Compact ticket matching the kitchen console: identity, time, photo, money, one action.
 *
 * Full dish lines live on the detail screen so the board stays scannable at arm's length.
 */
export function OrderTicket({ order }: { order: OrderDetail }) {
  const itemCount = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const badge = STATUS_BADGE[order.status];
  const collectsCash =
    order.paymentMethod === PAYMENT_METHOD.CASH_ON_DELIVERY && order.breakdown.payableNow > 0;
  const customer = order.customer?.name ?? order.customerName ?? 'Student';
  const thumb = order.lines.find((line) => line.imageUrl)?.imageUrl;

  return (
    <article className="rounded-2xl bg-surface p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Link href={`/orders/${order.id}`} className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-body font-semibold text-ink">{order.code}</p>
            {badge ? (
              <Badge tone={badge.tone} size="sm">
                {badge.label}
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-caption text-ink-muted">{formatClock(order.createdAt)}</p>
        </Link>
        <DishPhoto src={thumb} className="h-14 w-14 shrink-0 rounded-xl" />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-body font-medium text-ink">{customer}</p>
          <p className="text-caption text-ink-muted">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
            <span aria-hidden> · </span>
            {order.type === ORDER_TYPE.DELIVERY ? 'Delivery' : 'Pickup'}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular text-body font-semibold text-ink">
            {formatMoney(order.breakdown.grandTotal)}
          </p>
          {collectsCash ? (
            <Badge tone="warning" size="sm">
              Collect {formatMoney(order.breakdown.payableNow)}
            </Badge>
          ) : (
            <Badge tone="success" size="sm">
              Paid
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-3">
        <OrderStatusActions order={order} />
      </div>
    </article>
  );
}
