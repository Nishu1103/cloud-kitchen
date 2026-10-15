import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from './base';

/** Campus-wide when `vendorId` is null, vendor menu section when it is set. */
@Schema({ collection: 'categories', ...baseSchemaOptions })
export class Category {
  @Prop({ type: Types.ObjectId, ref: 'Campus', required: true, index: true })
  campusId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', default: null, index: true })
  vendorId?: Types.ObjectId | null;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true, match: /^[a-z0-9-]{2,80}$/ })
  slug: string;

  @Prop() iconUrl?: string;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;

  @Prop({ default: true })
  isActive: boolean;
}

export type CategoryDocument = HydratedDocument<Category>;
export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.index({ campusId: 1, vendorId: 1, slug: 1 }, { unique: true });
CategorySchema.index({ campusId: 1, vendorId: 1, sortOrder: 1 });
