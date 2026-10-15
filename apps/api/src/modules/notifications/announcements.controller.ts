import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, PORTALS } from '@ck/types';
import {
  AllowPortals,
  CurrentUser,
  RequirePermissions,
  TenantId,
} from '@/common/decorators';
import { ObjectIdParam } from '@/common/dto/object-id.dto';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';
import { AppException } from '@/common/exceptions/app.exception';
import type { AuthenticatedRequest, AuthenticatedUser } from '@/common/types/authenticated-request';
import { AuditService } from '@/modules/audit/audit.service';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/notifications.dto';

@ApiTags('announcements')
@Controller('admin/announcements')
@AllowPortals(PORTALS.ADMIN)
@RequirePermissions(PERMISSIONS.ANNOUNCEMENT_SEND)
export class AdminAnnouncementsController {
  constructor(
    private readonly announcementsService: AnnouncementsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  list(@TenantId() campusId: string, @Query() query: PaginationQueryDto) {
    return this.announcementsService.list(campusId, { page: query.page, limit: query.limit });
  }

  @Post()
  async create(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAnnouncementDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const announcement = await this.announcementsService.create({
      campusId,
      createdBy: user.id,
      dto,
    });
    await this.auditService.recordFromRequest(request, {
      action: 'announcement.create',
      resource: 'announcement',
      resourceId: String((announcement as { id?: string }).id ?? ''),
      metadata: { audiences: dto.audiences, sendNow: dto.sendNow ?? false },
    });
    return announcement;
  }

  @Post(':id/send')
  send(@TenantId() campusId: string, @Param() params: ObjectIdParam) {
    return this.announcementsService.sendNow(campusId, params.id);
  }
}

/** Vendor-scoped promotions. Quota-limited and customer-only, enforced in the service. */
@ApiTags('announcements')
@Controller('vendor/announcements')
@AllowPortals(PORTALS.VENDOR)
@RequirePermissions(PERMISSIONS.ANNOUNCEMENT_SEND_VENDOR_SCOPE)
export class VendorAnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  list(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.announcementsService.list(campusId, {
      page: query.page,
      limit: query.limit,
      vendorId: this.requireVendor(user),
    });
  }

  @Post()
  create(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.announcementsService.create({
      campusId,
      createdBy: user.id,
      vendorId: this.requireVendor(user),
      dto,
    });
  }

  @Post(':id/send')
  send(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ObjectIdParam,
  ) {
    return this.announcementsService.sendNow(campusId, params.id, this.requireVendor(user));
  }

  private requireVendor(user: AuthenticatedUser): string {
    if (!user.vendorId) {
      throw AppException.forbidden('Your account is not linked to a kitchen.');
    }
    return user.vendorId;
  }
}
