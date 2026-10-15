import { Types } from 'mongoose';

/**
 * Normalises a handler's return value into the shape the shared `@ck/types` entities
 * describe: `id` instead of `_id`, strings instead of `ObjectId`, ISO strings instead
 * of `Date`, and no `__v`.
 *
 * This lives in one interceptor rather than in each service because most reads use
 * `.lean()` for speed, and `lean()` skips the schema's `toJSON` transform. Without a
 * single normaliser, every endpoint would have to remember to map its own documents and
 * embedded subdocuments (saved addresses, order lines, option groups), and the four
 * frontends would each need fallbacks for `id ?? _id`.
 *
 * Internal fields are also dropped here, so a document that happens to carry a password
 * hash or a token digest cannot reach a client because a `select()` was forgotten.
 */
const STRIPPED_KEYS = new Set([
  '__v',
  'passwordHash',
  'refreshTokenHash',
  'tokenHash',
  'otpHash',
  'handoverOtpHash',
  // Reachable only through the endpoint that returns it under a different key, so a
  // forgotten `select` on any other order read cannot leak a live handover code.
  'handoverCode',
  'webhookSecret',
]);

/** Guards against a cyclic or pathologically nested payload locking up the event loop. */
const MAX_DEPTH = 12;

export function toApiShape<T>(input: T): T {
  return normalize(input, 0) as T;
}

function normalize(value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;
  if (depth > MAX_DEPTH) return value;

  if (value instanceof Date) return value.toISOString();
  if (value instanceof Types.ObjectId) return value.toString();
  // Binary payloads (webhook echoes, file streams) must pass through untouched.
  if (Buffer.isBuffer(value)) return value;

  if (Array.isArray(value)) {
    return value.map((entry) => normalize(entry, depth + 1));
  }

  if (typeof value !== 'object') return value;

  // A hydrated Mongoose document already knows how to serialise itself, including
  // virtuals; running it through `toJSON` first keeps both paths identical.
  const source = hasToJSON(value) ? (value.toJSON() as Record<string, unknown>) : value;
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    return normalize(source, depth + 1);
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source as Record<string, unknown>)) {
    if (STRIPPED_KEYS.has(key)) continue;
    if (key === '_id') {
      // Only rename when the caller has not already provided an `id`.
      if (!('id' in (source as Record<string, unknown>))) {
        result.id = normalize(entry, depth + 1);
      }
      continue;
    }
    result[key] = normalize(entry, depth + 1);
  }
  return result;
}

function hasToJSON(value: object): value is { toJSON: () => unknown } {
  return typeof (value as { toJSON?: unknown }).toJSON === 'function';
}
