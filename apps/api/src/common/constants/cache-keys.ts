/** Every Redis key the API uses, in one place, so TTL and invalidation stay honest. */
export const cacheKeys = {
  /** Explicitly revoked session (logout, password change). TTL = access token TTL. */
  revokedSession: (sessionId: string) => `auth:revoked:sid:${sessionId}`,
  /** Revokes every session of a user at once (suspension, forced logout). */
  revokedUser: (userId: string) => `auth:revoked:uid:${userId}`,
  /** Effective permission set, invalidated on any role or user change. */
  userPermissions: (userId: string) => `auth:perms:${userId}`,
  loginAttempts: (identifier: string) => `auth:attempts:${identifier}`,
  lockout: (identifier: string) => `auth:lockout:${identifier}`,
  otpAttempts: (scope: string) => `auth:otp:attempts:${scope}`,
  throttle: (bucket: string) => `throttle:${bucket}`,
  idempotency: (key: string) => `idem:${key}`,
  /** Slug to tenant id, resolved on every anonymous storefront request. */
  campusBySlug: (slug: string) => `campus:slug:${slug}`,
  featureFlags: (campusId: string) => `flags:${campusId}`,
  settings: (campusId: string) => `settings:${campusId}`,
  vendorOpenState: (vendorId: string) => `vendor:open:${vendorId}`,
  announcementQuota: (vendorId: string, day: string) => `quota:announce:${vendorId}:${day}`,
  cartLock: (userId: string) => `cart:${userId}`,
  /** Dashboard aggregations. Short TTL: a dashboard need not be accurate to the second. */
  analyticsVendor: (vendorId: string, range: string) => `analytics:vendor:${vendorId}:${range}`,
  analyticsCampus: (campusId: string, range: string) => `analytics:campus:${campusId}:${range}`,
} as const;

export const COOKIES = {
  ACCESS_TOKEN: 'ck_at',
  REFRESH_TOKEN: 'ck_rt',
  CSRF: 'ck_csrf',
} as const;
