/**
 * Web-push subscription management (client side).
 *
 * Responsibilities:
 *   - Subscribe the current browser/device with the push service using
 *     the app's VAPID public key.
 *   - Persist the resulting subscription to `push_subscriptions` via
 *     the Supabase client (RLS lets users insert their own rows).
 *   - Unsubscribe (both from the browser AND our row).
 *   - Report current status (permission + subscribed).
 *
 * Actually sending pushes is server-side (supabase/functions/send-push).
 */

import { supabase } from '@/lib/supabaseClient';
import { getServiceWorkerRegistration } from '@/lib/serviceWorker';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Base64url → Uint8Array, because PushManager.subscribe() wants the
// VAPID public key as raw bytes, not a base64 string.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// ArrayBuffer → base64 (what we store — matches what `web-push` server
// libraries expect on the way back out).
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function detectPlatform() {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Macintosh|Windows|Linux/.test(ua)) return 'desktop';
  return 'other';
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Returns { supported, permission, subscribed } for the current browser.
 * Note: "subscribed" is checked against the browser's PushManager only —
 * a row could exist in push_subscriptions for a stale/re-installed
 * browser; the 410-cleanup loop in send-push handles that.
 */
export async function getPushStatus() {
  if (!isPushSupported()) {
    return { supported: false, permission: 'default', subscribed: false };
  }
  const permission = Notification.permission;
  const reg = await getServiceWorkerRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return {
    supported: true,
    permission,
    subscribed: Boolean(sub),
    subscription: sub,
  };
}

/**
 * Request permission (if not already granted), subscribe with the push
 * service, and persist to Supabase. Safe to call multiple times — an
 * existing subscription with the same endpoint is upserted.
 *
 * Returns { ok: true } on success, { ok: false, reason } on failure.
 * `reason` values: "not-supported", "permission-denied", "no-vapid-key",
 * "no-registration", "subscribe-failed", "save-failed".
 */
export async function subscribeToPush(userEmail) {
  if (!isPushSupported()) return { ok: false, reason: 'not-supported' };
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[push] VITE_VAPID_PUBLIC_KEY is not set — skipping subscribe');
    return { ok: false, reason: 'no-vapid-key' };
  }
  if (!userEmail) return { ok: false, reason: 'no-user' };

  if (Notification.permission !== 'granted') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') return { ok: false, reason: 'permission-denied' };
  }

  const reg = await getServiceWorkerRegistration();
  if (!reg) return { ok: false, reason: 'no-registration' };

  let sub;
  try {
    // If an existing subscription is present, reuse it — re-subscribing
    // with different VAPID keys would invalidate the old endpoint.
    sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
  } catch (err) {
    console.warn('[push] subscribe failed:', err);
    return { ok: false, reason: 'subscribe-failed', error: err };
  }

  const json = sub.toJSON();
  const endpoint = json.endpoint || sub.endpoint;
  const p256dh = json.keys?.p256dh
    || arrayBufferToBase64(sub.getKey('p256dh'));
  const auth = json.keys?.auth
    || arrayBufferToBase64(sub.getKey('auth'));

  try {
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_email: userEmail,
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent || null,
        platform: detectPlatform(),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );
    if (error) {
      console.warn('[push] save failed:', error);
      return { ok: false, reason: 'save-failed', error };
    }
  } catch (err) {
    console.warn('[push] save threw:', err);
    return { ok: false, reason: 'save-failed', error: err };
  }

  // Also flip the master pref on so send-push respects it.
  try {
    await supabase
      .from('profiles')
      .update({ push_notifications_enabled: true })
      .eq('email', userEmail);
  } catch {
    // Non-fatal — the subscription row already exists.
  }

  return { ok: true, subscription: sub };
}

/**
 * Unsubscribe this browser: unregister from the push service AND delete
 * the corresponding row from push_subscriptions. Does NOT flip the
 * profiles.push_notifications_enabled flag — the user may have other
 * devices still subscribed.
 */
export async function unsubscribeFromPush() {
  if (!isPushSupported()) return { ok: true };
  const reg = await getServiceWorkerRegistration();
  if (!reg) return { ok: true };
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { ok: true };

  const endpoint = sub.endpoint;
  try { await sub.unsubscribe(); } catch (err) {
    console.warn('[push] browser unsubscribe failed:', err);
  }

  try {
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  } catch (err) {
    console.warn('[push] row delete failed:', err);
  }

  return { ok: true };
}

/**
 * Touch the row's last_seen_at so we can prune subscriptions that
 * haven't checked in in >8 weeks (iOS's silent expiry window).
 * Safe to call from any authenticated page load.
 */
export async function touchPushSubscription() {
  if (!isPushSupported()) return;
  const reg = await getServiceWorkerRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  try {
    await supabase
      .from('push_subscriptions')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('endpoint', sub.endpoint);
  } catch {
    // Non-fatal.
  }
}
