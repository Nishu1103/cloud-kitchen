import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  type PaymentMethod,
  type PaymentStatus,
} from '@ck/types';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions, paiseField } from './base';

@Schema({ _id: true })
export class RefundRecord {
  @Prop({ ...paiseField(0), required: true })
  amount: number;

  @Prop({ required: true, maxlength: 240 })
  reason: string;

  @Prop({ enum: ['pending', 'processed', 'failed'], default: 'pending' })
  status: string;

  @Prop() providerRefundId?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  initiatedBy?: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

/**
 * Ledger of gateway interactions. The gateway - not the client - is the source of
 * truth for `status`: it only advances to `captured` from a signature-verified
 * webhook or a server-side fetch, never from a browser callback.
 */
@Schema({ collection: 'payments', ...baseSchemaOptions })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Campus', required: true, index: true })
  campusId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  orderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ['razorpay', 'mock', 'wallet', 'cod'] })
  provider: string;

  @Prop({ type: String, enum: Object.values(PAYMENT_METHOD), required: true })
  method: PaymentMethod;

  @Prop({
    type: String,
    enum: Object.values(PAYMENT_STATUS),
    default: PAYMENT_STATUS.CREATED,
    index: true,
  })
  status: PaymentStatus;

  @Prop({ ...paiseField(0), required: true })
  amount: number;

  @Prop({ default: 'INR' })
  currency: string;

  /** Gateway order handle, unique so a webhook cannot be applied to two payments. */
  @Prop({ sparse: true, unique: true })
  providerOrderId?: string;

  @Prop({ sparse: true })
  providerPaymentId?: string;

  @Prop({ maxlength: 120 })
  failureCode?: string;

  @Prop({ maxlength: 300 })
  failureMessage?: string;

  /** Gateway payloads may contain PII; excluded from default projections. */
  @Prop({ type: Object, default: {}, select: false })
  providerPayload?: Record<string, unknown>;

  @Prop({ type: [RefundRecord], default: [] })
  refunds: RefundRecord[];

  @Prop({ ...paiseField(0) })
  refundedAmount: number;

  @Prop() capturedAt?: Date;

  /**
   * Guards against duplicate charge attempts from retried client requests.
   * The unique sparse index is declared below, not here, to avoid a duplicate.
   */
  @Prop()
  idempotencyKey?: string;
}

export type PaymentDocument = HydratedDocument<Payment>;
export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index({ campusId: 1, createdAt: -1 });
PaymentSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
