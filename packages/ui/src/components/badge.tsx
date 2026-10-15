import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

const badge = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-muted text-ink-muted',
        brand: 'bg-brand-soft text-brand',
        success: 'bg-success-soft text-success-ink',
        warning: 'bg-warning-soft text-warning-ink',
        danger: 'bg-danger-soft text-danger-ink',
        info: 'bg-info-soft text-info-ink',
        outline: 'border border-line-strong text-ink-muted',
      },
      size: {
        sm: 'px-2 py-0.5 text-micro uppercase tracking-wide',
        md: 'px-2.5 py-1 text-caption',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badge> {
  icon?: ReactNode;
}

export function Badge({ className, tone, size, icon, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badge({ tone, size }), className)} {...props}>
      {icon}
      {children}
    </span>
  );
}

type Tone = NonNullable<VariantProps<typeof badge>['tone']>;

/**
 * One mapping from domain status to colour, shared by all four portals.
 *
 * Keeping it here is what stops the customer app calling a cancelled order red while
 * the admin app calls it grey. Unknown statuses fall back to neutral rather than
 * throwing, so a new status added on the server cannot break a deployed client.
 */
const ORDER_TONES: Record<string, Tone> = {
  draft: 'neutral',
  awaiting_payment: 'warning',
  placed: 'info',
  accepted: 'info',
  preparing: 'brand',
  ready: 'brand',
  out_for_delivery: 'brand',
  delivered: 'success',
  completed: 'success',
  cancelled: 'danger',
  rejected: 'danger',
  refunded: 'neutral',
  failed: 'danger',
};

const PAYMENT_TONES: Record<string, Tone> = {
  pending: 'warning',
  authorized: 'info',
  captured: 'success',
  failed: 'danger',
  refunded: 'neutral',
  partially_refunded: 'warning',
};

const VENDOR_TONES: Record<string, Tone> = {
  draft: 'neutral',
  pending_review: 'warning',
  approved: 'success',
  rejected: 'danger',
  suspended: 'danger',
};

const DELIVERY_TONES: Record<string, Tone> = {
  unassigned: 'warning',
  offered: 'info',
  assigned: 'info',
  arrived_at_vendor: 'brand',
  picked_up: 'brand',
  arrived_at_customer: 'brand',
  delivered: 'success',
  cancelled: 'danger',
  expired: 'neutral',
};

const TONE_SETS = {
  order: ORDER_TONES,
  payment: PAYMENT_TONES,
  vendor: VENDOR_TONES,
  delivery: DELIVERY_TONES,
} as const;

/** Turns `out_for_delivery` into `Out for delivery`. */
export function humanizeStatus(status: string): string {
  const spaced = status.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function StatusBadge({
  status,
  kind = 'order',
  size,
  className,
}: {
  status: string;
  kind?: keyof typeof TONE_SETS;
  size?: VariantProps<typeof badge>['size'];
  className?: string;
}) {
  return (
    <Badge tone={TONE_SETS[kind][status] ?? 'neutral'} size={size} className={className}>
      {humanizeStatus(status)}
    </Badge>
  );
}
