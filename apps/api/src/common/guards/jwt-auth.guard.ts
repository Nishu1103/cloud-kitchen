import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Inject } from '@nestjs/common';
import { CONFIG, type AppConfig } from '@/config';
import { AuthorizationService } from '@/modules/rbac/authorization.service';
import { cacheKeys, COOKIES } from '../constants/cache-keys';
import { IS_PUBLIC_KEY } from '../decorators';
import { AppException } from '../exceptions/app.exception';
import { RedisService } from '@/modules/redis/redis.service';
import type { AccessTokenClaims, AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Authenticates every request unless the handler is explicitly `@Public()`.
 *
 * Access tokens are short-lived and deliberately carry no permissions: the
 * effective permission set is resolved server-side on each request (Redis-cached)
 * so revoking a role takes effect immediately rather than after token expiry.
 * Two revocation lists cover the window where a still-valid token must stop
 * working: per session (logout) and per user (suspension, password change).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
    private readonly authorization: AuthorizationService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      if (isPublic) return true;
      throw AppException.unauthenticated();
    }

    let claims: AccessTokenClaims;
    try {
      claims = await this.jwtService.verifyAsync<AccessTokenClaims>(token, {
        secret: this.config.auth.accessSecret,
        issuer: this.config.auth.issuer,
        audience: this.config.auth.audience,
        algorithms: ['HS256'],
      });
    } catch {
      if (isPublic) return true;
      throw AppException.unauthenticated('Your session has expired. Please sign in again.');
    }

    const [sessionRevoked, userRevoked] = await Promise.all([
      this.redis.exists(cacheKeys.revokedSession(claims.sid)),
      this.redis.exists(cacheKeys.revokedUser(claims.sub)),
    ]);
    if (sessionRevoked || userRevoked) {
      if (isPublic) return true;
      throw AppException.unauthenticated('This session is no longer valid.');
    }

    const principal = await this.authorization.resolvePrincipal(claims.sub);
    if (!principal) {
      if (isPublic) return true;
      throw AppException.unauthenticated();
    }

    // A token must never outlive the tenant binding it was minted with.
    if (principal.campusId !== claims.cid) {
      this.logger.warn(`Tenant mismatch for user ${claims.sub}; rejecting token.`);
      throw AppException.unauthenticated('This session is no longer valid.');
    }

    request.user = {
      id: principal.id,
      campusId: claims.cid,
      portal: claims.prt,
      sessionId: claims.sid,
      vendorId: principal.vendorId ?? claims.vid,
      roles: principal.roles,
      permissions: principal.permissions,
    };

    return true;
  }

  /**
   * Cookies first (browser portals), bearer second (mobile wrappers and
   * server-to-server calls). Cookie sessions are additionally CSRF-protected.
   */
  private extractToken(request: AuthenticatedRequest): string | undefined {
    const cookieToken = (request.cookies as Record<string, string> | undefined)?.[
      COOKIES.ACCESS_TOKEN
    ];
    if (cookieToken) return cookieToken;

    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7).trim() || undefined;
    return undefined;
  }
}
