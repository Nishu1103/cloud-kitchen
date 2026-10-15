import { IsMongoId, Matches } from 'class-validator';

/**
 * Validates path parameters before they reach a query. Without this, a value like
 * `{"$ne":null}` would reach Mongoose and throw a CastError at best.
 */
export class ObjectIdParam {
  @IsMongoId()
  id: string;
}

export class SlugParam {
  @Matches(/^[a-z0-9-]{2,80}$/, { message: 'slug must be lowercase letters, digits or hyphens' })
  slug: string;
}
