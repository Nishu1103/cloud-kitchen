import type {
  AuditLogEntry,
  Campus,
  Category,
  Coupon,
  DeliveryAssignment,
  DeliveryStatus,
  PaginatedResult,
  PublicUser,
  Review,
  Vendor,
  VendorStatus,
  WalletTransaction,
} from '@ck/types';
import type { ApiClient } from '../client';
import type {
  AdminDashboard,
  AdminUserPayload,
  AdminVendorPayload,
  Announcement,
  AnnouncementPayload,
  Banner,
  BannerPayload,
  CategoryPayload,
  CampusPayload,
  CampusUpdatePayload,
  CouponPayload,
  CouponUpdatePayload,
  DateRange,
  FeatureFlagView,
  OrderDetail,
  OrderListQuery,
  PageQuery,
  PagePayload,
  PeakHour,
  ReviewQuery,
  RolePayload,
  RoleUpdatePayload,
  RoleView,
  TicketDetail,
  TicketSummary,
  UserQuery,
  VendorDecisionPayload,
  WalletAdjustPayload,
  WalletBalance,
  Zone,
  ZonePayload,
} from '../contracts';

/**
 * Admin and super-admin surface.
 *
 * There is no separate super-admin client. The same calls are exposed and the API
 * decides per permission, so the portal only has to hide what the session cannot do —
 * which keeps authorisation in one place instead of two codebases.
 */
export function adminResource(client: ApiClient) {
  return {
    // ------------------------------------------------------------------- users
    users(query?: UserQuery): Promise<PaginatedResult<PublicUser>> {
      return client.get('/admin/users', { query });
    },

    user(id: string): Promise<PublicUser & { roleIds: string[]; permissions: string[] }> {
      return client.get(`/admin/users/${id}`);
    },

    updateUser(id: string, payload: AdminUserPayload): Promise<PublicUser> {
      return client.patch(`/admin/users/${id}`, payload);
    },

    // ----------------------------------------------------------------- vendors
    vendors(query?: PageQuery & { status?: VendorStatus }): Promise<PaginatedResult<Vendor>> {
      return client.get('/admin/vendors', { query });
    },

    vendor(id: string): Promise<Vendor> {
      return client.get(`/admin/vendors/${id}`);
    },

    /** Commercial terms only; the kitchen owns its own profile copy. */
    updateVendor(id: string, payload: AdminVendorPayload): Promise<Vendor> {
      return client.patch(`/admin/vendors/${id}`, payload);
    },

    /** Approves or rejects an application. A rejection must carry a reason. */
    decideVendor(id: string, payload: VendorDecisionPayload): Promise<Vendor> {
      return client.post(`/admin/vendors/${id}/decision`, payload);
    },

    // ------------------------------------------------------------------ orders
    orders(query?: OrderListQuery): Promise<PaginatedResult<OrderDetail>> {
      return client.get('/admin/orders', { query });
    },

    order(id: string): Promise<OrderDetail> {
      return client.get(`/admin/orders/${id}`);
    },

    cancelOrder(id: string, reason: string): Promise<OrderDetail> {
      return client.post(`/admin/orders/${id}/cancel`, { reason });
    },

    /** Partial refunds allowed; `amount` is paise and every call is audited. */
    refundOrder(
      id: string,
      amount: number,
      reason: string,
    ): Promise<{ refundId: string; amount: number }> {
      return client.post(`/admin/orders/${id}/refund`, { amount, reason }, { idempotent: true });
    },

    // ---------------------------------------------------------------- delivery
    deliveries(
      query?: PageQuery & { status?: DeliveryStatus },
    ): Promise<PaginatedResult<DeliveryAssignment>> {
      return client.get('/admin/delivery', { query });
    },

    assignDelivery(assignmentId: string, partnerId: string): Promise<DeliveryAssignment> {
      return client.post(`/admin/delivery/${assignmentId}/assign`, { partnerId });
    },

    // ----------------------------------------------------------------- coupons
    coupons(query?: PageQuery): Promise<PaginatedResult<Coupon>> {
      return client.get('/admin/coupons', { query });
    },

    createCoupon(payload: CouponPayload): Promise<Coupon> {
      return client.post('/admin/coupons', payload);
    },

    updateCoupon(id: string, payload: CouponUpdatePayload): Promise<Coupon> {
      return client.patch(`/admin/coupons/${id}`, payload);
    },

    // ------------------------------------------------------------------ wallet
    userWallet(userId: string): Promise<WalletBalance> {
      return client.get(`/admin/wallet/users/${userId}`);
    },

    userWalletTransactions(
      userId: string,
      query?: PageQuery,
    ): Promise<PaginatedResult<WalletTransaction>> {
      return client.get(`/admin/wallet/users/${userId}/transactions`, { query });
    },

    /** Credits or debits a wallet. Idempotent, because it moves money. */
    adjustWallet(userId: string, payload: WalletAdjustPayload): Promise<WalletTransaction> {
      return client.post(`/admin/wallet/users/${userId}/adjust`, payload, { idempotent: true });
    },

    // --------------------------------------------------------------- catalogue
    categories(): Promise<Category[]> {
      return client.get('/admin/categories');
    },

    createCategory(payload: CategoryPayload): Promise<Category> {
      return client.post('/admin/categories', payload);
    },

    // ----------------------------------------------------------------- reviews
    reviews(query?: ReviewQuery): Promise<PaginatedResult<Review>> {
      return client.get('/admin/reviews', { query });
    },

    moderateReview(id: string, isHidden: boolean, reason?: string): Promise<Review> {
      return client.patch(`/admin/reviews/${id}/moderate`, { isHidden, reason });
    },

    // --------------------------------------------------------------------- CMS
    pages(): Promise<{ slug: string; title: string; status: string; updatedAt: string }[]> {
      return client.get('/admin/content/pages');
    },

    upsertPage(payload: PagePayload): Promise<{ slug: string }> {
      return client.post('/admin/content/pages', payload);
    },

    deletePage(slug: string): Promise<void> {
      return client.delete(`/admin/content/pages/${slug}`);
    },

    banners(): Promise<Banner[]> {
      return client.get('/admin/content/banners');
    },

    createBanner(payload: BannerPayload): Promise<Banner> {
      return client.post('/admin/content/banners', payload);
    },

    updateBanner(id: string, payload: BannerPayload): Promise<Banner> {
      return client.patch(`/admin/content/banners/${id}`, payload);
    },

    deleteBanner(id: string): Promise<void> {
      return client.delete(`/admin/content/banners/${id}`);
    },

    // ----------------------------------------------------------------- support
    tickets(query?: PageQuery & { status?: string }): Promise<PaginatedResult<TicketSummary>> {
      return client.get('/admin/content/tickets', { query });
    },

    replyToTicket(id: string, body: string, resolve?: boolean): Promise<TicketDetail> {
      return client.post(`/admin/content/tickets/${id}/reply`, { body, resolve });
    },

    // ----------------------------------------------------------- announcements
    announcements(query?: PageQuery): Promise<PaginatedResult<Announcement>> {
      return client.get('/admin/announcements', { query });
    },

    createAnnouncement(payload: AnnouncementPayload): Promise<Announcement> {
      return client.post('/admin/announcements', payload);
    },

    /** Queues the fan-out; a campus-wide send is resolved by a worker. */
    sendAnnouncement(id: string): Promise<{ queued: boolean }> {
      return client.post(`/admin/announcements/${id}/send`);
    },

    // -------------------------------------------------------------------- RBAC
    /** The full permission catalogue, for building the role editor. */
    permissions(): Promise<string[]> {
      return client.get('/admin/roles/permissions');
    },

    roles(): Promise<RoleView[]> {
      return client.get('/admin/roles');
    },

    createRole(payload: RolePayload): Promise<RoleView> {
      return client.post('/admin/roles', payload);
    },

    updateRole(id: string, payload: RoleUpdatePayload): Promise<RoleView> {
      return client.patch(`/admin/roles/${id}`, payload);
    },

    deleteRole(id: string): Promise<void> {
      return client.delete(`/admin/roles/${id}`);
    },

    assignRoles(userId: string, roleIds: string[]): Promise<PublicUser> {
      return client.post(`/admin/roles/users/${userId}/assign`, { roleIds });
    },

    // ---------------------------------------------------------------- platform
    featureFlags(): Promise<FeatureFlagView[]> {
      return client.get('/admin/platform/feature-flags');
    },

    upsertFeatureFlag(payload: {
      key: string;
      enabled: boolean;
      rolloutPercent?: number;
      description?: string;
    }): Promise<FeatureFlagView> {
      return client.post('/admin/platform/feature-flags', payload);
    },

    settings(): Promise<Record<string, unknown>> {
      return client.get('/admin/platform/settings');
    },

    upsertSetting(payload: {
      key: string;
      value: unknown;
      isSensitive?: boolean;
    }): Promise<{ key: string }> {
      return client.post('/admin/platform/settings', payload);
    },

    // ---------------------------------------------------------------- campuses
    campuses(): Promise<Campus[]> {
      return client.get('/admin/campuses');
    },

    /** Super-admin only: onboarding a campus is configuration, not a deployment. */
    createCampus(payload: CampusPayload): Promise<Campus> {
      return client.post('/admin/campuses', payload);
    },

    currentCampus(): Promise<Campus> {
      return client.get('/admin/campuses/current');
    },

    updateCampus(id: string, payload: CampusUpdatePayload): Promise<Campus> {
      return client.patch(`/admin/campuses/${id}`, payload);
    },

    zones(): Promise<Zone[]> {
      return client.get('/admin/campuses/current/zones');
    },

    createZone(payload: ZonePayload): Promise<Zone> {
      return client.post('/admin/campuses/current/zones', payload);
    },

    updateZone(id: string, payload: Partial<ZonePayload>): Promise<Zone> {
      return client.patch(`/admin/campuses/current/zones/${id}`, payload);
    },

    // --------------------------------------------------------------- analytics
    dashboard(range?: DateRange): Promise<AdminDashboard> {
      return client.get('/admin/analytics/dashboard', { query: range });
    },

    peakHours(range?: DateRange): Promise<PeakHour[]> {
      return client.get('/admin/analytics/peak-hours', { query: range });
    },

    // -------------------------------------------------------------- audit trail
    auditLogs(query?: PageQuery & { actorId?: string; action?: string }): Promise<
      PaginatedResult<AuditLogEntry>
    > {
      return client.get('/admin/audit-logs', { query });
    },
  };
}
