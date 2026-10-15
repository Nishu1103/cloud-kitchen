import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { FEATURE_FLAGS } from '@ck/types';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from './base';

/**
 * Runtime feature switches. Campaign features (flash sale, happy hour, meal pass)
 * ship dark and are enabled per campus without a deploy; `rolloutPercent` allows
 * a gradual ramp keyed on a stable hash of the user id.
 */
@Schema({ collection: 'feature_flags', ...baseSchemaOptions })
export class FeatureFlag {
  @Prop({ type: Types.ObjectId, ref: 'Campus', default: null, index: true })
  campusId?: Types.ObjectId | null;

  @Prop({ required: true, enum: FEATURE_FLAGS })
  key: string;

  @Prop({ default: false })
  enabled: boolean;

  @Prop({ type: Number, default: 100, min: 0, max: 100 })
  rolloutPercent: number;

  @Prop({ maxlength: 240 })
  description?: string;

  @Prop({ type: Object, default: {} })
  config: Record<string, unknown>;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export type FeatureFlagDocument = HydratedDocument<FeatureFlag>;
export const FeatureFlagSchema = SchemaFactory.createForClass(FeatureFlag);

FeatureFlagSchema.index({ campusId: 1, key: 1 }, { unique: true });

/**
 * Operational knobs (tax rate, delivery radius, quotas). Values are namespaced by
 * `group` and validated by the owning service before they are written.
 */
@Schema({ collection: 'settings', ...baseSchemaOptions })
export class Setting {
  @Prop({ type: Types.ObjectId, ref: 'Campus', default: null, index: true })
  campusId?: Types.ObjectId | null;

  @Prop({ required: true, match: /^[a-z0-9_]{2,40}$/ })
  group: string;

  @Prop({ required: true, match: /^[a-zA-Z0-9_.]{2,60}$/ })
  key: string;

  @Prop({ type: Object, required: true })
  value: unknown;

  @Prop({ maxlength: 240 })
  description?: string;

  /** Secret-bearing settings are never returned by the public settings endpoint. */
  @Prop({ default: false })
  isSensitive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export type SettingDocument = HydratedDocument<Setting>;
export const SettingSchema = SchemaFactory.createForClass(Setting);

SettingSchema.index({ campusId: 1, group: 1, key: 1 }, { unique: true });

/**
 * Immutable trail of privileged actions. Written for approvals, refunds, role
 * changes, suspensions and impersonation - the operations an operator could abuse.
 */
@Schema({ collection: 'audit_logs', ...baseSchemaOptions })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'Campus', index: true })
  campusId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  actorId?: Types.ObjectId;

  @Prop({ maxlength: 160 })
  actorEmail?: string;

  @Prop({ required: true, maxlength: 60, index: true })
  action: string;

  @Prop({ required: true, maxlength: 60 })
  resource: string;

  @Prop({ maxlength: 60 })
  resourceId?: string;

  @Prop({ maxlength: 45 })
  ip?: string;

  @Prop({ maxlength: 300 })
  userAgent?: string;

  @Prop({ enum: ['success', 'failure'], default: 'success' })
  outcome: string;

  @Prop({ maxlength: 64 })
  requestId?: string;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, unknown>;
}

export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ campusId: 1, createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ resource: 1, resourceId: 1, createdAt: -1 });
// Retained for two years to satisfy dispute and compliance windows.
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 730 });
