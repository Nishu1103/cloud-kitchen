import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES } from '@ck/types';
import { FEATURE_FLAG_KEY } from '../decorators';
import { AppException } from '../exceptions/app.exception';
import { FeatureFlagsService } from '@/modules/platform/feature-flags.service';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/** Blocks endpoints belonging to a feature that is switched off for this campus. */
@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const flag = this.reflector.getAllAndOverride<string>(FEATURE_FLAG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!flag) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const campusId = request.tenantId ?? request.user?.campusId;
    if (!campusId) return false;

    const enabled = await this.featureFlags.isEnabled(campusId, flag, request.user?.id);
    if (!enabled) {
      throw new AppException(
        ERROR_CODES.FEATURE_DISABLED,
        'This feature is not available on your campus yet.',
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
