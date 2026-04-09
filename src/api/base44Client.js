import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, serverUrl, token, functionsVersion } = appParams;

const BASE44_SERVER = 'https://base44.app';

// appBaseUrl must be absolute so auth.redirectToLogin() builds a valid URL.
const appBaseUrl = import.meta.env.VITE_BASE44_APP_BASE_URL
  || serverUrl
  || BASE44_SERVER;

// Avoid passing null serverUrl to the SDK — let it use its own default instead.
const resolvedServerUrl = serverUrl || BASE44_SERVER;

export const base44 = createClient({
  appId,
  serverUrl: resolvedServerUrl,
  token,
  functionsVersion,
  appBaseUrl,
  requiresAuth: false
});
