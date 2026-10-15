import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Paise } from '@ck/types';
import type { AppConfig } from '@/config';
import type {
  CreateProviderOrderParams,
  PaymentProvider,
  ProviderOrder,
  ProviderPaymentStatus,
  ProviderRefund,
  WebhookEvent,
} from './payment-provider.interface';

/**
 * Local development stand-in. Behaves like a real gateway - including HMAC webhook
 * verification - so the payment code path exercised in development is the same one
 * that runs in production. The environment schema refuses to boot with this provider
 * when NODE_ENV=production.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockPaymentProvider.name);
  private readonly secret = 'mock-webhook-secret';
  private readonly payments = new Map<string, { orderId: string; amount: Paise }>();

  constructor(private readonly config: AppConfig) {}

  async createOrder(params: CreateProviderOrderParams): Promise<ProviderOrder> {
    const providerOrderId = `mock_order_${randomUUID().slice(0, 12)}`;
    this.logger.warn(
      `[mock gateway] created ${providerOrderId} for ${params.reference} (${params.amount} paise)`,
    );
    return { providerOrderId, amount: params.amount, publicKey: 'mock_key' };
  }

  async fetchPayment(providerPaymentId: string): Promise<ProviderPaymentStatus> {
    const known = this.payments.get(providerPaymentId);
    return {
      providerPaymentId,
      status: 'captured',
      amount: known?.amount ?? 0,
      method: 'upi',
      raw: { mock: true, environment: this.config.env },
    };
  }

  async refund(providerPaymentId: string, amount: Paise): Promise<ProviderRefund> {
    this.logger.warn(`[mock gateway] refunded ${amount} paise of ${providerPaymentId}`);
    return { providerRefundId: `mock_rfnd_${randomUUID().slice(0, 12)}`, status: 'processed' };
  }

  verifyWebhook(rawBody: Buffer, signature: string | undefined): WebhookEvent | null {
    if (!signature) return null;
    const expected = createHmac('sha256', this.secret).update(rawBody).digest('hex');
    const provided = Buffer.from(signature, 'utf8');
    const computed = Buffer.from(expected, 'utf8');
    if (provided.length !== computed.length || !timingSafeEqual(provided, computed)) return null;

    const payload = JSON.parse(rawBody.toString('utf8')) as {
      event?: string;
      providerOrderId?: string;
      providerPaymentId?: string;
      amount?: number;
    };

    return {
      type: payload.event ?? 'payment.captured',
      providerOrderId: payload.providerOrderId,
      providerPaymentId: payload.providerPaymentId ?? `mock_pay_${randomUUID().slice(0, 12)}`,
      status: payload.event === 'payment.failed' ? 'failed' : 'captured',
      amount: payload.amount,
      raw: payload as Record<string, unknown>,
    };
  }
}
