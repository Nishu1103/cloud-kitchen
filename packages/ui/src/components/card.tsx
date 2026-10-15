import { Slot } from '@radix-ui/react-slot';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

export function Card({
  className,
  interactive,
  asChild,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  /**
   * Renders the child instead of a `<div>`. A whole-card link belongs in the anchor
   * itself rather than wrapping a div in one, which nests interactive content and
   * breaks keyboard focus order.
   */
  asChild?: boolean;
}) {
  const Component = asChild ? Slot : 'div';

  return (
    <Component
      className={cn(
        'ck-card',
        interactive &&
          'cursor-pointer transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned control: a button, a filter, a menu. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-line p-4', className)}>
      <div className="min-w-0">
        <h3 className="truncate text-title text-ink">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-caption text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center justify-end gap-2 border-t border-line p-4', className)}
      {...props}
    />
  );
}

/**
 * A single headline number. `delta` is rendered as a signed percentage against the
 * previous period, coloured by direction rather than by sign alone so it reads at a
 * glance on a dashboard.
 */
export function StatCard({
  label,
  value,
  delta,
  hint,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: number;
  hint?: string;
  icon?: ReactNode;
  className?: string;
}) {
  const direction = delta === undefined ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';

  return (
    <div className={cn('ck-card p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-caption font-medium uppercase tracking-wide text-ink-subtle">{label}</p>
        {icon ? <span className="text-ink-subtle">{icon}</span> : null}
      </div>
      <p className="tabular mt-2 text-title-lg text-ink">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-caption">
        {direction ? (
          <span
            className={cn(
              'tabular font-medium',
              direction === 'up' && 'text-success',
              direction === 'down' && 'text-danger',
              direction === 'flat' && 'text-ink-subtle',
            )}
          >
            {delta! > 0 ? '+' : ''}
            {delta!.toFixed(1)}%
          </span>
        ) : null}
        {hint ? <span className="text-ink-subtle">{hint}</span> : null}
      </div>
    </div>
  );
}
