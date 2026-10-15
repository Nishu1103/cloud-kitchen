import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { VENDOR_STATUS, type VendorStatus } from '@ck/types';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions, GEO_POINT_SCHEMA, paiseField } from './base';

@Schema({ _id: false })
export class OperatingHour {
  @Prop({ type: Number, required: true, min: 0, max: 6 })
  day: number;

  @Prop({ required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ })
  open: string;

  @Prop({ required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ })
  close: string;

  @Prop({ default: false })
  isClosed: boolean;
}

@Schema({ _id: true })
export class VendorDocumentFile {
  @Prop({ required: true, enum: ['fssai', 'gst', 'pan', 'aadhaar', 'agreement', 'other'] })
  kind: string;

  @Prop({ required: true })
  storageKey: string;

  @Prop({ enum: ['pending', 'verified', 'rejected'], default: 'pending' })
  status: string;

  @Prop({ maxlength: 240 })
  note?: string;

  @Prop() expiresAt?: Date;
}

@Schema({ collection: 'vendors', ...baseSchemaOptions })
export class Vendor {
  @Prop({ type: Types.ObjectId, ref: 'Campus', required: true, index: true })
  campusId: Types.ObjectId;

  @Prop({ required: true, lowercase: true, trim: true, match: /^[a-z0-9-]{2,60}$/ })
  slug: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ trim: true, maxlength: 140 })
  tagline?: string;

  @Prop({ trim: true, maxlength: 2000 })
  description?: string;

  @Prop() logoUrl?: string;

  @Prop() coverUrl?: string;

  @Prop({ type: [String], default: [] })
  cuisines: string[];

  @Prop({
    type: String,
    enum: Object.values(VENDOR_STATUS),
    default: VENDOR_STATUS.DRAFT,
    index: true,
  })
  status: VendorStatus;

  /** Vendor-controlled shutter. Distinct from `status`, which is admin-controlled. */
  @Prop({ default: false })
  isOpen: boolean;

  @Prop({ default: true })
  acceptsDelivery: boolean;

  @Prop({ default: true })
  acceptsPickup: boolean;

  @Prop({ type: Number, default: 0, min: 0, max: 5 })
  rating: number;

  @Prop({ type: Number, default: 0, min: 0 })
  ratingCount: number;

  @Prop({ type: Number, default: 20, min: 1, max: 240 })
  avgPrepMinutes: number;

  @Prop({ ...paiseField(0) })
  minOrderAmount: number;

  @Prop({ ...paiseField(0) })
  packagingFee: number;

  @Prop({ ...paiseField(0) })
  deliveryFee: number;

  /** Platform take rate. Admin-only field; vendors can read but never write it. */
  @Prop({ type: Number, default: 15, min: 0, max: 40 })
  commissionPercent: number;

  @Prop({ type: [OperatingHour], default: [] })
  operatingHours: OperatingHour[];

  @Prop({ type: GEO_POINT_SCHEMA, default: undefined })
  location?: { type: 'Point'; coordinates: [number, number] };

  @Prop({ match: /^#[0-9a-fA-F]{6}$/ })
  themeColor?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  ownerId?: Types.ObjectId;

  @Prop({ trim: true, maxlength: 120 })
  contactName?: string;

  @Prop({ match: /^[6-9]\d{9}$/ })
  contactPhone?: string;

  /**
   * Payout details are read only by the payout worker, never by vendor-facing
   * endpoints, so they stay out of default projections.
   */
  @Prop({ type: Object, select: false, default: {} })
  payoutAccount?: { accountLast4?: string; ifsc?: string; upiId?: string; beneficiary?: string };

  @Prop({ type: [VendorDocumentFile], default: [], select: false })
  documents: VendorDocumentFile[];

  @Prop({ ...paiseField(0) })
  pendingSettlement: number;

  @Prop({ ...paiseField(0) })
  lifetimeRevenue: number;

  @Prop({ type: Number, default: 0, min: 0 })
  totalOrders: number;

  @Prop() approvedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop({ maxlength: 300 })
  rejectionReason?: string;

  @Prop({ type: Number, default: 0 })
  sortWeight: number;

  @Prop() deletedAt?: Date;
}

export type VendorDocument = HydratedDocument<Vendor>;
export const VendorSchema = SchemaFactory.createForClass(Vendor);

VendorSchema.index({ campusId: 1, slug: 1 }, { unique: true });
VendorSchema.index({ campusId: 1, status: 1, isOpen: -1, sortWeight: -1 });
VendorSchema.index({ campusId: 1, cuisines: 1 });
VendorSchema.index({ name: 'text', cuisines: 'text', tagline: 'text' });
VendorSchema.index({ location: '2dsphere' }, { sparse: true });
