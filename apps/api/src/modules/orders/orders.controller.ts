import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PERMISSIONS, PORTALS } from '@ck/types';
import {
  AllowPortals,
  CurrentUser,
  RequirePermissions,
  TenantId,
} from '@/common/decorators';
import { ObjectIdParam } from '@/common/dto/object-id.dto';
import { parseQueryFlag } from '@/common/dto/transforms';
import { AppException } from '@/common/exceptions/app.exception';
import type { AuthenticatedRequest, AuthenticatedUser } from '@/common/types/authenticated-request';
import { AuditService } from '@/modules/audit/audit.service';
import { PaymentsService } from '@/modules/payments/payments.service';
import {
  CancelOrderDto,
  OrderQueryDto,
  PlaceOrderDto,
  RefundOrderDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
@AllowPortals(PORTALS.CUSTOMER)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * `Idempotency-Key` lets a client retry a submit after a timeout without risking a
   * second charge. Rate limited because each call reserves stock and hits the gateway.
   */
  @Post()
  @RequirePermissions(PERMISSIONS.ORDER_PLACE)
  @Throttle({ checkout: { limit: 10, ttl: 60_000 } })
  place(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PlaceOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.ordersService.place({
      campusId,
      userId: user.id,
      dto,
      idempotencyKey: idempotencyKey?.slice(0, 80),
    });
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ORDER_READ_OWN)
  list(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrderQueryDto,
  ) {
    return this.ordersService.listForCustomer(
      campusId,
      user.id,
      query.page,
      query.limit,
      query.status,
    );
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ORDER_READ_OWN)
  detail(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ObjectIdParam,
  ) {
    return this.ordersService.findForCustomer(campusId, user.id, params.id);
  }

  /**
   * The code the student reads out to the delivery partner.
   *
   * Deliberately not part of the order payload: it is fetched only when the screen that
   * shows it is open, so it stays out of list responses, logs and caches.
   */
  @Get(':id/handover-code')
  @RequirePermissions(PERMISSIONS.ORDER_READ_OWN)
  handoverCode(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ObjectIdParam,
  ) {
    return this.ordersService.handoverCode(campusId, user.id, params.id);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.ORDER_CANCEL_OWN)
  cancel(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ObjectIdParam,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancel({
      campusId,
      orderId: params.id,
      actorId: user.id,
      dto,
      isCustomer: true,
    });
  }
}

@ApiTags('orders')
@Controller('vendor/orders')
@AllowPortals(PORTALS.VENDOR)
export class VendorOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ORDER_READ_VENDOR)
  list(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrderQueryDto,
  ) {
    return this.ordersService.listForVendor(campusId, this.vendorOf(user), {
      page: query.page,
      limit: query.limit,
      status: query.status,
      live: query.live === undefined ? undefined : parseQueryFlag(query.live),
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ORDER_READ_VENDOR)
  detail(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ObjectIdParam,
  ) {
    return this.ordersService.findByIdScoped(campusId, params.id, this.vendorOf(user));
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.ORDER_UPDATE_STATUS)
  updateStatus(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ObjectIdParam,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.vendorUpdateStatus(
      campusId,
      this.vendorOf(user),
      params.id,
      dto,
      user.id,
    );
  }

  private vendorOf(user: AuthenticatedUser): string {
    if (!user.vendorId) throw AppException.forbidden('Your account is not linked to a kitchen.');
    return user.vendorId;
  }
}

@ApiTags('orders')
@Controller('admin/orders')
@AllowPortals(PORTALS.ADMIN)
export class AdminOrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ORDER_READ_ALL)
  list(@TenantId() campusId: string, @Query() query: OrderQueryDto) {
    return this.ordersService.listForAdmin(campusId, {
      page: query.page,
      limit: query.limit,
      status: query.status,
      search: query.search,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ORDER_READ_ALL)
  detail(@TenantId() campusId: string, @Param() params: ObjectIdParam) {
    return this.ordersService.findByIdScoped(campusId, params.id);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.ORDER_CANCEL_ANY)
  async cancel(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ObjectIdParam,
    @Body() dto: CancelOrderDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const order = await this.ordersService.cancel({
      campusId,
      orderId: params.id,
      actorId: user.id,
      dto,
      isCustomer: false,
    });
    await this.auditService.recordFromRequest(request, {
      action: 'order.cancel',
      resource: 'order',
      resourceId: params.id,
      metadata: { reason: dto.reason },
    });
    return order;
  }

  /** Partial refunds are supported; every one is audited with the amount and reason. */
  @Post(':id/refund')
  @RequirePermissions(PERMISSIONS.ORDER_REFUND)
  async refund(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ObjectIdParam,
    @Body() dto: RefundOrderDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const result = await this.paymentsService.refund({
      orderId: params.id,
      amount: dto.amount,
      reason: dto.reason,
      initiatedBy: user.id,
    });
    await this.auditService.recordFromRequest(request, {
      action: 'order.refund',
      resource: 'order',
      resourceId: params.id,
      metadata: { amount: dto.amount, reason: dto.reason, refundId: result.refundId },
    });
    return result;
  }
}
