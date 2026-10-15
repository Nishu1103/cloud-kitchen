/**
 * Every notification the platform can emit, with the audience it targets and the
 * channels it is allowed to use. Adding a type here is the only place you touch
 * to make it deliverable end to end.
 */
export const NOTIFICATION_CHANNEL = {
  PUSH: 'push',
  IN_APP: 'in_app',
  EMAIL: 'email',
  SMS: 'sms',
  REALTIME: 'realtime',
} as const;
export type NotificationChannel =
  (typeof NOTIFICATION_CHANNEL)[keyof typeof NOTIFICATION_CHANNEL];

export const NOTIFICATION_AUDIENCE = {
  CUSTOMER: 'customer',
  VENDOR: 'vendor',
  DELIVERY: 'delivery',
  ADMIN: 'admin',
} as const;
export type NotificationAudience =
  (typeof NOTIFICATION_AUDIENCE)[keyof typeof NOTIFICATION_AUDIENCE];

export const NOTIFICATION_CATEGORY = {
  ORDER: 'order',
  PAYMENT: 'payment',
  DELIVERY: 'delivery',
  PROMOTION: 'promotion',
  ACCOUNT: 'account',
  SYSTEM: 'system',
  REVIEW: 'review',
  INVENTORY: 'inventory',
} as const;
export type NotificationCategory =
  (typeof NOTIFICATION_CATEGORY)[keyof typeof NOTIFICATION_CATEGORY];

/**
 * Mute preferences are a flat map so a student can silence promotions without losing
 * "your order is ready". The keys are built here rather than inlined at each call site
 * because they are persisted, and because a colon - not a dot - keeps them usable as
 * MongoDB field names.
 */
export const categoryPreferenceKey = (category: NotificationCategory): string =>
  `category:${category}`;

export const channelPreferenceKey = (channel: NotificationChannel): string =>
  `channel:${channel}`;

/**
 * Only these keys may be written. Transactional order updates stay outside the
 * mutable set, and an unknown key is rejected instead of being stored, which keeps
 * a client from growing the user document with arbitrary fields.
 */
export const NOTIFICATION_PREFERENCE_KEYS: readonly string[] = [
  ...Object.values(NOTIFICATION_CATEGORY).map(categoryPreferenceKey),
  ...Object.values(NOTIFICATION_CHANNEL).map(channelPreferenceKey),
];

export const NOTIFICATION_TYPE = {
  // customer
  ORDER_PLACED: 'order.placed',
  ORDER_ACCEPTED: 'order.accepted',
  ORDER_REJECTED: 'order.rejected',
  ORDER_PREPARING: 'order.preparing',
  ORDER_READY: 'order.ready',
  ORDER_OUT_FOR_DELIVERY: 'order.out_for_delivery',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_CANCELLED: 'order.cancelled',
  REFUND_PROCESSED: 'payment.refund_processed',
  REVIEW_REMINDER: 'review.reminder',
  REVIEW_REPLY: 'review.reply',
  SUPPORT_REPLY: 'support.reply',
  COUPON_RECEIVED: 'promotion.coupon_received',
  WALLET_CREDITED: 'payment.wallet_credited',

  // vendor
  VENDOR_NEW_ORDER: 'vendor.new_order',
  VENDOR_ORDER_CANCELLED: 'vendor.order_cancelled',
  VENDOR_NEW_REVIEW: 'vendor.new_review',
  VENDOR_LOW_STOCK: 'vendor.low_stock',
  VENDOR_SETTLEMENT: 'vendor.settlement',
  VENDOR_APPROVED: 'vendor.approved',
  VENDOR_REJECTED: 'vendor.rejected',
  VENDOR_SUSPENDED: 'vendor.suspended',

  // delivery
  DELIVERY_OFFERED: 'delivery.offered',
  DELIVERY_ASSIGNED: 'delivery.assigned',
  DELIVERY_CANCELLED: 'delivery.cancelled',
  DELIVERY_CUSTOMER_WAITING: 'delivery.customer_waiting',
  DELIVERY_EARNING_CREDITED: 'delivery.earning_credited',

  // admin
  ADMIN_VENDOR_REQUEST: 'admin.vendor_request',
  ADMIN_COMPLAINT: 'admin.complaint',
  ADMIN_PAYOUT_REQUEST: 'admin.payout_request',
  ADMIN_SYSTEM_ALERT: 'admin.system_alert',

  // account / broadcast
  ACCOUNT_VERIFY_EMAIL: 'account.verify_email',
  ACCOUNT_PASSWORD_RESET: 'account.password_reset',
  ACCOUNT_NEW_LOGIN: 'account.new_login',
  BROADCAST_ANNOUNCEMENT: 'system.announcement',
} as const;
export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

export interface NotificationTypeMeta {
  category: NotificationCategory;
  audience: NotificationAudience;
  channels: NotificationChannel[];
  /** Transactional notifications ignore user mute preferences. */
  transactional: boolean;
}

const C = NOTIFICATION_CHANNEL;
const A = NOTIFICATION_AUDIENCE;
const G = NOTIFICATION_CATEGORY;

export const NOTIFICATION_REGISTRY: Record<NotificationType, NotificationTypeMeta> = {
  'order.placed': {
    category: G.ORDER,
    audience: A.CUSTOMER,
    channels: [C.PUSH, C.IN_APP, C.REALTIME, C.EMAIL],
    transactional: true,
  },
  'order.accepted': {
    category: G.ORDER,
    audience: A.CUSTOMER,
    channels: [C.PUSH, C.IN_APP, C.REALTIME],
    transactional: true,
  },
  'order.rejected': {
    category: G.ORDER,
    audience: A.CUSTOMER,
    channels: [C.PUSH, C.IN_APP, C.REALTIME],
    transactional: true,
  },
  'order.preparing': {
    category: G.ORDER,
    audience: A.CUSTOMER,
    channels: [C.PUSH, C.IN_APP, C.REALTIME],
    transactional: true,
  },
  'order.ready': {
    category: G.ORDER,
    audience: A.CUSTOMER,
    channels: [C.PUSH, C.IN_APP, C.REALTIME],
    transactional: true,
  },
  'order.out_for_delivery': {
    category: G.ORDER,
    audience: A.CUSTOMER,
    channels: [C.PUSH, C.IN_APP, C.REALTIME],
    transactional: true,
  },
  'order.delivered': {
    category: G.ORDER,
    audience: A.CUSTOMER,
    channels: [C.PUSH, C.IN_APP, C.REALTIME, C.EMAIL],
    transactional: true,
  },
  'order.cancelled': {
    category: G.ORDER,
    audience: A.CUSTOMER,
    channels: [C.PUSH, C.IN_APP, C.REALTIME, C.EMAIL],
    transactional: true,
  },
  'payment.refund_processed': {
    category: G.PAYMENT,
    audience: A.CUSTOMER,
    channels: [C.PUSH, C.IN_APP, C.EMAIL],
    transactional: true,
  },
  'review.reminder': {
    category: G.REVIEW,
    audience: A.CUSTOMER,
    channels: [C.PUSH, C.IN_APP],
    transactional: false,
  },
  'review.reply': {
    category: G.REVIEW,
    audience: A.CUSTOMER,
    channels: [C.PUSH, C.IN_APP],
    transactional: false,
  },
  'support.reply': {
    category: G.ACCOUNT,
    audience: A.CUSTOMER,
    channels: [C.PUSH, C.IN_APP, C.EMAIL],
    transactional: true,
  },
  'promotion.coupon_received': {
    category: G.PROMOTION,
    audience: A.CUSTOMER,
    channels: [C.PUSH, C.IN_APP],
    transactional: false,
  },
  'payment.wallet_credited': {
    category: G.PAYMENT,
    audience: A.CUSTOMER,
    channels: [C.PUSH, C.IN_APP],
    transactional: true,
  },

  'vendor.new_order': {
    category: G.ORDER,
    audience: A.VENDOR,
    channels: [C.PUSH, C.IN_APP, C.REALTIME],
    transactional: true,
  },
  'vendor.order_cancelled': {
    category: G.ORDER,
    audience: A.VENDOR,
    channels: [C.PUSH, C.IN_APP, C.REALTIME],
    transactional: true,
  },
  'vendor.new_review': {
    category: G.REVIEW,
    audience: A.VENDOR,
    channels: [C.PUSH, C.IN_APP],
    transactional: false,
  },
  'vendor.low_stock': {
    category: G.INVENTORY,
    audience: A.VENDOR,
    channels: [C.PUSH, C.IN_APP, C.REALTIME],
    transactional: true,
  },
  'vendor.settlement': {
    category: G.PAYMENT,
    audience: A.VENDOR,
    channels: [C.IN_APP, C.EMAIL],
    transactional: true,
  },
  'vendor.approved': {
    category: G.ACCOUNT,
    audience: A.VENDOR,
    channels: [C.PUSH, C.IN_APP, C.EMAIL],
    transactional: true,
  },
  'vendor.rejected': {
    category: G.ACCOUNT,
    audience: A.VENDOR,
    channels: [C.IN_APP, C.EMAIL],
    transactional: true,
  },
  'vendor.suspended': {
    category: G.ACCOUNT,
    audience: A.VENDOR,
    channels: [C.PUSH, C.IN_APP, C.EMAIL],
    transactional: true,
  },

  'delivery.offered': {
    category: G.DELIVERY,
    audience: A.DELIVERY,
    channels: [C.PUSH, C.IN_APP, C.REALTIME],
    transactional: true,
  },
  'delivery.assigned': {
    category: G.DELIVERY,
    audience: A.DELIVERY,
    channels: [C.PUSH, C.IN_APP, C.REALTIME],
    transactional: true,
  },
  'delivery.cancelled': {
    category: G.DELIVERY,
    audience: A.DELIVERY,
    channels: [C.PUSH, C.IN_APP, C.REALTIME],
    transactional: true,
  },
  'delivery.customer_waiting': {
    category: G.DELIVERY,
    audience: A.DELIVERY,
    channels: [C.PUSH, C.IN_APP, C.REALTIME],
    transactional: true,
  },
  'delivery.earning_credited': {
    category: G.PAYMENT,
    audience: A.DELIVERY,
    channels: [C.IN_APP],
    transactional: true,
  },

  'admin.vendor_request': {
    category: G.SYSTEM,
    audience: A.ADMIN,
    channels: [C.IN_APP, C.REALTIME, C.EMAIL],
    transactional: true,
  },
  'admin.complaint': {
    category: G.SYSTEM,
    audience: A.ADMIN,
    channels: [C.IN_APP, C.REALTIME],
    transactional: true,
  },
  'admin.payout_request': {
    category: G.PAYMENT,
    audience: A.ADMIN,
    channels: [C.IN_APP, C.REALTIME],
    transactional: true,
  },
  'admin.system_alert': {
    category: G.SYSTEM,
    audience: A.ADMIN,
    channels: [C.IN_APP, C.REALTIME, C.EMAIL],
    transactional: true,
  },

  'account.verify_email': {
    category: G.ACCOUNT,
    audience: A.CUSTOMER,
    channels: [C.EMAIL],
    transactional: true,
  },
  'account.password_reset': {
    category: G.ACCOUNT,
    audience: A.CUSTOMER,
    channels: [C.EMAIL],
    transactional: true,
  },
  'account.new_login': {
    category: G.ACCOUNT,
    audience: A.CUSTOMER,
    channels: [C.IN_APP, C.EMAIL],
    transactional: true,
  },
  'system.announcement': {
    category: G.SYSTEM,
    audience: A.CUSTOMER,
    channels: [C.PUSH, C.IN_APP],
    transactional: false,
  },
};

export const DEVICE_PLATFORM = {
  WEB: 'web',
  ANDROID_PWA: 'android_pwa',
  IOS_PWA: 'ios_pwa',
  ANDROID_NATIVE: 'android_native',
  IOS_NATIVE: 'ios_native',
} as const;
export type DevicePlatform = (typeof DEVICE_PLATFORM)[keyof typeof DEVICE_PLATFORM];
