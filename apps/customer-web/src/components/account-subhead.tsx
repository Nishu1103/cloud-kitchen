'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { RemoteImage } from '@/components/remote-image';
import { CAMPUS_BY_PERIOD } from '@/lib/media';

export function AccountSubhead({
  title,
  subtitle,
  backHref = '/account',
  action,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  action?: ReactNode;
}) {
  const scene = CAMPUS_BY_PERIOD.noon;

  return (
    <header className="relative mb-5 overflow-hidden sm:rounded-3xl">
      <div className="relative h-[7.5rem]">
        <RemoteImage
          src={scene.src}
          alt=""
          fill
          sizes="100vw"
          className={`object-cover ${scene.object}`}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/45 to-canvas" />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-4 pb-4">
          <Link
            href={backHref}
            aria-label="Back to profile"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md"
          >
            <ArrowLeft aria-hidden className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-[1.85rem] font-bold leading-none tracking-tight text-white">
              {title}
            </h1>
            {subtitle ? <p className="mt-1 truncate text-caption text-white/70">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      </div>
    </header>
  );
}

export function AccountPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-[1.35rem] bg-surface ${className}`}>{children}</section>;
}
