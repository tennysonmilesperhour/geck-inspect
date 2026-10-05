// The guided first gecko (activation pass, 5 Oct 2026). Three short,
// skippable steps on an empty collection: add the gecko (by photo through
// Morph ID's free try, or by name and morph), add its parents if known,
// then a payoff screen with its family card, what it needs next and its
// value estimate. See docs/planning/activation-2026-10.md.
//
// This file holds the parts with no React in them: the draft a guest
// carries through sign-up, the care schedule shown on the payoff screen,
// and the one funnel event the flow sends.
import { captureEvent } from '@/lib/posthog';

// A gecko typed into Quick Add in the guest demo. It lives in localStorage
// (not sessionStorage) because sign-up often means confirming an email in
// a new tab; it is saved into the collection once the account exists.
export const PENDING_GECKO_KEY = 'geck_pending_first_gecko_v1';
const PENDING_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

// Fields a guest draft may carry. Anything else is dropped, so a stale or
// tampered draft can never send an unexpected column to save_gecko_record.
const DRAFT_FIELDS = ['name', 'sex', 'hatch_date', 'morphs_traits', 'weight_grams'];

export function cleanDraft(draft) {
  if (!draft || typeof draft !== 'object') return null;
  const out = {};
  for (const key of DRAFT_FIELDS) {
    if (draft[key] === undefined || draft[key] === '') continue;
    out[key] = draft[key];
  }
  out.name = typeof out.name === 'string' ? out.name.trim().slice(0, 80) : '';
  if (!out.name) return null;
  if (!['Male', 'Female', 'Unsexed'].includes(out.sex)) out.sex = 'Unsexed';
  if (typeof out.morphs_traits === 'string') out.morphs_traits = out.morphs_traits.trim().slice(0, 200);
  const grams = Number(out.weight_grams);
  out.weight_grams = out.weight_grams == null || !Number.isFinite(grams) || grams < 0 ? null : grams;
  if (out.hatch_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(out.hatch_date))) out.hatch_date = null;
  return out;
}

export function savePendingGecko(draft, now = Date.now()) {
  const clean = cleanDraft(draft);
  if (!clean) return false;
  try {
    localStorage.setItem(PENDING_GECKO_KEY, JSON.stringify({ saved_at: now, draft: clean }));
    return true;
  } catch {
    return false;
  }
}

/** The guest's unsaved gecko, or null (also null once it is two weeks old). */
export function readPendingGecko(now = Date.now()) {
  try {
    const raw = localStorage.getItem(PENDING_GECKO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || now - Number(parsed.saved_at || 0) > PENDING_MAX_AGE_MS) {
      localStorage.removeItem(PENDING_GECKO_KEY);
      return null;
    }
    return cleanDraft(parsed.draft);
  } catch {
    return null;
  }
}

export function clearPendingGecko() {
  try {
    localStorage.removeItem(PENDING_GECKO_KEY);
  } catch {
    // storage blocked
  }
}

// Crested geckos on CGD are usually fed every 2 to 3 days.
export const DEFAULT_FEEDING_INTERVAL_DAYS = 3;

/**
 * How often to weigh this gecko. Growing crested geckos are weighed every
 * two weeks (they can double in weight in a couple of months); adults,
 * past about 18 months, once a month is plenty. Unknown age counts as
 * growing, since most first geckos are bought as juveniles.
 */
export function weighInIntervalDays(gecko, now = new Date()) {
  const hatched = Date.parse(gecko?.hatch_date || '');
  if (Number.isFinite(hatched)) {
    const months = (now.getTime() - hatched) / (30.44 * 24 * 60 * 60 * 1000);
    if (months >= 18) return 30;
  }
  return 14;
}

const pad = (n) => String(n).padStart(2, '0');
export function addDaysISO(isoDate, days) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  date.setDate(date.getDate() + Number(days || 0));
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "Tuesday 19 Oct" style label for a YYYY-MM-DD date. */
export function friendlyDay(isoDate) {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  if (!y) return '';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

/**
 * What the new gecko needs next, from the same rules the reminder jobs
 * use: a weigh-in every 14 or 30 days from the last one (or from today
 * when it has none), and feeding every N days from the group's last
 * feeding. Returns { weighIn: { dueDate, everyDays, hasWeight },
 * feeding: { nextDate, everyDays } | null }.
 */
export function careSchedule({ gecko, lastWeighDate = null, group = null, today }) {
  const everyDays = weighInIntervalDays(gecko);
  const weighIn = {
    hasWeight: Boolean(lastWeighDate),
    everyDays,
    // No weight yet: the first weigh-in is due today.
    dueDate: lastWeighDate ? addDaysISO(lastWeighDate, everyDays) : today,
  };
  let feeding = null;
  if (group) {
    const interval = Math.max(1, Number(group.interval_days) || DEFAULT_FEEDING_INTERVAL_DAYS);
    feeding = {
      everyDays: interval,
      nextDate: group.last_fed_date ? addDaysISO(group.last_fed_date, interval) : today,
      diet: group.diet_type || 'CGD',
    };
  }
  return { weighIn, feeding };
}

/**
 * One event for the whole flow, so a single PostHog funnel (or one query
 * on public.user_events) shows where people drop:
 *   step: add | parents | payoff
 *   action: shown, choose_photo, choose_type, saved, skipped, done,
 *           reminder_on, reminder_off, weight_logged, open_record,
 *           add_another, open_lineage
 */
export function flowEvent(step, action, props = {}) {
  captureEvent('first_gecko_flow', { step, action, ...props });
}

// Set when the member picks "add by photo", so the Morph ID page can say
// which step they are on and offer the way back to typing it in.
const PHOTO_PATH_KEY = 'geck_first_gecko_photo_path';
export function markPhotoPath(on = true) {
  try {
    if (on) sessionStorage.setItem(PHOTO_PATH_KEY, '1');
    else sessionStorage.removeItem(PHOTO_PATH_KEY);
  } catch {
    // ignore
  }
}
export function onPhotoPath() {
  try {
    return sessionStorage.getItem(PHOTO_PATH_KEY) === '1';
  } catch {
    return false;
  }
}
