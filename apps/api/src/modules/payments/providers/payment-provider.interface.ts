import type { Paise } from '@ck/types';

export interface CreateProviderOrderParams {
  amount: Paise;
  currency: 'INR';
  /** Our order code, echoed back by the gateway for reconciliation. */
  reference: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: Record<string, string>;
}

export interface ProviderOrder {
  providerOrderId: string;
  amount: Paise;
  /** Public key or handle the browser SDK needs. Never a secret. */
  publicKey?: string;
}

export interface ProviderPaymentStatus {
  providerPaymentId: string;
  status: 'authorized' | 'captured' | 'failed' | 'pending';
  amount: Paise;
  method?: string;
  failureCode?: string;
  failureMessage?: string;
  raw: Record<string, unknown>;
}

export interface ProviderRefund {
  providerRefundId: string;
  status: 'pending' | 'processed' | 'failed';
}

export interface WebhookEvent {
  type: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  status: 'captured' | 'failed' | 'refunded' | 'ignored';
  amount?: Paise;
  raw: Record<string, unknown>;
}

/**
 * Contract every gateway implements. Two rules are absolute for any implementation:
 * a payment is only ever marked captured from a source the server verified itself,
 * and webhook payloads are rejected unless their signature checks out.
 */
export interface PaymentProvider {
  readonly name: string;
  createOrder(params: CreateProviderOrderParams): Promise<ProviderOrder>;
  fetchPayment(providerPaymentId: string): Promise<ProviderPaymentStatus>;
  refund(providerPaymentId: string, amount: Paise, reason: string): Promise<ProviderRefund>;
  verifyWebhook(rawBody: Buffer, signature: string | undefined): WebhookEvent | null;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';
