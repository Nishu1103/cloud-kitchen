'use client';

import { errorMessage, type CategoryPayload, type ProductPayload } from '@ck/sdk';
import type { ProductFlag } from '@ck/types';
import { toast } from '@ck/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { useSession } from '@/lib/session';

interface MenuFilters {
  page?: number;
  limit?: number;
  categoryId?: string;
}

export function useMenuProducts(filters?: MenuFilters) {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.products(filters),
    queryFn: () => api.vendor.products(filters),
    enabled: Boolean(user),
  });
}

export function useMenuCategories() {
  const { user } = useSession();

  return useQuery({
    queryKey: keys.categories,
    queryFn: () => api.vendor.categories(),
    enabled: Boolean(user),
    // Categories are edited rarely and read by every menu screen.
    staleTime: 5 * 60_000,
  });
}

/**
 * Invalidates by prefix rather than by exact key.
 *
 * The menu is viewed under several filters at once (a category tab, a search), and a
 * saved dish has to appear in all of them - naming one filtered key would leave the
 * others showing the old row.
 */
function useMenuMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  successMessage: (result: TResult, input: TInput) => string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (result, input) => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(successMessage(result, input));
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useCreateProduct() {
  return useMenuMutation(
    (payload: ProductPayload) => api.vendor.createProduct(payload),
    (product) => `${product.name} added to the menu.`,
  );
}

export function useUpdateProduct() {
  return useMenuMutation(
    ({ id, payload }: { id: string; payload: ProductPayload }) =>
      api.vendor.updateProduct(id, payload),
    (product) => `${product.name} updated.`,
  );
}

export function useDeleteProduct() {
  return useMenuMutation(
    (id: string) => api.vendor.deleteProduct(id),
    () => 'Dish removed from the menu.',
  );
}

/**
 * Availability and stock, the two switches used most during service.
 *
 * Stock is separate from the rest of the dish on purpose: flipping "sold out" mid-rush
 * must not require submitting a whole product form, and it needs a permission a kitchen
 * assistant can hold without being able to reprice the menu.
 */
export function useSetStock() {
  return useMenuMutation(
    ({
      id,
      stockQuantity,
      isAvailable,
    }: {
      id: string;
      stockQuantity?: number | null;
      isAvailable?: boolean;
    }) => api.vendor.setStock(id, { stockQuantity, isAvailable }),
    (product) =>
      product.isAvailable ? `${product.name} is back on.` : `${product.name} marked sold out.`,
  );
}

export function useToggleFlags() {
  return useMenuMutation(
    (input: { productIds: string[]; flag: ProductFlag; enabled: boolean }) =>
      api.vendor.toggleFlags(input),
    (result, input) =>
      `${result.updated} ${result.updated === 1 ? 'dish' : 'dishes'} ${
        input.enabled ? 'tagged' : 'untagged'
      }.`,
  );
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CategoryPayload) => api.vendor.createCategory(payload),
    onSuccess: (category) => {
      void queryClient.invalidateQueries({ queryKey: keys.categories });
      toast.success(`Section "${category.name}" created.`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}
