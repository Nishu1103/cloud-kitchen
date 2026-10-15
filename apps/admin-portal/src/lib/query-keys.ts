/**
 * Query keys in one place so a rename cannot leave a stale screen behind.
 */
export const keys = {
  session: ['session'] as const,

  dashboard: (range?: unknown) => ['analytics', 'dashboard', range ?? null] as const,
  peakHours: (range?: unknown) => ['analytics', 'peak-hours', range ?? null] as const,

  users: (filters?: unknown) => ['users', filters ?? null] as const,
  user: (id: string) => ['users', 'detail', id] as const,

  vendors: (filters?: unknown) => ['vendors', filters ?? null] as const,
  vendor: (id: string) => ['vendors', 'detail', id] as const,

  orders: (filters?: unknown) => ['orders', filters ?? null] as const,
  order: (id: string) => ['orders', 'detail', id] as const,

  deliveries: (filters?: unknown) => ['delivery', filters ?? null] as const,

  coupons: (page: number) => ['coupons', page] as const,

  reviews: (filters?: unknown) => ['reviews', filters ?? null] as const,

  tickets: (filters?: unknown) => ['tickets', filters ?? null] as const,

  announcements: (page: number) => ['announcements', page] as const,

  roles: ['roles'] as const,
  permissions: ['permissions'] as const,

  settings: ['settings'] as const,
  featureFlags: ['feature-flags'] as const,

  campuses: ['campuses'] as const,
  currentCampus: ['campuses', 'current'] as const,
  zones: ['campuses', 'zones'] as const,

  pages: ['cms', 'pages'] as const,
  banners: ['cms', 'banners'] as const,

  audit: (filters?: unknown) => ['audit', filters ?? null] as const,

  notifications: (filters?: unknown) => ['notifications', 'list', filters ?? null] as const,
  unreadCount: ['notifications', 'unread'] as const,
};
