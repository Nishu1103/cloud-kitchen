import type {
  Category,
  Coupon,
  OrderStatus,
  PaginatedResult,
  Product,
  Review,
  Vendor,
} from '@ck/types';
import type { ApiClient } from '../client';
import type {
  Announcement,
  AnnouncementPayload,
  CategoryPayload,
  CouponPayload,
  CouponUpdatePayload,
  DateRange,
  OrderDetail,
  OrderListQuery,
  PageQuery,
  PeakHour,
  ProductPayload,
  ReviewQuery,
  StockPayload,
  ToggleFlagsPayload,
  VendorDashboard,
  VendorOnboardingPayload,
  VendorProfilePayload,
} from '../contracts';

/** Everything the kitchen portal calls. */
export function vendorResource(client: ApiClient) {
  return {
    profile(): Promise<Vendor> {
      return client.get('/vendor/profile');
    },

    updateProfile(payload: VendorProfilePayload): Promise<Vendor> {
      return client.patch('/vendor/profile', payload);
    },

    /** The kitchen's own switch, independent of its scheduled operating hours. */
    setOpenState(isOpen: boolean): Promise<Vendor> {
      return client.patch('/vendor/profile/open-state', { isOpen });
    },

    submitOnboarding(payload: VendorOnboardingPayload): Promise<Vendor> {
      return client.post('/vendor/onboarding', payload);
    },

    orders(query?: OrderListQuery): Promise<PaginatedResult<OrderDetail>> {
      return client.get('/vendor/orders', { query });
    },

    order(id: string): Promise<OrderDetail> {
      return client.get(`/vendor/orders/${id}`);
    },

    /**
     * Advances an order.
     *
     * Transitions are validated server-side against a forward-only map, so a board left
     * open on a stale state gets `INVALID_TRANSITION` instead of corrupting the timeline.
     */
    updateOrderStatus(
      id: string,
      status: OrderStatus,
      note?: string,
    ): Promise<OrderDetail> {
      return client.patch(`/vendor/orders/${id}/status`, { status, note });
    },

    products(query?: PageQuery & { categoryId?: string }): Promise<PaginatedResult<Product>> {
      return client.get('/vendor/menu/products', { query });
    },

    createProduct(payload: ProductPayload): Promise<Product> {
      return client.post('/vendor/menu/products', payload);
    },

    updateProduct(id: string, payload: ProductPayload): Promise<Product> {
      return client.patch(`/vendor/menu/products/${id}`, payload);
    },

    deleteProduct(id: string): Promise<void> {
      return client.delete(`/vendor/menu/products/${id}`);
    },

    /** Flips one flag across many products at once (today's special, hidden, combo). */
    toggleFlags(payload: ToggleFlagsPayload): Promise<{ updated: number }> {
      return client.patch('/vendor/menu/products/flags', payload);
    },

    setStock(id: string, payload: StockPayload): Promise<Product> {
      return client.patch(`/vendor/menu/products/${id}/stock`, payload);
    },

    categories(): Promise<Category[]> {
      return client.get('/vendor/menu/categories');
    },

    createCategory(payload: CategoryPayload): Promise<Category> {
      return client.post('/vendor/menu/categories', payload);
    },

    coupons(query?: PageQuery): Promise<PaginatedResult<Coupon>> {
      return client.get('/vendor/coupons', { query });
    },

    createCoupon(payload: CouponPayload): Promise<Coupon> {
      return client.post('/vendor/coupons', payload);
    },

    updateCoupon(id: string, payload: CouponUpdatePayload): Promise<Coupon> {
      return client.patch(`/vendor/coupons/${id}`, payload);
    },

    reviews(query?: ReviewQuery): Promise<PaginatedResult<Review>> {
      return client.get('/vendor/reviews', { query });
    },

    replyToReview(id: string, reply: string): Promise<Review> {
      return client.post(`/vendor/reviews/${id}/reply`, { reply });
    },

    dashboard(range?: DateRange): Promise<VendorDashboard> {
      return client.get('/vendor/analytics/dashboard', { query: range });
    },

    peakHours(range?: DateRange): Promise<PeakHour[]> {
      return client.get('/vendor/analytics/peak-hours', { query: range });
    },

    announcements(query?: PageQuery): Promise<PaginatedResult<Announcement>> {
      return client.get('/vendor/announcements', { query });
    },

    /**
     * Promotional push from the kitchen.
     *
     * The API enforces a daily quota per vendor. Order updates are unlimited; marketing
     * is not, because students mute a kitchen that spams them.
     */
    createAnnouncement(payload: AnnouncementPayload): Promise<Announcement> {
      return client.post('/vendor/announcements', payload);
    },

    /** Queues the fan-out; recipients are resolved by a worker, not in this request. */
    sendAnnouncement(id: string): Promise<{ queued: boolean }> {
      return client.post(`/vendor/announcements/${id}/send`);
    },
  };
}
