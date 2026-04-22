/**
 * Service-worker registration for web push.
 *
 * Registration is idempotent — multiple calls just return the existing
 * registration. We register eagerly on page load (not lazily inside the
 * Settings toggle) because iOS requires the worker to already be
 * controlling the page before Notification.requestPermission() is
 * allowed to return "granted" in a PWA context.
 *
 * Safe to run in every browser: if `serviceWorker` is missing we just
 * bail. No-op on localhost over plain HTTP (workers require HTTPS).
 */
export async function registerServiceWorker() {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (err) {
    console.warn('[sw] registration failed:', err);
    return null;
  }
}

export async function getServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.getRegistration();
}
