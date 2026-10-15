/**
 * Single source of truth for authorization.
 *
 * Rule: code NEVER branches on a role name. It always asks for a permission.
 * Roles are just named bundles of these strings, editable at runtime by a
 * super-admin without a deploy.
 */
export const PERMISSIONS = {
  // --- platform / tenant -----------------------------------------------------
  CAMPUS_CREATE: 'campus:create',
  /** Read the caller's own campus, including its delivery zones. */
  CAMPUS_READ: 'campus:read',
  CAMPUS_UPDATE: 'campus:update',
  /** Read, and act on, any campus on the platform. Super-admin territory. */
  CAMPUS_READ_ALL: 'campus:read_all',
  PLATFORM_SETTINGS_MANAGE: 'platform_settings:manage',
  FEATURE_FLAG_MANAGE: 'feature_flag:manage',
  AUDIT_LOG_READ: 'audit_log:read',
  IMPERSONATE_USER: 'user:impersonate',

  // --- identity --------------------------------------------------------------
  USER_READ: 'user:read',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_SUSPEND: 'user:suspend',
  ROLE_MANAGE: 'role:manage',

  // --- vendor ----------------------------------------------------------------
  VENDOR_READ: 'vendor:read',
  VENDOR_CREATE: 'vendor:create',
  VENDOR_UPDATE_OWN: 'vendor:update_own',
  VENDOR_UPDATE_ANY: 'vendor:update_any',
  VENDOR_APPROVE: 'vendor:approve',
  VENDOR_SUSPEND: 'vendor:suspend',
  VENDOR_PAYOUT_MANAGE: 'vendor_payout:manage',

  // --- catalog ---------------------------------------------------------------
  PRODUCT_READ: 'product:read',
  PRODUCT_CREATE: 'product:create',
  PRODUCT_UPDATE: 'product:update',
  PRODUCT_DELETE: 'product:delete',
  CATEGORY_MANAGE: 'category:manage',
  INVENTORY_MANAGE: 'inventory:manage',

  // --- ordering --------------------------------------------------------------
  ORDER_PLACE: 'order:place',
  ORDER_READ_OWN: 'order:read_own',
  ORDER_READ_VENDOR: 'order:read_vendor',
  ORDER_READ_ALL: 'order:read_all',
  ORDER_ACCEPT: 'order:accept',
  ORDER_UPDATE_STATUS: 'order:update_status',
  ORDER_CANCEL_OWN: 'order:cancel_own',
  ORDER_CANCEL_ANY: 'order:cancel_any',
  ORDER_REFUND: 'order:refund',

  // --- delivery --------------------------------------------------------------
  DELIVERY_READ_OWN: 'delivery:read_own',
  DELIVERY_READ_ALL: 'delivery:read_all',
  DELIVERY_ACCEPT: 'delivery:accept',
  DELIVERY_UPDATE_STATUS: 'delivery:update_status',
  DELIVERY_ASSIGN: 'delivery:assign',
  DELIVERY_PARTNER_MANAGE: 'delivery_partner:manage',

  // --- money -----------------------------------------------------------------
  PAYMENT_READ_OWN: 'payment:read_own',
  PAYMENT_READ_ALL: 'payment:read_all',
  WALLET_READ_OWN: 'wallet:read_own',
  WALLET_ADJUST: 'wallet:adjust',
  COUPON_READ: 'coupon:read',
  COUPON_MANAGE: 'coupon:manage',
  PAYOUT_APPROVE: 'payout:approve',

  // --- engagement ------------------------------------------------------------
  REVIEW_CREATE: 'review:create',
  /** A kitchen answering its own reviews; distinct from moderating anyone's. */
  REVIEW_REPLY: 'review:reply',
  REVIEW_MODERATE: 'review:moderate',
  NOTIFICATION_READ_OWN: 'notification:read_own',
  ANNOUNCEMENT_SEND: 'announcement:send',
  ANNOUNCEMENT_SEND_VENDOR_SCOPE: 'announcement:send_vendor_scope',

  // --- content & insight -----------------------------------------------------
  CMS_MANAGE: 'cms:manage',
  BANNER_MANAGE: 'banner:manage',
  ANALYTICS_VIEW_OWN: 'analytics:view_own',
  ANALYTICS_VIEW_ALL: 'analytics:view_all',
  REPORT_EXPORT: 'report:export',
  SUPPORT_TICKET_MANAGE: 'support_ticket:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];
