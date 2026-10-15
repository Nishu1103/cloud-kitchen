import { applyDecorators, createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Permission, Portal } from '@ck/types';
import type { AuthenticatedRequest, AuthenticatedUser } from '../types/authenticated-request';
import { AppException } from '../exceptions/app.exception';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const PERMISSIONS_KEY = 'auth:permissions';
export const PERMISSIONS_MODE_KEY = 'auth:permissionsMode';
export const PORTALS_KEY = 'auth:portals';
export const SKIP_CSRF_KEY = 'auth:skipCsrf';
export const AUDIT_KEY = 'audit:action';
export const FEATURE_FLAG_KEY = 'feature:flag';

/** Opts an endpoint out of authentication. Must be explicit and rare. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Requires ALL listed permissions. */
export const RequirePermissions = (...permissions: Permission[]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    SetMetadata(PERMISSIONS_MODE_KEY, 'all'),
  );

/** Requires AT LEAST ONE of the listed permissions. */
export const RequireAnyPermission = (...permissions: Permission[]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    SetMetadata(PERMISSIONS_MODE_KEY, 'any'),
  );

/** Restricts an endpoint to sessions issued for specific portals. */
export const AllowPortals = (...portals: Portal[]) => SetMetadata(PORTALS_KEY, portals);

/**
 * Only for endpoints authenticated by something other than the session cookie
 * (payment webhooks verified by HMAC signature).
 */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);

export interface AuditMetadata {
  action: string;
  resource: string;
}

/** Records a durable audit entry for the request. */
export const Audit = (action: string, resource: string) =>
  SetMetadata<string, AuditMetadata>(AUDIT_KEY, { action, resource });

/** Gates an endpoint behind a runtime feature flag. */
export const RequireFeature = (flag: string) => SetMetadata(FEATURE_FLAG_KEY, flag);

/**
 * Throws when there is no session, so a handler that takes it can treat the user as
 * present. On a `@Public()` route that only wants the user when one is signed in, use
 * `@OptionalUser()` - this one would turn that route into a 401.
 */
export const CurrentUser = createParamDecorator(
  (property: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw AppException.unauthenticated();
    return property ? request.user[property] : request.user;
  },
);

/** The session user when the request carries one, `undefined` when anonymous. */
export const OptionalUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined => {
    return context.switchToHttp().getRequest<AuthenticatedRequest>().user;
  },
);

/** Tenant id resolved by TenantGuard. Services take it as an explicit argument. */
export const TenantId = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.tenantId) throw AppException.forbidden('No tenant context on this request.');
  return request.tenantId;
});

export const RequestId = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  return context.switchToHttp().getRequest<AuthenticatedRequest>().requestId;
});

export const ClientIp = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.ip ?? 'unknown';
});
