import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { buildConfig, type AppConfig } from './configuration';
import { validateEnv } from './env.schema';

let cached: AppConfig | undefined;

/**
 * Loads and validates the environment exactly once per process.
 *
 * Called from `main.ts` before the Nest container is created so that an invalid
 * or insecure configuration crashes the process instead of booting a half-broken
 * API. Values already present in the real environment always win over .env files,
 * which is what lets containers and CI inject secrets.
 */
export function loadAppConfig(): AppConfig {
  if (cached) return cached;

  for (const candidate of ['.env', '../../.env']) {
    const path = resolve(process.cwd(), candidate);
    if (existsSync(path)) loadDotenv({ path, override: false });
  }

  const env = validateEnv(process.env as Record<string, unknown>);
  process.env.TZ = env.TZ;
  cached = buildConfig(env);
  return cached;
}
