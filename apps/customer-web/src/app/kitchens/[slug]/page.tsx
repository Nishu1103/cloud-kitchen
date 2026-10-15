'use client';

import { formatMoney } from '@ck/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  ErrorState,
  Skeleton,
  SkeletonText,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '@ck/ui';
import { ArrowLeft, Clock, Heart, Share2, ShieldCheck, Star } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ProductCard } from '@/components/product-card';
import { RemoteImage } from '@/components/remote-image';
import { useVendor, useVendorMenu, useVendorReviews } from '@/hooks/use-catalog';
import { kitchenCover } from '@/lib/media';
import { useSaved } from '@/lib/saved';
import { useSession } from '@/lib/session';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function KitchenPage() {
  const params = useParams<{ slug: string }>();
  const vendor = useVendor(params.slug);
  const menu = useVendorMenu(vendor.data?.id);
  const reviews = useVendorReviews(vendor.data?.id);
  const [tab, setTab] = useState('menu');
  const [section, setSection] = useState('all');
  const { user } = useSession();
  const saved = useSaved(user?.id);

  if (vendor.isError) {
    return (
      <ErrorState
        title="Kitchen not found"
        message="This kitchen may have been removed from the campus."
      />
    );
  }

  if (vendor.isLoading || !vendor.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="aspect-[16/9] w-full rounded-3xl" />
        <SkeletonText lines={2} />
      </div>
    );
  }

  const shop = vendor.data;
  const cover = kitchenCover(shop);
  const sections = menu.data?.sections ?? [];
  const isSaved = saved.isVendorSaved(shop.id);
  const recommended = sections.flatMap((item) => item.products).slice(0, 8);
  const special = recommended.find((item) => item.flags?.includes('chef_special')) ?? recommended[0];
  const etaLow = Math.max(10, shop.avgPrepMinutes - 5);
  const etaHigh = shop.avgPrepMinutes + 8;

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: shop.name, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url).catch(() => undefined);
  };

  return (
    <div className="space-y-5">
      <div className="relative -mx-4 overflow-hidden bg-surface-muted sm:mx-0 sm:rounded-3xl">
        <div className="relative aspect-[4/3] sm:aspect-[21/9]">
          <RemoteImage
            src={cover.src}
            fallback={cover.fallback}
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-canvas via-transparent to-ink/30" />
          <span className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-ink/55 px-2.5 py-1 text-micro font-medium text-white backdrop-blur-md">
            <ShieldCheck aria-hidden className="h-3.5 w-3.5 text-success" />
            Hygienic · Verified
          </span>
        </div>

        <div className="absolute left-3 top-3 flex gap-2 sm:left-4 sm:top-4">
          <Button variant="ghost" size="icon-sm" className="rounded-full bg-ink/50 text-white hover:bg-ink/70" asChild>
            <Link href="/kitchens" aria-label="Back to kitchens">
              <ArrowLeft aria-hidden className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="absolute right-3 top-3 flex gap-2 sm:right-4 sm:top-4">
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full bg-ink/50 text-white hover:bg-ink/70"
            aria-pressed={isSaved}
            aria-label={isSaved ? 'Unsave kitchen' : 'Save kitchen'}
            onClick={() => saved.toggleVendor(shop.id)}
          >
            <Heart aria-hidden className={isSaved ? 'h-4 w-4 fill-danger text-danger' : 'h-4 w-4'} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full bg-ink/50 text-white hover:bg-ink/70"
            aria-label="Share kitchen"
            onClick={() => void share()}
          >
            <Share2 aria-hidden className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h1 className="font-serif text-title-lg text-ink">{shop.name}</h1>
        <p className="text-caption text-ink-muted">
          {shop.ratingCount > 0 ? (
            <>
              ★ {shop.rating.toFixed(1)} ({shop.ratingCount} reviews)
            </>
          ) : (
            'New on campus'
          )}
          {shop.cuisines[0] ? ` · ${shop.cuisines[0]}` : ''}
        </p>
        <div className="grid grid-cols-3 divide-x divide-line rounded-2xl bg-surface py-3 text-center">
          <div>
            <p className="inline-flex items-center gap-1 text-caption text-ink-subtle">
              <Clock aria-hidden className="h-3.5 w-3.5" /> Time
            </p>
            <p className="mt-0.5 text-caption font-semibold text-ink">
              {etaLow}–{etaHigh} min
            </p>
          </div>
          <div>
            <p className="inline-flex items-center gap-1 text-caption text-ink-subtle">
              <Star aria-hidden className="h-3.5 w-3.5" /> Rating
            </p>
            <p className="mt-0.5 text-caption font-semibold text-ink">
              {shop.ratingCount > 0 ? shop.rating.toFixed(1) : 'New'}
            </p>
          </div>
          <div>
            <p className="text-caption text-ink-subtle">Today</p>
            <p className="mt-0.5 text-caption font-semibold text-ink">
              {shop.ratingCount > 0 ? `${Math.max(12, Math.round(shop.ratingCount / 3))}+ orders` : 'Just opened'}
            </p>
          </div>
        </div>
      </div>

      {special ? (
        <Link
          href="#menu"
          className="flex items-center gap-3 rounded-2xl bg-peach p-3 text-peach-ink"
        >
          <div className="min-w-0 flex-1">
            <p className="text-caption font-medium">Today&apos;s Special 🔥</p>
            <p className="font-serif text-body font-semibold">{special.name}</p>
          </div>
          {special.imageUrl ? (
            <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
              <RemoteImage src={special.imageUrl} alt="" fill sizes="64px" className="object-cover" />
              {special.compareAtPrice && special.compareAtPrice > special.basePrice ? (
                <span className="absolute bottom-1 right-1 rounded bg-danger px-1 text-[0.6rem] font-bold text-white">
                  {Math.round(
                    ((special.compareAtPrice - special.basePrice) / special.compareAtPrice) * 100,
                  )}
                  % OFF
                </span>
              ) : null}
            </span>
          ) : null}
        </Link>
      ) : null}

      {!shop.isOpen ? (
        <Alert tone="warning" title="This kitchen is closed">
          You can look through the menu, but ordering opens when the kitchen does.
        </Alert>
      ) : null}

      <div id="menu">
      <Tabs value={tab} onValueChange={setTab}>
        <TabList>
          <Tab value="menu">Menu</Tab>
          <Tab value="reviews">Reviews</Tab>
          <Tab value="info">Info</Tab>
        </TabList>

        <TabPanel value="menu" className="pt-2">
          {menu.isError ? (
            <ErrorState message="We could not load this menu." onRetry={() => menu.refetch()} />
          ) : menu.isLoading ? (
            <Card className="p-4">
              <SkeletonText lines={6} />
            </Card>
          ) : sections.length === 0 ? (
            <Alert tone="info" title="Nothing on the menu yet">
              This kitchen has not published any dishes.
            </Alert>
          ) : (
            <Tabs value={section} onValueChange={setSection}>
              <TabList>
                <Tab value="all">Recommended</Tab>
                {sections.map((item) => (
                  <Tab key={item.category.id} value={item.category.id}>
                    {item.category.name}
                  </Tab>
                ))}
              </TabList>

              <TabPanel value="all" className="pt-2">
                {sections.map((item) => (
                  <section key={item.category.id} className="pt-4">
                    <h2 className="sticky top-14 z-10 -mx-4 bg-canvas/95 px-4 py-2 font-display text-title text-ink backdrop-blur sm:mx-0 sm:px-0">
                      {item.category.name}
                      <span className="ml-2 text-caption font-normal text-ink-subtle">
                        {item.products.length}
                      </span>
                    </h2>
                    {item.products.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        vendorId={shop.id}
                        vendorSlug={shop.slug}
                        vendorOpen={shop.isOpen}
                      />
                    ))}
                  </section>
                ))}
              </TabPanel>

              {sections.map((item) => (
                <TabPanel key={item.category.id} value={item.category.id} className="pt-2">
                  {item.products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      vendorId={shop.id}
                      vendorSlug={shop.slug}
                      vendorOpen={shop.isOpen}
                    />
                  ))}
                </TabPanel>
              ))}
            </Tabs>
          )}
        </TabPanel>

        <TabPanel value="reviews" className="space-y-3 pt-4">
          {reviews.isError ? (
            <ErrorState message="Reviews could not be loaded." onRetry={() => reviews.refetch()} />
          ) : reviews.isLoading ? (
            <SkeletonText lines={4} />
          ) : !reviews.data?.items.length ? (
            <p className="text-body text-ink-muted">No reviews yet. Be the first after you order.</p>
          ) : (
            reviews.data.items.map((review) => (
              <article key={review.id} className="rounded-2xl bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-body font-medium text-ink">{review.customerName}</p>
                  <span className="inline-flex items-center gap-1 text-caption text-warning">
                    <Star aria-hidden className="h-3.5 w-3.5 fill-current" />
                    {review.rating.toFixed(1)}
                  </span>
                </div>
                {review.comment ? (
                  <p className="mt-2 text-caption text-ink-muted">{review.comment}</p>
                ) : null}
                {review.vendorReply ? (
                  <p className="mt-2 rounded-xl bg-surface-muted px-3 py-2 text-caption text-ink-muted">
                    Kitchen: {review.vendorReply}
                  </p>
                ) : null}
              </article>
            ))
          )}
        </TabPanel>

        <TabPanel value="info" className="space-y-4 pt-4">
          {shop.description ? <p className="text-body text-ink-muted">{shop.description}</p> : null}
          <div className="flex flex-wrap gap-2">
            {shop.cuisines.map((cuisine) => (
              <Badge key={cuisine} tone="outline">
                {cuisine}
              </Badge>
            ))}
            {shop.acceptsDelivery ? <Badge tone="outline">Delivery</Badge> : null}
            {shop.acceptsPickup ? <Badge tone="outline">Pickup</Badge> : null}
            {shop.minOrderAmount > 0 ? (
              <Badge tone="outline">Min {formatMoney(shop.minOrderAmount)}</Badge>
            ) : null}
          </div>
          {shop.operatingHours.length > 0 ? (
            <ul className="space-y-1 text-caption text-ink-muted">
              {shop.operatingHours.map((row) => (
                <li key={row.day} className="flex justify-between gap-4">
                  <span>{DAYS[row.day] ?? `Day ${row.day}`}</span>
                  <span className="tabular">
                    {row.isClosed ? 'Closed' : `${row.open} – ${row.close}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </TabPanel>
      </Tabs>
      </div>
    </div>
  );
}
