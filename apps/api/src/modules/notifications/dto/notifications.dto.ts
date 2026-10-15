import {
  DEVICE_PLATFORM,
  NOTIFICATION_AUDIENCE,
  NOTIFICATION_PREFERENCE_KEYS,
  type DevicePlatform,
} from '@ck/types';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsMongoId,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @MaxLength(512)
  token: string;

  @IsIn(Object.values(DEVICE_PLATFORM))
  platform: DevicePlatform;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  browser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceLabel?: string;
}

export class UnregisterDeviceDto {
  @IsString()
  @MaxLength(512)
  token: string;
}

export class MarkReadDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  ids: string[];
}

@ValidatorConstraint({ name: 'knownPreferenceMap' })
class KnownPreferenceMap implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) return false;
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length || entries.length > NOTIFICATION_PREFERENCE_KEYS.length) return false;
    return entries.every(
      ([key, flag]) =>
        NOTIFICATION_PREFERENCE_KEYS.includes(key) && typeof flag === 'boolean',
    );
  }

  defaultMessage(): string {
    return 'preferences must map known notification keys to booleans';
  }
}

export class UpdatePreferencesDto {
  /**
   * Flat patch of `category:<name>` / `channel:<name>` to booleans. Keys are
   * allowlisted against `NOTIFICATION_PREFERENCE_KEYS` and values must be booleans,
   * so nothing outside the known set can reach the user document.
   */
  @IsObject()
  @Validate(KnownPreferenceMap)
  preferences: Record<string, boolean>;
}

export class CreateAnnouncementDto {
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title: string;

  @IsString()
  @MaxLength(400)
  body: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  imageUrl?: string;

  /** Internal route only, so a broadcast cannot redirect students off-platform. */
  @IsOptional()
  @Matches(/^\/[A-Za-z0-9\-._~/?=&]*$/, { message: 'deepLink must be an in-app path' })
  @MaxLength(200)
  deepLink?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(Object.values(NOTIFICATION_AUDIENCE), { each: true })
  audiences: string[];

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  sendNow?: boolean;
}
