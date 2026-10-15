/**
 * Public configuration, read once and validated at module load.
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so they must be referenced
 * literally — a dynamic `process.env[key]` lookup silently yields undefined in the
 * browser. Failing loudly here beats a blank kitchen board and a 404 in the network tab.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env and set it before starting the app.`,
    );
  }
  return value;
}

export const env = {
  apiUrl: required('NEXT_PUBLIC_API_URL', process.env.NEXT_PUBLIC_API_URL),
  wsUrl: required('NEXT_PUBLIC_WS_URL', process.env.NEXT_PUBLIC_WS_URL),
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Campus Kitchen',
  /** The campus this deployment serves; a campus is a tenant. */
  campusSlug: process.env.NEXT_PUBLIC_CAMPUS_SLUG ?? 'iit-kharagpur',
  /** Where a customer would see this kitchen, for "view my storefront". */
  storefrontUrl: process.env.NEXT_PUBLIC_STOREFRONT_URL ?? 'http://localhost:3000',
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? '',
  },
} as const;

/**
 * Push is optional: the board must work fully without it. Where a customer can miss a
 * promotion, a kitchen missing an order costs money, so the portal also keeps an
 * always-on realtime socket and an audible alert rather than relying on push alone.
 */
export const pushConfigured = Boolean(
  env.firebase.apiKey && env.firebase.projectId && env.firebase.vapidKey,
);
