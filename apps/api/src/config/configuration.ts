import type { Env } from './env.schema';

/**
 * Grouped, typed view of the environment. Modules inject `AppConfig` sections
 * instead of reading `process.env`, so a missing key is a compile error.
 */
export interface AppConfig {
  env: Env['NODE_ENV'];
  isProduction: boolean;
  http: {
    port: number;
    url: string;
    globalPrefix: string;
    corsOrigins: string[];
    cookieDomain?: string;
    trustProxyHops: number;
  };
  rateLimit: { windowMs: number; limit: number };
  mongo: { uri: string };
  redis: { url: string; password?: string; tls: boolean };
  auth: {
    accessSecret: string;
    accessTtl: number;
    refreshTtl: number;
    issuer: string;
    audience: string;
    passwordPepper: string;
    maxFailedAttempts: number;
    lockoutSeconds: number;
    allowedEmailDomains: string[];
  };
  payments: {
    provider: 'razorpay' | 'mock';
    razorpay: { keyId?: string; keySecret?: string; webhookSecret?: string };
  };
  storage: {
    /** Unset for native Amazon S3. Never a MinIO URL. */
    endpoint?: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
    publicBaseUrl: string;
  };
  mail: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
    from: string;
  };
  firebase: { projectId?: string; clientEmail?: string; privateKey?: string; enabled: boolean };
  sms: { provider: 'msg91' | 'mock'; apiKey?: string; senderId?: string };
}

/**
 * Native Amazon S3 needs no custom endpoint. DigitalOcean Spaces does, and operators
 * often leave `S3_ENDPOINT` blank while setting `S3_PUBLIC_BASE_URL` to the CDN host.
 */
function resolveStorageEndpoint(env: Env): string | undefined {
  if (env.S3_ENDPOINT) return env.S3_ENDPOINT;
  try {
    const host = new URL(env.S3_PUBLIC_BASE_URL).hostname.toLowerCase();
    const spaces = host.match(/(?:\.s3)?\.([a-z0-9-]+)\.digitaloceanspaces\.com$/);
    if (spaces) return `https://${spaces[1]}.digitaloceanspaces.com`;
  } catch {
    // Invalid public URL is already rejected by env validation.
  }
  return undefined;
}

export function buildConfig(env: Env): AppConfig {
  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    http: {
      port: env.API_PORT,
      url: env.API_URL,
      globalPrefix: env.API_GLOBAL_PREFIX,
      corsOrigins: env.CORS_ORIGINS,
      cookieDomain: env.COOKIE_DOMAIN,
      trustProxyHops: env.TRUST_PROXY_HOPS,
    },
    rateLimit: { windowMs: env.RATE_LIMIT_WINDOW_MS, limit: env.RATE_LIMIT_MAX },
    mongo: { uri: env.MONGODB_URI },
    redis: { url: env.REDIS_URL, password: env.REDIS_PASSWORD, tls: env.REDIS_TLS },
    auth: {
      accessSecret: env.JWT_ACCESS_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtl: env.JWT_REFRESH_TTL,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      passwordPepper: env.PASSWORD_PEPPER,
      maxFailedAttempts: env.AUTH_MAX_FAILED_ATTEMPTS,
      lockoutSeconds: env.AUTH_LOCKOUT_SECONDS,
      allowedEmailDomains: env.AUTH_ALLOWED_EMAIL_DOMAINS,
    },
    payments: {
      provider: env.PAYMENT_PROVIDER,
      razorpay: {
        keyId: env.RAZORPAY_KEY_ID,
        keySecret: env.RAZORPAY_KEY_SECRET,
        webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
      },
    },
    storage: {
      endpoint: resolveStorageEndpoint(env),
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      publicBaseUrl: env.S3_PUBLIC_BASE_URL,
    },
    mail: {
      host: env.MAIL_HOST,
      port: env.MAIL_PORT,
      secure: env.MAIL_SECURE,
      user: env.MAIL_USER,
      password: env.MAIL_PASSWORD,
      from: env.MAIL_FROM,
    },
    firebase: {
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      // Env files store the PEM with escaped newlines.
      privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      enabled: Boolean(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY),
    },
    sms: { provider: env.SMS_PROVIDER, apiKey: env.SMS_API_KEY, senderId: env.SMS_SENDER_ID },
  };
}

export const CONFIG = 'APP_CONFIG';
