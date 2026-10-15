import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Paise } from '@ck/types';
import type { AppConfig } from '@/config';
import { AppException } from '@/common/exceptions/app.exception';
import { ERROR_CODES } from '@ck/types';
import type {
  CreateProviderOrderParams,
  PaymentProvider,
  ProviderOrder,
  ProviderPaymentStatus,
  ProviderRefund,
  WebhookEvent,
} from './payment-provider.interface';

const API_BASE = 'https://api.razorpay.com/v1';

/**
 * Razorpay integration over plain HTTPS - no SDK, so there is no third-party code
 * in the payment path and the request surface is auditable in one file.
 *
 * Capture is never inferred from the browser. The client tells us a payment id; we
 * fetch that payment from Razorpay and believe only the response. Webhooks are
 * authenticated with a constant-time HMAC-SHA256 comparison of the raw body.
 */
@Injectable()
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay';
  private readonly logger = new Logger(RazorpayProvider.name);
  private readonly authHeader: string;

  constructor(private readonly config: AppConfig) {
    const { keyId, keySecret } = config.payments.razorpay;
    this.authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
  }

  async createOrder(params: CreateProviderOrderParams): Promise<ProviderOrder> {
    const response = await this.request<{ id: string; amount: number }>('POST', '/orders', {
      amount: params.amount,
      currency: params.currency,
      receipt: params.reference,
      notes: params.notes,
      payment_capture: 1,
    });

    return {
      providerOrderId: response.id,
      amount: response.amount,
      publicKey: this.config.payments.razorpay.keyId,
    };
  }

  async fetchPayment(providerPaymentId: string): Promise<ProviderPaymentStatus> {
    const payment = await this.request<{
      id: string;
      status: string;
      amount: number;
      method?: string;
      error_code?: string;
      error_description?: string;
    }>('GET', `/payments/${encodeURIComponent(providerPaymentId)}`);

    return {
      providerPaymentId: payment.id,
      status: this.mapStatus(payment.status),
      amount: payment.amount,
      method: payment.method,
      failureCode: payment.error_code,
      failureMessage: payment.error_description,
      raw: payment as unknown as Record<string, unknown>,
    };
  }

  async refund(
    providerPaymentId: string,
    amount: Paise,
    reason: string,
  ): Promise<ProviderRefund> {
    const refund = await this.request<{ id: string; status: string }>(
      'POST',
      `/payments/${encodeURIComponent(providerPaymentId)}/refund`,
      { amount, notes: { reason }, speed: 'normal' },
    );
    return {
      providerRefundId: refund.id,
      status: refund.status === 'processed' ? 'processed' : 'pending',
    };
  }

  verifyWebhook(rawBody: Buffer, signature: string | undefined): WebhookEvent | null {
    const secret = this.config.payments.razorpay.webhookSecret;
    if (!secret || !signature) return null;

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const provided = Buffer.from(signature, 'utf8');
    const computed = Buffer.from(expected, 'utf8');
    // Length check first: timingSafeEqual throws on mismatched lengths.
    if (provided.length !== computed.length || !timingSafeEqual(provided, computed)) {
      this.logger.warn('Rejected webhook with an invalid signature.');
      return null;
    }

    const payload = JSON.parse(rawBody.toString('utf8')) as {
      event: string;
      payload?: {
        payment?: { entity?: { id?: string; order_id?: string; amount?: number } };
        refund?: { entity?: { payment_id?: string; amount?: number } };
      };
    };

    const payment = payload.payload?.payment?.entity;
    const refund = payload.payload?.refund?.entity;

    switch (payload.event) {
      case 'payment.captured':
        return {
          type: payload.event,
          providerOrderId: payment?.order_id,
          providerPaymentId: payment?.id,
          status: 'captured',
          amount: payment?.amount,
          raw: payload as unknown as Record<string, unknown>,
        };
      case 'payment.failed':
        return {
          type: payload.event,
          providerOrderId: payment?.order_id,
          providerPaymentId: payment?.id,
          status: 'failed',
          raw: payload as unknown as Record<string, unknown>,
        };
      case 'refund.processed':
        return {
          type: payload.event,
          providerPaymentId: refund?.payment_id,
          status: 'refunded',
          amount: refund?.amount,
          raw: payload as unknown as Record<string, unknown>,
        };
      default:
        return { type: payload.event, status: 'ignored', raw: {} };
    }
  }

  private mapStatus(status: string): ProviderPaymentStatus['status'] {
    switch (status) {
      case 'captured':
        return 'captured';
      case 'authorized':
        return 'authorized';
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const text = await response.text();
      if (!response.ok) {
        // Gateway errors are logged in full but summarised to the client.
        this.logger.error(`Razorpay ${method} ${path} failed: ${response.status} ${text}`);
        throw AppException.unprocessable(
          ERROR_CODES.PAYMENT_FAILED,
          'The payment gateway rejected this request. Please try again.',
        );
      }
      return JSON.parse(text) as T;
    } catch (error) {
      if (error instanceof AppException) throw error;
      this.logger.error({ err: error }, `Razorpay ${method} ${path} threw`);
      throw AppException.unprocessable(
        ERROR_CODES.PAYMENT_FAILED,
        'Could not reach the payment gateway. Please try again.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
