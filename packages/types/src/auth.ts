/**
 * Password policy, shared by the API and all four portals.
 *
 * Length is the dominant factor, so this asks for 12 characters and a little variety
 * rather than a thicket of rules that pushes people toward "Passw0rd!". The upper bound
 * exists because Argon2's cost scales with input length, making an unbounded password a
 * denial-of-service vector.
 *
 * It lives here so a client can state the rule before submitting and the server can
 * enforce the identical one — a mismatch would mean a form that accepts a password the
 * API then rejects.
 */
export const PASSWORD_RULES = {
  min: 12,
  max: 128,
  pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
  message: 'Password must include an uppercase letter, a lowercase letter and a number.',
  hint: 'At least 12 characters, with an uppercase letter, a lowercase letter and a number.',
} as const;

/** Client-side pre-check. The server validates the same rule regardless. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_RULES.min) {
    return `Use at least ${PASSWORD_RULES.min} characters.`;
  }
  if (password.length > PASSWORD_RULES.max) {
    return `Use at most ${PASSWORD_RULES.max} characters.`;
  }
  if (!PASSWORD_RULES.pattern.test(password)) return PASSWORD_RULES.message;
  return null;
}

/** Indian 10-digit mobile, matching the API's own validator. */
export const PHONE_PATTERN = /^[6-9]\d{9}$/;
