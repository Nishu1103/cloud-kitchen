import { createPushClient, type PushOutcome } from '@ck/sdk';
import { api } from './api';
import { env } from './env';

export type { PushOutcome };

/**
 * Web push for the customer PWA.
 *
 * The platform detection, service-worker handover and token bookkeeping live in the SDK
 * so all four portals behave identically. What stays here is what differs per app: the
 * Firebase project config and how a device is stored against the account.
 *
 * Firebase is imported lazily so its bundle is only fetched for a student who actually
 * opts in — it is far too large to sit in the initial payload of a home page loaded on
 * campus Wi-Fi.
 */
const FIREBASE_CONFIG = {
  apiKey: env.firebase.apiKey,
  authDomain: env.firebase.authDomain,
  projectId: env.firebase.projectId,
  messagingSenderId: env.firebase.messagingSenderId,
  appId: env.firebase.appId,
};

const push = createPushClient({
  config: FIREBASE_CONFIG,
  vapidKey: env.firebase.vapidKey,
  mintToken: async (registration) => {
    const [{ getApps, initializeApp }, { getMessaging, getToken, isSupported }] =
      await Promise.all([import('firebase/app'), import('firebase/messaging')]);

    if (!(await isSupported())) return null;

    const app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
    return getToken(getMessaging(app), {
      vapidKey: env.firebase.vapidKey,
      serviceWorkerRegistration: registration,
    });
  },
  registerDevice: (input) => api.account.registerDevice(input),
  unregisterDevice: (token) => api.account.unregisterDevice(token),
  storageKey: 'ck.customer.pushToken',
});

export const pushSupport = push.support;
export const permissionState = push.permission;
export const isStandalone = push.isStandalone;
export const enablePush = push.enable;
export const refreshPushRegistration = push.refresh;
export const disablePush = push.disable;
