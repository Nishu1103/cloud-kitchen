/**
 * Query keys in one place.
 *
 * Every cache invalidation names a key from here, so a rename cannot leave a stale
 * screen behind: placing an order has to refresh the cart, the order list and the
 * wallet, and those three keys are declared once rather than spelled out per call site.
 */
export const keys = {
  session: ['session'] as const,
  bootstrap: ['bootstrap'] as const,
  campus: ['campus'] as const,

  banners: (placement: string) => ['banners', placement] as const,
  vendors: (filters?: unknown) => ['vendors', filters ?? null] as const,
  vendor: (slug: string) => ['vendor', slug] as const,
  vendorMenu: (vendorId: string) => ['vendor-menu', vendorId] as const,
  products: (filters?: unknown) => ['products', filters ?? null] as const,
  categories: ['categories'] as const,

  cart: ['cart'] as const,
  coupons: ['coupons'] as const,

  orders: (filters?: unknown) => ['orders', filters ?? null] as const,
  order: (id: string) => ['order', id] as const,
  handoverCode: (id: string) => ['order', id, 'handover-code'] as const,

  wallet: ['wallet'] as const,
  walletTransactions: (page: number) => ['wallet-transactions', page] as const,

  addresses: ['addresses'] as const,
  notifications: (filters?: unknown) => ['notifications', 'list', filters ?? null] as const,
  unreadCount: ['notifications', 'unread'] as const,
  notificationPreferences: ['notifications', 'preferences'] as const,

  reviews: (filters?: unknown) => ['reviews', filters ?? null] as const,
  myReviews: (page: number) => ['reviews', 'mine', page] as const,

  supportTickets: (page: number) => ['support', 'tickets', page] as const,
  supportTicket: (id: string) => ['support', 'ticket', id] as const,

  cmsPage: (slug: string) => ['cms-page', slug] as const,
  search: (term: string) => ['search', term] as const,
};
