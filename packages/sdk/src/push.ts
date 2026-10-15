import { DEVICE_PLATFORM, type DevicePlatform } from '@ck/types';

/**
 * Web push registration, shared by every portal.
 *
 * Deliberately best-effort: the notification centre and the realtime socket carry the
 * same information, so every failure path returns a reason instead of throwing. A user
 * who denies permission must still get a fully working app.
 *
 * Firebase itself is not imported here. The caller mints the token through `mintToken`,
 * which keeps this package free of a heavy optional dependency and lets each app decide
 * when to pay for that bundle - it should be fetched when somebody opts in, not on the
 * first page load. What stays shared is everything that is easy to get subtly wrong:
 * iOS install detection, the service-worker config handover, and token bookkeeping.
 */
export type PushOutcome =
  | { status: 'registered'; token: string }
  | { status: 'denied' }
  | { status: 'unsupported'; reason: string }
  | { status: 'needs-install'; reason: string }
  | { status: 'error'; reason: string };

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
}

export interface PushClientOptions {
  /** Handed to the service worker at runtime; also decides whether push is configured. */
  config: FirebaseWebConfig;
  vapidKey: string;
  /**
   * Mints an FCM registration token for this browser, against the worker registration
   * this client created. Return `null` when the browser cannot produce one. The caller
   * owns this so the Firebase bundle is imported lazily, by the app that depends on it.
   */
  mintToken: (registration: ServiceWorkerRegistration) => Promise<string | null>;
  /** Stores the token against the signed-in account, so the API can target it. */
  registerDevice: (input: {
    token: string;
    platform: DevicePlatform;
    browser: string;
    deviceLabel: string;
  }) => Promise<unknown>;
  unregisterDevice: (token: string) => Promise<unknown>;
  /** Worker path, relative to the origin root so its scope covers the whole app. */
  serviceWorkerPath?: string;
  /** Namespaced per app so two portals on one host cannot clobber each other. */
  storageKey?: string;
}

export interface PushClient {
  /** `null` when push is possible; an outcome explaining why when it is not. */
  support: () => PushOutcome | null;
  permission: () => NotificationPermission | 'unsupported';
  isStandalone: () => boolean;
  enable: () => Promise<PushOutcome>;
  /** Re-mints an already-granted token, for tokens Firebase rotates silently. */
  refresh: () => Promise<void>;
  disable: () => Promise<void>;
}

/** True when the page is running as an installed PWA rather than a browser tab. */
function standalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari's own flag, which predates the standard media query.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac; the touch-point check separates the two.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function detectPlatform(): DevicePlatform {
  if (isIos()) return standalone() ? DEVICE_PLATFORM.IOS_PWA : DEVICE_PLATFORM.WEB;
  if (/Android/.test(navigator.userAgent)) {
    return standalone() ? DEVICE_PLATFORM.ANDROID_PWA : DEVICE_PLATFORM.WEB;
  }
  return DEVICE_PLATFORM.WEB;
}

function browserName(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'edge';
  if (/OPR\//.test(ua)) return 'opera';
  if (/Chrome\//.test(ua)) return 'chrome';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Safari\//.test(ua)) return 'safari';
  return 'unknown';
}

/**
 * Hands the Firebase config to the service worker and waits for it to be active,
 * because posting to a worker that is still installing is a no-op.
 *
 * The worker is plain JavaScript served from the origin root, so it cannot read the
 * build's environment. Handing the config over at runtime also means one worker file
 * works for every campus deployment.
 */
async function sendConfigToWorker(
  registration: ServiceWorkerRegistration,
  config: FirebaseWebConfig,
): Promise<void> {
  const worker = registration.active ?? registration.waiting ?? registration.installing ?? null;
  if (!worker) return;

  if (worker.state !== 'activated') {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 5_000);
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') {
          clearTimeout(timer);
          resolve();
        }
      });
    });
  }

  worker.postMessage({ type: 'FIREBASE_CONFIG', config });
}

export function createPushClient(options: PushClientOptions): PushClient {
  const workerPath = options.serviceWorkerPath ?? '/firebase-messaging-sw.js';
  const storageKey = options.storageKey ?? 'ck.pushToken';
  const configured = Boolean(
    options.config.apiKey && options.config.projectId && options.vapidKey,
  );

  const support = (): PushOutcome | null => {
    if (typeof window === 'undefined') return { status: 'unsupported', reason: 'Server render' };
    if (!configured) {
      return { status: 'unsupported', reason: 'Push is not configured for this deployment' };
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { status: 'unsupported', reason: 'This browser cannot receive web push' };
    }
    // On iOS, push exists only for a site added to the Home Screen. Detecting that here
    // is what lets the UI say "Add to Home Screen" instead of showing a dead switch.
    if (isIos() && !standalone()) {
      return {
        status: 'needs-install',
        reason: 'On iPhone and iPad, add this app to your Home Screen to receive alerts',
      };
    }
    return null;
  };

  const enable = async (): Promise<PushOutcome> => {
    const blocked = support();
    if (blocked) return blocked;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return { status: 'denied' };

      const registration = await navigator.serviceWorker.register(workerPath, { scope: '/' });
      await sendConfigToWorker(registration, options.config);

      const token = await options.mintToken(registration);
      if (!token) return { status: 'error', reason: 'Could not create a device token' };

      await options.registerDevice({
        token,
        platform: detectPlatform(),
        browser: browserName(),
        deviceLabel: navigator.userAgent.slice(0, 80),
      });

      // Tokens rotate silently. Remembering the last one we sent lets the app
      // re-register on a later load only when it actually changed.
      localStorage.setItem(storageKey, token);
      return { status: 'registered', token };
    } catch (error) {
      return { status: 'error', reason: (error as Error).message };
    }
  };

  return {
    support,
    permission: () =>
      typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
    isStandalone: standalone,
    enable,

    /**
     * Without this, a token Firebase rotates in the background leaves a device that
     * looks subscribed but silently receives nothing.
     */
    refresh: async () => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      if (support()) return;
      await enable();
    },

    disable: async () => {
      const token = localStorage.getItem(storageKey);
      if (!token) return;
      localStorage.removeItem(storageKey);
      try {
        await options.unregisterDevice(token);
      } catch {
        // The row is harmless if it lingers: the API prunes tokens the gateway rejects.
      }
    },
  };
}
