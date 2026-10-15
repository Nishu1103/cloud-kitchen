'use client';

import { EmptyState, ErrorState } from '@ck/ui';
import { Flame, SlidersHorizontal, Store } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { RemoteImage } from '@/components/remote-image';
import { SectionHeading } from '@/components/section-heading';
import { VendorCard, VendorCardSkeleton } from '@/components/vendor-card';
import { useCategories, useProducts, useVendors } from '@/hooks/use-catalog';
import { CURATED_TILES } from '@/lib/media';

export default function ExplorePage() {
  const [cuisine, setCuisine] = useState('all');
  const categories = useCategories();
  const vendors = useVendors({ limit: 20, openOnly: false, sortBy: 'popular' });
  const specials = useProducts({ flag: 'chef_special', limit: 6 });

  const chips = ['All', ...(categories.data ?? []).map((category) => category.name)];
  const items = (vendors.data?.items ?? []).filter((vendor) => {
    if (cuisine === 'all') return true;
    return vendor.cuisines.some((item) => item.toLowerCase() === cuisine.toLowerCase());
  });
  const hero = specials.data?.items[0];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-serif text-display text-ink">Explore</h1>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-muted"
          aria-label="Filters"
          onClick={() => document.getElementById('explore-cuisine')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <SlidersHorizontal aria-hidden className="h-4 w-4" />
        </button>
      </div>

      <div
        id="explore-cuisine"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {chips.map((chip) => {
          const value = chip === 'All' ? 'all' : chip;
          const active = cuisine === value;
          return (
            <button
              key={chip}
              type="button"
              onClick={() => setCuisine(value)}
              className={
                active
                  ? 'shrink-0 rounded-full bg-peach px-3.5 py-1.5 text-caption font-semibold text-peach-ink'
                  : 'shrink-0 rounded-full bg-surface px-3.5 py-1.5 text-caption text-ink-muted'
              }
            >
              {chip}
            </button>
          );
        })}
      </div>

      {hero ? (
        <Link
          href={hero.vendor ? `/kitchens/${hero.vendor.slug}` : '/kitchens'}
          className="relative flex overflow-hidden rounded-[1.5rem] bg-gradient-to-r from-[#3d2a1a] to-[#1a1210]"
        >
          <div className="flex-1 space-y-2 p-5">
            <p className="text-caption font-medium text-gold">Today&apos;s Special</p>
            <h2 className="font-serif text-title-lg text-gold">{hero.name}</h2>
            {hero.stockQuantity !== undefined && hero.stockQuantity !== null && hero.stockQuantity <= 20 ? (
              <p className="inline-flex items-center gap-1 text-caption text-warning">
                <Flame aria-hidden className="h-3.5 w-3.5" />
                Only {hero.stockQuantity} plates left!
              </p>
            ) : (
              <p className="text-caption text-white/70">{hero.vendor?.name}</p>
            )}
            <span className="mt-3 inline-flex rounded-full bg-peach px-4 py-2 text-caption font-semibold text-peach-ink">
              Order Now →
            </span>
          </div>
          {hero.imageUrl ? (
            <div className="relative w-[42%] min-h-[10rem]">
              <RemoteImage src={hero.imageUrl} alt="" fill sizes="40vw" className="object-cover" />
            </div>
          ) : null}
        </Link>
      ) : null}

      <section>
        <SectionHeading title="Curated for you" href="/search" serif />
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          {CURATED_TILES.map((tile) => (
            <Link
              key={tile.title}
              href={tile.href}
              className="relative h-40 w-[11rem] shrink-0 overflow-hidden rounded-2xl sm:w-auto"
            >
              <RemoteImage src={tile.image} alt="" fill sizes="180px" className="object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 p-3">
                <span className="block font-serif text-body font-semibold text-white">{tile.title}</span>
                <span className="text-caption text-white/75">{tile.subtitle}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading title="Trending Kitchens 🔥" href="/kitchens" serif />
        {vendors.isError ? (
          <ErrorState message="We could not load the kitchens." onRetry={() => vendors.refetch()} />
        ) : vendors.isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <VendorCardSkeleton key={index} layout="row" />
            ))}
          </div>
        ) : items.length > 0 ? (
          <div className="space-y-4">
            {items.map((vendor) => (
              <VendorCard key={vendor.id} vendor={vendor} layout="row" />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Store aria-hidden className="h-6 w-6" />}
            title="No kitchens yet"
            description="Kitchens on this campus are still being onboarded."
          />
        )}
      </section>
    </div>
  );
}
