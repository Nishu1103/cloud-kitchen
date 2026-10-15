'use client';

import { useEffect, useState } from 'react';

function label(since: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} mins`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/**
 * How long a ticket has been waiting, ticking without a refetch.
 *
 * Rendered from `useEffect` rather than at build/SSR time because the server and the
 * tablet disagree about "now"; showing a server-computed age would hydrate to a
 * different string and, worse, freeze at whatever the page load happened to be.
 */
export function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Until the first client tick there is nothing honest to show.
  return <span suppressHydrationWarning>{now === null ? '—' : label(since, now)}</span>;
}
