import { ORDER_STATUS, ORDER_TYPE, PAYMENT_METHOD, type OrderStatus, type OrderType, type PaymentMethod } from '@ck/types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';
import { QUERY_FLAG_VALUES } from '@/common/dto/transforms';

export class OrderLineDto {
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
}

/**
 * Note what is absent: no prices, no totals, no discount amount. The client states
 * what it wants, never what it costs - every amount is computed server-side.
 */
export class PlaceOrderDto {
  @IsMongoId()
  vendorId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  lines: OrderLineDto[];

  @IsIn(Object.values(ORDER_TYPE))
  type: OrderType;

  @IsIn(Object.values(PAYMENT_METHOD))
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsMongoId()
  addressId?: string;

  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{4,24}$/)
  couponCode?: string;

  @IsOptional()
  @IsBoolean()
  applyWallet?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  instructions?: string;

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}

export class UpdateOrderStatusDto {
  @IsIn(Object.values(ORDER_STATUS))
  status: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}

export class CancelOrderDto {
  @IsString()
  @MaxLength(240)
  reason: string;
}

export class RefundOrderDto {
  @IsInt()
  @Min(1)
  amount: number;

  @IsString()
  @MaxLength(240)
  reason: string;
}

export class OrderQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(Object.values(ORDER_STATUS))
  status?: OrderStatus;

  @IsOptional()
  @IsIn([...QUERY_FLAG_VALUES])
  live?: boolean | string;
}
