import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { cspConnectSrc } from '../../packages/config/csp.mjs';
import { remoteImagePatterns } from '../../packages/config/images.mjs';

/**
 * Delivery partner portal.
 *
 * Lives on a phone, outdoors, on campus Wi-Fi that drops between hostels. That shapes
 * everything here: it is installable so it can receive push, it asks for geolocation
 * (unlike the other portals, where the permission is denied outright), and it keeps the
 * JavaScript it ships small because a rider waiting on a spinner is a late delivery.
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
 * Tighter than the other portals: this app uploads nothing and embeds no map tiles, so
 * `connect-src` is our API, the socket and Google's push endpoints, and nothing else.
 * Navigation hands off to the phone's own map app through a `geo:` link rather than
 * loading a third-party SDK.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' https://www.gstatic.com${isDev ? " 'unsafe-eval' 'unsafe-inline'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${cspConnectSrc({
    apiOrigin,
    wsUrl: process.env.NEXT_PUBLIC_WS_URL,
  })} https://fcmregistrations.googleapis.com https://firebaseinstallations.googleapis.com`,
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
    optimizePackageImports: ['lucide-react'],
  },
  async redirects() {
    return [
      // Assigned-job notifications used `/jobs/:id`. The active run is the home screen.
      { source: '/jobs/:id', destination: '/', permanent: false },
    ];
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
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Geolocation is allowed for this origin only - it is the one portal that
          // legitimately needs it, and only while a job is in progress.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
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
        // to revalidate, and a rider would stop being offered jobs without knowing.
        source: '/firebase-messaging-sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};
