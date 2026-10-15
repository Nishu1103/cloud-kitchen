import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions, GEO_POINT_SCHEMA } from './base';

/** A delivery zone inside a campus (hostel cluster, department block, gate). */
@Schema({ _id: true })
export class CampusZone {
  /** Present on stored subdocuments; addresses reference it by id. */
  _id?: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name: string;

  @Prop({ type: Number, default: 0, min: 0 })
  deliveryFee: number;

  @Prop({ type: Number, default: 10, min: 0, max: 240 })
  etaMinutes: number;

  @Prop({ type: Object, default: undefined })
  boundary?: { type: 'Polygon'; coordinates: number[][][] };

  @Prop({ default: true })
  isActive: boolean;
}

/**
 * The tenant root. Every other collection carries `campusId`, which is what makes
 * a second campus a configuration change rather than a new deployment.
 */
@Schema({ collection: 'campuses', ...baseSchemaOptions })
export class Campus {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9-]{2,40}$/ })
  slug: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  city: string;

  @Prop({ default: 'Asia/Kolkata' })
  timezone: string;

  @Prop({ default: 'INR', enum: ['INR'] })
  currency: string;

  @Prop() logoUrl?: string;

  @Prop({ match: /^#[0-9a-fA-F]{6}$/ })
  themeColor?: string;

  /** Signup allowlist for this campus, e.g. iitkgp.ac.in. */
  @Prop({ type: [String], default: [] })
  emailDomains: string[];

  @Prop({ type: [CampusZone], default: [] })
  zones: CampusZone[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop() supportEmail?: string;

  @Prop() supportPhone?: string;

  @Prop({ type: Object, default: {} })
  branding: Record<string, string>;

  @Prop({ type: GEO_POINT_SCHEMA, default: undefined })
  location?: { type: 'Point'; coordinates: [number, number] };

  @Prop({ type: Types.ObjectId })
  createdBy?: Types.ObjectId;
}

export type CampusDocument = HydratedDocument<Campus>;
export const CampusSchema = SchemaFactory.createForClass(Campus);

CampusSchema.index({ isActive: 1 });
