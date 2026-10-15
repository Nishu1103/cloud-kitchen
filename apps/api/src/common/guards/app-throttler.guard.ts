import { HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import { ERROR_CODES } from '@ck/types';
import { AppException } from '../exceptions/app.exception';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Rate limits by session first and IP second. Keying on IP alone punishes whole
 * campus NATs (thousands of students behind one address), while keying on the
 * user alone lets an unauthenticated attacker hammer the login endpoint for free.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(request: AuthenticatedRequest): Promise<string> {
    if (request.user?.id) return `u:${request.user.id}`;
    return `ip:${request.ip ?? 'unknown'}`;
  }

  protected override async throwThrottlingException(
    _context: unknown,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new AppException(
      ERROR_CODES.RATE_LIMITED,
      `Too many requests. Try again in ${detail.timeToBlockExpire || detail.ttl} seconds.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
