'use client';

import type { BrowseProduct } from '@ck/sdk';
import { formatMoney } from '@ck/types';
import { cn } from '@ck/ui';
import { Plus, Star } from 'lucide-react';
import Link from 'next/link';
import { RemoteImage } from '@/components/remote-image';
import { DEFAULT_COVER, etaRange } from '@/lib/media';

export function DishHit({ product }: { product: BrowseProduct }) {
  const vendor = product.vendor;
  const veg = product.diet === 'veg' || product.diet === 'vegan';

  return (
    <Link
      href={vendor ? `/kitchens/${vendor.slug}` : '/kitchens'}
      className="flex items-center gap-3 rounded-2xl bg-surface p-3"
    >
      {product.imageUrl ? (
        <RemoteImage
          src={product.imageUrl}
          fallback={DEFAULT_COVER}
          alt=""
          width={72}
          height={72}
          className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-2xl object-cover"
        />
      ) : (
        <span className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-2xl bg-surface-muted" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            aria-label={veg ? 'Vegetarian' : 'Non-vegetarian'}
            className={cn(
              'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border',
              veg ? 'border-success' : 'border-danger',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', veg ? 'bg-success' : 'bg-danger')} />
          </span>
          <p className="truncate font-serif text-body font-medium text-ink">{product.name}</p>
        </div>
        {product.description ? (
          <p className="truncate text-caption text-ink-muted">{product.description}</p>
        ) : (
          <p className="truncate text-caption text-ink-muted">{vendor?.name}</p>
        )}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-caption text-ink-muted">
          <span className="tabular font-semibold text-ink">{formatMoney(product.basePrice)}</span>
          {product.ratingCount > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-gold">
              <Star aria-hidden className="h-3 w-3 fill-current" />
              {product.rating.toFixed(1)}
            </span>
          ) : null}
          {vendor?.avgPrepMinutes ? <span>{etaRange(vendor.avgPrepMinutes)}</span> : null}
        </p>
      </div>

      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-peach text-peach-ink">
        <Plus aria-hidden className="h-5 w-5" />
        <span className="sr-only">Open kitchen to add</span>
      </span>
    </Link>
  );
}
