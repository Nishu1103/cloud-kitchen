import { z } from 'zod';

const csv = (value: string) =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

const bool = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .default('false');

const port = z.coerce.number().int().min(1).max(65535);
const seconds = z.coerce.number().int().positive();

/**
 * The process refuses to start unless the environment is fully valid. Anything
 * optional here must have a safe default; anything security-critical is checked
 * again by `assertProductionHardening` below.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    TZ: z.string().default('Asia/Kolkata'),

    API_PORT: port.default(4000),
    API_URL: z.string().url(),
    API_GLOBAL_PREFIX: z.string().default('api'),
    CORS_ORIGINS: z.string().transform(csv),
    COOKIE_DOMAIN: z.string().optional().transform((value) => (value ? value : undefined)),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().min(10).default(120),

    MONGODB_URI: z.string().startsWith('mongodb'),

    REDIS_URL: z.string().startsWith('redis'),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_TLS: bool,

    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_TTL: seconds.default(900),
    JWT_REFRESH_TTL: seconds.default(2592000),
    JWT_ISSUER: z.string().default('campus-kitchen'),
    JWT_AUDIENCE: z.string().default('campus-kitchen-clients'),
    PASSWORD_PEPPER: z.string().min(16),
    AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
    AUTH_LOCKOUT_SECONDS: seconds.default(900),
    AUTH_ALLOWED_EMAIL_DOMAINS: z.string().default('').transform(csv),

    PAYMENT_PROVIDER: z.enum(['razorpay', 'mock']).default('mock'),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

    // Empty = native Amazon S3 for S3_REGION. Do not point this at MinIO.
    S3_ENDPOINT: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.string().url().optional(),
    ),
    S3_REGION: z.string().default('ap-south-1'),
    S3_BUCKET: z.string().min(1),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_FORCE_PATH_STYLE: bool,
    S3_PUBLIC_BASE_URL: z.string().url(),

    MAIL_HOST: z.string().min(1),
    MAIL_PORT: port.default(1025),
    MAIL_SECURE: bool,
    MAIL_USER: z.string().optional(),
    MAIL_PASSWORD: z.string().optional(),
    MAIL_FROM: z.string().default('Campus Kitchen <no-reply@campuskitchen.in>'),

    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASE_CLIENT_EMAIL: z.string().optional(),
    FIREBASE_PRIVATE_KEY: z.string().optional(),

    SMS_PROVIDER: z.enum(['msg91', 'mock']).default('mock'),
    SMS_API_KEY: z.string().optional(),
    SMS_SENDER_ID: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const wildcardOrigin = env.CORS_ORIGINS.some((origin) => origin.includes('*'));
    if (wildcardOrigin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message: 'Wildcard origins are not allowed; credentialed CORS requires exact origins.',
      });
    }

    if (env.PAYMENT_PROVIDER === 'razorpay') {
      for (const key of ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when PAYMENT_PROVIDER=razorpay`,
          });
        }
      }
    }

    if (env.NODE_ENV !== 'production') return;

    const placeholders = [/replace-me/i, /replace-with-/i, /changeme/i, /^secret$/i, /localdev/i];
    const secrets: Array<[string, string]> = [
      ['JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET],
      ['PASSWORD_PEPPER', env.PASSWORD_PEPPER],
      ['S3_ACCESS_KEY_ID', env.S3_ACCESS_KEY_ID],
      ['S3_SECRET_ACCESS_KEY', env.S3_SECRET_ACCESS_KEY],
    ];
    for (const [name, value] of secrets) {
      if (placeholders.some((pattern) => pattern.test(value))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [name],
          message: `${name} still holds a placeholder value; generate a real secret.`,
        });
      }
    }

    if (env.CORS_ORIGINS.some((origin) => origin.startsWith('http://'))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message: 'Plaintext http origins are not allowed in production.',
      });
    }

    if (env.PAYMENT_PROVIDER === 'mock') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PAYMENT_PROVIDER'],
        message: 'The mock payment provider must never run in production.',
      });
    }

    if (!env.MONGODB_URI.includes('tls=true') && !env.MONGODB_URI.startsWith('mongodb+srv://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MONGODB_URI'],
        message: 'Production MongoDB connections must use TLS.',
      });
    }

    const minioLike =
      /minio/i.test(env.S3_ENDPOINT ?? '') ||
      /localhost|127\.0\.0\.1/.test(env.S3_ENDPOINT ?? '') ||
      /localhost|127\.0\.0\.1/.test(env.S3_PUBLIC_BASE_URL) ||
      /ckminioadmin/i.test(env.S3_ACCESS_KEY_ID) ||
      /ckminioadmin/i.test(env.S3_SECRET_ACCESS_KEY);

    if (minioLike) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['S3_ENDPOINT'],
        message: 'Production image storage must be Amazon S3, not MinIO or localhost.',
      });
    }

    if (env.S3_PUBLIC_BASE_URL.startsWith('http://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['S3_PUBLIC_BASE_URL'],
        message: 'Production object URLs must be HTTPS.',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    // Thrown before the logger exists, so this is the one place we write to stderr directly.
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return parsed.data;
}
