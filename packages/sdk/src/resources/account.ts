import type {
  Address,
  PaginatedResult,
  Review,
  SessionUser,
  WalletTransaction,
} from '@ck/types';
import type { ApiClient } from '../client';
import type {
  AddressPayload,
  NotificationFeed,
  NotificationListQuery,
  PageQuery,
  PresignPayload,
  PresignResult,
  ProfilePayload,
  RegisterDevicePayload,
  ReviewPayload,
  TicketDetail,
  TicketPayload,
  TicketSummary,
  UserPreferencesPayload,
  WalletBalance,
} from '../contracts';

/** Profile, addresses, wallet, reviews, uploads, notifications and support. */
export function accountResource(client: ApiClient) {
  return {
    profile(): Promise<SessionUser> {
      return client.get('/me');
    },

    updateProfile(payload: ProfilePayload): Promise<SessionUser> {
      return client.patch('/me', payload);
    },

    updatePreferences(payload: UserPreferencesPayload): Promise<{ updated: boolean }> {
      return client.patch('/me/preferences', payload);
    },

    /** Soft-deletes; the API anonymises the account and keeps order history intact. */
    deleteAccount(): Promise<void> {
      return client.delete('/me');
    },

    addresses(): Promise<Address[]> {
      return client.get('/me/addresses');
    },

    /** Returns the full list, so the caller can replace its cache without a refetch. */
    addAddress(payload: AddressPayload): Promise<Address[]> {
      return client.post('/me/addresses', payload);
    },

    updateAddress(id: string, payload: Partial<AddressPayload>): Promise<Address[]> {
      return client.patch(`/me/addresses/${id}`, payload);
    },

    removeAddress(id: string): Promise<void> {
      return client.delete(`/me/addresses/${id}`);
    },

    wallet(): Promise<WalletBalance> {
      return client.get('/wallet');
    },

    walletTransactions(query?: PageQuery): Promise<PaginatedResult<WalletTransaction>> {
      return client.get('/wallet/transactions', { query });
    },

    myReviews(query?: PageQuery): Promise<PaginatedResult<Review>> {
      return client.get('/reviews/mine', { query });
    },

    submitReview(payload: ReviewPayload): Promise<Review> {
      return client.post('/reviews', payload);
    },

    notifications(query?: NotificationListQuery): Promise<NotificationFeed> {
      return client.get('/notifications', { query });
    },

    unreadCount(): Promise<{ unread: number }> {
      return client.get('/notifications/unread-count');
    },

    markRead(ids: string[]): Promise<{ updated: number }> {
      return client.patch('/notifications/read', { ids });
    },

    markAllRead(): Promise<{ updated: number }> {
      return client.patch('/notifications/read-all');
    },

    notificationPreferences(): Promise<{ preferences: Record<string, boolean> }> {
      return client.get('/notifications/preferences');
    },

    updateNotificationPreferences(
      preferences: Record<string, boolean>,
    ): Promise<{ preferences: Record<string, boolean> }> {
      return client.patch('/notifications/preferences', { preferences });
    },

    /**
     * Registers this device's FCM token.
     *
     * Called on every load rather than once at permission grant: tokens rotate
     * silently, and a stale token is an order update nobody receives.
     */
    registerDevice(payload: RegisterDevicePayload): Promise<{ registered: boolean }> {
      return client.post('/notifications/devices', payload);
    },

    unregisterDevice(token: string): Promise<void> {
      return client.delete('/notifications/devices', { body: { token } });
    },

    /**
     * Signs a direct-to-storage upload.
     *
     * Bytes never pass through the API: the client PUTs straight to object storage with
     * the returned URL and then submits only `publicUrl`.
     */
    presignUpload(payload: PresignPayload): Promise<PresignResult> {
      return client.post('/uploads/presign', payload);
    },

    supportTickets(query?: PageQuery & { status?: string }): Promise<
      PaginatedResult<TicketSummary>
    > {
      return client.get('/support/tickets', { query });
    },

    supportTicket(id: string): Promise<TicketDetail> {
      return client.get(`/support/tickets/${id}`);
    },

    createSupportTicket(payload: TicketPayload): Promise<TicketSummary> {
      return client.post('/support/tickets', payload);
    },

    replyToTicket(id: string, body: string): Promise<TicketDetail> {
      return client.post(`/support/tickets/${id}/messages`, { body });
    },
  };
}
