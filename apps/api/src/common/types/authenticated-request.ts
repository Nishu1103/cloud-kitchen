import type { Request } from 'express';
import type { Permission, Portal, SystemRole } from '@ck/types';

/** Claims we mint. Kept short - JWTs travel on every request. */
export interface AccessTokenClaims {
  sub: string;
  /** Tenant (campus) the session is bound to. */
  cid: string;
  /** Portal the session was issued for; a vendor token cannot drive the admin app. */
  prt: Portal;
  /** Session id, used for revocation and refresh-token family tracking. */
  sid: string;
  /** Vendor the user acts for, when applicable. */
  vid?: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface AuthenticatedUser {
  id: string;
  campusId: string;
  portal: Portal;
  sessionId: string;
  vendorId?: string;
  roles: SystemRole[];
  permissions: Permission[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  /** Tenant resolved by TenantGuard; every query must be scoped to it. */
  tenantId?: string;
  requestId: string;
  /** Raw body captured for webhook signature verification. */
  rawBody?: Buffer;
}
