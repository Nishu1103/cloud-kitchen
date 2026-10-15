import { Module } from '@nestjs/common';
import { CartModule } from '@/modules/cart/cart.module';
import { CatalogModule } from '@/modules/catalog/catalog.module';
import { CouponsModule } from '@/modules/coupons/coupons.module';
import { DeliveryModule } from '@/modules/delivery/delivery.module';
import { PaymentsModule } from '@/modules/payments/payments.module';
import { PricingModule } from '@/modules/pricing/pricing.module';
import { WalletModule } from '@/modules/wallet/wallet.module';
import { OrderEventsListener } from './order-events.listener';
import {
  AdminOrdersController,
  OrdersController,
  VendorOrdersController,
} from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    CartModule,
    CatalogModule,
    CouponsModule,
    PricingModule,
    PaymentsModule,
    WalletModule,
    DeliveryModule,
  ],
  controllers: [OrdersController, VendorOrdersController, AdminOrdersController],
  providers: [OrdersService, OrderEventsListener],
  exports: [OrdersService],
})
export class OrdersModule {}
