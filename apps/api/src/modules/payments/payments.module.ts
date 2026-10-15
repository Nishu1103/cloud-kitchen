import { Module } from '@nestjs/common';
import { CONFIG, type AppConfig } from '@/config';
import { PaymentsController, PaymentsWebhookController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MockPaymentProvider } from './providers/mock.provider';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';
import { RazorpayProvider } from './providers/razorpay.provider';

@Module({
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_PROVIDER,
      inject: [CONFIG],
      // Swapping gateways is a config change; nothing above this line knows which one runs.
      useFactory: (config: AppConfig) =>
        config.payments.provider === 'razorpay'
          ? new RazorpayProvider(config)
          : new MockPaymentProvider(config),
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
