import { Module } from '@nestjs/common';
import {
  AdminCouponsController,
  CouponsController,
  VendorCouponsController,
} from './coupons.controller';
import { CouponsService } from './coupons.service';

@Module({
  controllers: [CouponsController, AdminCouponsController, VendorCouponsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
