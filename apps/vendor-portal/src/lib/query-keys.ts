/**
 * Query keys in one place.
 *
 * Every cache invalidation names a key from here, so a rename cannot leave a stale
 * screen behind: accepting an order has to refresh the board, that order and the
 * dashboard counters, and those keys are declared once rather than per call site.
 *
 * The prefixes matter as much as the leaves: socket handlers invalidate by prefix
 * (`['orders']`) to catch every filtered board at once.
 */
export const keys = {
  session: ['session'] as const,
  bootstrap: ['bootstrap'] as const,

  profile: ['vendor', 'profile'] as const,

  orders: (filters?: unknown) => ['orders', filters ?? null] as const,
  order: (id: string) => ['orders', 'detail', id] as const,

  products: (filters?: unknown) => ['products', filters ?? null] as const,
  categories: ['categories'] as const,

  coupons: (page: number) => ['coupons', page] as const,

  reviews: (filters?: unknown) => ['reviews', filters ?? null] as const,

  dashboard: (range?: unknown) => ['analytics', 'dashboard', range ?? null] as const,
  peakHours: (range?: unknown) => ['analytics', 'peak-hours', range ?? null] as const,

  announcements: (page: number) => ['announcements', page] as const,

  notifications: (filters?: unknown) => ['notifications', 'list', filters ?? null] as const,
  unreadCount: ['notifications', 'unread'] as const,
  notificationPreferences: ['notifications', 'preferences'] as const,
};
