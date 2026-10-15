'use client';

import { formatMoney, type Vendor } from '@ck/types';
import { Badge, cn } from '@ck/ui';
import { Clock, Heart, Star } from 'lucide-react';
import Link from 'next/link';
import { RemoteImage } from '@/components/remote-image';
import { etaRange, kitchenCover } from '@/lib/media';
import { useSaved } from '@/lib/saved';
import { useSession } from '@/lib/session';

export function VendorCard({
  vendor,
  layout = 'tile',
  offer,
}: {
  vendor: Vendor;
  layout?: 'tile' | 'rail' | 'featured' | 'compact' | 'row';
  offer?: string;
}) {
  const closed = !vendor.isOpen;
  const { user } = useSession();
  const saved = useSaved(user?.id);
  const isSaved = saved.isVendorSaved(vendor.id);
  const photo = kitchenCover(vendor);
  const cuisine = vendor.cuisines.slice(0, 2).join(' · ');

  const heart = (
    <button
      type="button"
      aria-pressed={isSaved}
      aria-label={isSaved ? `Remove ${vendor.name} from favourites` : `Save ${vendor.name}`}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/50 text-white backdrop-blur-sm hover:bg-ink/70"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        saved.toggleVendor(vendor.id);
      }}
    >
      <Heart aria-hidden className={cn('h-4 w-4', isSaved && 'fill-danger text-danger')} />
    </button>
  );

  if (layout === 'featured') {
    return (
      <article className="relative overflow-hidden rounded-[1.6rem] bg-surface">
        <Link href={`/kitchens/${vendor.slug}`} className="relative block aspect-[16/10] sm:aspect-[21/9]">
          <RemoteImage
            src={photo.src}
            fallback={photo.fallback}
            alt=""
            fill
            sizes="100vw"
            className={cn('object-cover', closed && 'opacity-50 saturate-50')}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
          {vendor.ratingCount > 0 ? (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-micro font-semibold text-black">
              <Star aria-hidden className="h-3 w-3 fill-current" />
              {vendor.rating.toFixed(1)}
            </span>
          ) : null}
          <div className="absolute inset-x-0 bottom-0 space-y-1 p-4">
            <p className="font-serif text-[1.45rem] font-bold leading-tight text-white">{vendor.name}</p>
            <p className="text-caption text-white/80">{cuisine || vendor.tagline}</p>
            <p className="text-caption text-white/70">
              <Clock aria-hidden className="mr-1 inline h-3.5 w-3.5" />
              {etaRange(vendor.avgPrepMinutes)}
            </p>
            {offer ? (
              <span className="mt-1 inline-flex rounded-full bg-brand px-2.5 py-1 text-micro font-semibold text-white">
                {offer}
              </span>
            ) : null}
          </div>
        </Link>
      </article>
    );
  }

  if (layout === 'compact') {
    return (
      <article className="relative min-w-0">
        <Link href={`/kitchens/${vendor.slug}`} className="block">
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-surface-muted">
            <RemoteImage
              src={photo.src}
              fallback={photo.fallback}
              alt=""
              fill
              sizes="50vw"
              className="object-cover"
            />
          </div>
          <p className="mt-2 truncate font-serif text-body font-semibold text-ink">{vendor.name}</p>
          <p className="flex items-center gap-2 text-caption text-ink-muted">
            {vendor.ratingCount > 0 ? (
              <span className="inline-flex items-center gap-0.5 text-gold">
                <Star aria-hidden className="h-3 w-3 fill-current" />
                {vendor.rating.toFixed(1)}
              </span>
            ) : null}
            <span>{etaRange(vendor.avgPrepMinutes)}</span>
          </p>
        </Link>
        <div className="absolute right-2 top-2">{heart}</div>
      </article>
    );
  }

  if (layout === 'row') {
    return (
      <article className="flex items-center gap-3">
        <Link href={`/kitchens/${vendor.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
          <span className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-2xl bg-surface-muted">
            <RemoteImage
              src={photo.src}
              fallback={photo.fallback}
              alt=""
              fill
              sizes="72px"
              className="object-cover"
            />
          </span>
          <span className="min-w-0 flex-1">
            <p className="truncate font-serif text-body font-semibold text-ink">{vendor.name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-caption text-ink-muted">
              {vendor.ratingCount > 0 ? (
                <span className="inline-flex items-center gap-0.5 text-gold">
                  <Star aria-hidden className="h-3 w-3 fill-current" />
                  {vendor.rating.toFixed(1)}
                  <span className="text-ink-subtle">({vendor.ratingCount})</span>
                </span>
              ) : (
                <Badge tone="neutral" size="sm">
                  New
                </Badge>
              )}
              <span>{etaRange(vendor.avgPrepMinutes)}</span>
              {vendor.deliveryFee > 0 ? <span>{formatMoney(vendor.deliveryFee)} delivery</span> : null}
            </p>
          </span>
        </Link>
        <span
          className={cn(
            'shrink-0 text-micro font-semibold uppercase tracking-wide',
            vendor.isOpen ? 'text-success' : 'text-warning',
          )}
        >
          {vendor.isOpen ? 'Open' : 'Busy'}
        </span>
      </article>
    );
  }

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-3xl bg-surface',
        layout === 'rail' && 'w-[16.5rem] shrink-0 snap-start',
      )}
    >
      <Link href={`/kitchens/${vendor.slug}`} className="block">
        <div className="relative aspect-[16/10] w-full bg-surface-muted">
          <RemoteImage
            src={photo.src}
            fallback={photo.fallback}
            alt=""
            fill
            sizes={
              layout === 'rail'
                ? '264px'
                : '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'
            }
            className={cn(
              'object-cover transition-transform duration-500 group-hover:scale-105',
              closed && 'opacity-50 saturate-50',
            )}
          />
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
        <div className="space-y-1 p-3.5">
          <p className="truncate font-serif text-[1.05rem] font-bold text-ink">{vendor.name}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-muted">
            {vendor.ratingCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-gold">
                <Star aria-hidden className="h-3.5 w-3.5 fill-current" />
                {vendor.rating.toFixed(1)}
              </span>
            ) : (
              <Badge tone="neutral" size="sm">
                New
              </Badge>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock aria-hidden className="h-3.5 w-3.5" />
              {etaRange(vendor.avgPrepMinutes)}
            </span>
          </div>
          {cuisine ? <p className="truncate text-caption text-ink-subtle">{cuisine}</p> : null}
        </div>
      </Link>
      <div className="absolute right-3 top-3">{heart}</div>
    </article>
  );
}

export function VendorCardSkeleton({ layout = 'tile' }: { layout?: 'tile' | 'rail' | 'row' }) {
  if (layout === 'row') {
    return (
      <div className="flex items-center gap-3">
        <div className="ck-skeleton h-[4.5rem] w-[4.5rem] rounded-2xl" />
        <div className="flex-1 space-y-2">
          <div className="ck-skeleton h-4 w-2/3" />
          <div className="ck-skeleton h-3 w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-3xl bg-surface',
        layout === 'rail' && 'w-[16.5rem] shrink-0',
      )}
    >
      <div className="ck-skeleton aspect-[16/10] w-full rounded-none" />
      <div className="space-y-2 p-3">
        <div className="ck-skeleton h-4 w-2/3" />
        <div className="ck-skeleton h-3 w-1/2" />
      </div>
    </div>
  );
}
