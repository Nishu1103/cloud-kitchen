import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES, PERMISSIONS } from '@ck/types';
import { Types } from 'mongoose';
import { IS_PUBLIC_KEY } from '../decorators';
import { AppException } from '../exceptions/app.exception';
import { TenantResolverService } from '../tenant/tenant-resolver.service';
import type { AuthenticatedRequest } from '../types/authenticated-request';

const CAMPUS_ID_HEADER = 'x-campus-id';
const CAMPUS_SLUG_HEADER = 'x-campus-slug';

/**
 * Resolves the tenant for the request exactly once.
 *
 * For a signed-in caller the tenant comes from the session and nothing else, so it
 * cannot be influenced by request input. Only an operator holding `campus:read_all`
 * may target another campus, and only through an explicit header - which keeps
 * multi-campus support from becoming a cross-tenant read.
 *
 * Anonymous storefront requests have no session, so they name their campus by slug
 * (header or `?campusSlug=`). That is safe because those endpoints serve only data
 * that is public for the campus in question.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!isPublic) return false;

      const slug =
        this.header(request, CAMPUS_SLUG_HEADER) ??
        this.queryValue(request, 'campusSlug') ??
        this.paramValue(request, 'campusSlug');

      const resolved = await this.tenantResolver.resolveSlug(slug);
      if (resolved) request.tenantId = resolved;

      // Some public routes (campus discovery, webhooks) are legitimately tenant-free.
      // A handler that needs a tenant asks for one via @TenantId and fails there.
      return true;
    }

    const requestedCampusId = this.header(request, CAMPUS_ID_HEADER);

    if (!requestedCampusId || requestedCampusId === user.campusId) {
      request.tenantId = user.campusId;
      return true;
    }

    if (!user.permissions.includes(PERMISSIONS.CAMPUS_READ_ALL)) {
      throw new AppException(
        ERROR_CODES.TENANT_MISMATCH,
        'You cannot access data outside your campus.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (!Types.ObjectId.isValid(requestedCampusId)) {
      throw AppException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'Invalid campus id header.');
    }

    request.tenantId = requestedCampusId;
    return true;
  }

  private header(request: AuthenticatedRequest, name: string): string | undefined {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }

  private queryValue(request: AuthenticatedRequest, name: string): string | undefined {
    const value = (request.query as Record<string, unknown> | undefined)?.[name];
    return typeof value === 'string' ? value : undefined;
  }

  private paramValue(request: AuthenticatedRequest, name: string): string | undefined {
    const value = (request.params as Record<string, unknown> | undefined)?.[name];
    return typeof value === 'string' ? value : undefined;
  }
}
