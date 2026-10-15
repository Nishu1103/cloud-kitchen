import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DOMAIN_EVENTS,
  ERROR_CODES,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  type Paise,
  type PaymentMethod,
} from '@ck/types';
import { Model, Types } from 'mongoose';
import { AppException } from '@/common/exceptions/app.exception';
import { Order, Payment, type OrderDocument, type PaymentDocument } from '@/database/schemas';
import { PAYMENT_PROVIDER, type PaymentProvider } from './providers/payment-provider.interface';

export interface InitiatePaymentResult {
  paymentId: string;
  providerOrderId?: string;
  publicKey?: string;
  amount: Paise;
  /** True when nothing more is owed (fully covered by wallet, or cash on delivery). */
  settled: boolean;
}

/**
 * Owns the gateway conversation and the payment ledger.
 *
 * The client is never trusted to report success. `confirm` takes a payment id,
 * fetches that payment from the gateway, and only then records a capture; the
 * webhook does the same independently, so a dropped browser callback still results
 * in a paid order.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly events: EventEmitter2,
  ) {}

  async initiate(params: {
    campusId: string;
    userId: string;
    orderId: string;
    amount: Paise;
    method: PaymentMethod;
    reference: string;
    customerEmail?: string;
    customerPhone?: string;
    idempotencyKey?: string;
  }): Promise<InitiatePaymentResult> {
    // A retried submit must not create a second charge.
    if (params.idempotencyKey) {
      const existing = await this.paymentModel
        .findOne({ idempotencyKey: params.idempotencyKey })
        .lean();
      if (existing) {
        return {
          paymentId: String(existing._id),
          providerOrderId: existing.providerOrderId,
          amount: existing.amount,
          settled: existing.status === PAYMENT_STATUS.CAPTURED,
        };
      }
    }

    const offline =
      params.method === PAYMENT_METHOD.CASH_ON_DELIVERY ||
      params.method === PAYMENT_METHOD.WALLET ||
      params.amount === 0;

    if (offline) {
      const payment = await this.paymentModel.create({
        campusId: new Types.ObjectId(params.campusId),
        orderId: new Types.ObjectId(params.orderId),
        userId: new Types.ObjectId(params.userId),
        provider: params.method === PAYMENT_METHOD.CASH_ON_DELIVERY ? 'cod' : 'wallet',
        method: params.method,
        amount: params.amount,
        // Wallet debits and prepaid-zero orders are already settled; COD is collected later.
        status:
          params.method === PAYMENT_METHOD.CASH_ON_DELIVERY
            ? PAYMENT_STATUS.PENDING
            : PAYMENT_STATUS.CAPTURED,
        capturedAt: params.method === PAYMENT_METHOD.CASH_ON_DELIVERY ? undefined : new Date(),
        idempotencyKey: params.idempotencyKey,
      });
      return { paymentId: String(payment._id), amount: params.amount, settled: true };
    }

    const providerOrder = await this.provider.createOrder({
      amount: params.amount,
      currency: 'INR',
      reference: params.reference,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      notes: { orderId: params.orderId, campusId: params.campusId },
    });

    const payment = await this.paymentModel.create({
      campusId: new Types.ObjectId(params.campusId),
      orderId: new Types.ObjectId(params.orderId),
      userId: new Types.ObjectId(params.userId),
      provider: this.provider.name,
      method: params.method,
      amount: params.amount,
      status: PAYMENT_STATUS.PENDING,
      providerOrderId: providerOrder.providerOrderId,
      idempotencyKey: params.idempotencyKey,
    });

    return {
      paymentId: String(payment._id),
      providerOrderId: providerOrder.providerOrderId,
      publicKey: providerOrder.publicKey,
      amount: params.amount,
      settled: false,
    };
  }

  /**
   * Called by the browser after the gateway modal closes. The reported id is
   * verified against the gateway before anything is marked paid, and the amount must
   * match to the paisa.
   */
  async confirm(params: {
    userId: string;
    paymentId: string;
    providerPaymentId: string;
  }): Promise<{ status: string; orderId: string }> {
    const payment = await this.paymentModel.findOne({
      _id: new Types.ObjectId(params.paymentId),
      userId: new Types.ObjectId(params.userId),
    });
    if (!payment) throw AppException.notFound('Payment');

    if (payment.status === PAYMENT_STATUS.CAPTURED) {
      return { status: payment.status, orderId: String(payment.orderId) };
    }

    const remote = await this.provider.fetchPayment(params.providerPaymentId);

    if (remote.status === 'failed') {
      payment.status = PAYMENT_STATUS.FAILED;
      payment.failureCode = remote.failureCode;
      payment.failureMessage = remote.failureMessage;
      payment.providerPaymentId = remote.providerPaymentId;
      await payment.save();
      this.events.emit(DOMAIN_EVENTS.PAYMENT_FAILED, {
        orderId: String(payment.orderId),
        paymentId: String(payment._id),
      });
      throw AppException.unprocessable(
        ERROR_CODES.PAYMENT_FAILED,
        remote.failureMessage ?? 'The payment did not go through.',
      );
    }

    if (remote.amount !== payment.amount) {
      // Amount tampering: record it and refuse rather than under-charging.
      this.logger.error(
        `Amount mismatch on payment ${payment._id}: expected ${payment.amount}, gateway reported ${remote.amount}.`,
      );
      throw AppException.unprocessable(
        ERROR_CODES.PAYMENT_FAILED,
        'The paid amount does not match this order. Support has been notified.',
      );
    }

    if (remote.status !== 'captured' && remote.status !== 'authorized') {
      return { status: PAYMENT_STATUS.PENDING, orderId: String(payment.orderId) };
    }

    await this.markCaptured(payment, remote.providerPaymentId, remote.raw);
    return { status: PAYMENT_STATUS.CAPTURED, orderId: String(payment.orderId) };
  }

  /** Webhook path: authoritative, and safe to receive more than once. */
  async handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<{ handled: boolean }> {
    const event = this.provider.verifyWebhook(rawBody, signature);
    if (!event) throw AppException.forbidden('Invalid webhook signature.');
    if (event.status === 'ignored') return { handled: false };

    const payment = event.providerOrderId
      ? await this.paymentModel.findOne({ providerOrderId: event.providerOrderId })
      : await this.paymentModel.findOne({ providerPaymentId: event.providerPaymentId });

    if (!payment) {
      this.logger.warn(`Webhook ${event.type} referenced an unknown payment; ignoring.`);
      return { handled: false };
    }

    if (event.status === 'captured') {
      if (payment.status === PAYMENT_STATUS.CAPTURED) return { handled: true };
      if (event.amount !== undefined && event.amount !== payment.amount) {
        this.logger.error(`Webhook amount mismatch for payment ${payment._id}.`);
        return { handled: false };
      }
      await this.markCaptured(payment, event.providerPaymentId ?? '', event.raw);
    } else if (event.status === 'failed') {
      payment.status = PAYMENT_STATUS.FAILED;
      payment.providerPaymentId = event.providerPaymentId;
      await payment.save();
      this.events.emit(DOMAIN_EVENTS.PAYMENT_FAILED, {
        orderId: String(payment.orderId),
        paymentId: String(payment._id),
      });
    } else if (event.status === 'refunded') {
      payment.status =
        payment.refundedAmount + (event.amount ?? 0) >= payment.amount
          ? PAYMENT_STATUS.REFUNDED
          : PAYMENT_STATUS.PARTIALLY_REFUNDED;
      payment.refundedAmount += event.amount ?? 0;
      await payment.save();
    }

    return { handled: true };
  }

  async refund(params: {
    orderId: string;
    amount: Paise;
    reason: string;
    initiatedBy: string;
  }): Promise<{ refundId: string; status: string }> {
    const payment = await this.paymentModel.findOne({
      orderId: new Types.ObjectId(params.orderId),
      status: { $in: [PAYMENT_STATUS.CAPTURED, PAYMENT_STATUS.PARTIALLY_REFUNDED] },
    });
    if (!payment) throw AppException.notFound('Captured payment');

    const refundable = payment.amount - payment.refundedAmount;
    if (params.amount > refundable) {
      throw AppException.badRequest(
        ERROR_CODES.VALIDATION_FAILED,
        `At most ₹${(refundable / 100).toFixed(2)} can be refunded on this order.`,
      );
    }

    // Wallet and cash orders are reversed by the order service, not the gateway.
    if (payment.provider === 'wallet' || payment.provider === 'cod') {
      payment.refunds.push({
        amount: params.amount,
        reason: params.reason,
        status: 'processed',
        initiatedBy: new Types.ObjectId(params.initiatedBy),
        createdAt: new Date(),
      } as never);
      payment.refundedAmount += params.amount;
      payment.status =
        payment.refundedAmount >= payment.amount
          ? PAYMENT_STATUS.REFUNDED
          : PAYMENT_STATUS.PARTIALLY_REFUNDED;
      await payment.save();
      return { refundId: 'internal', status: 'processed' };
    }

    if (!payment.providerPaymentId) {
      throw AppException.internal('This payment has no gateway reference to refund.');
    }

    const refund = await this.provider.refund(
      payment.providerPaymentId,
      params.amount,
      params.reason,
    );

    payment.refunds.push({
      amount: params.amount,
      reason: params.reason,
      status: refund.status,
      providerRefundId: refund.providerRefundId,
      initiatedBy: new Types.ObjectId(params.initiatedBy),
      createdAt: new Date(),
    } as never);
    payment.refundedAmount += params.amount;
    payment.status =
      payment.refundedAmount >= payment.amount
        ? PAYMENT_STATUS.REFUND_PENDING
        : PAYMENT_STATUS.PARTIALLY_REFUNDED;
    await payment.save();

    return { refundId: refund.providerRefundId, status: refund.status };
  }

  async findForOrder(orderId: string, userId?: string) {
    const filter: Record<string, unknown> = { orderId: new Types.ObjectId(orderId) };
    if (userId) filter.userId = new Types.ObjectId(userId);
    return this.paymentModel.find(filter).sort({ createdAt: -1 }).lean();
  }

  private async markCaptured(
    payment: PaymentDocument,
    providerPaymentId: string,
    raw: Record<string, unknown>,
  ): Promise<void> {
    payment.status = PAYMENT_STATUS.CAPTURED;
    payment.providerPaymentId = providerPaymentId;
    payment.capturedAt = new Date();
    payment.providerPayload = raw;
    await payment.save();

    // The order module listens and moves the order to `placed`, notifying everyone.
    this.events.emit(DOMAIN_EVENTS.PAYMENT_CAPTURED, {
      orderId: String(payment.orderId),
      paymentId: String(payment._id),
      amount: payment.amount,
    });
  }
}
