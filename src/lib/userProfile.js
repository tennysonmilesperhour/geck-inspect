import { supabase, normalizeSupabaseUser } from '@/lib/supabaseClient';
import { mirroredMembershipTier } from '@/lib/nativeMembership';

/**
 * Canonical signed-in user shape for AuthContext, User.me and api.auth.me.
 * Legacy tables need profiles.id; billing and UUID RLS need auth_user_id.
 * Privileges come from protected database rows, never editable auth metadata.
 */
export async function loadUserProfile(authUser) {
  const basic = normalizeSupabaseUser(authUser);
  if (!basic) return null;
  const [profileResult, storeResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('email', authUser.email).maybeSingle(),
    supabase.from('revenuecat_entitlements').select('entitlement_identifier, is_active, expires_at').eq('app_user_id', authUser.id),
  ]).catch(error => {
    console.warn('User enrichment failed:', error.message);
    return [{ data: null }, { data: null }];
  });
  if (profileResult.error || storeResult.error) console.warn('User enrichment incomplete:', profileResult.error?.message || storeResult.error?.message);
  const tier = mirroredMembershipTier(storeResult.data || []);
  return { ...basic, ...profileResult.data, auth_user_id: authUser.id, email: authUser.email,
    revenuecat_tier: tier, revenuecat_pro_active: tier === 'breeder' };
}
