import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, PORTALS } from '@ck/types';
import { IsMongoId, IsOptional } from 'class-validator';
import {
  AllowPortals,
  CurrentUser,
  RequirePermissions,
  TenantId,
} from '@/common/decorators';
import { ObjectIdParam } from '@/common/dto/object-id.dto';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';
import { AppException } from '@/common/exceptions/app.exception';
import type { AuthenticatedUser } from '@/common/types/authenticated-request';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto';

class AvailableCouponsQuery {
  @IsOptional()
  @IsMongoId()
  vendorId?: string;
}

@ApiTags('coupons')
@Controller('coupons')
@RequirePermissions(PERMISSIONS.COUPON_READ)
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  available(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AvailableCouponsQuery,
  ) {
    return this.couponsService.listAvailable(campusId, user.id, query.vendorId);
  }
}

@ApiTags('coupons')
@Controller('admin/coupons')
@AllowPortals(PORTALS.ADMIN)
@RequirePermissions(PERMISSIONS.COUPON_MANAGE)
export class AdminCouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  list(@TenantId() campusId: string, @Query() query: PaginationQueryDto) {
    return this.couponsService.listForAdmin(campusId, query.page, query.limit);
  }

  @Post()
  create(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCouponDto,
  ) {
    return this.couponsService.create(campusId, user.id, dto);
  }

  @Patch(':id')
  update(
    @TenantId() campusId: string,
    @Param() params: ObjectIdParam,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.couponsService.update(campusId, params.id, dto);
  }
}

/** Vendor-funded offers. Scoped to the vendor so it cannot discount other kitchens. */
@ApiTags('coupons')
@Controller('vendor/coupons')
@AllowPortals(PORTALS.VENDOR)
@RequirePermissions(PERMISSIONS.COUPON_MANAGE)
export class VendorCouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  list(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.couponsService.listForAdmin(campusId, query.page, query.limit, this.vendorOf(user));
  }

  @Post()
  create(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCouponDto,
  ) {
    return this.couponsService.create(campusId, user.id, dto, this.vendorOf(user));
  }

  @Patch(':id')
  update(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ObjectIdParam,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.couponsService.update(campusId, params.id, dto, this.vendorOf(user));
  }

  private vendorOf(user: AuthenticatedUser): string {
    if (!user.vendorId) throw AppException.forbidden('Your account is not linked to a kitchen.');
    return user.vendorId;
  }
}
