import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { HTMLAttributes, ReactNode, ThHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { Button } from './button';
import { Skeleton } from './feedback';

/**
 * Table primitives for the admin and vendor portals.
 *
 * Thin wrappers over real table elements rather than a data-grid abstraction: the
 * portals need different columns everywhere, and semantic `<table>` markup keeps
 * keyboard and screen-reader navigation working for free.
 */
export function TableWrap({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('w-full overflow-x-auto rounded-lg border border-line', className)}>
      {children}
    </div>
  );
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full border-collapse text-body', className)} {...props} />;
}

export function Thead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-surface-muted', className)} {...props} />;
}

export function Tbody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-line', className)} {...props} />;
}

export function Th({
  className,
  numeric,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap px-3 py-2.5 text-left text-micro font-semibold uppercase tracking-wide text-ink-muted',
        numeric && 'text-right',
        className,
      )}
      {...props}
    />
  );
}

export function Tr({
  className,
  interactive,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        'bg-surface-raised',
        interactive && 'cursor-pointer transition-colors hover:bg-surface-muted/60',
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  className,
  numeric,
  ...props
}: HTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        'px-3 py-2.5 align-middle text-ink',
        numeric && 'tabular text-right',
        className,
      )}
      {...props}
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <Tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <Tr key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <Td key={c}>
              <Skeleton className={c === 0 ? 'w-40' : 'w-20'} />
            </Td>
          ))}
        </Tr>
      ))}
    </Tbody>
  );
}

/**
 * Cursor-agnostic pager driven by the API's `{ page, limit, total }` meta.
 */
export function Pagination({
  page,
  limit,
  total,
  onPageChange,
  className,
}: {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);

  return (
    <div className={cn('flex items-center justify-between gap-3 py-3', className)}>
      <p className="text-caption text-ink-muted">
        {total === 0 ? 'No results' : `${from}–${to} of ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          leadingIcon={<ChevronLeft aria-hidden className="h-4 w-4" />}
        >
          Previous
        </Button>
        <span className="tabular text-caption text-ink-muted">
          {page} / {pages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          trailingIcon={<ChevronRight aria-hidden className="h-4 w-4" />}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
