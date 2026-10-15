import { Module } from '@nestjs/common';
import {
  AdminVendorsController,
  VendorOnboardingController,
  VendorSelfController,
  VendorsController,
} from './vendors.controller';
import { VendorsService } from './vendors.service';

@Module({
  controllers: [
    VendorsController,
    VendorSelfController,
    VendorOnboardingController,
    AdminVendorsController,
  ],
  providers: [VendorsService],
  exports: [VendorsService],
})
export class VendorsModule {}
