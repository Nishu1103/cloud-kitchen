import { Prop, Schema } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { paiseField } from './base';

@Schema({ _id: false })
export class LineOption {
  @Prop({ required: true, maxlength: 40 })
  groupId: string;

  @Prop({ required: true, maxlength: 80 })
  groupName: string;

  @Prop({ required: true, maxlength: 40 })
  choiceId: string;

  @Prop({ required: true, maxlength: 80 })
  choiceName: string;

  @Prop({ type: Number, default: 0, validate: { validator: Number.isInteger } })
  priceDelta: number;
}

/**
 * Line items are denormalised on purpose: an order must render identically years
 * later even if the product was renamed, repriced or deleted. Prices are always
 * recomputed server-side from the catalogue - the client's numbers are ignored.
 */
@Schema({ _id: true })
export class OrderLine {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true, maxlength: 140 })
  name: string;

  @Prop() imageUrl?: string;

  @Prop({ ...paiseField(0), required: true })
  unitPrice: number;

  @Prop({ type: Number, required: true, min: 1, max: 50 })
  quantity: number;

  @Prop({ type: [LineOption], default: [] })
  options: LineOption[];

  @Prop({ maxlength: 200 })
  notes?: string;

  @Prop({ ...paiseField(0), required: true })
  lineTotal: number;
}

@Schema({ _id: false })
export class PriceBreakdownSchemaClass {
  @Prop({ ...paiseField(0) })
  itemsTotal: number;

  @Prop({ ...paiseField(0) })
  packagingFee: number;

  @Prop({ ...paiseField(0) })
  deliveryFee: number;

  @Prop({ ...paiseField(0) })
  discount: number;

  @Prop({ ...paiseField(0) })
  walletApplied: number;

  @Prop({ ...paiseField(0) })
  taxTotal: number;

  @Prop({ ...paiseField(0) })
  grandTotal: number;

  @Prop({ ...paiseField(0) })
  payableNow: number;
}
