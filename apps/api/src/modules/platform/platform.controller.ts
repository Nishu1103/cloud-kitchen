import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FEATURE_FLAGS, PERMISSIONS, PORTALS, type FeatureFlagKey } from '@ck/types';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  AllowPortals,
  CurrentUser,
  OptionalUser,
  Public,
  RequirePermissions,
  TenantId,
} from '@/common/decorators';
import type { AuthenticatedUser } from '@/common/types/authenticated-request';
import { FeatureFlagsService } from './feature-flags.service';
import { SettingsService } from './settings.service';

class UpsertFlagDto {
  @IsIn(FEATURE_FLAGS)
  key: FeatureFlagKey;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercent?: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

class UpsertSettingDto {
  @Matches(/^[a-z0-9_]{2,40}$/)
  group: string;

  @Matches(/^[a-zA-Z0-9_.]{2,60}$/)
  key: string;

  /** Value is intentionally untyped; each consumer coerces and defaults it. */
  value: unknown;

  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;
}

/** Read-only configuration every portal needs at boot. */
@ApiTags('platform')
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly featureFlags: FeatureFlagsService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Public, because the storefront itself is: an anonymous visitor sees the same
   * flag-gated banners and happy-hour pricing as a signed-in one. Only public settings
   * and flag booleans are returned — never a flag's internal config or a sensitive
   * setting. The user, when present, only affects percentage-rollout bucketing.
   */
  @Get('bootstrap')
  @Public()
  async bootstrap(
    @TenantId() campusId: string,
    @OptionalUser() user: AuthenticatedUser | undefined,
  ) {
    const [flags, settings] = await Promise.all([
      this.featureFlags.publicFlags(campusId, user?.id),
      this.settings.listPublic(campusId),
    ]);
    return { flags, settings };
  }
}

@ApiTags('platform')
@Controller('admin/platform')
@AllowPortals(PORTALS.ADMIN)
export class AdminPlatformController {
  constructor(
    private readonly featureFlags: FeatureFlagsService,
    private readonly settings: SettingsService,
  ) {}

  @Get('feature-flags')
  @RequirePermissions(PERMISSIONS.FEATURE_FLAG_MANAGE)
  listFlags(@TenantId() campusId: string) {
    return this.featureFlags.listForAdmin(campusId);
  }

  @Post('feature-flags')
  @RequirePermissions(PERMISSIONS.FEATURE_FLAG_MANAGE)
  upsertFlag(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertFlagDto,
  ) {
    return this.featureFlags.upsert({ campusId, updatedBy: user.id, ...dto });
  }

  @Get('settings')
  @RequirePermissions(PERMISSIONS.PLATFORM_SETTINGS_MANAGE)
  listSettings(@TenantId() campusId: string) {
    return this.settings.listPublic(campusId);
  }

  @Post('settings')
  @RequirePermissions(PERMISSIONS.PLATFORM_SETTINGS_MANAGE)
  upsertSetting(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertSettingDto,
  ) {
    return this.settings.upsert({ campusId, updatedBy: user.id, ...dto });
  }
}
