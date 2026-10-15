export const USER_STATUS = {
  PENDING_VERIFICATION: 'pending_verification',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DEACTIVATED: 'deactivated',
  /** Personal data erased on request; the row stays for order accounting. */
  DELETED: 'deleted',
} as const;
export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export const VENDOR_STATUS = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
} as const;
export type VendorStatus = (typeof VENDOR_STATUS)[keyof typeof VENDOR_STATUS];

/**
 * Forward-only order lifecycle. Terminal states accept no further transitions.
 * Guarded server-side by ORDER_TRANSITIONS - clients never decide the next state.
 */
export const ORDER_STATUS = {
  DRAFT: 'draft',
  AWAITING_PAYMENT: 'awaiting_payment',
  PLACED: 'placed',
  ACCEPTED: 'accepted',
  PREPARING: 'preparing',
  READY: 'ready',
  PICKED_UP: 'picked_up',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  REFUNDED: 'refunded',
} as const;
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  [ORDER_STATUS.DRAFT]: [ORDER_STATUS.AWAITING_PAYMENT, ORDER_STATUS.PLACED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.AWAITING_PAYMENT]: [ORDER_STATUS.PLACED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PLACED]: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.REJECTED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.ACCEPTED]: [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PREPARING]: [ORDER_STATUS.READY, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.READY]: [ORDER_STATUS.PICKED_UP, ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PICKED_UP]: [ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.REFUNDED],
  [ORDER_STATUS.COMPLETED]: [ORDER_STATUS.REFUNDED],
  [ORDER_STATUS.CANCELLED]: [ORDER_STATUS.REFUNDED],
  [ORDER_STATUS.REJECTED]: [ORDER_STATUS.REFUNDED],
  [ORDER_STATUS.REFUNDED]: [],
};

export const ORDER_TYPE = {
  DELIVERY: 'delivery',
  PICKUP: 'pickup',
  DINE_IN: 'dine_in',
} as const;
export type OrderType = (typeof ORDER_TYPE)[keyof typeof ORDER_TYPE];

export const PAYMENT_METHOD = {
  UPI: 'upi',
  CARD: 'card',
  NETBANKING: 'netbanking',
  WALLET: 'wallet',
  CASH_ON_DELIVERY: 'cod',
  MEAL_PASS: 'meal_pass',
} as const;
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

export const PAYMENT_STATUS = {
  CREATED: 'created',
  PENDING: 'pending',
  AUTHORIZED: 'authorized',
  CAPTURED: 'captured',
  FAILED: 'failed',
  REFUND_PENDING: 'refund_pending',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
} as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const DELIVERY_STATUS = {
  UNASSIGNED: 'unassigned',
  OFFERED: 'offered',
  ASSIGNED: 'assigned',
  ARRIVED_AT_VENDOR: 'arrived_at_vendor',
  PICKED_UP: 'picked_up',
  ARRIVED_AT_CUSTOMER: 'arrived_at_customer',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;
export type DeliveryStatus = (typeof DELIVERY_STATUS)[keyof typeof DELIVERY_STATUS];

export const WALLET_TXN_TYPE = {
  TOPUP: 'topup',
  ORDER_PAYMENT: 'order_payment',
  REFUND: 'refund',
  CASHBACK: 'cashback',
  REFERRAL_BONUS: 'referral_bonus',
  DELIVERY_EARNING: 'delivery_earning',
  VENDOR_SETTLEMENT: 'vendor_settlement',
  ADMIN_ADJUSTMENT: 'admin_adjustment',
  PAYOUT: 'payout',
} as const;
export type WalletTxnType = (typeof WALLET_TXN_TYPE)[keyof typeof WALLET_TXN_TYPE];

export const COUPON_TYPE = {
  FLAT: 'flat',
  PERCENTAGE: 'percentage',
  FREE_DELIVERY: 'free_delivery',
  BUY_X_GET_Y: 'buy_x_get_y',
} as const;
export type CouponType = (typeof COUPON_TYPE)[keyof typeof COUPON_TYPE];

/** Product merchandising flags. Toggles, not new pages. */
export const PRODUCT_FLAGS = [
  'todays_special',
  'limited',
  'festival',
  'subscription',
  'combo',
  'featured',
  'hidden',
  'happy_hour',
  'flash_sale',
  'chef_special',
  'bestseller',
  'new_arrival',
] as const;
export type ProductFlag = (typeof PRODUCT_FLAGS)[number];

export const DIET_TYPE = {
  VEG: 'veg',
  NON_VEG: 'non_veg',
  EGG: 'egg',
  VEGAN: 'vegan',
  JAIN: 'jain',
} as const;
export type DietType = (typeof DIET_TYPE)[keyof typeof DIET_TYPE];

export const FEATURE_FLAGS = [
  'flash_sale',
  'happy_hour',
  'festival_menu',
  'group_order',
  'meal_pass',
  'referral',
  'loyalty',
  'subscriptions',
  'wallet_topup',
  'cash_on_delivery',
  'live_tracking',
  'scheduled_orders',
  'vendor_self_onboarding',
] as const;
export type FeatureFlagKey = (typeof FEATURE_FLAGS)[number];
