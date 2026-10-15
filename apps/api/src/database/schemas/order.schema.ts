import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  ORDER_STATUS,
  ORDER_TYPE,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  type OrderStatus,
  type OrderType,
  type PaymentMethod,
  type PaymentStatus,
} from '@ck/types';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions, paiseField } from './base';
import { OrderLine, PriceBreakdownSchemaClass } from './order-line.schema';
import { UserAddress } from './user.schema';

@Schema({ _id: false })
export class OrderTimelineEntry {
  @Prop({ type: String, enum: Object.values(ORDER_STATUS), required: true })
  status: OrderStatus;

  @Prop({ type: Date, default: Date.now })
  at: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  byUserId?: Types.ObjectId;

  @Prop({ maxlength: 240 })
  note?: string;
}

@Schema({ collection: 'orders', ...baseSchemaOptions })
export class Order {
  @Prop({ required: true, unique: true, uppercase: true })
  code: string;

  @Prop({ type: Types.ObjectId, ref: 'Campus', required: true, index: true })
  campusId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({ maxlength: 80 })
  customerName?: string;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true, index: true })
  vendorId: Types.ObjectId;

  @Prop({ maxlength: 120 })
  vendorName?: string;

  @Prop({ type: String, enum: Object.values(ORDER_TYPE), required: true })
  type: OrderType;

  @Prop({
    type: String,
    enum: Object.values(ORDER_STATUS),
    default: ORDER_STATUS.DRAFT,
    index: true,
  })
  status: OrderStatus;

  @Prop({ type: [OrderLine], required: true })
  lines: OrderLine[];

  @Prop({ type: PriceBreakdownSchemaClass, required: true })
  breakdown: PriceBreakdownSchemaClass;

  @Prop({ type: String, enum: Object.values(PAYMENT_METHOD), required: true })
  paymentMethod: PaymentMethod;

  @Prop({
    type: String,
    enum: Object.values(PAYMENT_STATUS),
    default: PAYMENT_STATUS.CREATED,
    index: true,
  })
  paymentStatus: PaymentStatus;

  @Prop({ type: UserAddress, default: undefined })
  address?: UserAddress;

  @Prop({ uppercase: true, maxlength: 24 })
  couponCode?: string;

  @Prop({ ...paiseField(0) })
  commissionAmount: number;

  @Prop({ ...paiseField(0) })
  vendorPayout: number;

  @Prop() scheduledFor?: Date;

  @Prop({ maxlength: 300 })
  instructions?: string;

  @Prop({ type: [OrderTimelineEntry], default: [] })
  timeline: OrderTimelineEntry[];

  /**
   * Handover code shown to the customer and verified by the delivery partner.
   * Stored hashed so a database read cannot be used to collect other people's food.
   */
  @Prop({ select: false })
  handoverOtpHash?: string;

  /**
   * The same code in the clear, readable only by the customer who placed the order.
   *
   * The hash alone is not enough in practice: handover happens twenty minutes after
   * checkout, on a phone that has been locked, reloaded or handed to a friend, and a
   * student who cannot re-read their code cannot take delivery. It is `select: false`
   * and listed in the response serialiser's stripped keys, so it never travels with an
   * ordinary order read - only the dedicated owner-only endpoint returns it.
   *
   * Cleared once the order reaches a terminal state, so a dump of historical orders
   * carries no live codes.
   */
  @Prop({ select: false })
  handoverCode?: string;

  @Prop({ type: Types.ObjectId, ref: 'DeliveryAssignment' })
  deliveryAssignmentId?: Types.ObjectId;

  @Prop({ type: Number, min: 0 })
  etaMinutes?: number;

  @Prop({ maxlength: 240 })
  cancelReason?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  cancelledBy?: Types.ObjectId;

  @Prop() acceptedAt?: Date;

  @Prop() readyAt?: Date;

  @Prop() deliveredAt?: Date;

  @Prop() ratedAt?: Date;

  @Prop({ ...paiseField(0) })
  refundedAmount: number;
}

export type OrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);

// Customer order history.
OrderSchema.index({ campusId: 1, customerId: 1, createdAt: -1 });
// Vendor live board: open orders first, newest first.
OrderSchema.index({ campusId: 1, vendorId: 1, status: 1, createdAt: -1 });
// Admin console and reporting.
OrderSchema.index({ campusId: 1, createdAt: -1 });
OrderSchema.index({ campusId: 1, paymentStatus: 1, createdAt: -1 });
OrderSchema.index({ scheduledFor: 1 }, { sparse: true });
