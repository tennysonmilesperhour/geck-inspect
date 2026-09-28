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

/**
 * Converts a Supabase user object into the flat shape the rest of the
 * app expects (email, full_name, membership_tier, etc.).
 */
export function normalizeSupabaseUser(supabaseUser) {
  if (!supabaseUser) return null;
  const meta = supabaseUser.user_metadata || {};
  return {
    full_name: meta.full_name || meta.name || supabaseUser.email,
    profile_image: meta.profile_image || meta.avatar_url || null,
    sidebar_badge_preference: meta.sidebar_badge_preference || 'collection',
    ...meta,
    // Auth metadata is user-editable. It cannot choose identity or privileges.
    id: supabaseUser.id,
    auth_user_id: supabaseUser.id,
    email: supabaseUser.email,
    role: 'user',
    membership_tier: 'free',
    membership_billing_cycle: null,
    subscription_status: null,
    revenuecat_tier: 'free',
    revenuecat_pro_active: false,
    is_guest: false,
  };
}
