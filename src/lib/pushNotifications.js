import { supabase } from '@/lib/supabaseClient';

const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ||
  'BGQmcjlQQN13HAo_SfM71uXRSnYWCscGUlMIQYBkqYZwrmYGUicn9znAjBJnwWu5_bKqoltldjNuYd4vYgt8q_s';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getPushPermissionState() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

export function isIOSStandalone() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  return { isIOS, isStandalone };
}

export async function getExistingSubscription() {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function subscribeToPush(userEmail) {
  if (!VAPID_PUBLIC_KEY) throw new Error('VAPID public key not configured');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Push notification permission denied');
  }

  const reg = await navigator.serviceWorker.ready;

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const subJson = subscription.toJSON();

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_email: userEmail,
      endpoint: subJson.endpoint,
      keys_p256dh: subJson.keys.p256dh,
      keys_auth: subJson.keys.auth,
      user_agent: navigator.userAgent,
      updated_date: new Date().toISOString(),
    },
    { onConflict: 'user_email,endpoint' }
  );

  if (error) throw error;
  return subscription;
}

export async function unsubscribeFromPush(userEmail) {
  const subscription = await getExistingSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_email', userEmail)
      .eq('endpoint', endpoint);
  }
}

export async function sendPushToUser(userEmail, title, body, url, tag) {
  try {
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: { user_email: userEmail, title, body, url, tag },
    });
    if (error) console.warn('Push send failed:', error);
  } catch (e) {
    console.warn('Push send failed:', e);
  }
}
