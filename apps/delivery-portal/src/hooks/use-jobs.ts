'use client';

import { errorMessage, isApiError } from '@ck/sdk';
import { DELIVERY_STATUS, type DeliveryStatus } from '@ck/types';
import { toast } from '@ck/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Coordinates } from '@/lib/geo';
import { keys } from '@/lib/query-keys';
import { useSession } from '@/lib/session';

/** Statuses where the rider still has the food and the job is on screen. */
const ACTIVE_STATUSES = new Set<DeliveryStatus>([
  DELIVERY_STATUS.ASSIGNED,
  DELIVERY_STATUS.ARRIVED_AT_VENDOR,
  DELIVERY_STATUS.PICKED_UP,
  DELIVERY_STATUS.ARRIVED_AT_CUSTOMER,
]);

export const isActiveJob = (status: DeliveryStatus): boolean => ACTIVE_STATUSES.has(status);

/**
 * The open pool.
 *
 * Polled on a short interval as well as pushed over the socket: this is the one list
 * where being a few seconds stale costs the rider actual money, and a dropped socket on
 * campus Wi-Fi is common enough that it cannot be the only path.
 */
export function useOffers() {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.offers,
    queryFn: () => api.delivery.offers(),
    enabled: Boolean(user),
    refetchInterval: (query) =>
      // Offline riders are not shown jobs at all, so stop polling for them.
      query.state.data?.reason === 'offline' ? false : 15_000,
    refetchIntervalInBackground: false,
  });
}

export function useActiveJobs() {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.activeJobs,
    queryFn: () => api.delivery.jobs({ active: true, page: 1, limit: 10 }),
    enabled: Boolean(user),
    // Socket events drive updates; this is the fallback for a backgrounded tab.
    refetchInterval: 30_000,
  });
}

export function useJobHistory(page: number) {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.jobHistory(page),
    queryFn: () => api.delivery.jobs({ active: false, page, limit: 20 }),
    enabled: Boolean(user),
  });
}

/** Finds a job the rider already has, from the lists the API already returns. */
export function useJob(id: string) {
  const active = useActiveJobs();
  const history = useJobHistory(1);
  const job =
    active.data?.items.find((item) => item.id === id) ??
    history.data?.items.find((item) => item.id === id);

  return {
    data: job,
    isLoading: active.isLoading || history.isLoading,
    isError: active.isError || history.isError,
    refetch: () => {
      void active.refetch();
      void history.refetch();
    },
  };
}

export function useEarnings() {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.earnings,
    queryFn: () => api.delivery.earnings(),
    enabled: Boolean(user),
  });
}

/**
 * Claims a job.
 *
 * Losing the race is the expected outcome about as often as winning it, so a 409 is
 * reported as information rather than as a failure - and the pool is refetched either
 * way, because a lost job should disappear from the list immediately.
 */
export function useAcceptJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assignmentId: string) => api.delivery.accept(assignmentId),
    onSuccess: () => {
      toast.success('Job accepted. Head to the kitchen.');
    },
    onError: (error) => {
      if (isApiError(error) && error.status === 409) {
        toast('Someone else took that one', {
          description: 'It was accepted a moment before your tap landed.',
        });
        return;
      }
      toast.error(errorMessage(error));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.offers });
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useDeclineJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assignmentId: string) => api.delivery.decline(assignmentId),
    onSuccess: () => {
      // Declining is permanent for this rider, which is worth saying out loud.
      toast('Hidden from your list');
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.offers });
    },
  });
}

/**
 * Moves a job forward.
 *
 * The API owns the transition rules and the OTP check; this only reports what came back.
 * A wrong handover code is a 422 with a message worth showing verbatim, since it tells
 * the rider how many attempts are left before the job locks.
 */
export function useUpdateJobStatus(assignmentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      status: DeliveryStatus;
      otp?: string;
      location?: Coordinates;
      failureReason?: string;
    }) => api.delivery.updateStatus(assignmentId, input),
    onSuccess: (assignment) => {
      if (assignment.status === DELIVERY_STATUS.DELIVERED) {
        toast.success('Delivered. Earning added to your total.');
      }
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
      void queryClient.invalidateQueries({ queryKey: keys.earnings });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

/** The shift switch. Going offline stops offers and, with them, location reporting. */
export function useSetOnline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (isOnline: boolean) => api.delivery.setOnline(isOnline),
    onSuccess: ({ isOnline }) => {
      toast.success(isOnline ? 'You are online' : 'You are offline');
      void queryClient.invalidateQueries({ queryKey: keys.earnings });
      void queryClient.invalidateQueries({ queryKey: keys.offers });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}
