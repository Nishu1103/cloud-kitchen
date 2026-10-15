'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Inner-page chrome for every rider screen that is not Home.
 *
 * Home owns the greeting header; everything else shares this compact title row so the
 * bottom tab bar and the card language stay consistent.
 */
export function RiderScreen({
  title,
  backHref,
  actions,
  children,
}: {
  title: string;
  backHref?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="px-4 pb-6 pt-5">
      <header className="mb-4 flex items-center gap-3">
        {backHref ? (
          <Link
            href={backHref}
            aria-label="Go back"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface"
          >
            <ArrowLeft aria-hidden className="h-5 w-5" />
          </Link>
        ) : null}
        <h1 className="min-w-0 flex-1 truncate text-title font-semibold text-ink">{title}</h1>
        {actions}
      </header>
      {children}
    </div>
  );
}
