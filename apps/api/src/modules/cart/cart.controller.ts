import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ORDER_TYPE, PERMISSIONS, PORTALS, type OrderType } from '@ck/types';
import { IsIn, IsOptional, Matches } from 'class-validator';
import {
  AllowPortals,
  CurrentUser,
  RequirePermissions,
  TenantId,
} from '@/common/decorators';
import type { AuthenticatedUser } from '@/common/types/authenticated-request';
import { CartService } from './cart.service';
import {
  AddCartLineDto,
  ApplyCartCouponDto,
  UpdateCartLineDto,
  WalletPreferenceDto,
} from './dto/cart.dto';

class CartViewQuery {
  @IsOptional()
  @IsIn(Object.values(ORDER_TYPE))
  orderType?: OrderType;
}

class CartLineParam {
  @Matches(/^[a-f\d]{24}$/i, { message: 'Invalid cart line id' })
  lineId: string;
}

@ApiTags('cart')
@Controller('cart')
@AllowPortals(PORTALS.CUSTOMER)
@RequirePermissions(PERMISSIONS.ORDER_PLACE)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  view(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CartViewQuery,
  ) {
    return this.cartService.view(campusId, user.id, query.orderType);
  }

  @Post('lines')
  add(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddCartLineDto,
  ) {
    return this.cartService.addLine(campusId, user.id, dto);
  }

  @Patch('lines/:lineId')
  update(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: CartLineParam,
    @Body() dto: UpdateCartLineDto,
  ) {
    return this.cartService.updateLine(campusId, user.id, params.lineId, dto);
  }

  @Patch('coupon')
  coupon(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApplyCartCouponDto,
  ) {
    return this.cartService.applyCoupon(campusId, user.id, dto.code);
  }

  @Patch('wallet')
  wallet(
    @TenantId() campusId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: WalletPreferenceDto,
  ) {
    return this.cartService.setWalletPreference(campusId, user.id, dto.applyWallet);
  }

  @Delete()
  clear(@TenantId() campusId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cartService.clear(campusId, user.id);
  }
}
