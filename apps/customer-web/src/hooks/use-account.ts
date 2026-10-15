'use client';

import {
  errorMessage,
  type AddressPayload,
  type NotificationListQuery,
  type TicketPayload,
} from '@ck/sdk';
import { toast } from '@ck/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { useSession } from '@/lib/session';

export function useAddresses() {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.addresses,
    queryFn: () => api.account.addresses(),
    enabled: Boolean(user),
  });
}

export function useSaveAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: AddressPayload }) =>
      id ? api.account.updateAddress(id, payload) : api.account.addAddress(payload),
    onSuccess: (addresses) => {
      queryClient.setQueryData(keys.addresses, addresses);
      // A new address can change the delivery zone, and with it the delivery fee.
      void queryClient.invalidateQueries({ queryKey: keys.cart });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.account.removeAddress(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.addresses }),
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useWallet() {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.wallet,
    queryFn: () => api.account.wallet(),
    enabled: Boolean(user),
  });
}

export function useWalletTransactions(page = 1) {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.walletTransactions(page),
    queryFn: () => api.account.walletTransactions({ page, limit: 20 }),
    enabled: Boolean(user),
  });
}

export function useNotifications(filters?: NotificationListQuery) {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.notifications(filters),
    queryFn: () => api.account.notifications(filters),
    enabled: Boolean(user),
  });
}

/**
 * Unread badge count.
 *
 * The socket pushes this value, so there is no polling interval here; the query exists
 * to seed the badge on first load and to survive a reconnect.
 */
export function useUnreadCount() {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.unreadCount,
    queryFn: () => api.account.unreadCount(),
    enabled: Boolean(user),
    staleTime: 30_000,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids?: string[]) =>
      ids && ids.length > 0 ? api.account.markRead(ids) : api.account.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
      void queryClient.invalidateQueries({ queryKey: keys.unreadCount });
    },
  });
}

export function useNotificationPreferences() {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.notificationPreferences,
    queryFn: () => api.account.notificationPreferences(),
    enabled: Boolean(user),
    select: (result) => result.preferences,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (preferences: Record<string, boolean>) =>
      api.account.updateNotificationPreferences(preferences),
    onSuccess: (result) => {
      queryClient.setQueryData(keys.notificationPreferences, result);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useSupportTickets(page = 1) {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.supportTickets(page),
    queryFn: () => api.account.supportTickets({ page, limit: 20 }),
    enabled: Boolean(user),
  });
}

export function useSupportTicket(id: string | null) {
  return useQuery({
    queryKey: keys.supportTicket(id ?? ''),
    queryFn: () => api.account.supportTicket(id!),
    enabled: Boolean(id),
  });
}

export function useCreateSupportTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TicketPayload) => api.account.createSupportTicket(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['support'] });
      toast.success('Ticket raised — campus support will reply here.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useReplyToTicket(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => api.account.replyToTicket(id, body),
    onSuccess: (detail) => {
      queryClient.setQueryData(keys.supportTicket(id), detail);
      void queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useMyReviews(page = 1) {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.myReviews(page),
    queryFn: () => api.account.myReviews({ page, limit: 20 }),
    enabled: Boolean(user),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { name?: string; phone?: string; avatarUrl?: string }) =>
      api.account.updateProfile(payload),
    onSuccess: (user) => {
      queryClient.setQueryData(keys.session, user);
      toast.success('Profile updated');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}
