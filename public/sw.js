/**
 * Geck Inspect service worker.
 *
 * Two jobs:
 *   1. Web push (notifications). This is the original reason the worker
 *      exists and must keep working exactly as before.
 *   2. A deliberately conservative offline cache so the app opens and the
 *      last-seen collection is readable with no signal.
 *
 * The caching strategy is chosen to make the classic "stuck on an old
 * version" and "white screen after deploy" bugs impossible:
 *
 *   - Navigations (the HTML shell) are NETWORK-FIRST. An online visitor
 *     always gets fresh HTML from the server; the cached shell is only
 *     ever served when the network is unreachable. That means a stale
 *     cached page can never shadow a new deploy for an online user.
 *   - Hashed build assets under /assets/ are immutable (Vite fingerprints
 *     the filename), so they are safe to serve cache-first.
 *   - Other same-origin static files (logo, manifest, icons) use
 *     stale-while-revalidate: instant from cache, refreshed in the
 *     background.
 *   - Everything cross-origin (Supabase API, Stripe, storage, analytics)
 *     is NEVER intercepted. API data is always live; we never serve a
 *     stale gecko record from cache.
 *
 * Bump CACHE_VERSION whenever the caching logic below changes so the
 * activate handler purges the previous generation of caches.
 */

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `geck-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `geck-static-${CACHE_VERSION}`;
const CURRENT_CACHES = new Set([SHELL_CACHE, STATIC_CACHE]);

// Minimal set precached at install so the very first offline visit still
// opens. '/' is the SPA entry the router boots from.
const PRECACHE_URLS = ['/', '/logo.png', '/manifest.json'];

self.addEventListener('install', (event) => {
  // Activate the new worker immediately on update so push subscriptions
  // don't stall behind the old worker still holding the port, and so the
  // freshest caching logic takes over without waiting for every tab to
  // close.
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(SHELL_CACHE);
        // addAll fails atomically if any URL 404s; add individually so a
        // single missing asset can't abort the whole install.
        await Promise.all(
          PRECACHE_URLS.map((url) =>
            cache.add(url).catch(() => {
              /* asset optional, ignore */
            })
          )
        );
      } catch {
        /* precache is best-effort; the worker still installs without it */
      }
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches left behind by a previous CACHE_VERSION.
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('geck-') && !CURRENT_CACHES.has(name))
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

// Only cache genuinely cacheable responses: a real 200 from our own
// origin. Opaque (cross-origin no-cors) and partial (206) responses are
// skipped so we never poison the cache with something unreplayable.
function isCacheableResponse(response) {
  return (
    response &&
    response.status === 200 &&
    (response.type === 'basic' || response.type === 'default')
  );
}

async function networkFirstShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      // Keep a single canonical shell copy under '/', regardless of which
      // client-side route the navigation was for. The SPA router handles
      // the path once the shell boots.
      cache.put('/', response.clone());
    }
    return response;
  } catch {
    // Offline: serve the last good shell, falling back to the precached
    // entry point, then a tiny inline message if we have nothing at all.
    const cached = (await cache.match(request)) || (await cache.match('/'));
    if (cached) return cached;
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
        '<body style="font-family:system-ui;background:#0f172a;color:#e2e8f0;' +
        'display:flex;min-height:100vh;align-items:center;justify-content:center;' +
        'text-align:center;padding:2rem;margin:0">' +
        '<div><h1>You are offline</h1><p>Reconnect to load Geck Inspect.</p></div>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
    );
  }
}

async function cacheFirstImmutable(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheableResponse(response)) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((response) => {
      if (isCacheableResponse(response)) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  // Serve cache immediately when we have it; otherwise wait for network.
  return cached || (await networkFetch) || fetch(request);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never touch non-GET (mutations must always hit the network) or
  // anything cross-origin (Supabase, Stripe, storage, analytics). Letting
  // these fall through means API data is always live and uncached.
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // HTML navigations: network-first so a deploy is never shadowed by a
  // stale cached shell for an online user.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(request));
    return;
  }

  // Immutable hashed build output: safe to serve cache-first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirstImmutable(request));
    return;
  }

  // Other same-origin static assets (icons, fonts, images, manifest):
  // fast from cache, refreshed in the background.
  if (/\.(?:png|jpg|jpeg|svg|webp|gif|ico|woff2?|ttf|json|css|js)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Anything else falls through to the default network handling.
});

// Push notification arrival. Server payload is JSON:
//   { title, body, url, icon, tag, data }
// We always show a user-visible notification on iOS, Apple revokes
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
