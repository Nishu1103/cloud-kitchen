'use client';

import { ORDER_STATUS, type Order, type OrderStatus, type OrderType } from '@ck/types';
import { cn, humanizeStatus } from '@ck/ui';
import { Check } from 'lucide-react';

function stepsFor(type: OrderType): OrderStatus[] {
  const common: OrderStatus[] = [
    ORDER_STATUS.PLACED,
    ORDER_STATUS.PREPARING,
    ORDER_STATUS.READY,
  ];
  return type === 'delivery'
    ? [...common, ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.DELIVERED]
    : [...common, ORDER_STATUS.COMPLETED];
}

const LABELS: Partial<Record<OrderStatus, string>> = {
  [ORDER_STATUS.PLACED]: 'Confirmed',
  [ORDER_STATUS.ACCEPTED]: 'Confirmed',
  [ORDER_STATUS.PREPARING]: 'Preparing',
  [ORDER_STATUS.READY]: 'Ready',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'On the way',
  [ORDER_STATUS.DELIVERED]: 'Delivered',
  [ORDER_STATUS.COMPLETED]: 'Picked up',
};

export function OrderTimeline({
  order,
  variant = 'vertical',
}: {
  order: Order;
  variant?: 'vertical' | 'horizontal';
}) {
  const steps = stepsFor(order.type);
  const reached = new Set(order.timeline.map((event) => event.status));
  if (order.status === ORDER_STATUS.ACCEPTED) reached.add(ORDER_STATUS.PLACED);

  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => {
      if (order.status === ORDER_STATUS.ACCEPTED) return step === ORDER_STATUS.PLACED;
      return step === order.status;
    }),
  );

  const terminal =
    order.status === ORDER_STATUS.CANCELLED ||
    order.status === ORDER_STATUS.REJECTED ||
    order.status === ORDER_STATUS.REFUNDED;

  if (terminal) {
    const event = order.timeline.at(-1);
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger-soft p-3">
        <p className="text-body font-semibold text-danger-ink">{humanizeStatus(order.status)}</p>
        {order.cancelReason ? (
          <p className="mt-0.5 text-caption text-danger-ink/80">{order.cancelReason}</p>
        ) : null}
        {event ? (
          <p className="mt-1 text-caption text-danger-ink/70">
            {new Date(event.at).toLocaleString('en-IN')}
          </p>
        ) : null}
      </div>
    );
  }

  if (variant === 'horizontal') {
    return (
      <ol className="flex items-start justify-between gap-1">
        {steps.map((step, index) => {
          const done = index < currentIndex || reached.has(step);
          const active = index === currentIndex;
          return (
            <li key={step} className="flex min-w-0 flex-1 flex-col items-center text-center">
              <div className="flex w-full items-center">
                <span className={cn('h-0.5 flex-1', index === 0 ? 'bg-transparent' : done || active ? 'bg-brand' : 'bg-line')} />
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-micro font-semibold',
                    done && 'bg-brand text-brand-ink',
                    active && !done && 'bg-brand text-brand-ink ring-4 ring-brand/30',
                    !done && !active && 'bg-surface-muted text-ink-subtle',
                  )}
                >
                  {done ? <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
                </span>
                <span className={cn('h-0.5 flex-1', index === steps.length - 1 ? 'bg-transparent' : done ? 'bg-brand' : 'bg-line')} />
              </div>
              <p
                className={cn(
                  'mt-2 max-w-[4.5rem] text-[0.65rem] font-medium leading-tight',
                  done || active ? 'text-ink' : 'text-ink-subtle',
                )}
              >
                {LABELS[step] ?? humanizeStatus(step)}
              </p>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol>
      {steps.map((step, index) => {
        const done = reached.has(step) || index < currentIndex;
        const active = index === currentIndex;
        const event = order.timeline.find((item) => item.status === step);
        const last = index === steps.length - 1;

        return (
          <li key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-micro font-semibold',
                  done && 'border-brand bg-brand text-brand-ink',
                  active && !done && 'border-brand bg-brand text-brand-ink animate-pulse-ring',
                  !done && !active && 'border-line-strong text-ink-subtle',
                )}
              >
                {done ? <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
              </span>
              {!last ? (
                <span className={cn('w-0.5 flex-1', done ? 'bg-brand' : 'bg-line')} style={{ minHeight: '1.75rem' }} />
              ) : null}
            </div>
            <div className={cn('pb-6', last && 'pb-0')}>
              <p className={cn('text-body', done || active ? 'font-semibold text-ink' : 'text-ink-subtle')}>
                {LABELS[step] ?? humanizeStatus(step)}
              </p>
              {event ? (
                <p className="tabular text-caption text-ink-muted">
                  {new Date(event.at).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              ) : active && order.etaMinutes ? (
                <p className="text-caption text-brand">about {order.etaMinutes} min</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
