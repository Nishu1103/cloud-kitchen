import { PASSWORD_RULES, PORTALS, type Portal } from '@ck/types';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(160)
  @Transform(normalizeEmail)
  email: string;

  @IsString()
  @MinLength(PASSWORD_RULES.min)
  @MaxLength(PASSWORD_RULES.max)
  @Matches(PASSWORD_RULES.pattern, { message: PASSWORD_RULES.message })
  password: string;

  @IsOptional()
  @Matches(/^[6-9]\d{9}$/, { message: 'Enter a valid 10-digit Indian mobile number.' })
  phone?: string;

  @Matches(/^[a-z0-9-]{2,40}$/, { message: 'campusSlug is required.' })
  campusSlug: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  referralCode?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(160)
  @Transform(normalizeEmail)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;

  @Matches(/^[a-z0-9-]{2,40}$/)
  campusSlug: string;

  /** The portal the client is signing in to; the session is bound to it. */
  @IsIn(Object.values(PORTALS))
  portal: Portal;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceLabel?: string;
}

export class VerifyEmailDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token: string;
}

export class RequestPasswordResetDto {
  @IsEmail()
  @MaxLength(160)
  @Transform(normalizeEmail)
  email: string;

  @Matches(/^[a-z0-9-]{2,40}$/)
  campusSlug: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token: string;

  @IsString()
  @MinLength(PASSWORD_RULES.min)
  @MaxLength(PASSWORD_RULES.max)
  @Matches(PASSWORD_RULES.pattern, { message: PASSWORD_RULES.message })
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  @MaxLength(128)
  currentPassword: string;

  @IsString()
  @MinLength(PASSWORD_RULES.min)
  @MaxLength(PASSWORD_RULES.max)
  @Matches(PASSWORD_RULES.pattern, { message: PASSWORD_RULES.message })
  newPassword: string;
}

export class SendPhoneOtpDto {
  @Matches(/^[6-9]\d{9}$/, { message: 'Enter a valid 10-digit Indian mobile number.' })
  phone: string;
}

export class VerifyPhoneOtpDto {
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code.' })
  otp: string;
}
