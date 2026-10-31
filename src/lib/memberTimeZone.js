/**
 * The member's time zone, for reminders at about 7 am local time.
 *
 * profiles.time_zone holds an IANA name such as 'America/Chicago'
 * (supabase/migrations/20261031010000_reminder_time_zones.sql). The
 * scheduled reminder jobs run every hour and remind each member when it is
 * 7 am in their zone; a member with none saved gets 7 am Pacific, as
 * before.
 *
 * On each sign-in the app saves the browser's zone when the profile has
 * none yet (applyDetectedTimeZone below). It never overwrites a zone the
 * member already has: the update only matches a row whose time_zone is
 * still empty. Settings, Feeding Alerts lets the member change it.
 */
import { getSupabase } from '@/lib/supabaseLazy';

/** The zone a member with no saved zone is reminded in (reminder_default_time_zone()). */
export const DEFAULT_REMINDER_TIME_ZONE = 'America/Los_Angeles';

const COLUMN = 'time_zone';

/** An IANA zone name as the database accepts it: letters, digits, "_", "+", "-" and up to two "/". */
export function looksLikeTimeZone(value) {
  return typeof value === 'string'
    && value.length <= 64
    && /^(?:UTC|[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){1,2})$/.test(value);
}

/** The browser's time zone, or null when it cannot tell. */
export function detectTimeZone(intl = globalThis.Intl) {
  try {
    const zone = intl?.DateTimeFormat?.().resolvedOptions?.().timeZone;
    return looksLikeTimeZone(zone) ? zone : null;
  } catch {
    return null;
  }
}

/** Every zone the browser knows, for the Settings list, with `extra` added when missing. */
export function timeZoneOptions(extra = [], intl = globalThis.Intl) {
  let zones = [];
  try {
    zones = typeof intl?.supportedValuesOf === 'function' ? intl.supportedValuesOf('timeZone') : [];
  } catch {
    zones = [];
  }
  const all = new Set([...(zones || []), ...extra.filter(looksLikeTimeZone), DEFAULT_REMINDER_TIME_ZONE]);
  return [...all].sort();
}

/** "America/Los_Angeles" as "America / Los Angeles", for lists. */
export function timeZoneLabel(zone) {
  return String(zone || '').replace(/_/g, ' ').replace(/\//g, ' / ');
}

/**
 * Saves the browser's zone on the member's profile when it has none.
 * `profile` is the loaded profile row (select *). Resolves to what
 * happened, for tests; it never rejects.
 *
 *   'skipped'   no account or profile, or the column is not there yet
 *               (the site deployed before the migration)
 *   'has-zone'  the member already has a zone
 *   'unknown'   the browser cannot tell its zone
 *   'saved'     saved (the result's zone is in `zone`)
 *   'failed'    the update failed; the next sign-in tries again
 *
 * @returns {Promise<{ outcome: string, zone?: string }>}
 */
export async function applyDetectedTimeZone(authUser, profile, deps = {}) {
  const { getClient = getSupabase, detect = detectTimeZone } = deps;
  try {
    if (!authUser?.email || !profile || typeof profile !== 'object') return { outcome: 'skipped' };
    if (!Object.prototype.hasOwnProperty.call(profile, COLUMN)) return { outcome: 'skipped' };
    if (profile[COLUMN]) return { outcome: 'has-zone' };
    const zone = detect();
    if (!zone) return { outcome: 'unknown' };
    const supabase = await getClient();
    const { error } = await supabase.from('profiles')
      .update({ [COLUMN]: zone })
      .eq('email', authUser.email)
      .is(COLUMN, null);
    if (error) return { outcome: 'failed' };
    return { outcome: 'saved', zone };
  } catch {
    return { outcome: 'failed' };
  }
}

/**
 * Saves the zone the member picked in Settings. Throws the PostgREST error
 * as is: PGRST204 means the column is not there yet, and 22023 means the
 * database does not know the name.
 */
export async function saveTimeZone(email, zone, deps = {}) {
  const { getClient = getSupabase } = deps;
  if (!email) throw new Error('Sign in to change your time zone.');
  if (!looksLikeTimeZone(zone)) throw new Error('Choose a time zone from the list.');
  const supabase = await getClient();
  const { data, error } = await supabase.from('profiles')
    .update({ [COLUMN]: zone, updated_date: new Date().toISOString() })
    .eq('email', email)
    .select('email');
  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) throw new Error('Your profile was not found. Reload the page and try again.');
  return zone;
}
