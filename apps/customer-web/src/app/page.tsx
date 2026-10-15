'use client';

import { Badge, EmptyState, ErrorState } from '@ck/ui';
import { Store } from 'lucide-react';
import Link from 'next/link';
import { CampusHero } from '@/components/campus-hero';
import { MealSlots } from '@/components/meal-slots';
import { SectionHeading } from '@/components/section-heading';
import { VendorCard, VendorCardSkeleton } from '@/components/vendor-card';
import { useCampus, useCoupons, useVendors } from '@/hooks/use-catalog';
import { isLiveOrder, useOrders } from '@/hooks/use-orders';
import { env } from '@/lib/env';
import { campusLabel } from '@/lib/greeting';
import { useSaved } from '@/lib/saved';
import { useSession } from '@/lib/session';
import { useUnreadCount } from '@/hooks/use-account';

export default function HomePage() {
  const { user } = useSession();
  const campus = useCampus();
  const vendors = useVendors({ limit: 12, openOnly: false, sortBy: 'popular' });
  const coupons = useCoupons();
  const liveOrders = useOrders({ live: true, limit: 3 });
  const saved = useSaved(user?.id);
  const { data: unread } = useUnreadCount();

  const live = liveOrders.data?.items.filter((order) => isLiveOrder(order.status)) ?? [];
  const place = campus.data?.name ?? campusLabel(env.campusSlug);
  const firstName = user?.name.split(' ')[0];
  const kitchens = vendors.data?.items ?? [];
  const favourites = kitchens.filter((vendor) => saved.vendorIds.includes(vendor.id));
  const featuredPool = favourites.length > 0 ? favourites : kitchens;
  const featured = featuredPool[0];
  const rest = kitchens.filter((vendor) => vendor.id !== featured?.id);
  const offer = (coupons.data ?? []).find((coupon) => coupon.type === 'percentage');
  const offerLabel = offer ? `${offer.value}% OFF` : undefined;

  return (
    <div className="space-y-6 lg:space-y-8">
      <CampusHero place={place} firstName={firstName} unread={unread?.unread} />

      {live.length > 0 ? (
        <div className="px-4 sm:px-0">
          <div className="grid gap-3 sm:grid-cols-2">
            {live.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-serif text-body font-semibold text-ink">
                    {order.vendorName ?? 'Your order'}
                  </p>
                  <p className="tabular text-caption text-ink-muted">#{order.code}</p>
                </div>
                <Badge tone="brand" size="sm">
                  {order.status.replace(/_/g, ' ')}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <MealSlots />

      {featured ? (
        <section className="px-4 sm:px-0">
          <SectionHeading title="From your favourites" href="/saved" serif />
          <VendorCard vendor={featured} layout="featured" offer={offerLabel} />
        </section>
      ) : null}

      {rest.length > 0 || vendors.isLoading || vendors.isError || (!featured && !vendors.isLoading) ? (
        <section className="px-4 sm:px-0">
          <SectionHeading title="Kitchens on campus" href="/kitchens" serif />
          {vendors.isError ? (
            <ErrorState message="We could not load the kitchens." onRetry={() => vendors.refetch()} />
          ) : vendors.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <VendorCardSkeleton key={index} />
              ))}
            </div>
          ) : rest.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rest.map((vendor) => (
                <VendorCard key={vendor.id} vendor={vendor} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Store aria-hidden className="h-6 w-6" />}
              title="No kitchens yet"
              description="Kitchens on this campus are still being onboarded. Check back soon."
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
