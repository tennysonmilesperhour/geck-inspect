import { isNativePlatform } from './revenuecat';
import { supabase } from './supabaseClient';

export const NATIVE_AUTH_CALLBACK = 'com.geckinspect.app://auth/callback';
export function authRedirect(path = '/MyGeckos') {
  if (isNativePlatform()) return NATIVE_AUTH_CALLBACK + (path.includes('mode=reset') ? '?mode=reset' : '');
  return `${window.location.origin}${path}`;
}

export function parseNativeAuthCallback(value) {
  const url = new URL(value);
  if (url.protocol !== 'com.geckinspect.app:' || url.hostname !== 'auth' || url.pathname !== '/callback') return null;
  return { code: url.searchParams.get('code'), recovery: url.searchParams.get('mode') === 'reset', failed: url.searchParams.has('error') };
}

let installed = false;
const handledCodes = new Set();
export async function installNativeAuth() {
  if (!isNativePlatform() || installed) return;
  installed = true;
  const { App } = await import('@capacitor/app');
  const { Browser } = await import('@capacitor/browser');
  const handle = async ({ url }) => {
    try {
      const callback = parseNativeAuthCallback(url);
      if (!callback) return;
      if (callback.failed || !callback.code) throw new Error('Invalid sign-in callback');
      if (handledCodes.has(callback.code)) return;
      handledCodes.add(callback.code);
      const { error } = await supabase.auth.exchangeCodeForSession(callback.code);
      if (error) { handledCodes.delete(callback.code); throw error; }
      await Browser.close().catch(() => {});
      window.location.replace(callback.recovery ? '/AuthPortal?mode=reset' : '/MyGeckos');
    } catch {
      // Never log the callback URL or authorization code.
      await Browser.close().catch(() => {});
      window.location.replace('/AuthPortal?authError=callback');
    }
  };
  await App.addListener('appUrlOpen', handle);
  const launch = await App.getLaunchUrl();
  if (launch?.url) await handle(launch);
}
