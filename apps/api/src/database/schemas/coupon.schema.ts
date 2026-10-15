import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { COUPON_TYPE, type CouponType } from '@ck/types';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions, paiseField } from './base';

@Schema({ collection: 'coupons', ...baseSchemaOptions })
export class Coupon {
  @Prop({ type: Types.ObjectId, ref: 'Campus', required: true, index: true })
  campusId: Types.ObjectId;

  @Prop({ required: true, uppercase: true, trim: true, match: /^[A-Z0-9_-]{4,24}$/ })
  code: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  title: string;

  @Prop({ maxlength: 400 })
  description?: string;

  @Prop({ type: String, enum: Object.values(COUPON_TYPE), required: true })
  type: CouponType;

  /** Percentage (0-100) or flat paise, depending on `type`. */
  @Prop({ type: Number, required: true, min: 0 })
  value: number;

  @Prop({ ...paiseField(0) })
  maxDiscount?: number;

  @Prop({ ...paiseField(0) })
  minOrderAmount: number;

  /** Null = platform coupon funded by the campus; set = vendor-funded. */
  @Prop({ type: Types.ObjectId, ref: 'Vendor', default: null, index: true })
  vendorId?: Types.ObjectId | null;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  restrictedToUserIds: Types.ObjectId[];

  @Prop({ default: false })
  firstOrderOnly: boolean;

  @Prop({ type: Date, required: true })
  validFrom: Date;

  @Prop({ type: Date, required: true })
  validTo: Date;

  @Prop({ type: Number, min: 0 })
  usageLimitTotal?: number;

  @Prop({ type: Number, min: 0, default: 1 })
  usageLimitPerUser?: number;

  @Prop({ type: Number, default: 0, min: 0 })
  usedCount: number;

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export type CouponDocument = HydratedDocument<Coupon>;
export const CouponSchema = SchemaFactory.createForClass(Coupon);

CouponSchema.index({ campusId: 1, code: 1 }, { unique: true });
CouponSchema.index({ campusId: 1, isActive: 1, validTo: 1 });

/** One row per redemption; enforces per-user limits without scanning orders. */
@Schema({ collection: 'coupon_redemptions', ...baseSchemaOptions })
export class CouponRedemption {
  @Prop({ type: Types.ObjectId, ref: 'Coupon', required: true, index: true })
  couponId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId: Types.ObjectId;

  @Prop({ ...paiseField(0), required: true })
  discountAmount: number;
}

export type CouponRedemptionDocument = HydratedDocument<CouponRedemption>;
export const CouponRedemptionSchema = SchemaFactory.createForClass(CouponRedemption);

// A given order can only ever consume a coupon once.
CouponRedemptionSchema.index({ couponId: 1, orderId: 1 }, { unique: true });
CouponRedemptionSchema.index({ couponId: 1, userId: 1 });
