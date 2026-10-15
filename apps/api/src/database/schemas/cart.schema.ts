import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from './base';
import { OrderLine } from './order-line.schema';

/** One open cart per user. Carts are single-vendor by design. */
@Schema({ collection: 'carts', ...baseSchemaOptions })
export class Cart {
  @Prop({ type: Types.ObjectId, ref: 'Campus', required: true, index: true })
  campusId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', default: null })
  vendorId?: Types.ObjectId | null;

  @Prop({ type: [OrderLine], default: [] })
  lines: OrderLine[];

  @Prop({ uppercase: true, trim: true, maxlength: 24 })
  couponCode?: string;

  @Prop({ default: false })
  applyWallet: boolean;

  @Prop({ type: Date, default: Date.now })
  lastActivityAt: Date;
}

export type CartDocument = HydratedDocument<Cart>;
export const CartSchema = SchemaFactory.createForClass(Cart);

// Abandoned carts self-clean after 14 days of inactivity.
CartSchema.index({ lastActivityAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 14 });
