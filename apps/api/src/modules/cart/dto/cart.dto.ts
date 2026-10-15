import { ORDER_TYPE, type OrderType } from '@ck/types';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AddCartLineDto {
  @IsMongoId()
  vendorId: string;

  @IsMongoId()
  productId: string;

  @IsInt()
  @Min(1)
  @Max(50)
  quantity: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  choiceIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;

  @IsOptional()
  @IsIn(Object.values(ORDER_TYPE))
  orderType?: OrderType;

  /** Explicit consent to drop items from a different kitchen. */
  @IsOptional()
  @IsBoolean()
  replaceCart?: boolean;
}

export class UpdateCartLineDto {
  /** Zero removes the line. */
  @IsInt()
  @Min(0)
  @Max(50)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;

  @IsOptional()
  @IsIn(Object.values(ORDER_TYPE))
  orderType?: OrderType;
}

export class ApplyCartCouponDto {
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{4,24}$/)
  code?: string;
}

export class WalletPreferenceDto {
  @IsBoolean()
  applyWallet: boolean;
}
