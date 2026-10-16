/**
 * Converts a Supabase user object into the flat shape the rest of the
 * app expects (email, full_name, membership_tier, etc.).
 *
 * Kept apart from supabaseClient.js so the sign-in state can use it
 * without downloading the Supabase library (src/lib/supabaseLazy.js).
 * supabaseClient.js re-exports it for existing callers.
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
