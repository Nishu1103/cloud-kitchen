import { Module } from '@nestjs/common';
import { CouponsModule } from '@/modules/coupons/coupons.module';
import { PricingService } from './pricing.service';

/**
 * The single authority for money. Cart preview and order placement both resolve
 * totals here so a quoted price can never diverge from a charged price.
 */
@Module({
  imports: [CouponsModule],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
