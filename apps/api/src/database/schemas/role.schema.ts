import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ALL_PERMISSIONS, type Permission } from '@ck/types';
import { HydratedDocument, Types } from 'mongoose';
import { baseSchemaOptions } from './base';

/**
 * A named bundle of permissions. Editable at runtime, which is why permission
 * strings are validated against the compiled allowlist - a typo or an injected
 * value can never become a grant.
 */
@Schema({ collection: 'roles', ...baseSchemaOptions })
export class Role {
  @Prop({ required: true, lowercase: true, trim: true, match: /^[a-z0-9_]{3,40}$/ })
  slug: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name: string;

  @Prop({ maxlength: 240 })
  description?: string;

  @Prop({
    type: [String],
    default: [],
    validate: {
      validator: (values: string[]) =>
        values.every((value) => (ALL_PERMISSIONS as string[]).includes(value)),
      message: 'Unknown permission in role definition.',
    },
  })
  permissions: Permission[];

  /** System roles cannot be deleted or renamed by operators. */
  @Prop({ default: false })
  isSystem: boolean;

  /** Null for platform-wide roles; set for campus-scoped custom roles. */
  @Prop({ type: Types.ObjectId, ref: 'Campus', default: null, index: true })
  campusId?: Types.ObjectId | null;
}

export type RoleDocument = HydratedDocument<Role>;
export const RoleSchema = SchemaFactory.createForClass(Role);

RoleSchema.index({ slug: 1, campusId: 1 }, { unique: true });
