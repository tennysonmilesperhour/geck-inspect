/**
 * Weekly Gecko Notes for members in the EEA and the UK (decision of 18 Oct
 * 2026, docs/planning/weekly-notes-2026-10.md section 1).
 *
 * Why: there, a marketing email needs the member's consent, so the notes
 * are off unless the member turns them on. Everywhere else they are on
 * until the member stops them. Where a browser is comes from
 * regionNeedsConsent() (src/lib/analyticsConsent.js): Vercel's country
 * cookie or the browser's time zone.
 *
 * Two pieces live here:
 *
 * 1. The sign-up box. The form ticks it by default except in the region,
 *    and sends its value as `weekly_notes_at_signup` in the sign-up
 *    metadata. The database saves it as the member's choice when it makes
 *    the profile (handle_new_auth_user).
 *
 * 2. The region rule, after sign-in. A member who never chose (Google
 *    sign-in has no box, and members from before the box existed never
 *    saw it) gets the notes turned off when their browser is in the
 *    region. The database function weekly_notes_region_default() does the
 *    work and checks again that no choice is recorded, so this side only
 *    avoids needless calls. It also saves a sign-up box the profile missed
 *    (a profile row that existed before the account). It runs at most once
 *    per browser session and never holds anything up: every failure is
 *    silent and the next session tries again.
 */
import { regionNeedsConsent } from '@/lib/analyticsConsent';
import { getSupabase } from '@/lib/supabaseLazy';
import { isOffline } from '@/lib/offlineSession';

/** The sign-up metadata key that carries the box's value. */
export const SIGNUP_METADATA_KEY = 'weekly_notes_at_signup';

/** The profile column that says when the member last chose. */
export const CHOICE_COLUMN = 'email_weekly_notes_choice_at';

const SESSION_KEY_PREFIX = 'geckinspect.weekly-notes-region:';

// Used when sessionStorage cannot be read or written (private mode, a
// locked-down browser): still at most once per page load.
const askedInMemory = new Set();

/** Whether the sign-up box starts ticked: yes, except in the EEA and the UK. */
export function signupBoxDefault(options) {
  return !regionNeedsConsent(options);
}

/** The sign-up box's value from an auth user's metadata, or null when there is none. */
export function signupBoxFromMetadata(authUser) {
  const value = authUser?.user_metadata?.[SIGNUP_METADATA_KEY];
  return typeof value === 'boolean' ? value : null;
}

function defaultStorage() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function alreadyAsked(storage, key) {
  if (askedInMemory.has(key)) return true;
  try {
    return storage?.getItem(key) === '1';
  } catch {
    return false;
  }
}

function markAsked(storage, key) {
  askedInMemory.add(key);
  try {
    storage?.setItem(key, '1');
  } catch {
    // Remembered in memory only, for this page load.
  }
}

/**
 * Applies the region rule for the signed-in member, or saves a sign-up box
 * the profile missed. `profile` is the member's loaded profile row (as
 * loadUserProfile returns it). Resolves to what happened, for tests; it
 * never rejects.
 *
 *   'skipped'        no account, no profile row, the column is not there
 *                    yet (the site deployed before the migration), or no
 *                    signal; the next sign-in event tries again
 *   'chosen'         the member already chose; nothing to do
 *   'nothing-to-do'  outside the region, or the notes are already off
 *   'already-asked'  asked once in this browser session already
 *   'failed'         the call failed; the next session tries again
 *   otherwise        the database's answer: 'region-off', 'signup-choice',
 *                    'chosen', 'unchanged', 'no-profile' or 'not-signed-in'
 */
export async function applyWeeklyNotesRegionDefault(authUser, profile, deps = {}) {
  const {
    needsConsent = regionNeedsConsent,
    storage = defaultStorage(),
    getClient = getSupabase,
    offline = isOffline,
  } = deps;
  try {
    if (!authUser?.id || !profile || typeof profile !== 'object') return 'skipped';
    if (!Object.prototype.hasOwnProperty.call(profile, CHOICE_COLUMN)) return 'skipped';
    if (profile[CHOICE_COLUMN]) return 'chosen';

    const box = signupBoxFromMetadata(authUser);
    const region = needsConsent() === true;
    if (box === null && (!region || profile.email_weekly_notes_enabled === false)) return 'nothing-to-do';
    if (offline()) return 'skipped';

    const key = SESSION_KEY_PREFIX + authUser.id;
    if (alreadyAsked(storage, key)) return 'already-asked';
    markAsked(storage, key);

    const supabase = await getClient();
    const { data, error } = await supabase.rpc('weekly_notes_region_default', { p_consent_region: region });
    if (error) return 'failed';
    return typeof data === 'string' ? data : 'failed';
  } catch {
    return 'failed';
  }
}

/** For tests: forget the in-memory "asked" marks. */
export function __resetWeeklyNotesRegionMemory() {
  askedInMemory.clear();
}
