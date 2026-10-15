import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, PORTALS } from '@ck/types';
import { AllowPortals, CurrentUser, RequirePermissions, TenantId } from '@/common/decorators';
import { DateRangeQueryDto } from '@/common/dto/pagination.dto';
import { AppException } from '@/common/exceptions/app.exception';
import type { AuthenticatedUser } from '@/common/types/authenticated-request';
import { AnalyticsService } from './analytics.service';

/** Defaults to the last 30 days when no range is given. */
function resolveRange(query: DateRangeQueryDto): { from: Date; to: Date } {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - 29 * 86_400_000);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

@ApiTags('analytics')
@Controller('vendor/analytics')
@AllowPortals(PORTALS.VENDOR)
export class VendorAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @RequirePermissions(PERMISSIONS.ANALYTICS_VIEW_OWN)
  dashboard(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.analyticsService.vendorDashboard(campusId, this.vendorOf(user), resolveRange(query));
  }

  @Get('peak-hours')
  @RequirePermissions(PERMISSIONS.ANALYTICS_VIEW_OWN)
  peakHours(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.analyticsService.peakHours(campusId, this.vendorOf(user), resolveRange(query));
  }

  private vendorOf(user: AuthenticatedUser): string {
    if (!user.vendorId) throw AppException.forbidden('Your account is not linked to a kitchen.');
    return user.vendorId;
  }
}

@ApiTags('analytics')
@Controller('admin/analytics')
@AllowPortals(PORTALS.ADMIN)
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @RequirePermissions(PERMISSIONS.ANALYTICS_VIEW_ALL)
  dashboard(@TenantId() campusId: string, @Query() query: DateRangeQueryDto) {
    return this.analyticsService.adminDashboard(campusId, resolveRange(query));
  }

  @Get('peak-hours')
  @RequirePermissions(PERMISSIONS.ANALYTICS_VIEW_ALL)
  peakHours(@TenantId() campusId: string, @Query() query: DateRangeQueryDto) {
    return this.analyticsService.peakHours(campusId, undefined, resolveRange(query));
  }
}
