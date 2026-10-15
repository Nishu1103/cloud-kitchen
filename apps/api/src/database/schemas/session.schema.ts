import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { PORTALS, type Portal } from '@ck/types';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from './base';

/**
 * One row per refresh-token family (i.e. per sign-in on one device).
 *
 * Refresh tokens rotate on every use and only the SHA-256 digest of the current
 * token is stored. Presenting a previously-rotated token is treated as theft:
 * `reuseDetectedAt` is stamped and the entire family is revoked, which limits the
 * damage of a stolen token to a single request.
 */
@Schema({ collection: 'sessions', ...baseSchemaOptions })
export class Session {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Campus', required: true })
  campusId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(PORTALS), required: true })
  portal: Portal;

  @Prop({ required: true, unique: true })
  refreshTokenHash: string;

  @Prop({ type: [String], default: [], select: false })
  rotatedTokenHashes: string[];

  @Prop({ required: true })
  expiresAt: Date;

  @Prop() revokedAt?: Date;

  @Prop({ maxlength: 60 })
  revokedReason?: string;

  @Prop() reuseDetectedAt?: Date;

  @Prop({ maxlength: 45 })
  ip?: string;

  @Prop({ maxlength: 300 })
  userAgent?: string;

  @Prop({ maxlength: 80 })
  deviceLabel?: string;

  @Prop({ default: Date.now })
  lastUsedAt: Date;

  @Prop({ type: Number, default: 0 })
  rotationCount: number;
}

export type SessionDocument = HydratedDocument<Session>;
export const SessionSchema = SchemaFactory.createForClass(Session);

SessionSchema.index({ userId: 1, revokedAt: 1 });
// Expired sessions are removed by Mongo itself, so the collection cannot grow forever.
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
