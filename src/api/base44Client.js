import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, serverUrl, token, functionsVersion } = appParams;

// appBaseUrl must be absolute so auth.redirectToLogin() builds a valid URL.
// Falls back to serverUrl, then to the Base44 default, so /login never resolves
// as a relative path on Vercel (which would hit the SPA catch-all and 404).
const appBaseUrl = import.meta.env.VITE_BASE44_APP_BASE_URL
  || serverUrl
  || 'https://base44.app';

export const base44 = createClient({
  appId,
  serverUrl,
  token,
  functionsVersion,
  appBaseUrl,
  requiresAuth: false
});
