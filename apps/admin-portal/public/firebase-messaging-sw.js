/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging service worker for the admin portal.
 *
 * Must be served from the origin root. Config arrives at runtime from the page
 * (`FIREBASE_CONFIG` message) so no project keys are baked into a cached worker.
 */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const CONFIG_CACHE = 'ck-admin-push-config';
const CONFIG_KEY = '/__push-config';

async function saveConfig(config) {
  const cache = await caches.open(CONFIG_CACHE);
  await cache.put(CONFIG_KEY, new Response(JSON.stringify(config)));
}

async function loadConfig() {
  const cache = await caches.open(CONFIG_CACHE);
  const hit = await cache.match(CONFIG_KEY);
  return hit ? hit.json() : null;
}

let initialized = false;

async function initMessaging() {
  if (initialized) return true;

  const config = await loadConfig();
  if (!config || !config.projectId) return false;

  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    self.registration.showNotification(data.title || 'Campus Kitchen Admin', {
      body: data.body || '',
      icon: '/icons/icon.svg',
      tag: data.tag || data.orderId || 'ck-admin-general',
      renotify: Boolean(data.renotify),
      data: { deepLink: data.deepLink || '/notifications' },
    });
  });

  initialized = true;
  return true;
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await initMessaging();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const message = event.data;
  if (!message || message.type !== 'FIREBASE_CONFIG') return;

  event.waitUntil(
    (async () => {
      await saveConfig(message.config);
      await initMessaging();
    })(),
  );
});

self.addEventListener('push', (event) => {
  event.waitUntil(initMessaging());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.deepLink) || '/';

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target);
          return;
        }
      }

      await self.clients.openWindow(target);
    })(),
  );
});
