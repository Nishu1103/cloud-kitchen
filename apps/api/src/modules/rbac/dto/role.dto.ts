import { ALL_PERMISSIONS, type Permission } from '@ck/types';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @Matches(/^[a-z0-9_]{3,40}$/, { message: 'slug must be lowercase letters, digits or underscores' })
  slug: string;

  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  /**
   * `IsIn` against the compiled allowlist is the authorization boundary: an
   * operator cannot invent a permission string, and a request body cannot smuggle
   * one in.
   */
  @IsArray()
  @ArrayUnique()
  @IsIn(ALL_PERMISSIONS, { each: true })
  permissions: Permission[];
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(ALL_PERMISSIONS, { each: true })
  permissions?: Permission[];
}

export class AssignRolesDto {
  @IsArray()
  @ArrayUnique()
  @Matches(/^[a-f\d]{24}$/i, { each: true, message: 'roleIds must be object ids' })
  roleIds: string[];
}

export class SetDirectPermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsIn(ALL_PERMISSIONS, { each: true })
  permissions: Permission[];

  @IsOptional()
  @IsBoolean()
  replace?: boolean;
}
