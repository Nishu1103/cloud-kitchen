import { cn } from '@ck/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function SectionHeading({
  title,
  href,
  serif = false,
  action = 'See all',
}: {
  title: ReactNode;
  href?: string;
  serif?: boolean;
  action?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className={cn('text-title text-ink', serif ? 'font-serif' : 'font-display')}>{title}</h2>
      {href ? (
        <Link href={href} className="shrink-0 text-caption font-medium text-brand">
          {action}
        </Link>
      ) : null}
    </div>
  );
}
