import { Algorithm, hash, verify } from '@node-rs/argon2';
import { createHmac } from 'node:crypto';

/**
 * Argon2id parameters follow OWASP's 2024 guidance (19 MiB memory, 2 iterations,
 * 1 lane): deliberately expensive, so a leaked hash is economically useless to crack.
 *
 * This lives outside the Nest provider because the seed script and any future
 * migration must produce byte-identical digests. A second implementation that
 * peppers differently would silently lock every seeded account out.
 */
export const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

/**
 * The pepper is a server-side secret HMAC-mixed into the password before hashing,
 * so a database dump alone is not enough to attempt an offline crack.
 */
function peppered(plain: string, pepper: string): string {
  return createHmac('sha256', pepper).update(plain).digest('base64');
}

export function hashPassword(plain: string, pepper: string): Promise<string> {
  return hash(peppered(plain, pepper), ARGON2_OPTIONS);
}

export async function verifyPassword(
  digest: string,
  plain: string,
  pepper: string,
): Promise<boolean> {
  try {
    return await verify(digest, peppered(plain, pepper));
  } catch {
    // Malformed or truncated digest: fail closed, never throw into the auth path.
    return false;
  }
}
