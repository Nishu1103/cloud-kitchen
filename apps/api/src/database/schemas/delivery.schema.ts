import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DELIVERY_STATUS, type DeliveryStatus } from '@ck/types';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions, GEO_POINT_SCHEMA, paiseField } from './base';

@Schema({ _id: false })
export class DeliveryEndpoint {
  @Prop({ required: true, maxlength: 140 })
  name: string;

  @Prop({ required: true, maxlength: 300 })
  address: string;

  /**
   * The coarse part of the address - hostel or block, never the room.
   *
   * Stored separately so the open job pool can be listed without reading a field that
   * would identify where a specific student lives.
   */
  @Prop({ maxlength: 140 })
  area?: string;

  @Prop({ match: /^[6-9]\d{9}$/ })
  phone?: string;

  @Prop({ type: GEO_POINT_SCHEMA, default: undefined })
  location?: { type: 'Point'; coordinates: [number, number] };
}

@Schema({ collection: 'delivery_assignments', ...baseSchemaOptions })
export class DeliveryAssignment {
  @Prop({ type: Types.ObjectId, ref: 'Campus', required: true, index: true })
  campusId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, unique: true })
  orderId: Types.ObjectId;

  @Prop({ required: true, uppercase: true })
  orderCode: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true, sparse: true })
  partnerId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(DELIVERY_STATUS),
    default: DELIVERY_STATUS.UNASSIGNED,
    index: true,
  })
  status: DeliveryStatus;

  @Prop({ type: DeliveryEndpoint, required: true })
  pickup: DeliveryEndpoint;

  @Prop({ type: DeliveryEndpoint, required: true })
  drop: DeliveryEndpoint;

  @Prop({ ...paiseField(0) })
  earning: number;

  /**
   * Cash to collect at the door; 0 when the order is already paid.
   *
   * Copied onto the assignment rather than read from the order so the partner screen
   * never needs access to the order itself, which holds the full customer record.
   */
  @Prop({ ...paiseField(0) })
  collectCash: number;

  /** How many items to count at the counter. Never the item names. */
  @Prop({ type: Number, default: 0, min: 0 })
  itemCount: number;

  @Prop({ type: Number, min: 0 })
  distanceMeters?: number;

  /** Partners this assignment was offered to, so it is not re-offered on decline. */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  offeredTo: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  declinedBy: Types.ObjectId[];

  @Prop() offeredAt?: Date;

  @Prop() acceptedAt?: Date;

  @Prop() arrivedAtVendorAt?: Date;

  @Prop() pickedUpAt?: Date;

  @Prop() deliveredAt?: Date;

  @Prop({ maxlength: 240 })
  failureReason?: string;

  @Prop({ type: Number, default: 0 })
  otpAttempts: number;

  @Prop({ type: GEO_POINT_SCHEMA, default: undefined })
  lastKnownLocation?: { type: 'Point'; coordinates: [number, number] };

  @Prop() lastLocationAt?: Date;
}

export type DeliveryAssignmentDocument = HydratedDocument<DeliveryAssignment>;
export const DeliveryAssignmentSchema = SchemaFactory.createForClass(DeliveryAssignment);

DeliveryAssignmentSchema.index({ campusId: 1, status: 1, createdAt: 1 });
DeliveryAssignmentSchema.index({ partnerId: 1, status: 1, createdAt: -1 });

/** Operational state for a delivery partner: shift, capacity, earnings. */
@Schema({ collection: 'delivery_profiles', ...baseSchemaOptions })
export class DeliveryProfile {
  @Prop({ type: Types.ObjectId, ref: 'Campus', required: true, index: true })
  campusId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ default: false, index: true })
  isOnline: boolean;

  @Prop({ enum: ['cycle', 'bike', 'scooter', 'on_foot'], default: 'cycle' })
  vehicle: string;

  @Prop({ maxlength: 20 })
  vehicleNumber?: string;

  @Prop({ type: Number, default: 2, min: 1, max: 10 })
  maxConcurrentOrders: number;

  @Prop({ type: Number, default: 0, min: 0 })
  activeOrderCount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  completedDeliveries: number;

  @Prop({ type: Number, default: 0, min: 0, max: 5 })
  rating: number;

  @Prop({ ...paiseField(0) })
  lifetimeEarnings: number;

  @Prop({ ...paiseField(0) })
  unsettledEarnings: number;

  @Prop({ type: GEO_POINT_SCHEMA, default: undefined })
  location?: { type: 'Point'; coordinates: [number, number] };

  @Prop({ type: [Types.ObjectId], default: [] })
  preferredZoneIds: Types.ObjectId[];
}

export type DeliveryProfileDocument = HydratedDocument<DeliveryProfile>;
export const DeliveryProfileSchema = SchemaFactory.createForClass(DeliveryProfile);

DeliveryProfileSchema.index({ campusId: 1, isOnline: 1, activeOrderCount: 1 });
DeliveryProfileSchema.index({ location: '2dsphere' }, { sparse: true });
