import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';

export class CreateReviewDto {
  @IsMongoId()
  orderId: string;

  @IsOptional()
  @IsMongoId()
  productId?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  foodRating?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  deliveryRating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsUrl({ require_protocol: true, protocols: ['https'] }, { each: true })
  images?: string[];

  @IsOptional()
  @IsBoolean()
  anonymous?: boolean;
}

export class VendorReplyDto {
  @IsString()
  @MaxLength(600)
  reply: string;
}

export class ModerateReviewDto {
  @IsBoolean()
  isHidden: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

export class ReviewQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  hidden?: boolean;
}
