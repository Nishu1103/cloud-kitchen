import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES } from '@ck/types';
import { COOKIES } from '../constants/cache-keys';
import { SKIP_CSRF_KEY } from '../decorators';
import { AppException } from '../exceptions/app.exception';
import { safeEqual } from '../utils/crypto.util';
import type { AuthenticatedRequest } from '../types/authenticated-request';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER = 'x-csrf-token';

/**
 * Double-submit CSRF protection for cookie-authenticated requests.
 *
 * The cookie is readable by same-origin JavaScript, the header is not settable
 * cross-origin, and the two must match. Requests authenticated with an
 * `Authorization: Bearer` header are exempt because a bearer token is not
 * attached automatically by the browser and therefore cannot be ridden.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (SAFE_METHODS.has(request.method)) return true;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const cookies = (request.cookies ?? {}) as Record<string, string | undefined>;
    const usesCookieAuth = Boolean(cookies[COOKIES.ACCESS_TOKEN] ?? cookies[COOKIES.REFRESH_TOKEN]);
    if (!usesCookieAuth) return true;

    const cookieToken = cookies[COOKIES.CSRF];
    const headerToken = request.headers[CSRF_HEADER];
    const provided = Array.isArray(headerToken) ? headerToken[0] : headerToken;

    if (!cookieToken || !provided || !safeEqual(cookieToken, provided)) {
      throw new AppException(
        ERROR_CODES.CSRF_FAILED,
        'CSRF validation failed. Refresh the page and try again.',
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
