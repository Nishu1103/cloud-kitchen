import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { USER_STATUS, type Permission, type UserStatus } from '@ck/types';
import { HydratedDocument, Types } from 'mongoose';
import { ALL_PERMISSIONS } from '@ck/types';
import { baseSchemaOptions, GEO_POINT_SCHEMA, paiseField } from './base';

@Schema({ _id: true })
export class UserAddress {
  /** Present on stored subdocuments; the client selects an address by this id. */
  _id?: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 40 })
  label: string;

  @Prop({ required: true, trim: true, maxlength: 160 })
  line1: string;

  @Prop({ trim: true, maxlength: 160 })
  line2?: string;

  @Prop({ trim: true, maxlength: 80 })
  hostel?: string;

  @Prop({ trim: true, maxlength: 20 })
  roomNumber?: string;

  @Prop({ trim: true, maxlength: 120 })
  landmark?: string;

  @Prop({ type: Types.ObjectId })
  campusZoneId?: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 80 })
  contactName: string;

  @Prop({ required: true, match: /^[6-9]\d{9}$/ })
  contactPhone: string;

  @Prop({ type: GEO_POINT_SCHEMA, default: undefined })
  location?: { type: 'Point'; coordinates: [number, number] };

  @Prop({ default: false })
  isDefault: boolean;
}

@Schema({ collection: 'users', ...baseSchemaOptions })
export class User {
  @Prop({ type: Types.ObjectId, ref: 'Campus', required: true, index: true })
  campusId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true, maxlength: 160 })
  email: string;

  /**
   * Argon2id digest. `select: false` keeps it out of every query result by
   * default, so it can only leak if a query asks for it explicitly.
   */
  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ select: false })
  passwordUpdatedAt?: Date;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ match: /^[6-9]\d{9}$/, sparse: true })
  phone?: string;

  @Prop({ default: false })
  phoneVerified: boolean;

  @Prop() avatarUrl?: string;

  @Prop({
    type: String,
    enum: Object.values(USER_STATUS),
    default: USER_STATUS.PENDING_VERIFICATION,
    index: true,
  })
  status: UserStatus;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Role' }], default: [] })
  roleIds: Types.ObjectId[];

  /** Escape hatch for one-off grants; still validated against the allowlist. */
  @Prop({
    type: [String],
    default: [],
    validate: {
      validator: (values: string[]) =>
        values.every((value) => (ALL_PERMISSIONS as string[]).includes(value)),
      message: 'Unknown permission granted directly to user.',
    },
  })
  directPermissions: Permission[];

  /** Set for vendor owners and staff. */
  @Prop({ type: Types.ObjectId, ref: 'Vendor', index: true, sparse: true })
  vendorId?: Types.ObjectId;

  @Prop({ type: [UserAddress], default: [] })
  addresses: UserAddress[];

  @Prop({ default: 'en' })
  locale: string;

  @Prop({ type: Number, default: 0, min: 0 })
  loyaltyPoints: number;

  @Prop({ ...paiseField(0) })
  walletBalance: number;

  /** Single-use, hashed. Never store the emailed token itself. */
  @Prop({ select: false })
  emailVerificationTokenHash?: string;

  @Prop({ select: false })
  emailVerificationExpiresAt?: Date;

  @Prop({ select: false })
  passwordResetTokenHash?: string;

  @Prop({ select: false })
  passwordResetExpiresAt?: Date;

  @Prop({ select: false })
  phoneOtpHash?: string;

  @Prop({ select: false })
  phoneOtpExpiresAt?: Date;

  @Prop({ type: Object, default: {} })
  notificationPreferences: Record<string, boolean>;

  @Prop() lastLoginAt?: Date;

  @Prop() lastLoginIp?: string;

  /** Indexed below as a unique sparse index; declared here without one to avoid a duplicate. */
  @Prop({ type: String, maxlength: 12 })
  referralCode?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  referredBy?: Types.ObjectId;

  @Prop({ maxlength: 240 })
  suspensionReason?: string;

  @Prop() deletedAt?: Date;

  /** Maintained by `timestamps: true`; declared (undecorated) for type visibility only. */
  createdAt?: Date;

  updatedAt?: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

// Email is unique per campus, so the same person can exist on two campuses.
UserSchema.index({ campusId: 1, email: 1 }, { unique: true });
UserSchema.index({ campusId: 1, phone: 1 }, { unique: true, sparse: true });
UserSchema.index({ campusId: 1, status: 1, createdAt: -1 });
UserSchema.index({ referralCode: 1 }, { unique: true, sparse: true });
UserSchema.index({ name: 'text', email: 'text' });
