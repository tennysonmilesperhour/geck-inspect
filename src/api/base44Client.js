import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { supabase, normalizeSupabaseUser } from '@/lib/supabaseClient';
import * as sbEntities from '@/api/supabaseEntities';
import { isGuestMode, GUEST_USER, blockIfGuest } from '@/lib/guestMode';

const { appId, serverUrl, token, functionsVersion } = appParams;

const BASE44_SERVER = 'https://base44.app';
const RESOLVED_APP_ID = appId || '68929cdad944c572926ab6cb';

const appBaseUrl = import.meta.env.VITE_BASE44_APP_BASE_URL
  || serverUrl
  || BASE44_SERVER;

const resolvedServerUrl = serverUrl || BASE44_SERVER;

export const base44 = createClient({
  appId: RESOLVED_APP_ID,
  serverUrl: resolvedServerUrl,
  token,
  functionsVersion,
  appBaseUrl,
  requiresAuth: false
});

// Keep a reference to the REAL Base44 entities before we proxy them below.
// This is used by the AdminMigration page to read data directly from Base44
// (all other code should use base44.entities which now points to Supabase).
export const base44RawEntities = base44.entities;

// Override base44.auth so every page that calls base44.auth.me() / logout()
// uses Supabase instead of Base44's dead auth servers.
base44.auth = new Proxy(base44.auth, {
  get(target, prop) {
    if (prop === 'me') {
      return async () => {
        // Guest mode has no real Supabase user; return the synthetic
        // guest profile so pages that assume base44.auth.me() always
        // resolves don't crash their first load.
        if (isGuestMode()) return { ...GUEST_USER };
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        return normalizeSupabaseUser(user);
      };
    }
    if (prop === 'logout') {
      return async () => supabase.auth.signOut();
    }
    if (prop === 'loginWithRedirect' || prop === 'redirectToLogin') {
      return () => { window.location.href = '/AuthPortal'; };
    }
    if (prop === 'updateMe') {
      return async (data) => {
        blockIfGuest('update your profile');
        const { data: { user }, error } = await supabase.auth.updateUser({ data });
        if (error) throw error;
        return normalizeSupabaseUser(user);
      };
    }
    return target[prop];
  }
});

// Redirect all base44.entities.* calls to Supabase so every page that
// calls base44.entities.Gecko.filter() / .list() / etc. uses Supabase.
base44.entities = new Proxy(base44.entities || {}, {
  get(target, entityName) {
    if (typeof entityName !== 'string') return target[entityName];
    // Named exports in sbEntities match entity names exactly (e.g. sbEntities.Gecko)
    // UserEntity covers the User entity
    const sbEntity = entityName === 'User' ? sbEntities.UserEntity : sbEntities[entityName];
    return sbEntity || target[entityName];
  }
});

export function redirectToLogin() {
  window.location.href = '/AuthPortal';
}
