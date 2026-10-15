import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  /** Hard ceiling so a client cannot ask for the whole collection. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  /** Allowlisted at the service layer; never interpolated into a raw query. */
  @IsOptional()
  @IsString()
  @Matches(/^-?[a-zA-Z0-9_.]{1,40}$/, { message: 'sort must be a field name, optionally -prefixed' })
  sort?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

export class DateRangeQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be YYYY-MM-DD' })
  to?: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  granularity: 'day' | 'week' | 'month' = 'day';
}
