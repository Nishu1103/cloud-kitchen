import { formatMoney } from '@ck/types';
import { Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * Renders an integer-paise amount.
 *
 * Prices are never formatted ad hoc in a page: amounts travel as integer paise from
 * the API and pass through `formatMoney` here so rounding and the ₹ symbol are
 * identical in the cart, the invoice and the admin report.
 */
// Spelled out rather than interpolated: Tailwind only sees class names that appear
// literally in the source, so `text-${size}` would never be generated.
const PRICE_SIZES = {
  caption: 'text-caption',
  body: 'text-body',
  title: 'text-title',
  'title-lg': 'text-title-lg',
} as const;

export function Price({
  paise,
  strikeThrough,
  className,
  size = 'body',
}: {
  paise: number;
  /** Original price shown crossed out beside a discounted one. */
  strikeThrough?: boolean;
  className?: string;
  size?: keyof typeof PRICE_SIZES;
}) {
  return (
    <span
      className={cn(
        'tabular',
        PRICE_SIZES[size],
        strikeThrough && 'text-ink-subtle line-through',
        className,
      )}
    >
      {formatMoney(paise)}
    </span>
  );
}

/**
 * One line of a bill: label on the left, amount on the right.
 *
 * Discounts are passed as positive paise with `negative` set, so callers never have to
 * remember which fields the API returns as negatives.
 */
export function PriceRow({
  label,
  paise,
  negative,
  emphasis,
  hint,
}: {
  label: ReactNode;
  paise: number;
  negative?: boolean;
  emphasis?: boolean;
  hint?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span
        className={cn(
          'text-body',
          emphasis ? 'font-semibold text-ink' : 'text-ink-muted',
        )}
      >
        {label}
        {hint ? <span className="ml-1 text-caption text-ink-subtle">{hint}</span> : null}
      </span>
      <span
        className={cn(
          'tabular whitespace-nowrap',
          emphasis ? 'text-title font-semibold text-ink' : 'text-body',
          negative && 'text-success',
        )}
      >
        {negative ? '−' : ''}
        {formatMoney(Math.abs(paise))}
      </span>
    </div>
  );
}

/**
 * Quantity control for cart lines and menu cards.
 *
 * Holds no state of its own so the cart store stays the single source of truth; the
 * parent disables it while a mutation is in flight to prevent double-increments on a
 * slow campus connection.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  disabled,
  size = 'md',
  label = 'Quantity',
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  size?: 'sm' | 'md';
  label?: string;
}) {
  const dims = size === 'sm' ? 'h-8' : 'h-10';
  const btn = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';

  return (
    <div
      className={cn(
        'inline-flex items-center overflow-hidden rounded border border-line-strong bg-surface',
        dims,
        disabled && 'opacity-50',
      )}
    >
      <button
        type="button"
        className={cn(btn, 'inline-flex items-center justify-center text-ink-muted hover:bg-surface-muted disabled:pointer-events-none')}
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        aria-label={`Decrease ${label.toLowerCase()}`}
      >
        <Minus aria-hidden className="h-4 w-4" />
      </button>
      <span
        className={cn('tabular min-w-8 text-center font-semibold text-ink', size === 'sm' ? 'text-caption' : 'text-body')}
        aria-live="polite"
        aria-label={`${label}: ${value}`}
      >
        {value}
      </span>
      <button
        type="button"
        className={cn(btn, 'inline-flex items-center justify-center text-brand hover:bg-brand-soft disabled:pointer-events-none')}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`Increase ${label.toLowerCase()}`}
      >
        <Plus aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}
