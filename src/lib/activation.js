// Funnel events that need a little logic before they fire: the
// first-party signup, the first gecko on every add path, and the
// husbandry logs (weights, feedings, eggs). Everything goes through
// captureEvent, so it lands in public.user_events and in PostHog when
// PostHog is configured. See docs/planning/instrumentation-2026-10.md.
//
// All of it is best effort: a failed analytics call never blocks a save.
import { supabase } from '@/lib/supabaseClient';
import { captureEvent } from '@/lib/posthog';
import { getFirstTouch, firstTouchProperties, getSignupCta, signupCtaProperties } from '@/lib/attribution';

// An account counts as new on its first authenticated session within this
// long of being created. Email confirmation can take a while, so a day.
const NEW_ACCOUNT_WINDOW_MS = 24 * 60 * 60 * 1000;
const SIGNUP_FLAG_PREFIX = 'geck_signup_tracked:';
const FIRST_GECKO_FLAG_PREFIX = 'geck_first_gecko_tracked:';

function readFlag(key) {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key) {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, '1');
  } catch {
    // private window: the server-side checks still prevent most repeats
  }
}

/** True for an auth user created within the new-account window. */
export function isNewAccount(authUser, now = Date.now()) {
  const created = Date.parse(authUser?.created_at || '');
  if (!Number.isFinite(created)) return false;
  return now - created >= -10 * 60 * 1000 && now - created <= NEW_ACCOUNT_WINDOW_MS;
}

/**
 * Fire signup_completed once for a brand-new account, with this browser's
 * first touch, and copy the first touch onto the profile
 * (profiles.extra_data.first_touch, readable only by the member and
 * admins). Skips existing accounts, accounts already recorded in this
 * browser, and profiles that already carry a recorded signup (a second
 * device on the first day).
 */
export async function recordSignupIfNew(authUser, profile) {
  if (!authUser?.id || !isNewAccount(authUser)) return false;
  const flag = `${SIGNUP_FLAG_PREFIX}${authUser.id}`;
  if (readFlag(flag)) return false;
  const extra = profile && typeof profile.extra_data === 'object' && profile.extra_data ? profile.extra_data : null;
  if (extra?.signup_tracked_at) {
    writeFlag(flag);
    return false;
  }
  writeFlag(flag);
  const touch = getFirstTouch();
  const signupCta = getSignupCta();
  captureEvent('signup_completed', {
    method: authUser.app_metadata?.provider || 'email',
    ...firstTouchProperties(touch),
    ...signupCtaProperties(signupCta),
  });
  // Only when the profile row has loaded, so an absent row is not
  // overwritten; the event above is the record either way.
  if (profile?.id && authUser.email) {
    try {
      // Read extra_data fresh: other features keep settings there too
      // (care_reminders), and the profile snapshot may predate them.
      const { data: fresh } = await supabase.from('profiles').select('extra_data').eq('email', authUser.email).maybeSingle();
      const current = fresh && typeof fresh.extra_data === 'object' && fresh.extra_data ? fresh.extra_data : (extra || {});
      await supabase
        .from('profiles')
        .update({
          extra_data: {
            ...current,
            first_touch: touch || { source: 'unknown' },
            ...(signupCta ? { signup_cta: signupCta } : {}),
            signup_tracked_at: new Date().toISOString(),
          },
        })
        .eq('email', authUser.email);
    } catch {
      // the event is already recorded
    }
  }
  return true;
}

// Per page load: once the member is known to have geckos already, stop
// asking the database on every later add.
const firstGeckoSettled = new Set();

async function currentAuthIdentity() {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user ? { id: data.user.id, email: data.user.email } : null;
  } catch {
    return null;
  }
}

/**
 * A gecko (or several) was just added. Sends gecko_added with the add
 * path, and first_gecko_added when these are the member's first geckos.
 *
 *   source: full_form | quick_add | morph_id_draft | csv_import | hatch |
 *           claim | image_import | morphmarket_sync
 *   options.skipGeckoAdded: the caller already sends its own gecko_added
 */
export async function recordGeckoAdded(source, count = 1, options = {}) {
  const added = Math.max(1, Number(count) || 1);
  if (!options.skipGeckoAdded) captureEvent('gecko_added', { source, count: added });
  const who = await currentAuthIdentity();
  if (!who?.email) return false;
  const flag = `${FIRST_GECKO_FLAG_PREFIX}${who.id}`;
  if (firstGeckoSettled.has(who.id) || readFlag(flag)) return false;
  try {
    const { count: total, error } = await supabase
      .from('geckos')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', who.email);
    // Zero means the new row is not readable yet; try again next add.
    if (error || typeof total !== 'number' || total === 0) return false;
    firstGeckoSettled.add(who.id);
    writeFlag(flag);
    if (total <= added) {
      captureEvent('first_gecko_added', { source, count: added });
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

// Husbandry logs, recorded at the entity layer so every path counts
// (detail modal, Weigh-in Mode, Field Mode, Batch Husbandry, the
// assistant, offline sync, CSV import). Identical events inside two
// seconds are merged by the telemetry throttle, so a bulk import shows
// up as a handful of rows, not hundreds.
const LOG_EVENTS = {
  WeightRecord: 'weight_logged',
  FeedingRecord: 'feeding_logged',
  Egg: 'egg_logged',
};

export function noteEntityCreated(entityName) {
  const event = LOG_EVENTS[entityName];
  if (!event) return;
  let page = null;
  try {
    page = window.location.pathname.replace(/^\//, '').split('/')[0] || 'Home';
  } catch {
    // ignore
  }
  captureEvent(event, { via: page });
}

// Upgrade prompts. The clicked prompt is remembered for the tab so
// checkout_started and checkout_completed can say which paywall led there.
const LAST_PROMPT_KEY = 'geck_last_upgrade_prompt';

export function upgradePromptShown(limitType, surface = limitType) {
  captureEvent('upgrade_prompt_shown', { limit_type: limitType, surface });
}

export function upgradePromptClicked(limitType, surface = limitType) {
  captureEvent('upgrade_prompt_clicked', { limit_type: limitType, surface });
  try {
    window.sessionStorage.setItem(LAST_PROMPT_KEY, JSON.stringify({ limit_type: limitType, surface, at: Date.now() }));
  } catch {
    // ignore
  }
}

/** The upgrade prompt clicked in this tab in the last hour, if any. */
export function lastUpgradePrompt(now = Date.now()) {
  try {
    const raw = window.sessionStorage.getItem(LAST_PROMPT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || now - Number(parsed.at || 0) > 60 * 60 * 1000) return null;
    return parsed.surface || parsed.limit_type || null;
  } catch {
    return null;
  }
}
