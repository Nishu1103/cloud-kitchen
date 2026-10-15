import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { cspConnectSrc } from '../../packages/config/csp.mjs';
import { remoteImagePatterns } from '../../packages/config/images.mjs';

/**
 * Customer PWA.
 *
 * The shared packages ship TypeScript source, so Next compiles them in-app: one
 * component implementation across four portals, tree-shaken per route.
 */

/**
 * The monorepo keeps one environment contract at the root, so all four portals and the
 * API cannot drift apart on an API URL or a campus slug. Next only looks in the app
 * directory, so the root file is loaded here — before the config below reads it, and
 * before the build inlines `NEXT_PUBLIC_*` values.
 *
 * A real environment (a container, CI, the platform's own dashboard) already has these
 * set; `override: false` keeps this from clobbering them.
 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
for (const file of ['.env', '.env.local']) {
  const path = resolve(repoRoot, file);
  if (existsSync(path)) dotenv.config({ path, override: false });
}

const isDev = process.env.NODE_ENV !== 'production';

const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').origin;
  } catch {
    return 'http://localhost:4000';
  }
})();

/**
 * Content Security Policy.
 *
 * `connect-src` is limited to our own API, the socket origin and Google's push
 * endpoints, so a script injected through user content cannot exfiltrate anywhere.
 * `unsafe-inline` for styles is unavoidable with Tailwind's runtime CSS variables;
 * scripts get no such exemption in production.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' https://www.gstatic.com https://checkout.razorpay.com${isDev ? " 'unsafe-eval' 'unsafe-inline'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${cspConnectSrc({
    apiOrigin,
    wsUrl: process.env.NEXT_PUBLIC_WS_URL,
  })} https://fcmregistrations.googleapis.com https://firebaseinstallations.googleapis.com`,
  "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@ck/ui', '@ck/sdk', '@ck/types'],
  experimental: {
    // Only the icons actually imported end up in the bundle.
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    // Object storage and campus CDN hosts only; never a wildcard.
    remotePatterns: remoteImagePatterns,
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(self)' },
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
        // The service worker must never be served stale, or push stops working after
        // a deploy until the browser happens to revalidate.
        source: '/firebase-messaging-sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};
