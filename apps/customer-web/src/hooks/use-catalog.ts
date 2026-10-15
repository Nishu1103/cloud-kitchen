'use client';

import type { BannerPlacement, BrowseProductsQuery, BrowseVendorsQuery } from '@ck/sdk';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { env } from '@/lib/env';
import { keys } from '@/lib/query-keys';
import { useSession } from '@/lib/session';

/**
 * The campus this deployment serves.
 *
 * The slug is build-time configuration rather than a route segment, so one deployment
 * is one campus and a student can never be shown another campus's kitchens.
 */
export function useCampus() {
  return useQuery({
    queryKey: keys.campus,
    queryFn: () => api.discovery.campus(env.campusSlug),
    staleTime: 60 * 60_000,
  });
}

export function useVendors(filters?: BrowseVendorsQuery) {
  return useQuery({
    queryKey: keys.vendors(filters),
    queryFn: () => api.discovery.vendors(filters),
  });
}

export function useVendor(slug: string) {
  return useQuery({
    queryKey: keys.vendor(slug),
    queryFn: () => api.discovery.vendor(slug),
    enabled: Boolean(slug),
  });
}

export function useVendorMenu(vendorId: string | undefined) {
  return useQuery({
    queryKey: keys.vendorMenu(vendorId ?? ''),
    queryFn: () => api.discovery.vendorMenu(vendorId!),
    enabled: Boolean(vendorId),
    // Kitchens toggle stock and specials constantly during a meal rush.
    staleTime: 30_000,
  });
}

export function useProducts(filters?: BrowseProductsQuery) {
  return useQuery({
    queryKey: keys.products(filters),
    queryFn: () => api.discovery.products(filters),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: () => api.discovery.categories(),
    // Categories are effectively static within a session.
    staleTime: 30 * 60_000,
  });
}

export function useBanners(placement: BannerPlacement) {
  return useQuery({
    queryKey: keys.banners(placement),
    queryFn: () => api.discovery.banners(placement),
    staleTime: 5 * 60_000,
  });
}

/**
 * Feature flags and campus settings.
 *
 * Public, because the storefront is: an anonymous visitor must see the same happy-hour
 * pricing and flash-sale banners as a signed-in one. A failed or pending load yields no
 * flags, so every gated feature stays hidden — the safe direction to fail.
 */
export function useBootstrap() {
  return useQuery({
    queryKey: keys.bootstrap,
    queryFn: () => api.discovery.bootstrap(),
    staleTime: 10 * 60_000,
  });
}

/** Reads a feature flag. Unknown or unloaded flags are treated as off. */
export function useFeature(key: string): boolean {
  const { data } = useBootstrap();
  return data?.flags?.[key] === true;
}

export function useCoupons(vendorId?: string) {
  const { user } = useSession();

  return useQuery({
    queryKey: [...keys.coupons, vendorId ?? null],
    queryFn: () => api.discovery.coupons(vendorId),
    enabled: Boolean(user),
  });
}

export function useVendorReviews(vendorId: string | undefined) {
  return useQuery({
    queryKey: keys.reviews({ vendorId }),
    queryFn: () => api.discovery.vendorReviews(vendorId!, { page: 1, limit: 20 }),
    enabled: Boolean(vendorId),
  });
}
