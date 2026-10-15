/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging service worker.
 *
 * This file must be served from the origin root at this exact path: the browser scopes a
 * push subscription to the worker's location, and FCM's web SDK looks here by default.
 *
 * It is plain JavaScript rather than part of the bundle because a service worker runs
 * outside the app, before and after any tab exists. Config is injected at runtime from
 * the page (`FIREBASE_CONFIG` message) so the same file works across campuses and no
 * project keys are baked into a cached worker.
 *
 * Compat builds are used deliberately: the modular SDK is not designed to be imported
 * with `importScripts`, which is the only loader available here.
 */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const CONFIG_CACHE = 'ck-push-config';
const CONFIG_KEY = '/__push-config';

/** Persists config across worker restarts, which happen constantly when idle. */
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

  /**
   * Background handler for data-only messages.
   *
   * Messages that carry an FCM `notification` block are displayed by the SDK itself and
   * never reach this callback, which is why nothing here duplicates them. Order updates
   * take that path; silent payloads (a badge refresh, a cache hint) land here.
   */
  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const title = data.title || 'Campus Kitchen';

    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      image: data.imageUrl || undefined,
      // Collapses repeats for the same order rather than stacking six updates.
      tag: data.tag || data.orderId || 'ck-general',
      renotify: Boolean(data.renotify),
      requireInteraction: false,
      data: { deepLink: data.deepLink || '/' },
    });
  });

  initialized = true;
  return true;
}

self.addEventListener('install', () => {
  // Replaces an older worker immediately: a stale push handler is worse than none.
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
  // Ensures the handler is live even when the worker was woken cold by a push.
  event.waitUntil(initMessaging());
});

/**
 * Focuses an existing tab instead of opening another one, so tapping three order updates
 * does not leave three copies of the app open.
 */
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
