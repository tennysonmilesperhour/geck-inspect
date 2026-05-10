/**
 * Geck Inspect service worker ,  push notifications only.
 *
 * We intentionally do NOT cache assets or add offline support here.
 * Vite already emits hashed filenames with long-cache headers, and the
 * HTML shell is prerendered ,  layering our own cache on top is a
 * well-known source of "why is the site stuck on an old version" bugs.
 * Keep this file narrowly scoped to what push requires.
 */

self.addEventListener('install', () => {
  // Activate the new worker immediately on update so push subscriptions
  // don't stall behind the old worker still holding the port.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push notification arrival. Server payload is JSON:
//   { title, body, url, icon, tag, data }
// We always show a user-visible notification on iOS ,  Apple revokes
// push permission if a push handler ever resolves without one.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Geck Inspect', body: event.data?.text?.() || '' };
  }

  const title = payload.title || 'Geck Inspect';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/logo.png',
    badge: payload.badge || '/logo.png',
    tag: payload.tag || undefined,
    data: { url: payload.url || '/', ...(payload.data || {}) },
    // iOS ignores most of these but they're harmless. Android / desktop
    // honor them and the notification looks correct everywhere.
    requireInteraction: false,
    renotify: Boolean(payload.tag),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Tap a notification → focus an existing tab at that URL if one is
// already open, otherwise open a new one. "existing" here means the
// installed PWA window.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Prefer an already-open PWA window navigated to the same origin.
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            await client.focus();
            if ('navigate' in client) {
              try { await client.navigate(targetUrl); } catch {}
            }
            return;
          }
        } catch {}
      }

      await self.clients.openWindow(targetUrl);
    })()
  );
});

// Handle subscription-change events (browser-rotated the push keys).
// We emit a message to any open clients so they can re-subscribe.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window' });
      for (const client of allClients) {
        client.postMessage({ type: 'pushsubscriptionchange' });
      }
    })()
  );
});
