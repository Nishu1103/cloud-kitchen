import { createPushClient, type PushOutcome } from '@ck/sdk';
import { api } from './api';
import { env } from './env';

export type { PushOutcome };

/**
 * Web push for the admin portal.
 *
 * Same SDK path as the other apps. The storage key is namespaced so a laptop that also
 * has the customer site open keeps the two FCM tokens apart.
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
  storageKey: 'ck.admin.pushToken',
});

export const pushSupport = push.support;
export const permissionState = push.permission;
export const enablePush = push.enable;
export const refreshPushRegistration = push.refresh;
export const disablePush = push.disable;
