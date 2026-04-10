import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://qtrypzzcjebvfcihiynt.supabase.co';

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_ANON_KEY) {
  console.warn(
    '[supabaseClient] VITE_SUPABASE_ANON_KEY is not set. ' +
    'Authentication will not work until this env var is configured.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
