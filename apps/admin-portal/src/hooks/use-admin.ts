'use client';

import { errorMessage, isApiError, type DateRange, type PageQuery, type UserQuery } from '@ck/sdk';
import { PERMISSIONS, VENDOR_STATUS, type DeliveryStatus, type VendorStatus } from '@ck/types';
import { toast } from '@ck/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { useSession } from '@/lib/session';

export function useUnreadCount() {
  const { user } = useSession();
  return useQuery({
    queryKey: keys.unreadCount,
    queryFn: () => api.account.unreadCount(),
    enabled: Boolean(user),
    refetchInterval: (query) =>
      isApiError(query.state.error) && query.state.error.status === 429 ? 120_000 : 60_000,
  });
}

export function useNotifications(page = 1) {
  const { user } = useSession();
  return useQuery({
    queryKey: keys.notifications({ page }),
    queryFn: () => api.account.notifications({ page, limit: 20 }),
    enabled: Boolean(user),
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.account.markRead(ids),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.account.markAllRead(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useDashboard(range?: DateRange) {
  const { user } = useSession();
  return useQuery({
    queryKey: keys.dashboard(range),
    queryFn: () => api.admin.dashboard(range),
    enabled: Boolean(user),
  });
}

export function usePeakHours(range?: DateRange) {
  const { user } = useSession();
  return useQuery({
    queryKey: keys.peakHours(range),
    queryFn: () => api.admin.peakHours(range),
    enabled: Boolean(user),
  });
}

export function useUsers(query?: UserQuery) {
  const { user } = useSession();
  return useQuery({
    queryKey: keys.users(query),
    queryFn: () => api.admin.users(query),
    enabled: Boolean(user),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: 'active' | 'suspended'; statusReason?: string }) =>
      api.admin.updateUser(input.id, { status: input.status, statusReason: input.statusReason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Account updated.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useVendors(query?: PageQuery & { status?: VendorStatus }) {
  const { user, can } = useSession();
  return useQuery({
    queryKey: keys.vendors(query),
    queryFn: () => api.admin.vendors(query),
    enabled: Boolean(user) && can(PERMISSIONS.VENDOR_READ),
  });
}

export function useVendor(id: string) {
  const { user, can } = useSession();
  return useQuery({
    queryKey: keys.vendor(id),
    queryFn: () => api.admin.vendor(id),
    enabled: Boolean(user) && can(PERMISSIONS.VENDOR_READ) && Boolean(id),
  });
}

export function useDecideVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: VendorStatus; reason?: string }) =>
      api.admin.decideVendor(input.id, { status: input.status, reason: input.reason }),
    onSuccess: (_vendor, input) => {
      void queryClient.invalidateQueries({ queryKey: ['vendors'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
      toast.success(
        input.status === VENDOR_STATUS.SUSPENDED
          ? 'Kitchen suspended. Students cannot order from it.'
          : input.status === VENDOR_STATUS.APPROVED
            ? 'Kitchen is approved and can take orders.'
            : 'Kitchen application rejected.',
      );
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useOrders(query?: PageQuery) {
  const { user, can } = useSession();
  return useQuery({
    queryKey: keys.orders(query),
    queryFn: () => api.admin.orders(query),
    enabled: Boolean(user) && can(PERMISSIONS.ORDER_READ_ALL),
  });
}

export function useOrder(id: string) {
  const { user } = useSession();
  return useQuery({
    queryKey: keys.order(id),
    queryFn: () => api.admin.order(id),
    enabled: Boolean(user && id),
  });
}

export function useRefundOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; amount: number; reason: string }) =>
      api.admin.refundOrder(input.id, input.amount, input.reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Refund issued.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useDeliveries(query?: PageQuery & { status?: DeliveryStatus }) {
  const { user } = useSession();
  return useQuery({
    queryKey: keys.deliveries(query),
    queryFn: () => api.admin.deliveries(query),
    enabled: Boolean(user),
  });
}

export function useCoupons(page = 1) {
  const { user } = useSession();
  return useQuery({
    queryKey: keys.coupons(page),
    queryFn: () => api.admin.coupons({ page, limit: 20 }),
    enabled: Boolean(user),
  });
}

export function useReviews(query?: PageQuery) {
  const { user } = useSession();
  return useQuery({
    queryKey: keys.reviews(query),
    queryFn: () => api.admin.reviews(query),
    enabled: Boolean(user),
  });
}

export function useModerateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; isHidden: boolean; reason?: string }) =>
      api.admin.moderateReview(input.id, input.isHidden, input.reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reviews'] });
      toast.success('Review updated.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useTickets(query?: PageQuery) {
  const { user } = useSession();
  return useQuery({
    queryKey: keys.tickets(query),
    queryFn: () => api.admin.tickets(query),
    enabled: Boolean(user),
  });
}

export function useReplyToTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; body: string; resolve?: boolean }) =>
      api.admin.replyToTicket(input.id, input.body, input.resolve),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Reply sent.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useAnnouncements(page = 1) {
  const { user } = useSession();
  return useQuery({
    queryKey: keys.announcements(page),
    queryFn: () => api.admin.announcements({ page, limit: 20 }),
    enabled: Boolean(user),
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { title: string; body: string; audiences: string[]; sendNow?: boolean }) =>
      api.admin.createAnnouncement(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Announcement saved.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useSendAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.admin.sendAnnouncement(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Announcement queued.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useRoles() {
  const { user } = useSession();
  return useQuery({
    queryKey: keys.roles,
    queryFn: () => api.admin.roles(),
    enabled: Boolean(user),
  });
}

export function usePermissionsCatalogue() {
  const { user } = useSession();
  return useQuery({
    queryKey: keys.permissions,
    queryFn: () => api.admin.permissions(),
    enabled: Boolean(user),
    staleTime: 10 * 60_000,
  });
}

export function useFeatureFlags() {
  const { user } = useSession();
  return useQuery({
    queryKey: keys.featureFlags,
    queryFn: () => api.admin.featureFlags(),
    enabled: Boolean(user),
  });
}

export function useUpsertFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { key: string; enabled: boolean; description?: string }) =>
      api.admin.upsertFeatureFlag(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.featureFlags });
      toast.success('Flag updated.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useSettings() {
  const { user } = useSession();
  return useQuery({
    queryKey: keys.settings,
    queryFn: () => api.admin.settings(),
    enabled: Boolean(user),
  });
}

export function useCurrentCampus() {
  const { user } = useSession();
  return useQuery({
    queryKey: keys.currentCampus,
    queryFn: () => api.admin.currentCampus(),
    enabled: Boolean(user),
  });
}

export function useCampuses() {
  const { user } = useSession();
  return useQuery({
    queryKey: keys.campuses,
    queryFn: () => api.admin.campuses(),
    enabled: Boolean(user),
  });
}

export function useZones() {
  const { user } = useSession();
  return useQuery({
    queryKey: keys.zones,
    queryFn: () => api.admin.zones(),
    enabled: Boolean(user),
  });
}

export function useAuditLogs(query?: PageQuery) {
  const { user } = useSession();
  return useQuery({
    queryKey: keys.audit(query),
    queryFn: () => api.admin.auditLogs(query),
    enabled: Boolean(user),
  });
}

export function usePages() {
  const { user } = useSession();
  return useQuery({
    queryKey: keys.pages,
    queryFn: () => api.admin.pages(),
    enabled: Boolean(user),
  });
}

export function useBanners() {
  const { user } = useSession();
  return useQuery({
    queryKey: keys.banners,
    queryFn: () => api.admin.banners(),
    enabled: Boolean(user),
  });
}
