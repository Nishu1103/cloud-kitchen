/**
 * Query-string flags.
 *
 * GET params are always strings. `@IsBoolean()` rejects `"false"`, and
 * `@Type(() => Boolean)` turns `"false"` into `true` because `Boolean("false")`
 * is true in JavaScript. Validate the tokens, then coerce here.
 */
export function parseQueryFlag(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export const QUERY_FLAG_VALUES = [true, false, 'true', 'false'] as const;
