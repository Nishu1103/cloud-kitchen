'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Saved kitchens and dishes, kept on this device.
 *
 * There is no favourites API yet, so persistence is local. The key includes the
 * user id so two students sharing a phone do not inherit each other's list, and
 * an anonymous visitor still gets a working heart.
 */
const EVENT = 'ck-saved';

type SavedState = {
  vendorIds: string[];
  products: Array<{
    id: string;
    vendorSlug: string;
    name: string;
    imageUrl?: string;
    basePrice: number;
  }>;
};

const EMPTY: SavedState = { vendorIds: [], products: [] };

function storageKey(userId?: string): string {
  return `ck.saved.${userId ?? 'anon'}`;
}

function read(userId?: string): SavedState {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as SavedState;
    return {
      vendorIds: Array.isArray(parsed.vendorIds) ? parsed.vendorIds.filter((id) => typeof id === 'string') : [],
      products: Array.isArray(parsed.products)
        ? parsed.products
            .filter(
              (item) =>
                item && typeof item.id === 'string' && typeof item.vendorSlug === 'string',
            )
            .map((item) => ({
              id: item.id,
              vendorSlug: item.vendorSlug,
              name: typeof item.name === 'string' ? item.name : 'Saved dish',
              imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : undefined,
              basePrice: typeof item.basePrice === 'number' ? item.basePrice : 0,
            }))
        : [],
    };
  } catch {
    return EMPTY;
  }
}

function write(userId: string | undefined, next: SavedState): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(next));
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(EVENT, onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    window.removeEventListener(EVENT, onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

export function useSaved(userId?: string) {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(read(userId)),
    () => JSON.stringify(EMPTY),
  );
  const state: SavedState = JSON.parse(snapshot) as SavedState;

  const toggleVendor = useCallback(
    (vendorId: string) => {
      const current = read(userId);
      const vendorIds = current.vendorIds.includes(vendorId)
        ? current.vendorIds.filter((id) => id !== vendorId)
        : [...current.vendorIds, vendorId];
      write(userId, { ...current, vendorIds });
    },
    [userId],
  );

  const toggleProduct = useCallback(
    (product: { id: string; vendorSlug: string; name: string; imageUrl?: string; basePrice: number }) => {
      const current = read(userId);
      const exists = current.products.some((item) => item.id === product.id);
      const products = exists
        ? current.products.filter((item) => item.id !== product.id)
        : [...current.products, product];
      write(userId, { ...current, products });
    },
    [userId],
  );

  return {
    vendorIds: state.vendorIds,
    products: state.products,
    isVendorSaved: (id: string) => state.vendorIds.includes(id),
    isProductSaved: (id: string) => state.products.some((item) => item.id === id),
    toggleVendor,
    toggleProduct,
  };
}
