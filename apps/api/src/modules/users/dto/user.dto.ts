import { PHONE_PATTERN, USER_STATUS, type UserStatus } from '@ck/types';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Enter a valid phone number.' })
  phone?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  avatarUrl?: string;
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsIn(['en', 'hi', 'bn', 'ta', 'te'])
  locale?: string;

  @IsOptional()
  @IsIn(['veg', 'non_veg', 'egg', 'vegan', 'none'])
  dietaryPreference?: string;

  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;
}

/**
 * A campus address is usually a hostel and a room rather than a street line, so all
 * three are optional here and the service requires at least one of them. The phone
 * pattern is the shared one so a value that passes validation can never be rejected
 * later by the schema.
 */
export class AddressDto {
  @IsString()
  @MaxLength(40)
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  hostel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  roomNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  line1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  line2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  landmark?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  contactName?: string;

  /** Defaults to the account's own phone when omitted. */
  @IsOptional()
  @Matches(PHONE_PATTERN, { message: 'Enter a valid 10-digit mobile number.' })
  contactPhone?: string;

  @IsOptional()
  @IsMongoId()
  campusZoneId?: string;

  /** GeoJSON order: [longitude, latitude]. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  coordinates?: [number, number];

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class AdminUpdateUserDto {
  @IsOptional()
  @IsIn(Object.values(USER_STATUS))
  status?: UserStatus;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  statusReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
}

export class UserQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(Object.values(USER_STATUS))
  status?: UserStatus;
}
