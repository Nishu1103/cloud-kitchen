import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** URL-safe, 256 bits of entropy. Used for refresh tokens and one-time links. */
export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Long-lived credentials are stored only as SHA-256 digests. They already have
 * full entropy, so a slow KDF buys nothing here - unlike user passwords, which
 * go through Argon2id.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time compare that tolerates different lengths without leaking them. */
export function safeEqual(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right);
}

/** Numeric OTP from a CSPRNG, zero-padded and never biased. */
export function generateNumericOtp(length = 6): string {
  let otp = '';
  for (let index = 0; index < length; index += 1) otp += randomInt(0, 10).toString();
  return otp;
}

/** Short human-quotable order code, e.g. CK-7QF4KD. Ambiguous chars removed. */
export function generateOrderCode(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[randomInt(0, alphabet.length)];
  }
  return `CK-${code}`;
}

/** Support ticket reference, e.g. TKT-4M2XQ9. */
export function generateTicketCode(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[randomInt(0, alphabet.length)];
  }
  return `TKT-${code}`;
}

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}
