import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  ERROR_CODES,
  PORTALS,
  ROLE_PORTALS,
  SYSTEM_ROLES,
  USER_STATUS,
  type Portal,
  type SessionUser,
  type SystemRole,
} from '@ck/types';
import type { Response } from 'express';
import { Model, Types } from 'mongoose';
import { CONFIG, type AppConfig } from '@/config';
import { cacheKeys } from '@/common/constants/cache-keys';
import { AppException } from '@/common/exceptions/app.exception';
import {
  generateNumericOtp,
  generateOpaqueToken,
  hashToken,
  safeEqual,
} from '@/common/utils/crypto.util';
import {
  Campus,
  Role,
  User,
  type CampusDocument,
  type RoleDocument,
  type UserDocument,
} from '@/database/schemas';
import { AuditService } from '@/modules/audit/audit.service';
import { MailService } from '@/modules/mail/mail.service';
import { mailTemplates } from '@/modules/mail/mail.templates';
import { AuthorizationService } from '@/modules/rbac/authorization.service';
import { RedisService } from '@/modules/redis/redis.service';
import { PasswordService } from './password.service';
import { TokenService, type IssuedTokens } from './token.service';
import type {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
} from './dto/auth.dto';

interface RequestContext {
  ip?: string;
  userAgent?: string;
}

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(Campus.name) private readonly campusModel: Model<CampusDocument>,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly authorization: AuthorizationService,
    private readonly redis: RedisService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Self-registration is customer-only; vendor and delivery accounts are created
   * through an approval flow, and admins are provisioned by an existing admin.
   *
   * The response is intentionally identical whether or not the email already
   * exists, so this endpoint cannot be used to enumerate who has an account.
   */
  async register(dto: RegisterDto, context: RequestContext) {
    const campus = await this.requireCampus(dto.campusSlug);
    this.assertEmailDomainAllowed(dto.email, campus);

    const existing = await this.userModel
      .findOne({ campusId: campus._id, email: dto.email })
      .select('_id')
      .lean();

    if (existing) {
      this.logger.warn(`Registration attempted for an existing account on ${campus.slug}.`);
      return { registered: true };
    }

    const customerRole = await this.roleModel
      .findOne({ slug: SYSTEM_ROLES.CUSTOMER })
      .select('_id')
      .lean();
    if (!customerRole) throw AppException.internal('Roles are not seeded for this deployment.');

    const verificationToken = generateOpaqueToken();
    const user = await this.userModel.create({
      campusId: campus._id,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      passwordHash: await this.passwordService.hash(dto.password),
      passwordUpdatedAt: new Date(),
      status: USER_STATUS.PENDING_VERIFICATION,
      roleIds: [customerRole._id],
      emailVerificationTokenHash: hashToken(verificationToken),
      emailVerificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      referralCode: generateOpaqueToken(4).slice(0, 8).toUpperCase(),
      referredBy: await this.resolveReferrer(dto.referralCode, String(campus._id)),
    });

    const link = `${this.frontendUrl(PORTALS.CUSTOMER)}/verify-email?token=${verificationToken}`;
    const template = mailTemplates.verifyEmail(user.name, link);
    await this.mailService.send({ to: user.email, ...template });

    await this.auditService.record({
      campusId: String(campus._id),
      actorId: String(user._id),
      actorEmail: user.email,
      action: 'auth.register',
      resource: 'user',
      resourceId: String(user._id),
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { registered: true };
  }

  /**
   * Password login.
   *
   * Failures are counted per email+IP and lock the pair for a cooldown window, so
   * credential stuffing is throttled without letting an attacker lock out a victim
   * from every network. Every failure path returns the same message and a
   * comparable amount of work, so timing and wording cannot be used to probe which
   * accounts exist.
   */
  async login(dto: LoginDto, context: RequestContext) {
    const campus = await this.requireCampus(dto.campusSlug);
    const attemptKey = `${dto.email}:${context.ip ?? 'unknown'}`;

    if (await this.redis.exists(cacheKeys.lockout(attemptKey))) {
      throw new AppException(
        ERROR_CODES.ACCOUNT_LOCKED,
        'Too many failed attempts. Try again in a few minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.userModel
      .findOne({ campusId: campus._id, email: dto.email, deletedAt: { $exists: false } })
      .select('+passwordHash');

    let passwordMatches = false;
    if (user) {
      passwordMatches = await this.passwordService.verify(user.passwordHash, dto.password);
    } else {
      // Spend the same Argon2 budget on unknown accounts so response time cannot
      // be used to discover which addresses are registered.
      await this.passwordService.hash(dto.password);
    }

    if (!user || !passwordMatches) {
      await this.registerFailedAttempt(attemptKey);
      await this.auditService.record({
        campusId: String(campus._id),
        actorEmail: dto.email,
        action: 'auth.login',
        resource: 'session',
        outcome: 'failure',
        ip: context.ip,
        userAgent: context.userAgent,
      });
      throw AppException.unauthenticated('Incorrect email or password.');
    }

    if (user.status === USER_STATUS.SUSPENDED || user.status === USER_STATUS.DEACTIVATED) {
      throw AppException.forbidden(
        'This account is not active. Contact campus support for help.',
      );
    }
    if (!user.emailVerified) {
      throw new AppException(
        ERROR_CODES.EMAIL_NOT_VERIFIED,
        'Verify your email address before signing in. Check your inbox for the link.',
        HttpStatus.FORBIDDEN,
      );
    }

    const roles = await this.rolesOf(user);
    this.assertPortalAllowed(dto.portal, roles);

    await this.redis.del(cacheKeys.loginAttempts(attemptKey));

    const tokens = await this.tokenService.issue({
      userId: String(user._id),
      campusId: String(user.campusId),
      portal: dto.portal,
      vendorId: user.vendorId ? String(user.vendorId) : undefined,
      ip: context.ip,
      userAgent: context.userAgent,
      deviceLabel: dto.deviceLabel,
    });

    user.lastLoginAt = new Date();
    user.lastLoginIp = context.ip;
    await user.save();

    await this.auditService.record({
      campusId: String(user.campusId),
      actorId: String(user._id),
      actorEmail: user.email,
      action: 'auth.login',
      resource: 'session',
      resourceId: tokens.sessionId,
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: { portal: dto.portal },
    });

    // Sign-in alerts are advisory; a mail outage must not block the login.
    void this.mailService
      .send({
        to: user.email,
        ...mailTemplates.newLogin(user.name, {
          ip: context.ip,
          device: dto.deviceLabel ?? context.userAgent?.slice(0, 60),
          at: new Date().toLocaleString('en-IN', { timeZone: campus.timezone }),
        }),
      })
      .catch((error) => this.logger.warn(`Sign-in alert failed: ${String(error)}`));

    return { tokens, user: await this.buildSessionUser(user, dto.portal) };
  }

  async refresh(refreshToken: string | undefined, context: RequestContext) {
    if (!refreshToken) throw AppException.unauthenticated('No refresh token supplied.');
    const rotated = await this.tokenService.rotate(refreshToken, context);

    const user = await this.userModel.findById(rotated.userId);
    if (!user || user.status !== USER_STATUS.ACTIVE) {
      await this.tokenService.revokeSession(rotated.sessionId, 'user_inactive');
      throw AppException.unauthenticated('This session is no longer valid.');
    }

    return {
      tokens: rotated as IssuedTokens,
      user: await this.buildSessionUser(user, rotated.portal),
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.tokenService.revokeSession(sessionId, 'user_logout');
  }

  async logoutEverywhere(userId: string): Promise<{ revoked: number }> {
    const revoked = await this.tokenService.revokeAllForUser(userId, 'user_logout_all');
    return { revoked };
  }

  async verifyEmail(token: string) {
    const user = await this.userModel.findOne({
      emailVerificationTokenHash: hashToken(token),
      emailVerificationExpiresAt: { $gt: new Date() },
    });
    if (!user) {
      throw AppException.badRequest(
        ERROR_CODES.VALIDATION_FAILED,
        'This verification link is invalid or has expired.',
      );
    }

    user.emailVerified = true;
    if (user.status === USER_STATUS.PENDING_VERIFICATION) user.status = USER_STATUS.ACTIVE;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpiresAt = undefined;
    await user.save();
    await this.authorization.invalidateUser(String(user._id));

    return { verified: true };
  }

  /** Always reports success: a reset request must not confirm an address exists. */
  async requestPasswordReset(dto: RequestPasswordResetDto): Promise<{ requested: true }> {
    const campus = await this.campusModel.findOne({ slug: dto.campusSlug }).select('_id').lean();
    if (!campus) return { requested: true };

    const user = await this.userModel.findOne({ campusId: campus._id, email: dto.email });
    if (!user) return { requested: true };

    const token = generateOpaqueToken();
    user.passwordResetTokenHash = hashToken(token);
    user.passwordResetExpiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await user.save();

    const link = `${this.frontendUrl(PORTALS.CUSTOMER)}/reset-password?token=${token}`;
    await this.mailService.send({
      to: user.email,
      ...mailTemplates.passwordReset(user.name, link),
    });

    return { requested: true };
  }

  async resetPassword(dto: ResetPasswordDto, context: RequestContext) {
    const user = await this.userModel
      .findOne({
        passwordResetTokenHash: hashToken(dto.token),
        passwordResetExpiresAt: { $gt: new Date() },
      })
      .select('+passwordHash');

    if (!user) {
      throw AppException.badRequest(
        ERROR_CODES.VALIDATION_FAILED,
        'This reset link is invalid or has expired.',
      );
    }

    user.passwordHash = await this.passwordService.hash(dto.password);
    user.passwordUpdatedAt = new Date();
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    // A reset is the response to a possible compromise, so nothing stays signed in.
    if (!user.emailVerified) user.emailVerified = true;
    if (user.status === USER_STATUS.PENDING_VERIFICATION) user.status = USER_STATUS.ACTIVE;
    await user.save();

    await this.tokenService.revokeAllForUser(String(user._id), 'password_reset');
    await this.auditService.record({
      campusId: String(user.campusId),
      actorId: String(user._id),
      actorEmail: user.email,
      action: 'auth.password_reset',
      resource: 'user',
      resourceId: String(user._id),
      ip: context.ip,
      userAgent: context.userAgent,
    });

    return { reset: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto, portal: Portal) {
    const user = await this.userModel.findById(userId).select('+passwordHash');
    if (!user) throw AppException.notFound('User');

    const valid = await this.passwordService.verify(user.passwordHash, dto.currentPassword);
    if (!valid) throw AppException.unauthenticated('Your current password is incorrect.');

    if (await this.passwordService.verify(user.passwordHash, dto.newPassword)) {
      throw AppException.badRequest(
        ERROR_CODES.VALIDATION_FAILED,
        'Choose a password you have not used before.',
      );
    }

    user.passwordHash = await this.passwordService.hash(dto.newPassword);
    user.passwordUpdatedAt = new Date();
    await user.save();

    // Every existing session is dropped, then this device is re-issued a fresh one,
    // so a password change signs out anyone who had stolen the old credentials.
    await this.tokenService.revokeAllForUser(userId, 'password_change');
    const tokens = await this.tokenService.issue({
      userId,
      campusId: String(user.campusId),
      portal,
      vendorId: user.vendorId ? String(user.vendorId) : undefined,
    });

    await this.mailService
      .send({ to: user.email, ...mailTemplates.passwordChanged(user.name) })
      .catch(() => undefined);

    return { tokens };
  }

  async sendPhoneOtp(userId: string, phone: string) {
    const otp = generateNumericOtp();
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      {
        $set: {
          phone,
          phoneVerified: false,
          phoneOtpHash: hashToken(otp),
          phoneOtpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
      },
    );

    if (this.config.sms.provider === 'mock') {
      this.logger.warn(`[mock sms] OTP for ${phone.slice(-4).padStart(10, '*')} is ${otp}`);
    }
    // A real provider integration is wired in SmsService; kept out of the auth path
    // so an SMS outage cannot block account changes.
    return { sent: true, expiresInSeconds: OTP_TTL_MS / 1000 };
  }

  async verifyPhoneOtp(userId: string, otp: string) {
    // Bound the guess rate: a 6-digit code is only safe with an attempt limit.
    const attempts = await this.redis.incrementWithTtl(cacheKeys.otpAttempts(userId), 600);
    if (attempts > 5) {
      throw new AppException(
        ERROR_CODES.RATE_LIMITED,
        'Too many incorrect codes. Request a new one.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.userModel
      .findById(userId)
      .select('+phoneOtpHash +phoneOtpExpiresAt');
    if (!user?.phoneOtpHash || !user.phoneOtpExpiresAt || user.phoneOtpExpiresAt < new Date()) {
      throw AppException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'Request a new code.');
    }

    if (!safeEqual(user.phoneOtpHash, hashToken(otp))) {
      throw AppException.badRequest(ERROR_CODES.VALIDATION_FAILED, 'That code is not correct.');
    }

    user.phoneVerified = true;
    user.phoneOtpHash = undefined;
    user.phoneOtpExpiresAt = undefined;
    await user.save();
    await this.redis.del(cacheKeys.otpAttempts(userId));

    return { verified: true };
  }

  async currentUser(userId: string, portal: Portal): Promise<SessionUser> {
    const user = await this.userModel.findById(userId);
    if (!user) throw AppException.notFound('User');
    return this.buildSessionUser(user, portal);
  }

  listSessions(userId: string) {
    return this.tokenService.listSessions(userId);
  }

  applyCookies(response: Response, tokens: IssuedTokens, apiPrefix: string): void {
    this.tokenService.setAuthCookies(response, tokens, apiPrefix);
  }

  clearCookies(response: Response, apiPrefix: string): void {
    this.tokenService.clearAuthCookies(response, apiPrefix);
  }

  async revokeSession(userId: string, sessionId: string) {
    const sessions = await this.tokenService.listSessions(userId);
    if (!sessions.some((session) => String(session._id) === sessionId)) {
      throw AppException.notFound('Session');
    }
    await this.tokenService.revokeSession(sessionId, 'revoked_by_user');
    return { revoked: true };
  }

  private async buildSessionUser(user: UserDocument, portal: Portal): Promise<SessionUser> {
    const principal = await this.authorization.resolvePrincipal(String(user._id));
    return {
      id: String(user._id),
      campusId: String(user.campusId),
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      avatarUrl: user.avatarUrl,
      status: user.status,
      roles: principal?.roles ?? [],
      permissions: principal?.permissions ?? [],
      locale: user.locale,
      createdAt: (user as unknown as { createdAt: Date }).createdAt.toISOString(),
      portal,
      vendorId: user.vendorId ? String(user.vendorId) : undefined,
      loyaltyPoints: user.loyaltyPoints,
      walletBalance: user.walletBalance,
    };
  }

  private async rolesOf(user: UserDocument): Promise<SystemRole[]> {
    if (!user.roleIds?.length) return [];
    const roles = await this.roleModel.find({ _id: { $in: user.roleIds } }).select('slug').lean();
    return roles.map((role) => role.slug as SystemRole);
  }

  /**
   * A session is bound to one portal. Even with correct credentials, a customer
   * cannot obtain an admin-portal session, which stops a stolen customer password
   * from ever reaching operator screens.
   */
  private assertPortalAllowed(portal: Portal, roles: SystemRole[]): void {
    const allowed = new Set(roles.flatMap((role) => ROLE_PORTALS[role] ?? []));
    if (!allowed.has(portal)) {
      throw new AppException(
        ERROR_CODES.WRONG_PORTAL,
        'This account cannot sign in here. Use the portal that matches your role.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private assertEmailDomainAllowed(email: string, campus: CampusDocument): void {
    const domains = campus.emailDomains?.length
      ? campus.emailDomains
      : this.config.auth.allowedEmailDomains;
    if (!domains.length) return;

    const domain = email.split('@')[1] ?? '';
    const allowed = domains.some(
      (candidate) => domain === candidate || domain.endsWith(`.${candidate}`),
    );
    if (!allowed) {
      throw AppException.badRequest(
        ERROR_CODES.VALIDATION_FAILED,
        `Use your campus email address (${domains.join(', ')}).`,
        { email: [`Only ${domains.join(', ')} addresses can register.`] },
      );
    }
  }

  private async registerFailedAttempt(attemptKey: string): Promise<void> {
    const attempts = await this.redis.incrementWithTtl(
      cacheKeys.loginAttempts(attemptKey),
      this.config.auth.lockoutSeconds,
    );
    if (attempts >= this.config.auth.maxFailedAttempts) {
      await this.redis.setFlag(
        cacheKeys.lockout(attemptKey),
        this.config.auth.lockoutSeconds,
      );
      this.logger.warn(`Locked out ${attemptKey} after ${attempts} failed attempts.`);
    }
  }

  private async requireCampus(slug: string): Promise<CampusDocument> {
    const campus = await this.campusModel.findOne({ slug, isActive: true });
    if (!campus) throw AppException.notFound('Campus');
    return campus;
  }

  private async resolveReferrer(
    referralCode: string | undefined,
    campusId: string,
  ): Promise<Types.ObjectId | undefined> {
    if (!referralCode) return undefined;
    const referrer = await this.userModel
      .findOne({ referralCode: referralCode.toUpperCase(), campusId: new Types.ObjectId(campusId) })
      .select('_id')
      .lean();
    return referrer?._id;
  }

  private frontendUrl(portal: Portal): string {
    // Derived from the configured CORS allowlist so links never point off-platform.
    const origins = this.config.http.corsOrigins;
    const byPortal: Record<Portal, number> = {
      [PORTALS.CUSTOMER]: 0,
      [PORTALS.VENDOR]: 1,
      [PORTALS.DELIVERY]: 2,
      [PORTALS.ADMIN]: 3,
    };
    return origins[byPortal[portal]] ?? origins[0] ?? this.config.http.url;
  }
}
