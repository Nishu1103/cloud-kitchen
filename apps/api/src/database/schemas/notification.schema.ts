import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  DEVICE_PLATFORM,
  NOTIFICATION_CATEGORY,
  NOTIFICATION_CHANNEL,
  type DevicePlatform,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationType,
} from '@ck/types';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from './base';

/**
 * The in-app notification centre. Written for every notification regardless of
 * whether push succeeded, because push permission can be denied, revoked, or
 * simply unsupported (iOS Safari outside an installed PWA). This collection is
 * what makes the product work anyway.
 */
@Schema({ collection: 'notifications', ...baseSchemaOptions })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'Campus', required: true, index: true })
  campusId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, maxlength: 60 })
  type: NotificationType;

  @Prop({
    type: String,
    enum: Object.values(NOTIFICATION_CATEGORY),
    required: true,
  })
  category: NotificationCategory;

  @Prop({ required: true, maxlength: 120 })
  title: string;

  @Prop({ required: true, maxlength: 400 })
  body: string;

  @Prop() imageUrl?: string;

  /** Relative path inside the target portal; never an absolute external URL. */
  @Prop({ maxlength: 200 })
  deepLink?: string;

  @Prop({ type: Object, default: {} })
  data?: Record<string, string>;

  @Prop({ index: true })
  readAt?: Date;

  @Prop({ type: [String], enum: Object.values(NOTIFICATION_CHANNEL), default: [] })
  deliveredChannels: NotificationChannel[];

  @Prop({ type: Types.ObjectId, ref: 'Announcement', sparse: true })
  announcementId?: Types.ObjectId;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Unread badge count and the notification list.
NotificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
// Keep the centre bounded: entries expire after 90 days.
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

/**
 * One row per browser/device. A student with a phone, laptop and tablet has three,
 * and all three receive the push.
 */
@Schema({ collection: 'notification_tokens', ...baseSchemaOptions })
export class NotificationToken {
  @Prop({ type: Types.ObjectId, ref: 'Campus', required: true, index: true })
  campusId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  /** FCM registration token. Unique so a device is never messaged twice. */
  @Prop({ required: true, unique: true, maxlength: 512 })
  token: string;

  @Prop({ type: String, enum: Object.values(DEVICE_PLATFORM), default: DEVICE_PLATFORM.WEB })
  platform: DevicePlatform;

  @Prop({ maxlength: 80 })
  browser?: string;

  @Prop({ maxlength: 80 })
  deviceLabel?: string;

  @Prop({ type: Date, default: Date.now })
  lastSeenAt: Date;

  @Prop({ default: true })
  isActive: boolean;

  /** Consecutive send failures; the token is pruned once FCM reports it invalid. */
  @Prop({ type: Number, default: 0 })
  failureCount: number;
}

export type NotificationTokenDocument = HydratedDocument<NotificationToken>;
export const NotificationTokenSchema = SchemaFactory.createForClass(NotificationToken);

NotificationTokenSchema.index({ userId: 1, isActive: 1 });
// Devices that have not checked in for 90 days are dropped.
NotificationTokenSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

/** An admin- or vendor-authored broadcast, fanned out to a target audience. */
@Schema({ collection: 'announcements', ...baseSchemaOptions })
export class Announcement {
  @Prop({ type: Types.ObjectId, ref: 'Campus', required: true, index: true })
  campusId: Types.ObjectId;

  @Prop({ required: true, maxlength: 120 })
  title: string;

  @Prop({ required: true, maxlength: 400 })
  body: string;

  @Prop() imageUrl?: string;

  @Prop({ maxlength: 200 })
  deepLink?: string;

  @Prop({ type: [String], required: true })
  audiences: string[];

  @Prop({ type: Types.ObjectId, ref: 'Vendor', default: null })
  vendorId?: Types.ObjectId | null;

  @Prop({ enum: ['draft', 'scheduled', 'sending', 'sent', 'failed'], default: 'draft', index: true })
  status: string;

  @Prop() scheduledFor?: Date;

  @Prop() sentAt?: Date;

  @Prop({ type: Number, default: 0 })
  recipientCount: number;

  @Prop({ type: Number, default: 0 })
  pushSuccessCount: number;

  @Prop({ type: Number, default: 0 })
  pushFailureCount: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
}

export type AnnouncementDocument = HydratedDocument<Announcement>;
export const AnnouncementSchema = SchemaFactory.createForClass(Announcement);

AnnouncementSchema.index({ campusId: 1, status: 1, scheduledFor: 1 });
