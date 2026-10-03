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
export async function loadUserProfile(authUser) {
  const basic = normalizeSupabaseUser(authUser);
  if (!basic) return null;
  const [profileResult, storeResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('email', authUser.email).maybeSingle(),
    supabase.from('revenuecat_entitlements').select('entitlement_identifier, is_active, expires_at').eq('app_user_id', authUser.id),
  ]).catch(error => {
    console.warn('User enrichment failed:', error.message);
    return [{ data: null, error }, { data: null, error }];
  });
  if (profileResult.error || storeResult.error) {
    console.warn('User enrichment incomplete:', profileResult.error?.message || storeResult.error?.message);
    const cached = readCachedProfile(authUser.id);
    if (cached && !profileResult.data) {
      return { ...basic, ...cached, auth_user_id: authUser.id, email: authUser.email };
    }
  }
  const tier = mirroredMembershipTier(storeResult.data || []);
  const enriched = { ...basic, ...profileResult.data, auth_user_id: authUser.id, email: authUser.email,
    revenuecat_tier: tier, revenuecat_pro_active: tier === 'breeder' };
  if (profileResult.data && !storeResult.error) saveCachedProfile(authUser.id, enriched);
  return enriched;
}
