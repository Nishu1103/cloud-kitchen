import { DIET_TYPE, PRODUCT_FLAGS, type DietType, type ProductFlag } from '@ck/types';
import { Transform, Type } from 'class-transformer';
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
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';

export class OptionChoiceDto {
  @IsString()
  @MaxLength(40)
  id: string;

  @IsString()
  @MaxLength(80)
  name: string;

  /** Signed: a smaller portion may reduce the price. */
  @IsInt()
  @Min(-100_000)
  @Max(100_000)
  priceDelta: number;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

export class OptionGroupDto {
  @IsString()
  @MaxLength(40)
  id: string;

  @IsString()
  @MaxLength(80)
  name: string;

  @IsInt()
  @Min(0)
  @Max(20)
  minSelect: number;

  @IsInt()
  @Min(1)
  @Max(20)
  maxSelect: number;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => OptionChoiceDto)
  choices: OptionChoiceDto[];
}

export class CreateProductDto {
  @IsString()
  @MaxLength(140)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  description?: string;

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  imageUrl?: string;

  /** Integer paise. Rupee floats are rejected at the edge. */
  @IsInt({ message: 'basePrice must be an integer amount in paise' })
  @Min(0)
  @Max(10_000_000)
  basePrice: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  compareAtPrice?: number;

  @IsIn(Object.values(DIET_TYPE))
  diet: DietType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  spiceLevel?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsIn(PRODUCT_FLAGS, { each: true })
  flags?: ProductFlag[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => OptionGroupDto)
  optionGroups?: OptionGroupDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  prepMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  availableFrom?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  availableTo?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateProductDto extends CreateProductDto {
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

export class UpdateStockDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  stockQuantity?: number | null;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

/** Bulk merchandising toggle, e.g. marking six items as today's special. */
export class ToggleFlagsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  productIds: string[];

  @IsIn(PRODUCT_FLAGS)
  flag: ProductFlag;

  @IsBoolean()
  enabled: boolean;
}

export class CreateCategoryDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @Matches(/^[a-z0-9-]{2,80}$/)
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  iconUrl?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class BrowseProductsDto extends PaginationQueryDto {
  @IsOptional()
  @IsMongoId()
  vendorId?: string;

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @IsIn(Object.values(DIET_TYPE))
  diet?: DietType;

  @IsOptional()
  @IsIn(PRODUCT_FLAGS)
  flag?: ProductFlag;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  maxPrice?: number;

  @IsOptional()
  @IsIn(['price', '-price', 'rating', '-rating', 'soldCount', '-soldCount'])
  sortBy?: string;
}
