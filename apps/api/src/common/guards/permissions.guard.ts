import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@ck/types';
import { IS_PUBLIC_KEY, PERMISSIONS_KEY, PERMISSIONS_MODE_KEY } from '../decorators';
import { AppException } from '../exceptions/app.exception';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * The only place authorization is decided. Handlers declare the permissions they
 * need; nothing in the codebase compares against a role name.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const targets = [context.getHandler(), context.getClass()];
    const required = this.reflector.getAllAndMerge<Permission[]>(PERMISSIONS_KEY, targets);
    if (!required.length) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) throw AppException.unauthenticated();

    const mode = this.reflector.getAllAndOverride<'all' | 'any'>(PERMISSIONS_MODE_KEY, targets);
    const granted = new Set(user.permissions);
    const satisfied =
      mode === 'any'
        ? required.some((permission) => granted.has(permission))
        : required.every((permission) => granted.has(permission));

    if (!satisfied) {
      const missing = required.filter((permission) => !granted.has(permission));
      throw AppException.forbidden(
        `Missing required permission${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`,
      );
    }
    return true;
  }
}
