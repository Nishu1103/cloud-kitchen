import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';

export const BANNER_PLACEMENTS = ['home_hero', 'home_strip', 'vendor_top', 'checkout'] as const;

export const TICKET_CATEGORIES = [
  'order_issue',
  'payment',
  'refund',
  'quality',
  'delivery',
  'account',
  'other',
] as const;

export const TICKET_STATUSES = ['open', 'pending', 'resolved', 'closed'] as const;

export class UpsertPageDto {
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(60)
  slug: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title: string;

  /**
   * Trusted HTML authored by staff. It is rendered as-is, so the write permission is
   * effectively a stored-XSS capability - keep `cms:manage` off untrusted roles.
   */
  @IsString()
  @MaxLength(100_000)
  contentHtml: string;

  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  metaDescription?: string;
}

export class CreateBannerDto {
  @IsString()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subtitle?: string;

  @IsUrl({ require_protocol: true, protocols: ['https'] })
  imageUrl: string;

  /** In-app path only: an absolute URL here would be an open-redirect surface. */
  @IsOptional()
  @Matches(/^\/[\w\-./?=&]*$/, { message: 'Use an in-app path such as /vendors/abc.' })
  @MaxLength(200)
  deepLink?: string;

  @IsIn(BANNER_PLACEMENTS)
  placement: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class CreateTicketDto {
  @IsString()
  @MinLength(4)
  @MaxLength(160)
  subject: string;

  @IsIn(TICKET_CATEGORIES)
  category: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsMongoId()
  orderId?: string;
}

export class ReplyTicketDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;

  @IsOptional()
  @IsBoolean()
  resolve?: boolean;
}

export class TicketQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(TICKET_STATUSES)
  status?: string;
}
