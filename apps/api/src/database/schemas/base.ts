import { Schema, Types, type SchemaOptions } from 'mongoose';

export type ObjectId = Types.ObjectId;

/**
 * Defaults for every collection.
 *
 * `strict: 'throw'` is a security control, not a style choice: an unknown field in
 * a payload fails loudly instead of being silently dropped or silently stored.
 * `minimize: false` keeps empty objects so partial updates stay predictable.
 */
export const baseSchemaOptions: SchemaOptions = {
  timestamps: true,
  strict: 'throw',
  strictQuery: true,
  minimize: false,
  versionKey: '__v',
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
};

/**
 * GeoJSON point, as a real sub-schema.
 *
 * It has to be a `Schema` instance rather than a plain object: an object whose own key
 * is `type` is ambiguous to Mongoose, which then reads our field options as a nested
 * path. `_id: false` keeps the embedded point free of an identifier.
 */
export const GEO_POINT_SCHEMA = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (value: number[]) =>
          value.length === 2 &&
          value[0]! >= -180 &&
          value[0]! <= 180 &&
          value[1]! >= -90 &&
          value[1]! <= 90,
        message: 'Coordinates must be [longitude, latitude] within valid ranges.',
      },
    },
  },
  { _id: false },
);

/** Integer paise. Rejects floats and negatives at the schema boundary. */
export const paiseField = (defaultValue = 0) => ({
  type: Number,
  default: defaultValue,
  min: 0,
  validate: {
    validator: Number.isInteger,
    message: 'Monetary amounts must be whole paise (integers).',
  },
});

export const toObjectId = (value: string | Types.ObjectId): Types.ObjectId =>
  typeof value === 'string' ? new Types.ObjectId(value) : value;
