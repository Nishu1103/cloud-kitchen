'use client';

import {
  errorMessage,
  type AnnouncementPayload,
  type CouponPayload,
  type CouponUpdatePayload,
  type DateRange,
  type VendorProfilePayload,
} from '@ck/sdk';
import { toast } from '@ck/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { useSession } from '@/lib/session';

// ------------------------------------------------------------------------- profile

export function useKitchen() {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.profile,
    queryFn: () => api.vendor.profile(),
    enabled: Boolean(user),
  });
}

export function useUpdateKitchen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: VendorProfilePayload) => api.vendor.updateProfile(payload),
    onSuccess: (vendor) => {
      queryClient.setQueryData(keys.profile, vendor);
      toast.success('Kitchen details saved.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

/**
 * The open/closed switch.
 *
 * Written straight into the cache on success because this is the control a kitchen hits
 * when a queue gets away from it: waiting for a refetch to redraw the header would
 * leave staff unsure whether new orders are still arriving.
 */
export function useSetOpenState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (isOpen: boolean) => api.vendor.setOpenState(isOpen),
    onSuccess: (vendor) => {
      queryClient.setQueryData(keys.profile, (current: typeof vendor | undefined) =>
        current ? { ...current, ...vendor } : vendor,
      );
      toast.success(
        vendor.isOpen
          ? 'Kitchen is open. Students can order now.'
          : 'Kitchen is closed. No new orders will come in.',
      );
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

// ------------------------------------------------------------------------ analytics

export function useDashboard(range?: DateRange, enabled = true) {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.dashboard(range),
    queryFn: () => api.vendor.dashboard(range),
    enabled: Boolean(user) && enabled,
    // The API caches this for two minutes; matching that avoids pointless round trips.
    staleTime: 120_000,
  });
}

export function usePeakHours(range?: DateRange) {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.peakHours(range),
    queryFn: () => api.vendor.peakHours(range),
    enabled: Boolean(user),
    staleTime: 120_000,
  });
}

// -------------------------------------------------------------------------- coupons

export function useCoupons(page = 1) {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.coupons(page),
    queryFn: () => api.vendor.coupons({ page }),
    enabled: Boolean(user),
  });
}

export function useCreateCoupon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CouponPayload) => api.vendor.createCoupon(payload),
    onSuccess: (coupon) => {
      void queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast.success(`${coupon.code} is live.`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useUpdateCoupon() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CouponUpdatePayload }) =>
      api.vendor.updateCoupon(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast.success('Coupon updated.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

// -------------------------------------------------------------------------- reviews

export function useReviews(filters?: { page?: number; rating?: number }) {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.reviews(filters),
    queryFn: () => api.vendor.reviews(filters),
    enabled: Boolean(user),
  });
}

export function useReplyToReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) =>
      api.vendor.replyToReview(id, reply),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reviews'] });
      toast.success('Reply posted.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

// -------------------------------------------------------------------- announcements

export function useAnnouncements(page = 1) {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.announcements(page),
    queryFn: () => api.vendor.announcements({ page }),
    enabled: Boolean(user),
  });
}

/**
 * Promotional push from the kitchen.
 *
 * The API enforces a small daily quota per kitchen, and a rejection here is a quota
 * message worth reading rather than a failure to retry - which is why the API's own
 * wording is surfaced instead of a generic one.
 */
export function useCreateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AnnouncementPayload) => api.vendor.createAnnouncement(payload),
    onSuccess: (announcement) => {
      void queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success(
        announcement.status === 'sending' || announcement.status === 'sent'
          ? 'Sending to your customers now.'
          : 'Saved. Send it when you are ready.',
      );
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useSendAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.vendor.sendAnnouncement(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Queued. Students will get it in a moment.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}
