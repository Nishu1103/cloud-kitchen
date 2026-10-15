'use client';

import { errorMessage, type OrderListQuery, type PlaceOrderPayload } from '@ck/sdk';
import { ORDER_STATUS, type OrderStatus } from '@ck/types';
import { toast } from '@ck/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { useSession } from '@/lib/session';

/** Statuses where the order is still moving and the screen should track it. */
const LIVE_STATUSES = new Set<OrderStatus>([
  ORDER_STATUS.AWAITING_PAYMENT,
  ORDER_STATUS.PLACED,
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY,
  ORDER_STATUS.OUT_FOR_DELIVERY,
]);

export const isLiveOrder = (status: OrderStatus): boolean => LIVE_STATUSES.has(status);

export function useOrders(filters?: OrderListQuery) {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.orders(filters),
    queryFn: () => api.checkout.orders(filters),
    enabled: Boolean(user),
  });
}

export function useOrder(id: string) {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.order(id),
    queryFn: () => api.checkout.order(id),
    enabled: Boolean(user && id),
    /**
     * Socket events drive updates; this is the fallback for a dropped connection or a
     * backgrounded tab. Polling stops once the order reaches a terminal state so a
     * finished order is not refetched forever.
     */
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && isLiveOrder(status) ? 20_000 : false;
    },
  });
}

/**
 * The handover code for a live order.
 *
 * Kept out of `useOrder` on purpose: the code is only fetched by the screen that shows
 * it, and only while a handover is still pending, so it stays out of list payloads and
 * out of the cache for finished orders.
 */
export function useHandoverCode(id: string, enabled: boolean) {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.handoverCode(id),
    queryFn: () => api.checkout.handoverCode(id),
    enabled: Boolean(user && id) && enabled,
    staleTime: 5 * 60_000,
    // Losing the code mid-handover is worse than a stale read; the API clears it once
    // the order closes, and the screen hides it at that point anyway.
    gcTime: 30 * 60_000,
  });
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PlaceOrderPayload) => api.checkout.placeOrder(payload),
    onSuccess: () => {
      // The server clears the cart as part of placing the order, and the wallet moves
      // when it was used to pay.
      void queryClient.invalidateQueries({ queryKey: keys.cart });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: keys.wallet });
    },
  });
}

export function useCancelOrder(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reason: string) => api.checkout.cancelOrder(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.order(id) });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: keys.wallet });
      toast.success('Order cancelled. Any refund goes back to your wallet.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useConfirmPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { paymentId: string; providerPaymentId: string }) =>
      api.checkout.confirmPayment(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: keys.wallet });
    },
  });
}
