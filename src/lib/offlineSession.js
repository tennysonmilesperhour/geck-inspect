/**
 * Signing in without signal.
 *
 * Supabase keeps the member's session in localStorage. Online, the app
 * checks it with the server. Offline that check fails, and before this
 * module the app treated "could not check" as "signed out" and sent the
 * member to the sign-in page, so nothing worked without signal.
 *
 * These helpers let the app keep using the stored session while the phone
 * is offline. They never invent a session: if nothing is stored, the
 * member is signed out. When the connection returns, Supabase checks the
 * session again as usual, and a session that was revoked signs out then.
 *
 * The last loaded profile (plan, display name, profile id) is kept too, so
 * pages that need more than the login still work offline.
 */

const PROFILE_KEY_PREFIX = 'geckinspect_offline_profile:';

let storage = typeof localStorage !== 'undefined' ? localStorage : null;

/** Tests swap in a fake storage. */
export function __setSessionStorage(next) {
  storage = next;
}

export function isOffline(nav = typeof navigator !== 'undefined' ? navigator : null) {
  return Boolean(nav && nav.onLine === false);
}

/**
 * The session Supabase stored in this browser, or null. `storageKey` is
 * supabase.auth.storageKey when known; otherwise any sb-*-auth-token entry
 * is used.
 */
export function readStoredSession(storageKey) {
  if (!storage) return null;
  try {
    let raw = storageKey ? storage.getItem(storageKey) : null;
    if (!raw) {
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && /^sb-.+-auth-token$/.test(k)) {
          raw = storage.getItem(k);
          break;
        }
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Older SDKs wrapped it as { currentSession }.
    const session = parsed?.currentSession || parsed;
    return session?.user?.id ? session : null;
  } catch {
    return null;
  }
}

export function saveCachedProfile(authUserId, profile) {
  if (!storage || !authUserId || !profile) return;
  try {
    storage.setItem(PROFILE_KEY_PREFIX + authUserId, JSON.stringify(profile));
  } catch {
    // storage full or blocked: the app still works online
  }
}

export function readCachedProfile(authUserId) {
  if (!storage || !authUserId) return null;
  try {
    const parsed = JSON.parse(storage.getItem(PROFILE_KEY_PREFIX + authUserId) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function clearCachedProfiles() {
  if (!storage) return;
  try {
    const keys = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(PROFILE_KEY_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => storage.removeItem(k));
  } catch {
    // nothing to clear
  }
}
