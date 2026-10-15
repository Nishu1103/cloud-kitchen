import { VENDOR_STATUS, type VendorStatus } from '@ck/types';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';
import { QUERY_FLAG_VALUES } from '@/common/dto/transforms';

export class OperatingHourDto {
  @IsInt()
  @Min(0)
  @Max(6)
  day: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'open must be HH:mm' })
  open: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'close must be HH:mm' })
  close: string;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;
}

export class CreateVendorDto {
  @IsString()
  @MaxLength(120)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @Matches(/^[a-z0-9-]{2,60}$/, { message: 'slug must be lowercase letters, digits or hyphens' })
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  cuisines: string[];

  @IsOptional()
  @Matches(/^[6-9]\d{9}$/)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string;
}

/**
 * Fields a vendor may change about themselves. Commission, status and payout
 * details are deliberately absent - those are admin-only and live in a separate DTO,
 * so a vendor cannot lower their own commission by adding a field to the request.
 */
export class UpdateVendorDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  coverUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  cuisines?: string[];

  @IsOptional()
  @IsBoolean()
  acceptsDelivery?: boolean;

  @IsOptional()
  @IsBoolean()
  acceptsPickup?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  avgPrepMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  packagingFee?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => OperatingHourDto)
  operatingHours?: OperatingHourDto[];

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  themeColor?: string;

  @IsOptional()
  @Matches(/^[6-9]\d{9}$/)
  contactPhone?: string;
}

/** Admin-only levers, kept apart from the vendor-editable surface. */
export class AdminUpdateVendorDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(40)
  commissionPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  deliveryFee?: number;

  @IsOptional()
  @IsInt()
  sortWeight?: number;
}

export class VendorDecisionDto {
  @IsIn([VENDOR_STATUS.APPROVED, VENDOR_STATUS.REJECTED, VENDOR_STATUS.SUSPENDED])
  status: VendorStatus;

  @ValidateIf(
    (dto: VendorDecisionDto) =>
      dto.status === VENDOR_STATUS.REJECTED || dto.status === VENDOR_STATUS.SUSPENDED,
  )
  @IsString()
  @MinLength(8)
  @MaxLength(300)
  reason?: string;
}

export class ToggleOpenDto {
  @IsBoolean()
  isOpen: boolean;
}

export class BrowseVendorsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  cuisine?: string;

  @IsOptional()
  @IsIn([...QUERY_FLAG_VALUES])
  openOnly?: boolean | string;

  @IsOptional()
  @IsIn(['popular', 'rating', '-rating', 'name', '-name', 'avgPrepMinutes', 'prep', '-prep'])
  sortBy?: string;
}
