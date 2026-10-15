import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { COOKIES } from '@/common/constants/cache-keys';
import { CurrentUser, Public } from '@/common/decorators';
import { ObjectIdParam } from '@/common/dto/object-id.dto';
import type { AuthenticatedRequest, AuthenticatedUser } from '@/common/types/authenticated-request';
import { CONFIG, type AppConfig } from '@/config';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  SendPhoneOtpDto,
  VerifyEmailDto,
  VerifyPhoneOtpDto,
} from './dto/auth.dto';

/**
 * Tokens are returned as httpOnly cookies rather than in the response body, so a
 * cross-site script cannot read them. The body carries only the user profile the
 * portal needs to render, plus the access token for non-browser clients.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('register')
  @Public()
  // Registration is expensive (Argon2 + email) and a prime abuse target.
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto, @Req() request: AuthenticatedRequest) {
    return this.authService.register(dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('login')
  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { tokens, user } = await this.authService.login(dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    this.authService.applyCookies(response, tokens, this.config.http.globalPrefix);
    return { user, accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Post('refresh')
  @Public()
  @Throttle({ auth: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookies = (request.cookies ?? {}) as Record<string, string | undefined>;
    const presented = cookies[COOKIES.REFRESH_TOKEN];
    const { tokens, user } = await this.authService.refresh(presented, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    this.authService.applyCookies(response, tokens, this.config.http.globalPrefix);
    return { user, accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(user.sessionId);
    this.authService.clearCookies(response, this.config.http.globalPrefix);
    return { loggedOut: true };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.logoutEverywhere(user.id);
    this.authService.clearCookies(response, this.config.http.globalPrefix);
    return result;
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.currentUser(user.id, user.portal);
  }

  @Get('sessions')
  sessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.listSessions(user.id);
  }

  @Delete('sessions/:id')
  revokeSession(@CurrentUser() user: AuthenticatedUser, @Param() params: ObjectIdParam) {
    return this.authService.revokeSession(user.id, params.id);
  }

  @Post('verify-email')
  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ auth: { limit: 3, ttl: 300_000 } })
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('reset-password')
  @Public()
  @Throttle({ auth: { limit: 5, ttl: 300_000 } })
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto, @Req() request: AuthenticatedRequest) {
    return this.authService.resetPassword(dto, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { tokens } = await this.authService.changePassword(user.id, dto, user.portal);
    this.authService.applyCookies(response, tokens, this.config.http.globalPrefix);
    return { changed: true };
  }

  @Post('phone/send-otp')
  @Throttle({ auth: { limit: 3, ttl: 300_000 } })
  @HttpCode(HttpStatus.OK)
  sendOtp(@CurrentUser() user: AuthenticatedUser, @Body() dto: SendPhoneOtpDto) {
    return this.authService.sendPhoneOtp(user.id, dto.phone);
  }

  @Post('phone/verify-otp')
  @Throttle({ auth: { limit: 10, ttl: 300_000 } })
  @HttpCode(HttpStatus.OK)
  verifyOtp(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyPhoneOtpDto) {
    return this.authService.verifyPhoneOtp(user.id, dto.otp);
  }
}
