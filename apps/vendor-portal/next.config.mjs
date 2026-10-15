import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { cspConnectSrc, storageConnectOrigins } from '../../packages/config/csp.mjs';
import { remoteImagePatterns } from '../../packages/config/images.mjs';

/**
 * Vendor portal.
 *
 * Runs on a kitchen tablet all service long, so it is installable and push-capable:
 * a missed "new order" is a refunded order. Same shared packages as the other
 * portals, compiled in-app.
 */

/**
 * The monorepo keeps one environment contract at the root so the portals and the API
 * cannot drift apart on an API URL. Next only looks in the app directory, so the root
 * file is loaded here, before the build inlines `NEXT_PUBLIC_*` values. A real
 * environment already has these set, and `override: false` leaves those alone.
 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
for (const file of ['.env', '.env.local']) {
  const path = resolve(repoRoot, file);
  if (existsSync(path)) dotenv.config({ path, override: false });
}

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Built per response so a restarted process always picks up current S3/Spaces hosts.
 * The file never leaves the kitchen tablet via a wildcard connect-src.
 */
function contentSecurityPolicy() {
  const apiOrigin = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').origin;
    } catch {
      return 'http://localhost:4000';
    }
  })();

  return [
    "default-src 'self'",
    `script-src 'self' https://www.gstatic.com${isDev ? " 'unsafe-eval' 'unsafe-inline'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${cspConnectSrc({
      apiOrigin,
      wsUrl: process.env.NEXT_PUBLIC_WS_URL,
      extra: storageConnectOrigins(),
    })} https://fcmregistrations.googleapis.com https://firebaseinstallations.googleapis.com`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@ck/ui', '@ck/sdk', '@ck/types'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    remotePatterns: remoteImagePatterns,
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // A kitchen board is not a public page and must never be indexed.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          ...(isDev
            ? []
            : [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload',
                },
              ]),
        ],
      },
      {
        // Never serve a stale worker: push would keep dying until the browser happened
        // to revalidate, and the kitchen would silently stop hearing new orders.
        source: '/firebase-messaging-sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};
