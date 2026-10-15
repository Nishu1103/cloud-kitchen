import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import type { Portal } from '@ck/types';
import type { Response } from 'express';
import { Model, Types } from 'mongoose';
import { CONFIG, type AppConfig } from '@/config';
import { cacheKeys, COOKIES } from '@/common/constants/cache-keys';
import { generateOpaqueToken, hashToken } from '@/common/utils/crypto.util';
import { AppException } from '@/common/exceptions/app.exception';
import { Session, type SessionDocument } from '@/database/schemas';
import { RedisService } from '@/modules/redis/redis.service';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  sessionId: string;
  expiresIn: number;
}

interface IssueParams {
  userId: string;
  campusId: string;
  portal: Portal;
  vendorId?: string;
  ip?: string;
  userAgent?: string;
  deviceLabel?: string;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async issue(params: IssueParams): Promise<IssuedTokens> {
    const refreshToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + this.config.auth.refreshTtl * 1000);

    const session = await this.sessionModel.create({
      userId: new Types.ObjectId(params.userId),
      campusId: new Types.ObjectId(params.campusId),
      portal: params.portal,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt,
      ip: params.ip,
      userAgent: params.userAgent?.slice(0, 300),
      deviceLabel: params.deviceLabel,
    });

    const accessToken = await this.signAccessToken({
      userId: params.userId,
      campusId: params.campusId,
      portal: params.portal,
      sessionId: String(session._id),
      vendorId: params.vendorId,
    });

    return {
      accessToken,
      refreshToken,
      csrfToken: generateOpaqueToken(24),
      sessionId: String(session._id),
      expiresIn: this.config.auth.accessTtl,
    };
  }

  /**
   * Rotates a refresh token. The presented token is invalidated as part of the
   * same conditional update that issues the replacement, so two concurrent
   * refreshes cannot both succeed.
   *
   * Presenting an already-rotated token means the token leaked: the whole family is
   * revoked and every access token for the user is denied immediately.
   */
  async rotate(
    presentedToken: string,
    context: { ip?: string; userAgent?: string },
  ): Promise<IssuedTokens & { userId: string; campusId: string; portal: Portal }> {
    const presentedHash = hashToken(presentedToken);
    const nextToken = generateOpaqueToken();

    const session = await this.sessionModel.findOneAndUpdate(
      {
        refreshTokenHash: presentedHash,
        revokedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      },
      {
        $set: {
          refreshTokenHash: hashToken(nextToken),
          lastUsedAt: new Date(),
          ip: context.ip,
          userAgent: context.userAgent?.slice(0, 300),
        },
        $push: { rotatedTokenHashes: { $each: [presentedHash], $slice: -20 } },
        $inc: { rotationCount: 1 },
      },
      { new: true },
    );

    if (!session) {
      await this.handleSuspectedReuse(presentedHash);
      throw AppException.unauthenticated('Your session has expired. Please sign in again.');
    }

    const accessToken = await this.signAccessToken({
      userId: String(session.userId),
      campusId: String(session.campusId),
      portal: session.portal,
      sessionId: String(session._id),
    });

    return {
      accessToken,
      refreshToken: nextToken,
      csrfToken: generateOpaqueToken(24),
      sessionId: String(session._id),
      expiresIn: this.config.auth.accessTtl,
      userId: String(session.userId),
      campusId: String(session.campusId),
      portal: session.portal,
    };
  }

  async revokeSession(sessionId: string, reason: string): Promise<void> {
    const session = await this.sessionModel.findByIdAndUpdate(
      sessionId,
      { $set: { revokedAt: new Date(), revokedReason: reason.slice(0, 60) } },
      { new: true },
    );
    if (!session) return;
    // Deny still-valid access tokens for the remainder of their lifetime.
    await this.redis.setFlag(cacheKeys.revokedSession(sessionId), this.config.auth.accessTtl);
  }

  /** Used by password change, suspension and "sign out everywhere". */
  async revokeAllForUser(userId: string, reason: string): Promise<number> {
    const result = await this.sessionModel.updateMany(
      { userId: new Types.ObjectId(userId), revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokedReason: reason.slice(0, 60) } },
    );
    await this.redis.setFlag(cacheKeys.revokedUser(userId), this.config.auth.accessTtl);
    return result.modifiedCount;
  }

  async listSessions(userId: string) {
    return this.sessionModel
      .find({ userId: new Types.ObjectId(userId), revokedAt: { $exists: false } })
      .select('portal ip userAgent deviceLabel lastUsedAt createdAt expiresAt')
      .sort({ lastUsedAt: -1 })
      .lean();
  }

  /**
   * Cookie flags: `httpOnly` keeps tokens out of reach of XSS, `sameSite=lax`
   * blocks cross-site POSTs while still allowing top-level navigation back from a
   * payment gateway, and `secure` is on everywhere except local http development.
   * The refresh cookie is additionally path-scoped so it is only ever sent to the
   * refresh endpoint.
   */
  setAuthCookies(response: Response, tokens: IssuedTokens, apiPrefix: string): void {
    const secure = this.config.isProduction;
    const domain = this.config.http.cookieDomain;

    response.cookie(COOKIES.ACCESS_TOKEN, tokens.accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      domain,
      path: '/',
      maxAge: this.config.auth.accessTtl * 1000,
    });

    response.cookie(COOKIES.REFRESH_TOKEN, tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      domain,
      path: `/${apiPrefix}`,
      maxAge: this.config.auth.refreshTtl * 1000,
    });

    // Readable by same-origin JS on purpose: it is echoed back in the X-CSRF-Token header.
    response.cookie(COOKIES.CSRF, tokens.csrfToken, {
      httpOnly: false,
      secure,
      sameSite: 'lax',
      domain,
      path: '/',
      maxAge: this.config.auth.refreshTtl * 1000,
    });
  }

  clearAuthCookies(response: Response, apiPrefix: string): void {
    const domain = this.config.http.cookieDomain;
    response.clearCookie(COOKIES.ACCESS_TOKEN, { domain, path: '/' });
    response.clearCookie(COOKIES.REFRESH_TOKEN, { domain, path: `/${apiPrefix}` });
    response.clearCookie(COOKIES.CSRF, { domain, path: '/' });
  }

  private async signAccessToken(params: {
    userId: string;
    campusId: string;
    portal: Portal;
    sessionId: string;
    vendorId?: string;
  }): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: params.userId,
        cid: params.campusId,
        prt: params.portal,
        sid: params.sessionId,
        ...(params.vendorId ? { vid: params.vendorId } : {}),
      },
      {
        secret: this.config.auth.accessSecret,
        expiresIn: this.config.auth.accessTtl,
        issuer: this.config.auth.issuer,
        audience: this.config.auth.audience,
        algorithm: 'HS256',
      },
    );
  }

  private async handleSuspectedReuse(presentedHash: string): Promise<void> {
    const compromised = await this.sessionModel.findOne({ rotatedTokenHashes: presentedHash });
    if (!compromised) return;

    this.logger.error(
      { userId: String(compromised.userId), sessionId: String(compromised._id) },
      'Refresh token reuse detected - revoking every session for this user.',
    );
    compromised.reuseDetectedAt = new Date();
    await compromised.save();
    await this.revokeAllForUser(String(compromised.userId), 'refresh_token_reuse');
  }
}
