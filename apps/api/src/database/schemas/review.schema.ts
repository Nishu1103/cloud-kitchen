import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from './base';

/**
 * Reviews are anchored to an order, which is what makes them trustworthy: the
 * unique index below means one review per order, and the service only accepts one
 * from the customer who actually received that order.
 */
@Schema({ collection: 'reviews', ...baseSchemaOptions })
export class Review {
  @Prop({ type: Types.ObjectId, ref: 'Campus', required: true, index: true })
  campusId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, unique: true })
  orderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true, index: true })
  vendorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({ maxlength: 80 })
  customerName?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Product' }], default: [] })
  productIds: Types.ObjectId[];

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ type: Number, min: 1, max: 5 })
  deliveryRating?: number;

  @Prop({ maxlength: 1000, trim: true })
  comment?: string;

  @Prop({ type: [String], default: [] })
  imageUrls: string[];

  @Prop({ maxlength: 600, trim: true })
  vendorReply?: string;

  @Prop() vendorRepliedAt?: Date;

  @Prop({ default: false, index: true })
  isHidden: boolean;

  @Prop({ maxlength: 240 })
  moderationReason?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  moderatedBy?: Types.ObjectId;
}

export type ReviewDocument = HydratedDocument<Review>;
export const ReviewSchema = SchemaFactory.createForClass(Review);

ReviewSchema.index({ vendorId: 1, isHidden: 1, createdAt: -1 });
ReviewSchema.index({ campusId: 1, createdAt: -1 });
