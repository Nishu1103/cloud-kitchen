'use client';

import { EmptyState, ErrorState, Skeleton } from '@ck/ui';
import { ArrowLeft, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useDeferredValue, useState } from 'react';
import { DishHit } from '@/components/dish-hit';
import { SearchField } from '@/components/search-field';
import { VendorCard, VendorCardSkeleton } from '@/components/vendor-card';
import { useProducts, useVendors } from '@/hooks/use-catalog';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'veg', label: 'Veg' },
  { id: 'non_veg', label: 'Non Veg' },
  { id: 'healthy', label: 'Healthy' },
] as const;

function SearchResults() {
  const params = useSearchParams();
  const raw = params.get('q') ?? '';
  const categoryId = params.get('categoryId') ?? '';
  const term = useDeferredValue(raw.trim());
  const [diet, setDiet] = useState<(typeof FILTERS)[number]['id']>('all');

  const vendors = useVendors(term ? { search: term, limit: 8 } : undefined);
  const products = useProducts(
    term || categoryId
      ? {
          search: term || undefined,
          categoryId: categoryId || undefined,
          diet: diet === 'veg' || diet === 'non_veg' ? diet : undefined,
          limit: 20,
        }
      : undefined,
  );

  const vendorHits = vendors.data?.items ?? [];
  const productHits = (products.data?.items ?? []).filter((product) => {
    if (diet === 'healthy') return product.diet === 'veg' || product.diet === 'vegan';
    return true;
  });
  const loading = (term && vendors.isLoading) || ((term || categoryId) && products.isLoading);
  const empty =
    !loading &&
    Boolean(term || categoryId) &&
    vendorHits.length === 0 &&
    productHits.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink"
        >
          <ArrowLeft aria-hidden className="h-5 w-5" />
        </Link>
        <h1 className="font-serif text-title text-ink">Search results</h1>
      </div>

      <SearchField defaultValue={raw} autoFocus={!raw} />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setDiet(filter.id)}
            className={
              diet === filter.id
                ? 'shrink-0 rounded-full bg-brand px-3.5 py-1.5 text-caption font-medium text-brand-ink'
                : 'shrink-0 rounded-full bg-surface px-3.5 py-1.5 text-caption text-ink-muted'
            }
          >
            {filter.label}
          </button>
        ))}
      </div>

      {!term && !categoryId ? (
        <EmptyState
          icon={<SearchX aria-hidden className="h-6 w-6" />}
          title="Search the campus"
          description="Try a dish, a cuisine, or a kitchen name."
        />
      ) : vendors.isError || products.isError ? (
        <ErrorState
          message="Search is unavailable right now."
          onRetry={() => {
            void vendors.refetch();
            void products.refetch();
          }}
        />
      ) : loading ? (
        <>
          <VendorCardSkeleton layout="row" />
          <Skeleton className="h-24" />
        </>
      ) : empty ? (
        <EmptyState
          icon={<SearchX aria-hidden className="h-6 w-6" />}
          title={term ? `Nothing for “${term}”` : 'Nothing in this category'}
          description="Check the spelling, or browse all kitchens."
        />
      ) : (
        <div className="space-y-8">
          {productHits.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-serif text-title text-ink">Top Picks</h2>
              <div className="space-y-2">
                {productHits.map((product) => (
                  <DishHit key={product.id} product={product} />
                ))}
              </div>
            </section>
          ) : null}

          {vendorHits.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-serif text-title text-ink">Kitchens</h2>
              <div className="space-y-4">
                {vendorHits.map((vendor) => (
                  <VendorCard key={vendor.id} vendor={vendor} layout="row" />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      <SearchResults />
    </Suspense>
  );
}
