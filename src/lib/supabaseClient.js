import { createClient } from '@supabase/supabase-js';

const isTest = import.meta.env.MODE === 'test';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || (isTest ? 'http://127.0.0.1' : '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || (isTest ? 'test-anon-key' : '');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[supabaseClient] Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for this environment.',
  );
}

// Most data calls should fail quickly on a bad connection. Morph ID is a
// long-running vision request, though: two photos plus evidence can take
// longer than 30 seconds even when the analyzer is healthy.
const fetchWithTimeout = (url, options = {}) => {
  const requestUrl = typeof url === 'string' ? url : url?.url || String(url);
  const timeoutMs = requestUrl.includes('/functions/v1/recognize-gecko-morph')
    ? 120000
    : 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timeoutId)
  );
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() ? 'pkce' : 'implicit',
  },
  global: {
    fetch: fetchWithTimeout,
  },
});

// Lives in its own module so the sign-in state can use it without the
// Supabase library; re-exported here for existing callers.
export { normalizeSupabaseUser } from './normalizeSupabaseUser';
