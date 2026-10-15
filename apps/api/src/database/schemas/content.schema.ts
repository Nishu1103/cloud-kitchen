import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from './base';

/** Editor-managed static pages (terms, privacy, FAQ, campus policies). */
@Schema({ collection: 'cms_pages', ...baseSchemaOptions })
export class CmsPage {
  @Prop({ type: Types.ObjectId, ref: 'Campus', default: null, index: true })
  campusId?: Types.ObjectId | null;

  @Prop({ required: true, lowercase: true, match: /^[a-z0-9-]{2,80}$/ })
  slug: string;

  @Prop({ required: true, maxlength: 160 })
  title: string;

  /**
   * Sanitised HTML. Written only by holders of `cms:manage` and cleaned on write,
   * because this string is rendered into customer-facing pages.
   */
  @Prop({ required: true, maxlength: 100_000 })
  contentHtml: string;

  @Prop({ maxlength: 300 })
  metaDescription?: string;

  @Prop({ enum: ['draft', 'published'], default: 'draft', index: true })
  status: string;

  @Prop() publishedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export type CmsPageDocument = HydratedDocument<CmsPage>;
export const CmsPageSchema = SchemaFactory.createForClass(CmsPage);

CmsPageSchema.index({ campusId: 1, slug: 1 }, { unique: true });

/** Merchandising slots on the customer home screen. */
@Schema({ collection: 'banners', ...baseSchemaOptions })
export class Banner {
  @Prop({ type: Types.ObjectId, ref: 'Campus', required: true, index: true })
  campusId: Types.ObjectId;

  @Prop({ required: true, maxlength: 120 })
  title: string;

  @Prop({ maxlength: 200 })
  subtitle?: string;

  @Prop({ required: true })
  imageUrl: string;

  /** Internal route only, so a banner cannot be used for off-site redirection. */
  @Prop({ match: /^\/[A-Za-z0-9\-._~/?=&]*$/, maxlength: 200 })
  deepLink?: string;

  @Prop({ enum: ['home_hero', 'home_strip', 'vendor_top', 'checkout'], default: 'home_hero' })
  placement: string;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop() startsAt?: Date;

  @Prop() endsAt?: Date;

  @Prop({ type: Number, default: 0 })
  impressions: number;

  @Prop({ type: Number, default: 0 })
  clicks: number;
}

export type BannerDocument = HydratedDocument<Banner>;
export const BannerSchema = SchemaFactory.createForClass(Banner);

BannerSchema.index({ campusId: 1, placement: 1, isActive: 1, sortOrder: 1 });

@Schema({ _id: true })
export class TicketMessage {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId: Types.ObjectId;

  @Prop({ enum: ['customer', 'vendor', 'delivery', 'agent'], required: true })
  authorRole: string;

  @Prop({ required: true, maxlength: 2000 })
  body: string;

  @Prop({ type: [String], default: [] })
  attachmentUrls: string[];

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
}

@Schema({ collection: 'support_tickets', ...baseSchemaOptions })
export class SupportTicket {
  @Prop({ type: Types.ObjectId, ref: 'Campus', required: true, index: true })
  campusId: Types.ObjectId;

  @Prop({ required: true, uppercase: true, unique: true })
  code: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  raisedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', sparse: true })
  orderId?: Types.ObjectId;

  @Prop({ required: true, maxlength: 160 })
  subject: string;

  @Prop({
    enum: ['order_issue', 'payment', 'refund', 'quality', 'delivery', 'account', 'other'],
    default: 'other',
  })
  category: string;

  @Prop({ enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' })
  priority: string;

  @Prop({ enum: ['open', 'pending', 'resolved', 'closed'], default: 'open', index: true })
  status: string;

  @Prop({ type: [TicketMessage], default: [] })
  messages: TicketMessage[];

  @Prop({ type: Types.ObjectId, ref: 'User', sparse: true })
  assignedTo?: Types.ObjectId;

  @Prop() resolvedAt?: Date;
}

export type SupportTicketDocument = HydratedDocument<SupportTicket>;
export const SupportTicketSchema = SchemaFactory.createForClass(SupportTicket);

SupportTicketSchema.index({ campusId: 1, status: 1, priority: -1, createdAt: -1 });
