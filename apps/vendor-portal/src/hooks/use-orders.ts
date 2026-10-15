'use client';

import { errorMessage, type OrderListQuery } from '@ck/sdk';
import { ORDER_STATUS, type OrderStatus } from '@ck/types';
import { toast } from '@ck/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { useSession } from '@/lib/session';

/** The columns of the kitchen board, in the order work moves through them. */
export const BOARD_COLUMNS: { status: OrderStatus; label: string; hint: string }[] = [
  { status: ORDER_STATUS.PLACED, label: 'New', hint: 'Accept or reject' },
  { status: ORDER_STATUS.ACCEPTED, label: 'Accepted', hint: 'Start cooking' },
  { status: ORDER_STATUS.PREPARING, label: 'Cooking', hint: 'Mark ready when plated' },
  { status: ORDER_STATUS.READY, label: 'Ready', hint: 'Waiting for pickup' },
];

export function useVendorOrders(filters?: OrderListQuery) {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.orders(filters),
    queryFn: () => api.vendor.orders(filters),
    enabled: Boolean(user),
    /**
     * Socket events drive the board; this is the safety net for a dropped connection on
     * kitchen Wi-Fi. A missed order is a refund, so the live board tolerates the extra
     * request rather than trusting the socket alone.
     */
    refetchInterval: filters?.live ? 30_000 : false,
  });
}

export function useVendorOrder(id: string) {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.order(id),
    queryFn: () => api.vendor.order(id),
    enabled: Boolean(user && id),
  });
}

/**
 * Advances one order.
 *
 * Transitions are validated server-side against a forward-only map, so a board left
 * open on a stale state gets a refusal rather than corrupting the timeline. The error
 * is surfaced verbatim because the API's message is the useful one ("a delivery order
 * is completed by the delivery partner").
 */
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { id: string; status: OrderStatus; note?: string }) =>
      api.vendor.updateOrderStatus(input.id, input.status, input.note),
    onSuccess: (_order, input) => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: keys.order(input.id) });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}
