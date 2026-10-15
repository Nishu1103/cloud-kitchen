import type { Permission } from './permissions';
import type { Portal, SystemRole } from './roles';
import type {
  CouponType,
  DeliveryStatus,
  DietType,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  ProductFlag,
  UserStatus,
  VendorStatus,
  WalletTxnType,
} from './enums';
import type { NotificationCategory, NotificationType } from './notifications';

/**
 * All money is integer paise. Floats are never used for currency anywhere in the
 * platform - not in the DB, not on the wire, not in the UI layer.
 */
export type Paise = number;
export type ISODateString = string;
export type ObjectIdString = string;

export interface Money {
  amount: Paise;
  currency: 'INR';
}

export interface GeoPoint {
  type: 'Point';
  /** [longitude, latitude] - GeoJSON order, not lat/lng. */
  coordinates: [number, number];
}

export interface Address {
  id?: ObjectIdString;
  label: string;
  line1: string;
  line2?: string;
  hostel?: string;
  roomNumber?: string;
  landmark?: string;
  campusZoneId?: ObjectIdString;
  contactName: string;
  contactPhone: string;
  location?: GeoPoint;
  isDefault?: boolean;
}

export interface PublicUser {
  id: ObjectIdString;
  campusId: ObjectIdString;
  name: string;
  email: string;
  emailVerified: boolean;
  phone?: string;
  phoneVerified: boolean;
  avatarUrl?: string;
  status: UserStatus;
  roles: SystemRole[];
  permissions: Permission[];
  locale: string;
  createdAt: ISODateString;
}

export interface SessionUser extends PublicUser {
  portal: Portal;
  vendorId?: ObjectIdString;
  loyaltyPoints: number;
  walletBalance: Paise;
}

export interface Campus {
  id: ObjectIdString;
  slug: string;
  name: string;
  city: string;
  timezone: string;
  currency: 'INR';
  logoUrl?: string;
  themeColor?: string;
  emailDomains: string[];
  isActive: boolean;
  supportEmail?: string;
  supportPhone?: string;
}

export interface OperatingHours {
  /** 0 = Sunday. */
  day: number;
  open: string;
  close: string;
  isClosed: boolean;
}

export interface Vendor {
  id: ObjectIdString;
  campusId: ObjectIdString;
  slug: string;
  name: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  coverUrl?: string;
  cuisines: string[];
  status: VendorStatus;
  isOpen: boolean;
  acceptsDelivery: boolean;
  acceptsPickup: boolean;
  rating: number;
  ratingCount: number;
  avgPrepMinutes: number;
  minOrderAmount: Paise;
  packagingFee: Paise;
  deliveryFee: Paise;
  commissionPercent: number;
  operatingHours: OperatingHours[];
  location?: GeoPoint;
  themeColor?: string;
  ownerId?: ObjectIdString;
  contactName?: string;
  contactPhone?: string;
  rejectionReason?: string;
  approvedAt?: ISODateString;
  totalOrders?: number;
  lifetimeRevenue?: Paise;
  pendingSettlement?: Paise;
  createdAt?: ISODateString;
}

export interface Category {
  id: ObjectIdString;
  campusId: ObjectIdString;
  vendorId?: ObjectIdString;
  name: string;
  slug: string;
  iconUrl?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductOptionChoice {
  id: string;
  name: string;
  priceDelta: Paise;
  isAvailable: boolean;
}

export interface ProductOptionGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  required: boolean;
  choices: ProductOptionChoice[];
}

export interface Product {
  id: ObjectIdString;
  campusId: ObjectIdString;
  vendorId: ObjectIdString;
  categoryId?: ObjectIdString;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  basePrice: Paise;
  compareAtPrice?: Paise;
  diet: DietType;
  spiceLevel?: 0 | 1 | 2 | 3;
  flags: ProductFlag[];
  tags: string[];
  optionGroups: ProductOptionGroup[];
  isAvailable: boolean;
  stockQuantity?: number;
  lowStockThreshold?: number;
  prepMinutes: number;
  rating: number;
  ratingCount: number;
  availableFrom?: string;
  availableTo?: string;
  sortOrder: number;
}

export interface CartLineOption {
  groupId: string;
  groupName: string;
  choiceId: string;
  choiceName: string;
  priceDelta: Paise;
}

export interface CartLine {
  id: string;
  productId: ObjectIdString;
  name: string;
  imageUrl?: string;
  unitPrice: Paise;
  quantity: number;
  options: CartLineOption[];
  notes?: string;
  lineTotal: Paise;
}

export interface PriceBreakdown {
  itemsTotal: Paise;
  packagingFee: Paise;
  deliveryFee: Paise;
  discount: Paise;
  walletApplied: Paise;
  taxTotal: Paise;
  grandTotal: Paise;
  payableNow: Paise;
}

export interface Cart {
  id: ObjectIdString;
  vendorId?: ObjectIdString;
  vendorName?: string;
  lines: CartLine[];
  couponCode?: string;
  breakdown: PriceBreakdown;
  updatedAt: ISODateString;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  at: ISODateString;
  byUserId?: ObjectIdString;
  note?: string;
}

export interface Order {
  id: ObjectIdString;
  code: string;
  campusId: ObjectIdString;
  customerId: ObjectIdString;
  customerName?: string;
  vendorId: ObjectIdString;
  vendorName?: string;
  type: OrderType;
  status: OrderStatus;
  lines: CartLine[];
  breakdown: PriceBreakdown;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  address?: Address;
  scheduledFor?: ISODateString;
  instructions?: string;
  timeline: OrderStatusEvent[];
  deliveryAssignmentId?: ObjectIdString;
  etaMinutes?: number;
  cancelReason?: string;
  ratedAt?: ISODateString;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface DeliveryAssignment {
  id: ObjectIdString;
  campusId: ObjectIdString;
  orderId: ObjectIdString;
  orderCode: string;
  partnerId?: ObjectIdString;
  status: DeliveryStatus;
  /** Both ends carry the same shape: who to find, where, and how to reach them. */
  pickup: DeliveryEndpoint;
  drop: DeliveryEndpoint;
  earning: Paise;
  /** Cash to collect at the door; 0 when the order is already paid. */
  collectCash: Paise;
  itemCount: number;
  distanceMeters?: number;
  offeredAt?: ISODateString;
  acceptedAt?: ISODateString;
  arrivedAtVendorAt?: ISODateString;
  pickedUpAt?: ISODateString;
  deliveredAt?: ISODateString;
  failureReason?: string;
  /** Wrong handover codes so far. The API refuses the delivery after five. */
  otpAttempts: number;
  lastKnownLocation?: GeoPoint;
  lastLocationAt?: ISODateString;
  createdAt: ISODateString;
}

export interface DeliveryEndpoint {
  name: string;
  address: string;
  /** Hostel or block. Shown in the open pool, where the full address is withheld. */
  area?: string;
  phone?: string;
  location?: GeoPoint;
}

/**
 * A job in the open pool, as shown to every online partner.
 *
 * Deliberately not a `DeliveryAssignment`: the customer's name, phone and room number
 * appear only after someone accepts, so an idle partner watching the pool cannot
 * harvest addresses. `dropArea` is the hostel or block, which is all that is needed
 * to judge the trip.
 */
export interface DeliveryOffer {
  id: ObjectIdString;
  orderCode: string;
  pickup: { name: string; address: string; location?: GeoPoint };
  dropArea: string;
  earning: Paise;
  collectCash: Paise;
  itemCount: number;
  distanceMeters?: number;
  offeredAt?: ISODateString;
}

/** The rider's own record: availability, capacity and running totals. */
export interface DeliveryProfileSummary {
  today: { amount: Paise; deliveries: number };
  lifetime: Paise;
  /** Earned but not yet paid out by the campus. */
  unsettled: Paise;
  completedDeliveries: number;
  rating: number;
  isOnline: boolean;
}

export interface WalletTransaction {
  id: ObjectIdString;
  type: WalletTxnType;
  amount: Paise;
  balanceAfter: Paise;
  description: string;
  orderId?: ObjectIdString;
  createdAt: ISODateString;
}

export interface Coupon {
  id: ObjectIdString;
  code: string;
  title: string;
  description?: string;
  type: CouponType;
  value: number;
  maxDiscount?: Paise;
  minOrderAmount: Paise;
  vendorId?: ObjectIdString;
  validFrom: ISODateString;
  validTo: ISODateString;
  usageLimitTotal?: number;
  usageLimitPerUser?: number;
  usedCount: number;
  isActive: boolean;
}

export interface Review {
  id: ObjectIdString;
  orderId: ObjectIdString;
  vendorId: ObjectIdString;
  productIds: ObjectIdString[];
  customerName: string;
  rating: number;
  comment?: string;
  vendorReply?: string;
  isHidden: boolean;
  createdAt: ISODateString;
}

export interface AppNotification {
  id: ObjectIdString;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  body: string;
  imageUrl?: string;
  deepLink?: string;
  data?: Record<string, string>;
  readAt?: ISODateString;
  createdAt: ISODateString;
}

export interface AuditLogEntry {
  id: ObjectIdString;
  campusId?: ObjectIdString;
  actorId?: ObjectIdString;
  actorEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
  outcome: 'success' | 'failure';
  metadata?: Record<string, unknown>;
  createdAt: ISODateString;
}
