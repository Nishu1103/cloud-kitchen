import { createPushClient, type PushOutcome } from '@ck/sdk';
import { api } from './api';
import { env } from './env';

export type { PushOutcome };

/**
 * Web push for the delivery portal.
 *
 * Shares the SDK implementation with the other portals; only the Firebase project and
 * the storage key differ. The key is namespaced so a phone that also has the customer
 * app installed keeps the two tokens apart and does not unregister the wrong one.
 *
 * Firebase is imported lazily: the job list must render on campus Wi-Fi, and the bundle
 * is only worth fetching for a rider who actually turns alerts on.
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
  storageKey: 'ck.delivery.pushToken',
});

export const pushSupport = push.support;
export const permissionState = push.permission;
export const isStandalone = push.isStandalone;
export const enablePush = push.enable;
export const refreshPushRegistration = push.refresh;
export const disablePush = push.disable;
