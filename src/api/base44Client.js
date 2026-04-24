/**
 * Pure Supabase-backed facade for `base44.*`.
 *
 * Older code across the app still imports `{ base44 }` and calls
 * `base44.auth.me()`, `base44.entities.Gecko.filter(...)`, etc. This module
 * used to instantiate `@base44/sdk`'s `createClient(...)`, which on every
 * page load would:
 *   - start a 60s heartbeat POSTing to https://base44.app/api/.../analytics/track/batch
 *   - fire an init `me()` request to https://base44.app/api/.../entities/User/me
 *   - open a websocket to base44.app
 *   - rehydrate a `base44_access_token` from localStorage
 *
 * That meant every visit to /AuthPortal still talked to Base44's dead
 * servers even though the login form itself uses Supabase. This file
 * replaces the SDK entirely with Supabase calls, so nothing in the app
 * runtime reaches base44.app anymore.
 */
import { supabase, normalizeSupabaseUser } from '@/lib/supabaseClient';
import * as sbEntities from '@/api/supabaseEntities';
import { isGuestMode, GUEST_USER, blockIfGuest } from '@/lib/guestMode';

const authFacade = {
  async me() {
    if (isGuestMode()) return { ...GUEST_USER };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    return normalizeSupabaseUser(user);
  },
  async logout() {
    return supabase.auth.signOut();
  },
  loginWithRedirect() {
    window.location.href = '/AuthPortal';
  },
  redirectToLogin() {
    window.location.href = '/AuthPortal';
  },
  async updateMe(data) {
    blockIfGuest('update your profile');
    const { data: { user }, error } = await supabase.auth.updateUser({ data });
    if (error) throw error;
    return normalizeSupabaseUser(user);
  },
  async isAuthenticated() {
    if (isGuestMode()) return false;
    const { data: { user } } = await supabase.auth.getUser();
    return !!user;
  },
};

const entitiesFacade = new Proxy({}, {
  get(_target, entityName) {
    if (typeof entityName !== 'string') return undefined;
    if (entityName === 'User') return sbEntities.UserEntity;
    return sbEntities[entityName];
  },
});

const functionsFacade = {
  async invoke(functionName, body) {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error) throw error;
    return { data };
  },
};

const integrationsFacade = {
  Core: new Proxy({}, {
    get(_target, prop) {
      return () => {
        throw new Error(
          `base44.integrations.Core.${String(prop)}() was removed during the Supabase migration.`
        );
      };
    },
  }),
};

export const base44 = {
  auth: authFacade,
  entities: entitiesFacade,
  functions: functionsFacade,
  integrations: integrationsFacade,
};

export function redirectToLogin() {
  window.location.href = '/AuthPortal';
}
