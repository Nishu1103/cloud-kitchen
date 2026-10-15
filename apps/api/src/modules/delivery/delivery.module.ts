import { Module } from '@nestjs/common';
import { WalletModule } from '@/modules/wallet/wallet.module';
import { AdminDeliveryController, DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';

@Module({
  imports: [WalletModule],
  controllers: [DeliveryController, AdminDeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
