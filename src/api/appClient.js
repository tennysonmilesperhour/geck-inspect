/**
 * The app-wide data facade: `api.auth`, `api.entities`, `api.functions`.
 *
 * Everything here runs on Supabase. The facade exists because most
 * pages want one import for "current user" plus "entity CRUD" rather
 * than wiring `supabase.auth` and the entity clients separately, and
 * because guest mode needs a single place to intercept reads and
 * writes.
 *
 *   api.auth.me()                     -> current user, or throws
 *   api.entities.Gecko.filter({...})  -> entity CRUD (see supabaseEntities.js)
 *   api.functions.invoke(name, body)  -> Supabase edge functions
 *
 * For third-party integrations (LLM calls, file uploads) import from
 * '@/integrations/Core' instead.
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

export const api = {
  auth: authFacade,
  entities: entitiesFacade,
  functions: functionsFacade,
};
