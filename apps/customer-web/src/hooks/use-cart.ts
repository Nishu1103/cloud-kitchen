'use client';

import { errorMessage, isApiError, type AddCartLinePayload, type CartView } from '@ck/sdk';
import { toast } from '@ck/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { useSession } from '@/lib/session';

/**
 * The cart lives on the server.
 *
 * A device-local cart cannot know that a dish sold out or that a coupon expired, and
 * two devices signed into the same account would disagree. Every mutation returns the
 * authoritative cart with a fresh price breakdown, which is written straight into the
 * cache so the bill on screen is the bill that will be charged.
 */
export function useCart() {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.cart,
    queryFn: () => api.checkout.cart(),
    enabled: Boolean(user),
    // Short window: stock and kitchen availability move underneath a parked cart.
    staleTime: 15_000,
  });
}

function useCartMutation<TInput>(mutationFn: (input: TInput) => Promise<CartView>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (cart) => {
      queryClient.setQueryData(keys.cart, cart);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      // The server may have partially applied the change (a coupon dropped, stock
      // reserved), so refetch instead of trusting the pre-mutation cache.
      void queryClient.invalidateQueries({ queryKey: keys.cart });
    },
  });
}

export function useAddToCart() {
  return useCartMutation((payload: AddCartLinePayload) => api.checkout.addLine(payload));
}

export function useUpdateCartLine() {
  return useCartMutation(({ lineId, quantity }: { lineId: string; quantity: number }) =>
    api.checkout.updateLine(lineId, { quantity }),
  );
}

export function useApplyCoupon() {
  const mutation = useCartMutation((code?: string) => api.checkout.applyCoupon(code));

  return {
    ...mutation,
    /** Distinguishes "this code is wrong" from "the request failed" for inline errors. */
    invalidCode: isApiError(mutation.error) && mutation.error.code === 'COUPON_INVALID',
  };
}

export function useWalletPreference() {
  return useCartMutation((applyWallet: boolean) => api.checkout.setWalletPreference(applyWallet));
}

export function useClearCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.checkout.clearCart(),
    // The API keeps the cart row and empties it, so refetch rather than inventing a
    // cleared shape here - the id and the zeroed breakdown come from the server.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.cart }),
  });
}

/** Total item count for the tab bar badge. */
export function useCartCount(): number {
  const { data } = useCart();
  return data?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
}
