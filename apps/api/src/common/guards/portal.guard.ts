import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES, type Portal } from '@ck/types';
import { HttpStatus } from '@nestjs/common';
import { IS_PUBLIC_KEY, PORTALS_KEY } from '../decorators';
import { AppException } from '../exceptions/app.exception';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Binds a session to the portal it was issued for. A delivery partner's token
 * cannot be replayed against admin endpoints even if permissions were misconfigured,
 * which keeps the four apps genuinely isolated rather than isolated only by URL.
 */
@Injectable()
export class PortalGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const targets = [context.getHandler(), context.getClass()];
    const allowed = this.reflector.getAllAndOverride<Portal[]>(PORTALS_KEY, targets);
    if (!allowed?.length) return true;
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) throw AppException.unauthenticated();

    if (!allowed.includes(user.portal)) {
      throw new AppException(
        ERROR_CODES.WRONG_PORTAL,
        'This endpoint is not available for your session type. Sign in through the correct portal.',
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
