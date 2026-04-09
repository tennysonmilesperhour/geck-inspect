import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, serverUrl, token, functionsVersion } = appParams;

const BASE44_SERVER = 'https://base44.app';
// Fallback app ID extracted from Supabase storage URLs in the codebase.
const RESOLVED_APP_ID = appId || '68929cdad944c572926ab6cb';

// appBaseUrl must be absolute so auth.redirectToLogin() builds a valid URL.
const appBaseUrl = import.meta.env.VITE_BASE44_APP_BASE_URL
  || serverUrl
  || BASE44_SERVER;

// Avoid passing null serverUrl to the SDK — let it use its own default instead.
const resolvedServerUrl = serverUrl || BASE44_SERVER;

export const base44 = createClient({
  appId: RESOLVED_APP_ID,
  serverUrl: resolvedServerUrl,
  token,
  functionsVersion,
  appBaseUrl,
  requiresAuth: false
});

/**
 * Redirects to Base44 login with the correct app_id parameter.
 * The SDK's built-in redirectToLogin omits app_id, causing "App not found".
 */
export function redirectToLogin(fromUrl) {
  const returnTo = fromUrl || window.location.href;
  window.location.href = `${BASE44_SERVER}/login?app_id=${RESOLVED_APP_ID}&from_url=${encodeURIComponent(returnTo)}`;
}
