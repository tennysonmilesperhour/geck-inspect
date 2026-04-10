import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://mmuglfphhwlaluyfyxsp.supabase.co';

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tdWdsZnBoaHdsYWx1eWZ5eHNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MjA5MTksImV4cCI6MjA5MTA5NjkxOX0.mbjrSDZoEvQwPBiZbRtzjC04viNmSJ7sABDJQK9TmIM';

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
