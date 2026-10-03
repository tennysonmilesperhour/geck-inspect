// First-run onboarding state (audit step 32).
//
// The keeper-or-breeder question and Keeper mode used to live only in
// localStorage, so every new phone or browser asked again. They now live
// on the profile (onboarding_role, onboarding_completed_at, keeper_mode)
// with localStorage kept as a fast first-render cache and as the fallback
// for accounts that answered before the columns existed.
//
// The question also waits while something more important is on screen:
// the add-a-gecko form, a collection invite or a transfer claim. Before,
// "Make it yours" from the demo opened the role question on top of the
// add form.

import { KEEPER_MODE_STORAGE_KEY } from '@/lib/navItems';

export const TUTORIAL_SEEN_KEY = 'geck_inspect_tutorial_seen';
export const ROLE_CHOSEN_KEY = 'geck_inspect_role_chosen';
const POST_AUTH_REDIRECT_KEY = 'geck_inspect_post_auth_redirect';

function readLocal(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeLocal(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
}

/** What onboarding has already happened for this member, on any device. */
export function readOnboarding(user) {
  const profileSeen = Boolean(user?.onboarding_completed_at);
  const profileRole = user?.onboarding_role || null;
  return {
    seen: profileSeen || readLocal(TUTORIAL_SEEN_KEY) === '1',
    roleChosen: Boolean(profileRole && profileRole !== 'everything') || readLocal(ROLE_CHOSEN_KEY) === '1',
    keeperMode: typeof user?.keeper_mode === 'boolean'
      ? user.keeper_mode
      : readLocal(KEEPER_MODE_STORAGE_KEY) === '1',
    keeperModeFromProfile: typeof user?.keeper_mode === 'boolean',
  };
}

/**
 * Copy the profile's answers into this browser so the first render on the
 * next visit is already right. Returns true when Keeper mode changed.
 */
export function syncOnboardingToBrowser(user) {
  if (!user) return false;
  if (user.onboarding_completed_at) writeLocal(TUTORIAL_SEEN_KEY, '1');
  if (user.onboarding_role && user.onboarding_role !== 'everything') writeLocal(ROLE_CHOSEN_KEY, '1');
  if (typeof user.keeper_mode === 'boolean') {
    const next = user.keeper_mode ? '1' : '0';
    if (readLocal(KEEPER_MODE_STORAGE_KEY) !== next) {
      writeLocal(KEEPER_MODE_STORAGE_KEY, next);
      return true;
    }
  }
  return false;
}

/**
 * Members who answered before the profile columns existed have the answer
 * only in this browser. Returns the patch that copies it up to the
 * profile, or null when there is nothing to copy.
 */
export function browserAnswersToUpload(user) {
  if (!user || user.onboarding_completed_at) return null;
  if (readLocal(TUTORIAL_SEEN_KEY) !== '1') return null;
  const patch = { completed: true };
  const keeper = readLocal(KEEPER_MODE_STORAGE_KEY);
  if (typeof user.keeper_mode !== 'boolean' && (keeper === '1' || keeper === '0')) {
    patch.keeperMode = keeper === '1';
  }
  return patch;
}

/**
 * Save onboarding answers to the browser and, when signed in, the profile.
 * `patch` may hold { role, completed, keeperMode }. Never throws: the
 * browser copy still works if the profile write fails.
 */
export async function saveOnboarding(supabase, email, patch = {}) {
  const row = {};
  if (patch.completed) {
    writeLocal(TUTORIAL_SEEN_KEY, '1');
    row.onboarding_completed_at = new Date().toISOString();
  }
  if (patch.role) {
    if (patch.role !== 'everything') writeLocal(ROLE_CHOSEN_KEY, '1');
    row.onboarding_role = patch.role;
  }
  if (typeof patch.keeperMode === 'boolean') {
    writeLocal(KEEPER_MODE_STORAGE_KEY, patch.keeperMode ? '1' : '0');
    row.keeper_mode = patch.keeperMode;
  }
  if (!email || !supabase || Object.keys(row).length === 0) return false;
  try {
    const { error } = await supabase.from('profiles').update(row).eq('email', email);
    return !error;
  } catch {
    return false;
  }
}

/* ─── Holding the question while something else is on screen ───── */

const holds = new Set();
export const ONBOARDING_HOLD_EVENT = 'onboarding_hold_changed';

function announce() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ONBOARDING_HOLD_EVENT));
}

/** Keep the first-run question closed until `releaseOnboarding(reason)`. */
export function holdOnboarding(reason) {
  if (holds.has(reason)) return;
  holds.add(reason);
  announce();
}

export function releaseOnboarding(reason) {
  if (!holds.delete(reason)) return;
  announce();
}

const WAIT_PATHS = [/^\/collection-invite\//i, /^\/claim\//i, /^\/AuthPortal/i];

/**
 * True while the question should wait: an add form is open, the member is
 * on an invite or claim page, the URL asks for the add form, or a claim or
 * invite link is waiting to open after sign-in.
 */
export function onboardingShouldWait(location = {}) {
  if (holds.size > 0) return true;
  const path = location.pathname || '';
  if (WAIT_PATHS.some((re) => re.test(path))) return true;
  if (new URLSearchParams(location.search || '').get('add') === '1') return true;
  return hasFreshPostAuthRedirect();
}

// A saved claim or invite link waiting to open (postAuthRedirect.js keeps
// it for a day). An old or broken entry never blocks onboarding.
function hasFreshPostAuthRedirect(now = Date.now()) {
  const raw = readLocal(POST_AUTH_REDIRECT_KEY);
  if (!raw) return false;
  try {
    const { at } = JSON.parse(raw);
    return Boolean(at) && now - at < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/** For tests. */
export function _resetOnboardingHolds() {
  holds.clear();
}
