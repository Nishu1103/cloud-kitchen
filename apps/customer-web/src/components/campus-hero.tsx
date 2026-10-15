'use client';

import { Bell, ChevronDown, MapPin, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RemoteImage } from '@/components/remote-image';
import { SearchField } from '@/components/search-field';
import { greeting } from '@/lib/greeting';
import { CAMPUS_BY_PERIOD, campusPeriod, type CampusPeriod } from '@/lib/media';

const OVERLAY: Record<CampusPeriod, string> = {
  morning: 'from-ink/40 via-ink/15 to-canvas',
  noon: 'from-ink/45 via-ink/20 to-canvas',
  evening: 'from-ink/30 via-ink/15 to-canvas',
};

export function CampusHero({
  place,
  firstName,
  unread,
}: {
  place: string;
  firstName?: string;
  unread?: number;
}) {
  const [period, setPeriod] = useState<CampusPeriod>('morning');
  const scene = CAMPUS_BY_PERIOD[period];

  useEffect(() => {
    const sync = () => setPeriod(campusPeriod());
    sync();
    const timer = window.setInterval(sync, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="relative overflow-hidden sm:rounded-3xl">
      <div className="relative min-h-[27rem] sm:min-h-[30rem]">
        <RemoteImage
          src={scene.src}
          alt={scene.alt}
          fill
          priority
          sizes="100vw"
          className={`object-cover ${scene.object}`}
        />
        <div className={`absolute inset-0 bg-gradient-to-b ${OVERLAY[period]}`} />

        <div className="relative z-10 flex items-center justify-between px-4 pt-[max(0.85rem,env(safe-area-inset-top))] lg:hidden">
          <p className="inline-flex items-center gap-1.5 text-caption font-medium text-white">
            <MapPin aria-hidden className="h-3.5 w-3.5 text-brand" />
            {place}
            <ChevronDown aria-hidden className="h-3.5 w-3.5 opacity-70" />
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="/search"
              aria-label="Search"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-md"
            >
              <Search aria-hidden className="h-5 w-5" />
            </Link>
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-md"
            >
              <Bell aria-hidden className="h-5 w-5" />
              {unread ? (
                <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-danger px-1 text-center text-[0.625rem] font-semibold leading-4 text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </Link>
          </div>
        </div>

        <div className="relative z-10 px-5 pb-7 pt-[4.5rem] sm:px-8 sm:pt-24">
          <p className="text-[0.95rem] font-medium text-white">{greeting()},</p>
          <div className="relative">
            <h1 className="font-serif text-[3.15rem] font-bold leading-[0.95] tracking-tight text-white sm:text-display-lg">
              {firstName ? `${firstName}.` : 'Campus Kitchen'}
            </h1>
            {firstName ? (
              <p className="hungry-script relative z-10 -mt-5 ml-6 sm:-mt-6 sm:ml-8">Hungry?</p>
            ) : (
              <p className="mt-2 max-w-md text-body text-white/80">
                Food from your campus kitchens, tracked to your door.
              </p>
            )}
          </div>
          <SearchField className="mt-6 max-w-lg" tone="light" />
        </div>
      </div>
    </section>
  );
}
