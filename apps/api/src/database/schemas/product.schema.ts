import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { DIET_TYPE, PRODUCT_FLAGS, type DietType, type ProductFlag } from '@ck/types';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions, paiseField } from './base';

@Schema({ _id: false })
export class ProductOptionChoice {
  @Prop({ required: true, maxlength: 40 })
  id: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name: string;

  @Prop({ type: Number, default: 0, validate: { validator: Number.isInteger } })
  priceDelta: number;

  @Prop({ default: true })
  isAvailable: boolean;
}

@Schema({ _id: false })
export class ProductOptionGroup {
  @Prop({ required: true, maxlength: 40 })
  id: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name: string;

  @Prop({ type: Number, default: 0, min: 0, max: 20 })
  minSelect: number;

  @Prop({ type: Number, default: 1, min: 1, max: 20 })
  maxSelect: number;

  @Prop({ default: false })
  required: boolean;

  @Prop({ type: [ProductOptionChoice], default: [] })
  choices: ProductOptionChoice[];
}

/**
 * Merchandising is expressed as flags on this document ("today's special",
 * "flash sale", "chef special") rather than separate collections or pages, so a
 * new campaign is a toggle instead of a release.
 */
@Schema({ collection: 'products', ...baseSchemaOptions })
export class Product {
  @Prop({ type: Types.ObjectId, ref: 'Campus', required: true, index: true })
  campusId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Vendor', required: true, index: true })
  vendorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', index: true })
  categoryId?: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 140 })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true, maxlength: 160 })
  slug: string;

  @Prop({ trim: true, maxlength: 1500 })
  description?: string;

  @Prop() imageUrl?: string;

  @Prop({ ...paiseField(0), required: true })
  basePrice: number;

  @Prop({ ...paiseField(0) })
  compareAtPrice?: number;

  @Prop({ type: String, enum: Object.values(DIET_TYPE), default: DIET_TYPE.VEG, index: true })
  diet: DietType;

  @Prop({ type: Number, min: 0, max: 3, default: 0 })
  spiceLevel: number;

  @Prop({ type: [String], enum: PRODUCT_FLAGS, default: [], index: true })
  flags: ProductFlag[];

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [ProductOptionGroup], default: [] })
  optionGroups: ProductOptionGroup[];

  @Prop({ default: true, index: true })
  isAvailable: boolean;

  /** Null means "unlimited"; a number is decremented atomically at checkout. */
  @Prop({ type: Number, default: null, min: 0 })
  stockQuantity?: number | null;

  @Prop({ type: Number, default: 5, min: 0 })
  lowStockThreshold: number;

  @Prop({ type: Number, default: 10, min: 1, max: 240 })
  prepMinutes: number;

  @Prop({ type: Number, default: 0, min: 0, max: 5 })
  rating: number;

  @Prop({ type: Number, default: 0, min: 0 })
  ratingCount: number;

  @Prop({ type: Number, default: 0, min: 0 })
  soldCount: number;

  /** Daypart availability, e.g. breakfast only or happy hour. */
  @Prop({ match: /^([01]\d|2[0-3]):[0-5]\d$/ })
  availableFrom?: string;

  @Prop({ match: /^([01]\d|2[0-3]):[0-5]\d$/ })
  availableTo?: string;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;

  @Prop() deletedAt?: Date;
}

export type ProductDocument = HydratedDocument<Product>;
export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ campusId: 1, vendorId: 1, slug: 1 }, { unique: true });
ProductSchema.index({ campusId: 1, vendorId: 1, isAvailable: 1, sortOrder: 1 });
ProductSchema.index({ campusId: 1, flags: 1, isAvailable: 1 });
ProductSchema.index({ campusId: 1, soldCount: -1 });
ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });
