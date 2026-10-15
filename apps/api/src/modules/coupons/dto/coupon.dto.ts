import { COUPON_TYPE, type CouponType } from '@ck/types';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCouponDto {
  @Matches(/^[A-Za-z0-9_-]{4,24}$/, { message: 'code must be 4-24 letters, digits, - or _' })
  code: string;

  @IsString()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @IsIn(Object.values(COUPON_TYPE))
  type: CouponType;

  /** Percentage points for `percentage`, paise for `flat`. */
  @IsInt()
  @Min(0)
  value: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxDiscount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minOrderAmount?: number;

  @IsDateString()
  validFrom: string;

  @IsDateString()
  validTo: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimitTotal?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimitPerUser?: number;

  @IsOptional()
  @IsBoolean()
  firstOrderOnly?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsMongoId({ each: true })
  restrictedToUserIds?: string[];
}

export class UpdateCouponDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimitTotal?: number;

  @IsOptional()
  @IsDateString()
  validTo?: string;
}

export class ApplyCouponDto {
  @Matches(/^[A-Za-z0-9_-]{4,24}$/)
  code: string;
}
