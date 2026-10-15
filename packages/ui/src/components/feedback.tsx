import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Button } from './button';

export function Spinner({
  className,
  label = 'Loading',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span role="status" aria-live="polite">
      <Loader2 aria-hidden className={cn('h-5 w-5 animate-spin text-brand', className)} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * Placeholder block for content that is still loading.
 *
 * Skeletons that match the final layout are used instead of a centred spinner so the
 * page does not jump when data arrives — important on the order list, which refreshes
 * on every socket event.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('ck-skeleton h-4 w-full', className)} {...props} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={index === lines - 1 ? 'w-2/3' : 'w-full'} />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-ink-subtle">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="text-title text-ink">{title}</p>
        {description ? (
          <p className="mx-auto max-w-prose text-body text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/**
 * Failure state with a retry affordance.
 *
 * Shows the server's message when there is one: our API returns human-readable
 * messages alongside machine codes, and hiding them behind "Something went wrong"
 * makes support tickets impossible to triage.
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      className={className}
      icon={<XCircle aria-hidden className="h-6 w-6 text-danger" />}
      title={title}
      description={message}
      action={
        onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    />
  );
}

const ALERT_ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
} as const;

const ALERT_STYLES = {
  info: 'border-info/30 bg-info-soft text-info-ink',
  success: 'border-success/30 bg-success-soft text-success-ink',
  warning: 'border-warning/30 bg-warning-soft text-warning-ink',
  danger: 'border-danger/30 bg-danger-soft text-danger-ink',
} as const;

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof ALERT_ICONS;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = ALERT_ICONS[tone];
  return (
    <div
      // Errors are announced immediately; the rest are polite so we do not interrupt
      // a screen reader mid-sentence for an informational banner.
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-md border p-3 text-body',
        ALERT_STYLES[tone],
        className,
      )}
    >
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-0.5')}>{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function ProgressBar({
  value,
  max = 100,
  label,
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-muted', className)}
    >
      <div
        className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
