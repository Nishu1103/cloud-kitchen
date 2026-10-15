import type {
  Address,
  AppNotification,
  Cart,
  CouponType,
  DeliveryStatus,
  DevicePlatform,
  DietType,
  FeatureFlagKey,
  Order,
  OrderStatus,
  OrderType,
  Paise,
  PaymentMethod,
  PaymentStatus,
  Portal,
  PriceBreakdown,
  Product,
  ProductFlag,
  SessionUser,
  UserStatus,
  Vendor,
  VendorStatus,
} from '@ck/types';

/**
 * Request payloads and response envelopes for the HTTP layer.
 *
 * These mirror the API's DTOs field for field. That is not stylistic: validation runs
 * with `forbidNonWhitelisted`, so an invented or renamed field here becomes a 422 at
 * runtime rather than a type error at build time. Domain entities are imported from
 * `@ck/types` instead of being restated.
 */

/** Every list endpoint accepts these. */
export interface PageQuery {
  page?: number;
  limit?: number;
  /** Field name, `-` prefixed for descending. Allowlisted server-side. */
  sort?: string;
  search?: string;
}

// ---------------------------------------------------------------------------- auth

export interface LoginPayload {
  email: string;
  password: string;
  campusSlug: string;
  /** Defaults to the client's own portal; the session is bound to it. */
  portal?: Portal;
  deviceLabel?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  campusSlug: string;
  phone?: string;
  referralCode?: string;
}

export interface AuthSession {
  user: SessionUser;
  /** Only for clients that cannot use cookies (native wrappers). */
  accessToken?: string;
  expiresIn?: number;
}

export interface SessionSummary {
  id: string;
  deviceLabel?: string;
  ip?: string;
  userAgent?: string;
  portal: Portal;
  createdAt: string;
  lastUsedAt?: string;
  current: boolean;
}

// ------------------------------------------------------------------------- catalog

export interface BrowseProductsQuery extends PageQuery {
  vendorId?: string;
  categoryId?: string;
  diet?: DietType;
  flag?: ProductFlag;
  maxPrice?: Paise;
  sortBy?: string;
}

export interface BrowseVendorsQuery extends PageQuery {
  cuisine?: string;
  openOnly?: boolean;
  sortBy?: string;
}

/**
 * A dish as it appears in browse and search, carrying the kitchen that sells it so a
 * result can be navigated to and its availability judged without a second call.
 */
export interface BrowseProduct extends Product {
  vendor?: Pick<Vendor, 'id' | 'name' | 'slug' | 'logoUrl' | 'isOpen' | 'avgPrepMinutes'>;
}

export interface MenuSection {
  category: { id: string; name: string; slug: string };
  products: Product[];
}

export interface VendorMenu {
  vendor: Vendor;
  sections: MenuSection[];
}

export interface OptionChoicePayload {
  id: string;
  name: string;
  priceDelta: Paise;
  isAvailable?: boolean;
}

export interface OptionGroupPayload {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  required?: boolean;
  choices: OptionChoicePayload[];
}

export interface ProductPayload {
  name: string;
  diet: DietType;
  basePrice: Paise;
  description?: string;
  categoryId?: string;
  imageUrl?: string;
  /** Shown struck through beside `basePrice`; must be higher to display. */
  compareAtPrice?: Paise;
  spiceLevel?: number;
  flags?: ProductFlag[];
  tags?: string[];
  optionGroups?: OptionGroupPayload[];
  prepMinutes?: number;
  /** `null` means untracked stock; `0` marks it sold out. */
  stockQuantity?: number | null;
  lowStockThreshold?: number;
  availableFrom?: string;
  availableTo?: string;
  sortOrder?: number;
  isAvailable?: boolean;
}

export interface ToggleFlagsPayload {
  productIds: string[];
  flag: ProductFlag;
  enabled: boolean;
}

export interface StockPayload {
  stockQuantity?: number | null;
  isAvailable?: boolean;
}

export interface CategoryPayload {
  name: string;
  slug: string;
  iconUrl?: string;
  sortOrder?: number;
}

// ---------------------------------------------------------------------------- cart

export interface AddCartLinePayload {
  vendorId: string;
  productId: string;
  quantity: number;
  choiceIds?: string[];
  notes?: string;
  orderType?: OrderType;
  /** A cart holds one kitchen at a time; set this to discard the existing one. */
  replaceCart?: boolean;
}

export interface UpdateCartLinePayload {
  /** `0` removes the line. */
  quantity: number;
  notes?: string;
  orderType?: OrderType;
}

/**
 * The cart as the API returns it: one flat object, with the server's own pricing
 * attached. An empty cart is still a cart - it has an id and a zeroed breakdown - so
 * this is never null and screens can read `lines.length` without a guard.
 */
export type CartView = Cart;

// --------------------------------------------------------------------------- order

export interface PlaceOrderPayload {
  vendorId: string;
  lines: {
    productId: string;
    quantity: number;
    choiceIds?: string[];
    notes?: string;
  }[];
  type: OrderType;
  paymentMethod: PaymentMethod;
  addressId?: string;
  couponCode?: string;
  applyWallet?: boolean;
  instructions?: string;
  scheduledFor?: string;
}

export interface PlaceOrderResult {
  orderId: string;
  code: string;
  status: OrderStatus;
  breakdown: PriceBreakdown;
  /** Returned once, at creation, for the customer to show at handover. */
  handoverOtp?: string;
  payment: {
    paymentId: string;
    providerOrderId?: string;
    publicKey?: string;
    amount: Paise;
    /** True when nothing further is needed (wallet or cash). */
    settled: boolean;
  };
}

export interface OrderListQuery extends PageQuery {
  status?: OrderStatus;
  /** Vendor and delivery boards ask only for orders still in motion. */
  live?: boolean;
}

/** Order plus the joined records the tracking and operator screens need. */
export interface OrderDetail extends Order {
  vendor?: Pick<Vendor, 'id' | 'name' | 'logoUrl' | 'slug'>;
  customer?: { id: string; name: string; phone?: string };
  deliveryPartner?: { id: string; name: string; phone?: string };
}

// ------------------------------------------------------------------------ payments

/**
 * Confirms a gateway checkout.
 *
 * No signature is sent: the client is not trusted to prove payment. The API verifies
 * the charge with the provider (and via the signed webhook) before releasing the order.
 */
export interface ConfirmPaymentPayload {
  paymentId: string;
  providerPaymentId: string;
}

export interface PaymentView {
  paymentId: string;
  orderId: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amount: Paise;
  provider?: string;
  providerOrderId?: string;
  refundedAmount?: Paise;
  createdAt: string;
}

// -------------------------------------------------------------------------- wallet

export interface WalletBalance {
  balance: Paise;
  currency: 'INR';
  locked?: Paise;
}

export interface WalletAdjustPayload {
  /** Negative debits. Both directions are audited. */
  amount: Paise;
  reason: string;
}

// ------------------------------------------------------------------- notifications

export interface NotificationListQuery extends PageQuery {
  unreadOnly?: boolean;
  category?: string;
}

export interface NotificationFeed {
  items: AppNotification[];
  page: number;
  limit: number;
  total: number;
  unread: number;
}

export interface RegisterDevicePayload {
  token: string;
  platform: DevicePlatform;
  browser?: string;
  deviceLabel?: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  deepLink?: string;
  audiences: string[];
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  scheduledFor?: string;
  sentAt?: string;
  /** Recipients the send fanned out to; `0` until it has run. */
  recipientCount: number;
  pushSuccessCount: number;
  pushFailureCount: number;
  createdAt: string;
}

export interface AnnouncementPayload {
  title: string;
  body: string;
  imageUrl?: string;
  deepLink?: string;
  /** Audience keys: `student`, `vendor`, `delivery`, `admin`, `everyone`. */
  audiences: string[];
  scheduledFor?: string;
  sendNow?: boolean;
}

// -------------------------------------------------------------------------- vendor

export interface OperatingHourPayload {
  /** 0 = Sunday. */
  day: number;
  open: string;
  close: string;
  isClosed?: boolean;
}

export interface VendorProfilePayload {
  name?: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  coverUrl?: string;
  cuisines?: string[];
  acceptsDelivery?: boolean;
  acceptsPickup?: boolean;
  avgPrepMinutes?: number;
  minOrderAmount?: Paise;
  packagingFee?: Paise;
  operatingHours?: OperatingHourPayload[];
  themeColor?: string;
  contactPhone?: string;
}

export interface VendorOnboardingPayload {
  name: string;
  slug: string;
  cuisines: string[];
  tagline?: string;
  description?: string;
  contactPhone?: string;
  contactName?: string;
}

export interface VendorDecisionPayload {
  status: VendorStatus;
  /** Shown to the applicant, so a rejection has to explain itself. */
  reason?: string;
}

export interface AdminVendorPayload {
  commissionPercent?: number;
  deliveryFee?: Paise;
  sortWeight?: number;
}

// ------------------------------------------------------------------------ delivery

export interface DeliveryStatusPayload {
  status: DeliveryStatus;
  /** Required at handover; verified server-side against the order. */
  otp?: string;
  /** `[longitude, latitude]`, GeoJSON order. */
  location?: [number, number];
  /** Only read for a failed delivery: what the admin reviewing the refund will see. */
  failureReason?: string;
}

/**
 * Broadcast to every online partner on the campus when a job opens.
 *
 * A teaser, not the job: enough to decide whether to take it, with the addresses and
 * phone numbers only arriving on the assignment once it has been accepted.
 */
export interface DeliveryOfferEvent {
  assignmentId: string;
  orderCode: string;
  pickup: string;
  drop: string;
  earning: Paise;
  collectCash: Paise;
}

// -------------------------------------------------------------------------- coupon

export interface CouponPayload {
  code: string;
  title: string;
  type: CouponType;
  value: number;
  validFrom: string;
  validTo: string;
  description?: string;
  maxDiscount?: Paise;
  minOrderAmount?: Paise;
  usageLimitTotal?: number;
  usageLimitPerUser?: number;
  firstOrderOnly?: boolean;
  restrictedToUserIds?: string[];
}

export interface CouponUpdatePayload {
  title?: string;
  description?: string;
  isActive?: boolean;
  usageLimitTotal?: number;
  validTo?: string;
}

// -------------------------------------------------------------------------- review

export interface ReviewPayload {
  orderId: string;
  rating: number;
  productId?: string;
  foodRating?: number;
  deliveryRating?: number;
  comment?: string;
  images?: string[];
  anonymous?: boolean;
}

export interface ReviewQuery extends PageQuery {
  rating?: number;
  hidden?: boolean;
}

// --------------------------------------------------------------------------- users

export interface ProfilePayload {
  name?: string;
  phone?: string;
  avatarUrl?: string;
}

export interface UserPreferencesPayload {
  locale?: string;
  dietaryPreference?: string;
  marketingOptIn?: boolean;
}

export interface AddressPayload {
  label: string;
  hostel?: string;
  roomNumber?: string;
  landmark?: string;
  contactName?: string;
  contactPhone?: string;
  campusZoneId?: string;
  /** `[longitude, latitude]`, matching GeoJSON and the API's 2dsphere index. */
  coordinates?: [number, number];
  isDefault?: boolean;
}

export interface AdminUserPayload {
  status?: UserStatus;
  statusReason?: string;
  name?: string;
}

export interface UserQuery extends PageQuery {
  status?: UserStatus;
}

// ----------------------------------------------------------------------------- CMS

export interface PagePayload {
  slug: string;
  title: string;
  contentHtml: string;
  status?: string;
  metaDescription?: string;
}

/** Slots a banner can occupy; the API rejects anything else. */
export const BANNER_PLACEMENTS = ['home_hero', 'home_strip', 'vendor_top', 'checkout'] as const;
export type BannerPlacement = (typeof BANNER_PLACEMENTS)[number];

export interface BannerPayload {
  title: string;
  imageUrl: string;
  placement: BannerPlacement;
  subtitle?: string;
  deepLink?: string;
  sortOrder?: number;
  isActive?: boolean;
  startsAt?: string;
  endsAt?: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  deepLink?: string;
  placement: BannerPlacement;
  sortOrder: number;
  isActive: boolean;
}

export interface CmsPage {
  slug: string;
  title: string;
  contentHtml: string;
  metaDescription?: string;
  updatedAt: string;
}

// ------------------------------------------------------------------------- support

export interface TicketPayload {
  subject: string;
  category: string;
  message: string;
  orderId?: string;
}

export interface TicketSummary {
  id: string;
  subject: string;
  category: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TicketDetail extends TicketSummary {
  messages: { id: string; body: string; authorRole: string; createdAt: string }[];
}

// ---------------------------------------------------------------------------- RBAC

export interface RolePayload {
  slug: string;
  name: string;
  permissions: string[];
  description?: string;
}

export interface RoleUpdatePayload {
  name?: string;
  description?: string;
  permissions?: string[];
}

export interface RoleView {
  id: string;
  slug: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  userCount?: number;
}

// -------------------------------------------------------------------------- campus

export interface CampusBrandingPayload {
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  tagline?: string;
}

export interface CampusPayload {
  name: string;
  slug: string;
  city: string;
  timezone?: string;
  supportEmail?: string;
  branding?: CampusBrandingPayload;
  isActive?: boolean;
}

export interface CampusUpdatePayload {
  name?: string;
  city?: string;
  supportEmail?: string;
  branding?: CampusBrandingPayload;
  isActive?: boolean;
}

export interface ZonePayload {
  name: string;
  deliveryFee: Paise;
  etaMinutes: number;
  polygon?: number[][];
  isActive?: boolean;
  minOrderValue?: Paise;
}

export interface Zone {
  id: string;
  name: string;
  deliveryFee: Paise;
  etaMinutes: number;
  isActive: boolean;
  minOrderValue?: Paise;
}

// ------------------------------------------------------------------------ platform

export interface FeatureFlagView {
  key: FeatureFlagKey | string;
  enabled: boolean;
  rolloutPercent?: number;
  description?: string;
  updatedAt?: string;
}

export interface Bootstrap {
  flags: Record<string, boolean>;
  settings: Record<string, unknown>;
}

// ----------------------------------------------------------------------- analytics

export interface DateRange {
  from?: string;
  to?: string;
}

export interface AnalyticsRange {
  from: string;
  to: string;
}

/** Every amount is integer paise, as everywhere else on the wire. */
export interface VendorDashboard {
  range: AnalyticsRange;
  totals: {
    orders: number;
    revenue: Paise;
    /** Revenue less commission - what the kitchen is actually owed. */
    payout: Paise;
    averageOrderValue: Paise;
    cancelled: number;
    /** Placed, accepted, preparing or ready right now. */
    liveOrders: number;
  };
  /** Sparse: a status with no orders in the range is absent, not zero. */
  byStatus: Partial<Record<OrderStatus, number>>;
  timeline: { date: string; orders: number; revenue: Paise }[];
  topItems: { productId: string; name: string; quantity: number; revenue: Paise }[];
}

export interface AdminDashboard {
  range: AnalyticsRange;
  totals: {
    orders: number;
    gmv: Paise;
    /** Commission earned by the platform, not the kitchens' share. */
    platformRevenue: Paise;
    averageOrderValue: Paise;
    newUsers: number;
    activeUsers: number;
    pendingVendors: number;
    lowStockProducts: number;
  };
  timeline: { date: string; orders: number; gmv: Paise }[];
  topVendors: { vendorId: string; name: string; orders: number; gmv: Paise }[];
  paymentMix: { method: string; count: number; amount: Paise }[];
  usersByStatus: Record<string, number>;
  vendorsByStatus: Record<string, number>;
}

export interface PeakHour {
  /** 0-23 in campus time; all 24 are always present. */
  hour: number;
  orders: number;
  gmv: Paise;
}

// ------------------------------------------------------------------------- uploads

export type UploadPurpose =
  | 'avatar'
  | 'product'
  | 'vendor'
  | 'review'
  | 'document'
  | 'kitchen'
  | 'menu'
  | 'banner';

export interface PresignPayload {
  purpose: UploadPurpose;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  byteLength: number;
}

export interface PresignResult {
  uploadUrl: string;
  /** Where the object is readable once the PUT succeeds. */
  publicUrl: string;
  key: string;
  expiresInSeconds: number;
  /**
   * Must be sent verbatim on the PUT. The signature covers them, so a browser that
   * lets the runtime pick a different `Content-Type` gets a 403 from storage.
   */
  requiredHeaders: Record<string, string>;
}

export type { Address };
