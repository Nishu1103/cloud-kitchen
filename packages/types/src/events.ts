/** Internal domain events. Publishers never call side-effect services directly. */
export const DOMAIN_EVENTS = {
  ORDER_CREATED: 'order.created',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  ORDER_CANCELLED: 'order.cancelled',
  PAYMENT_CAPTURED: 'payment.captured',
  PAYMENT_FAILED: 'payment.failed',
  REFUND_COMPLETED: 'refund.completed',
  VENDOR_SUBMITTED: 'vendor.submitted',
  VENDOR_DECIDED: 'vendor.decided',
  DELIVERY_ASSIGNMENT_CREATED: 'delivery.assignment_created',
  DELIVERY_STATUS_CHANGED: 'delivery.status_changed',
  REVIEW_CREATED: 'review.created',
  USER_REGISTERED: 'user.registered',
  STOCK_LOW: 'stock.low',
} as const;
export type DomainEvent = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

/** Socket.IO server -> client messages. */
export const WS_EVENTS = {
  ORDER_UPDATED: 'order:updated',
  ORDER_NEW: 'order:new',
  DELIVERY_UPDATED: 'delivery:updated',
  DELIVERY_OFFER: 'delivery:offer',
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_COUNT: 'notification:count',
  VENDOR_STOCK_UPDATED: 'vendor:stock_updated',
  PRESENCE: 'presence',
} as const;
export type WsEvent = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

/**
 * Room naming. The gateway derives rooms from the verified JWT only, so a client
 * can never subscribe to another tenant's or user's stream.
 */
export const wsRooms = {
  user: (userId: string) => `user:${userId}`,
  vendor: (vendorId: string) => `vendor:${vendorId}`,
  order: (orderId: string) => `order:${orderId}`,
  campusAdmins: (campusId: string) => `campus:${campusId}:admins`,
  campusDelivery: (campusId: string) => `campus:${campusId}:delivery`,
};
