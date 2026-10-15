import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_KEY, type AuditMetadata } from '@/common/decorators';
import type { AuthenticatedRequest } from '@/common/types/authenticated-request';
import { AuditService } from '@/modules/audit/audit.service';

/**
 * Writes the audit entry for any handler marked with `@Audit(...)`, and only on success -
 * a rejected attempt is a log line, not a record of something that happened.
 *
 * Controllers that need to record a resource id discovered at runtime call the service
 * directly; this covers the common case without repeating it in every handler.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.getAllAndOverride<AuditMetadata | undefined>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!metadata || context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return next.handle().pipe(
      tap((result) => {
        const resourceId =
          (request.params as Record<string, string> | undefined)?.id ??
          (typeof result === 'object' && result !== null
            ? ((result as { id?: string })?.id ?? undefined)
            : undefined);

        void this.auditService.recordFromRequest(request, {
          action: metadata.action,
          resource: metadata.resource,
          resourceId,
        });
      }),
    );
  }
}
