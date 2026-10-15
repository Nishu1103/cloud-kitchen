import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DELIVERY_STATUS, PERMISSIONS, PORTALS, type DeliveryStatus } from '@ck/types';
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
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  AllowPortals,
  CurrentUser,
  RequirePermissions,
  TenantId,
} from '@/common/decorators';
import { ObjectIdParam } from '@/common/dto/object-id.dto';
import { PaginationQueryDto } from '@/common/dto/pagination.dto';
import { parseQueryFlag, QUERY_FLAG_VALUES } from '@/common/dto/transforms';
import type { AuthenticatedUser } from '@/common/types/authenticated-request';
import { DeliveryService } from './delivery.service';

class OnlineDto {
  @IsBoolean()
  isOnline: boolean;
}

class LocationDto {
  /** GeoJSON order: [longitude, latitude]. */
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  @Min(-180, { each: true })
  @Max(180, { each: true })
  coordinates: [number, number];
}

class UpdateDeliveryStatusDto {
  @IsIn([
    DELIVERY_STATUS.ARRIVED_AT_VENDOR,
    DELIVERY_STATUS.PICKED_UP,
    DELIVERY_STATUS.ARRIVED_AT_CUSTOMER,
    DELIVERY_STATUS.DELIVERED,
    DELIVERY_STATUS.FAILED,
  ])
  status: DeliveryStatus;

  /** Required to complete a delivery: the customer reads it out at handover. */
  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'The handover code is 6 digits.' })
  otp?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  location?: [number, number];

  /** Only read for a failed delivery: what the admin reviewing the refund will see. */
  @IsOptional()
  @IsString()
  @MaxLength(240)
  failureReason?: string;
}

class JobsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn([...QUERY_FLAG_VALUES])
  active?: boolean | string;
}

class AssignDto {
  @IsMongoId()
  partnerId: string;
}

class AdminDeliveryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(Object.values(DELIVERY_STATUS))
  status?: DeliveryStatus;
}

@ApiTags('delivery')
@Controller('delivery')
@AllowPortals(PORTALS.DELIVERY)
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get('offers')
  @RequirePermissions(PERMISSIONS.DELIVERY_READ_OWN)
  offers(@TenantId() campusId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.deliveryService.availableJobs(campusId, user.id);
  }

  @Get('jobs')
  @RequirePermissions(PERMISSIONS.DELIVERY_READ_OWN)
  jobs(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: JobsQueryDto,
  ) {
    return this.deliveryService.myJobs(
      campusId,
      user.id,
      query.page,
      query.limit,
      query.active === undefined ? true : parseQueryFlag(query.active),
    );
  }

  @Get('earnings')
  @RequirePermissions(PERMISSIONS.DELIVERY_READ_OWN)
  earnings(@TenantId() campusId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.deliveryService.earnings(campusId, user.id);
  }

  @Patch('availability')
  @RequirePermissions(PERMISSIONS.DELIVERY_UPDATE_STATUS)
  availability(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: OnlineDto,
  ) {
    return this.deliveryService.setOnline(campusId, user.id, dto.isOnline);
  }

  @Patch('location')
  @RequirePermissions(PERMISSIONS.DELIVERY_UPDATE_STATUS)
  location(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: LocationDto,
  ) {
    return this.deliveryService.updateLocation(campusId, user.id, dto.coordinates);
  }

  @Post('jobs/:id/accept')
  @RequirePermissions(PERMISSIONS.DELIVERY_ACCEPT)
  accept(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ObjectIdParam,
  ) {
    return this.deliveryService.accept(campusId, user.id, params.id);
  }

  @Post('jobs/:id/decline')
  @RequirePermissions(PERMISSIONS.DELIVERY_ACCEPT)
  decline(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ObjectIdParam,
  ) {
    return this.deliveryService.decline(campusId, user.id, params.id);
  }

  @Patch('jobs/:id/status')
  @RequirePermissions(PERMISSIONS.DELIVERY_UPDATE_STATUS)
  updateStatus(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ObjectIdParam,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    return this.deliveryService.updateStatus({
      campusId,
      partnerId: user.id,
      assignmentId: params.id,
      status: dto.status,
      otp: dto.otp,
      location: dto.location,
      failureReason: dto.failureReason,
    });
  }
}

@ApiTags('delivery')
@Controller('admin/delivery')
@AllowPortals(PORTALS.ADMIN)
export class AdminDeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DELIVERY_READ_ALL)
  list(@TenantId() campusId: string, @Query() query: AdminDeliveryQueryDto) {
    return this.deliveryService.listForAdmin(campusId, query.page, query.limit, query.status);
  }

  @Post(':id/assign')
  @RequirePermissions(PERMISSIONS.DELIVERY_ASSIGN)
  assign(
    @TenantId() campusId: string,
    @Param() params: ObjectIdParam,
    @Body() dto: AssignDto,
  ) {
    return this.deliveryService.assignManually(campusId, params.id, dto.partnerId);
  }
}
