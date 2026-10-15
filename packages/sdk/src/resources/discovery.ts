import type {
  Campus,
  Category,
  Coupon,
  PaginatedResult,
  Review,
  Vendor,
} from '@ck/types';
import type { ApiClient } from '../client';
import type {
  Banner,
  BannerPlacement,
  Bootstrap,
  BrowseProduct,
  BrowseProductsQuery,
  BrowseVendorsQuery,
  CmsPage,
  PageQuery,
  VendorMenu,
} from '../contracts';

/**
 * Public, tenant-scoped reads: campuses, kitchens, menus, CMS content.
 *
 * These are the only calls that work unauthenticated, and they resolve their tenant
 * from the campus slug the client attaches, never from a signed-in user.
 */
export function discoveryResource(client: ApiClient) {
  return {
    campuses(): Promise<Campus[]> {
      return client.get('/campuses');
    },

    campus(slug: string): Promise<Campus> {
      return client.get(`/campuses/${slug}`, { campusSlug: slug });
    },

    /** Feature flags and public settings; the first authenticated call every app makes. */
    bootstrap(): Promise<Bootstrap> {
      return client.get('/platform/bootstrap');
    },

    vendors(query?: BrowseVendorsQuery): Promise<PaginatedResult<Vendor>> {
      return client.get('/vendors', { query });
    },

    vendor(slug: string): Promise<Vendor> {
      return client.get(`/vendors/${slug}`);
    },

    vendorMenu(vendorId: string): Promise<VendorMenu> {
      return client.get(`/catalog/vendors/${vendorId}/menu`);
    },

    products(query?: BrowseProductsQuery): Promise<PaginatedResult<BrowseProduct>> {
      return client.get('/catalog/products', { query });
    },

    categories(): Promise<Category[]> {
      return client.get('/catalog/categories');
    },

    coupons(vendorId?: string): Promise<Coupon[]> {
      return client.get('/coupons', { query: { vendorId } });
    },

    vendorReviews(vendorId: string, query?: PageQuery): Promise<PaginatedResult<Review>> {
      return client.get(`/reviews/vendor/${vendorId}`, { query });
    },

    productReviews(productId: string, query?: PageQuery): Promise<PaginatedResult<Review>> {
      return client.get(`/reviews/product/${productId}`, { query });
    },

    page(slug: string): Promise<CmsPage> {
      return client.get(`/content/pages/${slug}`);
    },

    /** Placement is required: a banner belongs to a slot, not to the page in general. */
    banners(placement: BannerPlacement): Promise<Banner[]> {
      return client.get('/content/banners', { query: { placement } });
    },
  };
}
