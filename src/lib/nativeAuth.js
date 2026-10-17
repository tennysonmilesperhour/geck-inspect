import { isNativePlatform } from './revenuecat';
import { authContinuationPath, redirectFromSearch, safeRedirectPath } from './postAuthRedirect';
import { getSupabase } from './supabaseLazy';

export const NATIVE_AUTH_CALLBACK = 'com.geckinspect.app://auth/callback';
export function authRedirect(path = '/MyGeckos') {
  if (isNativePlatform()) {
    const target = path.startsWith('/AuthPortal') ? redirectFromSearch(path.split('?')[1]) : safeRedirectPath(path);
    const params = new URLSearchParams();
    if (path.includes('mode=reset')) params.set('mode', 'reset');
    if (target && target !== '/MyGeckos') params.set('redirect', target);
    return NATIVE_AUTH_CALLBACK + (params.size ? `?${params}` : '');
  }
  return `${window.location.origin}${path}`;
}

export function parseNativeAuthCallback(value) {
  const url = new URL(value);
  if (url.protocol !== 'com.geckinspect.app:' || url.hostname !== 'auth' || url.pathname !== '/callback') return null;
  return {
    code: url.searchParams.get('code'),
    recovery: url.searchParams.get('mode') === 'reset',
    failed: url.searchParams.has('error'),
    target: redirectFromSearch(url.search),
    // An email token link the website passed on to the app
    // (completeEmailLink in src/lib/emailLinkAuth.js).
    tokenHash: url.searchParams.get('token_hash'),
    type: url.searchParams.get('type'),
  };
}

// Capacitor retains the launch URL across webview reloads, so stay in the
// running router rather than reloading and consuming the same link again.
function navigateAfterAuth(path) {
  window.history.replaceState(window.history.state, '', path);
  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
}

// Check an email token link inside the app, so the session lands here and
// not in the phone's browser. Throws when the link is expired or used.
async function completeNativeTokenLink({ tokenHash, type, target }, Browser) {
  if (handledCodes.has(tokenHash)) return;
  handledCodes.add(tokenHash);
  const { supabase: client } = await import('./supabaseClient');
  const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) { handledCodes.delete(tokenHash); throw error; }
  await Browser.close().catch(() => {});
  navigateAfterAuth(type === 'recovery' || type === 'invite' ? authContinuationPath(target, { reset: true }) : target || '/MyGeckos');
}

let installed = false;
const handledCodes = new Set();
export async function installNativeAuth() {
  if (!isNativePlatform() || installed) return;
  installed = true;
  const { App } = await import('@capacitor/app');
  const { Browser } = await import('@capacitor/browser');
  const handle = async ({ url }) => {
    let callback;
    try {
      callback = parseNativeAuthCallback(url);
      if (!callback) return;
      if (!callback.failed && callback.tokenHash) return await completeNativeTokenLink(callback, Browser);
      if (callback.failed || !callback.code) throw new Error('Invalid sign-in callback');
      if (handledCodes.has(callback.code)) return;
      handledCodes.add(callback.code);
      const supabase = await getSupabase();
      const { error } = await supabase.auth.exchangeCodeForSession(callback.code);
      if (error) { handledCodes.delete(callback.code); throw error; }
      await Browser.close().catch(() => {});
      navigateAfterAuth(callback.recovery ? authContinuationPath(callback.target, { reset: true }) : callback.target || '/MyGeckos');
    } catch {
      // Never log the callback URL or authorization code.
      await Browser.close().catch(() => {});
      navigateAfterAuth(`/AuthPortal?authError=callback${callback?.target ? `&redirect=${encodeURIComponent(callback.target)}` : ''}`);
    }
  };
  await App.addListener('appUrlOpen', handle);
  const launch = await App.getLaunchUrl();
  if (launch?.url) await handle(launch);
}
