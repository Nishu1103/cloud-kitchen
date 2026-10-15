/**
 * Query keys in one place.
 *
 * Every cache invalidation names a key from here, so a rename cannot leave a stale
 * screen behind: accepting a job has to refresh the offer pool, the active run and the
 * earnings counter at once.
 *
 * The prefixes matter as much as the leaves: socket handlers invalidate by prefix
 * (`['jobs']`) to catch the active list and the history together.
 */
export const keys = {
  session: ['session'] as const,

  offers: ['offers'] as const,
  activeJobs: ['jobs', 'active'] as const,
  jobHistory: (page: number) => ['jobs', 'history', page] as const,

  earnings: ['earnings'] as const,
  wallet: ['wallet'] as const,
  walletTxns: (page: number) => ['wallet', 'txns', page] as const,

  notifications: (filters?: unknown) => ['notifications', 'list', filters ?? null] as const,
  unreadCount: ['notifications', 'unread'] as const,
  notificationPreferences: ['notifications', 'preferences'] as const,
};
