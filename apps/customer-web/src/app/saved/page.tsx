'use client';

import { formatMoney } from '@ck/types';
import { EmptyState, Tabs, Tab, TabList, TabPanel } from '@ck/ui';
import { ArrowLeft, Heart, Utensils } from 'lucide-react';
import Link from 'next/link';
import { VendorCard, VendorCardSkeleton } from '@/components/vendor-card';
import { RemoteImage } from '@/components/remote-image';
import { useVendors } from '@/hooks/use-catalog';
import { useSaved } from '@/lib/saved';
import { useSession } from '@/lib/session';

export default function SavedPage() {
  const { user } = useSession();
  const saved = useSaved(user?.id);
  const vendors = useVendors({ limit: 50, openOnly: false, sortBy: 'popular' });

  const savedVendors = (vendors.data?.items ?? []).filter((vendor) =>
    saved.vendorIds.includes(vendor.id),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/" aria-label="Back" className="flex h-10 w-10 items-center justify-center">
          <ArrowLeft aria-hidden className="h-5 w-5" />
        </Link>
        <h1 className="font-serif text-title-lg text-ink">Favourites</h1>
      </div>

      <Tabs defaultValue="kitchens">
        <TabList>
          <Tab value="kitchens" count={saved.vendorIds.length}>
            Kitchens
          </Tab>
          <Tab value="dishes" count={saved.products.length}>
            Dishes
          </Tab>
        </TabList>

        <TabPanel value="kitchens" className="space-y-4 pt-4">
          {vendors.isLoading ? (
            <VendorCardSkeleton layout="row" />
          ) : savedVendors.length === 0 ? (
            <EmptyState
              icon={<Heart aria-hidden className="h-6 w-6" />}
              title="No favourite kitchens"
              description="Tap the heart on a kitchen to keep it here."
              action={
                <Link href="/kitchens" className="text-caption text-brand">
                  Explore kitchens
                </Link>
              }
            />
          ) : (
            savedVendors.map((vendor) => (
              <VendorCard key={vendor.id} vendor={vendor} layout="row" />
            ))
          )}
        </TabPanel>

        <TabPanel value="dishes" className="space-y-2 pt-4">
          {saved.products.length === 0 ? (
            <EmptyState
              icon={<Utensils aria-hidden className="h-6 w-6" />}
              title="No saved dishes"
              description="Heart a dish on a menu to find it again without searching."
            />
          ) : (
            saved.products.map((product) => (
              <div key={product.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3">
                <Link href={`/kitchens/${product.vendorSlug}`} className="flex min-w-0 flex-1 items-center gap-3">
                  {product.imageUrl ? (
                    <RemoteImage
                      src={product.imageUrl}
                      alt=""
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-2xl object-cover"
                    />
                  ) : (
                    <span className="h-16 w-16 rounded-2xl bg-surface-muted" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-serif text-body font-medium text-ink">{product.name}</p>
                    <p className="tabular text-caption text-ink-muted">
                      {formatMoney(product.basePrice)}
                    </p>
                  </div>
                </Link>
                <button
                  type="button"
                  aria-label={`Remove ${product.name}`}
                  className="text-danger"
                  onClick={() => saved.toggleProduct(product)}
                >
                  <Heart aria-hidden className="h-5 w-5 fill-current" />
                </button>
              </div>
            ))
          )}
        </TabPanel>
      </Tabs>
    </div>
  );
}
