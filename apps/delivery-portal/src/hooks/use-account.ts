'use client';

import { errorMessage, isApiError, type NotificationListQuery } from '@ck/sdk';
import { PERMISSIONS } from '@ck/types';
import { toast } from '@ck/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { useSession } from '@/lib/session';

export function useWallet() {
  const { user, can } = useSession();

  return useQuery({
    queryKey: keys.wallet,
    queryFn: () => api.account.wallet(),
    enabled: Boolean(user) && can(PERMISSIONS.WALLET_READ_OWN),
  });
}

export function useWalletTransactions(page: number) {
  const { user, can } = useSession();

  return useQuery({
    queryKey: keys.walletTxns(page),
    queryFn: () => api.account.walletTransactions({ page, limit: 20 }),
    enabled: Boolean(user) && can(PERMISSIONS.WALLET_READ_OWN),
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
 * Drives the tab bar badge.
 *
 * The socket pushes an authoritative count into this key, so the interval is only a
 * fallback for a dropped connection rather than the primary source.
 */
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

export function useMarkRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => api.account.markRead(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.account.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useNotificationPreferences() {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.notificationPreferences,
    queryFn: () => api.account.notificationPreferences(),
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
    // The API wraps the map; screens only ever want the map itself.
    select: (result) => result.preferences,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (preferences: Record<string, boolean>) =>
      api.account.updateNotificationPreferences(preferences),
    onSuccess: (result) => {
      // The API returns the merged set, so the cache takes it verbatim rather than
      // guessing what a partial patch did to keys this screen does not render.
      queryClient.setQueryData(keys.notificationPreferences, result);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { current: string; next: string }) =>
      api.auth.changePassword(input.current, input.next),
    onSuccess: () => toast.success('Password changed. Other devices stay signed in.'),
    onError: (error) => toast.error(errorMessage(error)),
  });
}
