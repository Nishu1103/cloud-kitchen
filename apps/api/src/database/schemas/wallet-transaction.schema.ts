import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { WALLET_TXN_TYPE, type WalletTxnType } from '@ck/types';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from './base';

/**
 * Append-only ledger. `User.walletBalance` is a cached projection of this and is
 * only ever mutated inside the same transaction that appends a row here, so the
 * two cannot drift.
 *
 * `amount` is signed: credits positive, debits negative. It therefore does not use
 * `paiseField`, which forbids negatives.
 */
@Schema({ collection: 'wallet_transactions', ...baseSchemaOptions })
export class WalletTransaction {
  @Prop({ type: Types.ObjectId, ref: 'Campus', required: true, index: true })
  campusId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(WALLET_TXN_TYPE), required: true })
  type: WalletTxnType;

  @Prop({
    type: Number,
    required: true,
    validate: { validator: Number.isInteger, message: 'Amount must be whole paise.' },
  })
  amount: number;

  @Prop({ type: Number, required: true, min: 0, validate: { validator: Number.isInteger } })
  balanceAfter: number;

  @Prop({ required: true, maxlength: 200 })
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'Order', sparse: true })
  orderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Payment', sparse: true })
  paymentId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  performedBy?: Types.ObjectId;

  /**
   * Makes credit/debit retries safe under at-least-once queue delivery.
   * The unique sparse index is declared below, not here, to avoid a duplicate.
   */
  @Prop()
  idempotencyKey?: string;
}

export type WalletTransactionDocument = HydratedDocument<WalletTransaction>;
export const WalletTransactionSchema = SchemaFactory.createForClass(WalletTransaction);

WalletTransactionSchema.index({ userId: 1, createdAt: -1 });
WalletTransactionSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
