/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging service worker for the kitchen portal.
 *
 * Must be served from the origin root at this exact path: the browser scopes a push
 * subscription to the worker's location, and FCM's web SDK looks here by default. It is a
 * near-copy of the customer worker rather than a shared file because a service worker is
 * fetched by URL, not imported - each origin needs its own, and this one differs in how
 * loudly it treats a new order.
 *
 * Config arrives at runtime from the page (`FIREBASE_CONFIG` message) so the same file
 * works across campuses and no project keys are baked into a cached worker.
 */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const CONFIG_CACHE = 'ck-vendor-push-config';
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
    const isNewOrder = data.category === 'order' && data.type === 'order.new';

    self.registration.showNotification(data.title || 'Kitchen', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      // A new order is the one notification a kitchen must not miss, so it vibrates
      // hard and stays on screen until someone deals with it. Everything else behaves
      // like a normal notification.
      vibrate: isNewOrder ? [200, 100, 200, 100, 200] : undefined,
      requireInteraction: isNewOrder,
      // Each order gets its own notification; collapsing them would hide a second
      // order that arrived while the first was unread.
      tag: data.tag || data.orderId || 'ck-vendor-general',
      renotify: Boolean(data.renotify) || isNewOrder,
      data: { deepLink: data.deepLink || '/orders' },
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

/** Focuses the open board rather than stacking tabs for every order. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.deepLink) || '/orders';

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
