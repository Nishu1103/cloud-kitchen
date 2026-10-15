import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, PORTALS, VENDOR_STATUS, type VendorStatus } from '@ck/types';
import { IsIn, IsOptional } from 'class-validator';
import {
  AllowPortals,
  CurrentUser,
  Public,
  RequirePermissions,
  TenantId,
} from '@/common/decorators';
import { ObjectIdParam, SlugParam } from '@/common/dto/object-id.dto';
import { AppException } from '@/common/exceptions/app.exception';
import type { AuthenticatedRequest, AuthenticatedUser } from '@/common/types/authenticated-request';
import { AuditService } from '@/modules/audit/audit.service';
import {
  AdminUpdateVendorDto,
  BrowseVendorsDto,
  CreateVendorDto,
  ToggleOpenDto,
  UpdateVendorDto,
  VendorDecisionDto,
} from './dto/vendor.dto';
import { VendorsService } from './vendors.service';

class AdminVendorQueryDto extends BrowseVendorsDto {
  @IsOptional()
  @IsIn(Object.values(VENDOR_STATUS))
  status?: VendorStatus;
}

/**
 * Customer browse surface.
 *
 * Public: a student compares menus before deciding to create an account, and reviews and
 * campus pages are already readable anonymously. The tenant still comes from the campus
 * slug on the request, and the service only ever returns approved kitchens, so "public"
 * means one campus's storefront rather than the whole platform's vendor table.
 */
@ApiTags('vendors')
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  @Public()
  browse(@TenantId() campusId: string, @Query() query: BrowseVendorsDto) {
    return this.vendorsService.browse(campusId, query);
  }

  @Get(':slug')
  @Public()
  bySlug(@TenantId() campusId: string, @Param() params: SlugParam) {
    return this.vendorsService.findPublicBySlug(campusId, params.slug);
  }
}

@ApiTags('vendors')
@Controller('vendor/profile')
@AllowPortals(PORTALS.VENDOR)
export class VendorSelfController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.VENDOR_READ)
  me(@TenantId() campusId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vendorsService.findForOwner(this.requireVendor(user), campusId);
  }

  @Patch()
  @RequirePermissions(PERMISSIONS.VENDOR_UPDATE_OWN)
  update(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.vendorsService.update(this.requireVendor(user), campusId, dto);
  }

  @Patch('open-state')
  @RequirePermissions(PERMISSIONS.VENDOR_UPDATE_OWN)
  toggleOpen(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ToggleOpenDto,
  ) {
    return this.vendorsService.setOpen(this.requireVendor(user), campusId, dto.isOpen);
  }

  private requireVendor(user: AuthenticatedUser): string {
    if (!user.vendorId) throw AppException.forbidden('Your account is not linked to a kitchen.');
    return user.vendorId;
  }
}

/** Vendor onboarding, available to any signed-in customer who wants to sell. */
@ApiTags('vendors')
@Controller('vendor/onboarding')
export class VendorOnboardingController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.VENDOR_CREATE)
  create(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVendorDto,
  ) {
    return this.vendorsService.create(campusId, user.id, dto);
  }
}

@ApiTags('vendors')
@Controller('admin/vendors')
@AllowPortals(PORTALS.ADMIN)
export class AdminVendorsController {
  constructor(
    private readonly vendorsService: VendorsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.VENDOR_READ)
  list(@TenantId() campusId: string, @Query() query: AdminVendorQueryDto) {
    return this.vendorsService.listForAdmin(campusId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.VENDOR_READ)
  one(@TenantId() campusId: string, @Param() params: ObjectIdParam) {
    return this.vendorsService.findForAdmin(params.id, campusId);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.VENDOR_UPDATE_ANY)
  async update(
    @TenantId() campusId: string,
    @Param() params: ObjectIdParam,
    @Body() dto: AdminUpdateVendorDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const vendor = await this.vendorsService.adminUpdate(params.id, campusId, dto);
    await this.auditService.recordFromRequest(request, {
      action: 'vendor.update',
      resource: 'vendor',
      resourceId: params.id,
      metadata: { changes: dto },
    });
    return vendor;
  }

  @Post(':id/decision')
  @RequirePermissions(PERMISSIONS.VENDOR_APPROVE)
  async decide(
    @TenantId() campusId: string,
    @Param() params: ObjectIdParam,
    @Body() dto: VendorDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    const vendor = await this.vendorsService.decide(params.id, campusId, dto, user.id);
    await this.auditService.recordFromRequest(request, {
      action: `vendor.${dto.status}`,
      resource: 'vendor',
      resourceId: params.id,
      metadata: { reason: dto.reason },
    });
    return vendor;
  }
}
