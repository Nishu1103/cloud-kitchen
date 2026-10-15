/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging service worker for the rider app.
 *
 * Must be served from the origin root at this exact path: the browser scopes a push
 * subscription to the worker's location, and FCM's web SDK looks here by default. It is a
 * near-copy of the other portals' workers rather than a shared file because a service
 * worker is fetched by URL, not imported - each origin needs its own, and this one
 * differs in how it treats a job offer.
 *
 * Config arrives at runtime from the page (`FIREBASE_CONFIG` message) so the same file
 * works across campuses and no project keys are baked into a cached worker.
 */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const CONFIG_CACHE = 'ck-delivery-push-config';
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
    const isOffer = data.type === 'delivery.offered';

    self.registration.showNotification(data.title || 'Rider', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      // An offer goes to every online rider and the first to accept wins, so it has to
      // reach a phone in a pocket. It does not require interaction, though: a job that
      // somebody else took should be dismissible with a swipe, not a chore.
      vibrate: isOffer ? [180, 80, 180, 80, 180] : undefined,
      // Offers collapse onto one notification: by the time a rider looks, what matters is
      // that there is work, and the list in the app is the source of truth for what.
      tag: isOffer ? 'ck-delivery-offer' : data.tag || 'ck-delivery-general',
      renotify: Boolean(data.renotify) || isOffer,
      data: { deepLink: data.deepLink || (isOffer ? '/jobs' : '/') },
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

/** Focuses the open app rather than stacking a tab per notification. */
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
