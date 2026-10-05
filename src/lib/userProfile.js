import { supabase, normalizeSupabaseUser } from '@/lib/supabaseClient';
import { mirroredMembershipTier } from '@/lib/nativeMembership';
import { readCachedProfile, saveCachedProfile, isOffline, readStoredSession } from '@/lib/offlineSession';
import { isNetworkError } from '@/lib/offlineQueue';

/**
 * The signed-in auth user. getUser() asks the server, which fails with no
 * signal; in that case the session stored in this browser is used, so an
 * offline member stays signed in instead of landing on the sign-in page.
 * A missing session still means signed out.
 */
export async function currentAuthUser() {
  let result;
  try {
    result = await supabase.auth.getUser();
  } catch (error) {
    if (!isOffline() && !isNetworkError(error)) throw error;
    result = { data: { user: null }, error };
  }
  const user = result?.data?.user;
  if (user) return user;
  if (isOffline() || isNetworkError(result?.error)) {
    return readStoredSession(supabase.auth.storageKey)?.user || null;
  }
  return null;
}

/**
 * Canonical signed-in user shape for AuthContext, User.me and api.auth.me.
 * Legacy tables need profiles.id; billing and UUID RLS need auth_user_id.
 * Privileges come from protected database rows, never editable auth metadata.
 *
 * The result is also kept in this browser so the app still knows the
 * member's profile id and plan when it opens without signal. A read that
 * fails falls back to that copy (see src/lib/offlineSession.js).
 */
/** The best active complimentary plan from membership_comps rows. */
export function activeComp(rows, now = Date.now()) {
  const rank = { keeper: 1, breeder: 2 };
  return (rows || [])
    .filter((r) => rank[r?.tier] && Date.parse(r.ends_at) > now && (!r.starts_at || Date.parse(r.starts_at) <= now))
    .sort((a, b) => rank[b.tier] - rank[a.tier] || Date.parse(b.ends_at) - Date.parse(a.ends_at))[0] || null;
}

export async function loadUserProfile(authUser) {
  const basic = normalizeSupabaseUser(authUser);
  if (!basic) return null;
  const [profileResult, storeResult, compResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('email', authUser.email).maybeSingle(),
    supabase.from('revenuecat_entitlements').select('entitlement_identifier, is_active, expires_at').eq('app_user_id', authUser.id),
    // Complimentary plans (membership_comps). Read-only for members; a
    // failed read just means no comp, it never blocks sign-in. Admins can
    // read every row, so filter to this email; activeComp() picks the live one.
    Promise.resolve()
      .then(() => supabase.from('membership_comps').select('tier, starts_at, ends_at').eq('email', authUser.email.toLowerCase()))
      .catch(error => ({ data: null, error })),
  ]).catch(error => {
    console.warn('User enrichment failed:', error.message);
    return [{ data: null, error }, { data: null, error }, { data: null, error }];
  });
  if (profileResult.error || storeResult.error) {
    console.warn('User enrichment incomplete:', profileResult.error?.message || storeResult.error?.message);
    const cached = readCachedProfile(authUser.id);
    if (cached && !profileResult.data) {
      return { ...basic, ...cached, auth_user_id: authUser.id, email: authUser.email };
    }
  }
  const tier = mirroredMembershipTier(storeResult.data || []);
  const comp = activeComp(compResult?.error ? [] : compResult?.data || []);
  const enriched = { ...basic, ...profileResult.data, auth_user_id: authUser.id, email: authUser.email,
    revenuecat_tier: tier, revenuecat_pro_active: tier === 'breeder',
    comp_tier: comp?.tier || null, comp_ends_at: comp?.ends_at || null };
  if (profileResult.data && !storeResult.error) saveCachedProfile(authUser.id, enriched);
  return enriched;
}
