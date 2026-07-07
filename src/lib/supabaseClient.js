import { createClient } from '@supabase/supabase-js';

// The bundled fallback is the production project (anon key is public by
// design). It exists so builds work without env vars set. The risk it
// creates is a local or preview build silently talking to PRODUCTION
// data when someone forgot to set VITE_SUPABASE_URL, so warn loudly in
// dev when the fallback is in use. We do NOT throw: prod intentionally
// relies on this fallback, and failing the build would be worse.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://mmuglfphhwlaluyfyxsp.supabase.co';

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tdWdsZnBoaHdsYWx1eWZ5eHNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjA5MTksImV4cCI6MjA5MTA5NjkxOX0.mbjrSDZoEvQwPBiZbRtzjC04viNmSJ7sABDJQK9TmIM';

if (
  import.meta.env.DEV &&
  (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY)
) {
  console.warn(
    '[supabaseClient] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set; ' +
      'falling back to the bundled PRODUCTION project. Set them in .env.local ' +
      'to point this build at a different Supabase project.',
  );
}

// Wrap the global fetch with a 30-second timeout so Supabase requests
// don't hang indefinitely on flaky connections.
const fetchWithTimeout = (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timeoutId)
  );
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
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
    id: supabaseUser.id,
    email: supabaseUser.email,
    full_name: meta.full_name || meta.name || supabaseUser.email,
    membership_tier: meta.membership_tier || 'free',
    membership_billing_cycle: meta.membership_billing_cycle || null,
    profile_image: meta.profile_image || meta.avatar_url || null,
    sidebar_badge_preference: meta.sidebar_badge_preference || 'collection',
    ...meta,
  };
}
