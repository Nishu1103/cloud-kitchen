import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsHexColor,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsTimeZone,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

class BrandingDto {
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  logoUrl?: string;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsHexColor()
  accentColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  tagline?: string;
}

export class CreateCampusDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  /** The subdomain / URL segment for this tenant. */
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Use lowercase letters, numbers and hyphens only.',
  })
  @MaxLength(40)
  slug: string;

  @IsString()
  @MaxLength(80)
  city: string;

  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrandingDto)
  branding?: BrandingDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCampusDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrandingDto)
  branding?: BrandingDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateZoneDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsInt()
  @Min(0)
  @Max(50_000)
  deliveryFee: number;

  @IsInt()
  @Min(5)
  @Max(180)
  etaMinutes: number;

  /** Closed ring of [longitude, latitude] pairs. */
  @IsOptional()
  @IsArray()
  polygon?: number[][];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  minOrderValue?: number;
}
