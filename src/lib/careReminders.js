// Personal weigh-in reminders (activation pass, 5 Oct 2026).
//
// The old weigh-in job only nudges a member about geckos that were
// weighed once and then not for 30 days, as one weekly line. A new member
// whose first gecko has no weight, or was weighed today, hears nothing
// for a month, which is exactly when they stop coming back. This sets a
// reminder per gecko from the day it is added: every 14 days for a
// growing gecko, every 30 for an adult.
//
// Where it is stored: profiles.extra_data.care_reminders, an existing
// jsonb column only the member and admins can read or write, so the app
// works today with no database change:
//
//   care_reminders: {
//     weigh_in: {
//       enabled: true,                      // member-wide switch (Settings)
//       geckos: { "<gecko id>": { on: true, every_days: 14, since: "2026-10-05" } }
//     }
//   }
//
// The daily job that reads it is in
// supabase/migrations/20261008081343_personal_weighin_reminders.sql,
// changed by 20261015151100_reminders_and_offline_logging.sql.
//
// From the October 2026 release (review item E2 15) reminders follow the
// animal:
//   * A gecko added on or after the day the defaults start (see
//     loadCareDefaultsFrom below) with no stored choice gets a weigh-in
//     reminder anyway, every 14, 21 or 30 days by its life stage
//     (src/lib/lifeStage.js). A stored every_days is only used when
//     the member picked it ("fixed": true); otherwise the cadence moves
//     with the gecko as it grows.
//   * The same new gecko, when it is in no feeding group, gets a feeding
//     reminder every 3 days, stored (when the member changes it) as
//       care_reminders.feeding.geckos["<gecko id>"] = { on, every_days }
//   * "on": false on either one switches it off for that gecko.
import { supabase } from '@/lib/supabaseClient';
import { weighInIntervalDays } from '@/lib/lifeStage';

// The day the defaults start is stored once, when the release's migration
// runs, in the public app_settings row 'care_reminder_defaults_from': 16
// Oct 2026 or the day the migration ran, whichever is later. The reminder
// jobs read it through public.care_reminder_defaults_from(), and the app
// reads the same row (loadCareDefaultsFrom below), so the gecko record's
// switches and the server agree on which geckos get default reminders.
//
// CARE_DEFAULTS_FROM is only the fallback, for when the row is missing
// (the migration has not run yet), cannot be read, or is not a real day.
// It is the same day as the SQL fallback,
// public.care_reminder_defaults_fallback(); a test checks they match.
export const CARE_DEFAULTS_FROM = '2026-10-16';

/** True for a real calendar day written YYYY-MM-DD (the SQL's check). */
export function isCareDefaultsDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime())
    && parsed.getUTCFullYear() >= 1
    && parsed.toISOString().slice(0, 10) === value;
}

const defaultsDay = (value) => (isCareDefaultsDay(value) ? value : CARE_DEFAULTS_FROM);

// Feeding every 3 days on crested gecko diet, the activation default.
export const DEFAULT_GECKO_FEEDING_DAYS = 3;

const asObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

export function weighInSection(extra) {
  const care = asObject(asObject(extra).care_reminders);
  return asObject(care.weigh_in);
}

/** Member-wide switch. On unless the member turned it off. */
export function memberWeighInEnabled(extra) {
  return weighInSection(extra).enabled !== false;
}

/** This gecko's reminder, or null when none was set up. */
export function geckoWeighInSetting(extra, geckoId) {
  const entry = asObject(weighInSection(extra).geckos)[geckoId];
  return entry && typeof entry === 'object' ? entry : null;
}

function withWeighIn(extra, patch) {
  const base = asObject(extra);
  const care = asObject(base.care_reminders);
  const weighIn = weighInSection(base);
  return { ...base, care_reminders: { ...care, weigh_in: { ...weighIn, ...patch } } };
}

/**
 * extra_data with this gecko's reminder set (pure). `fixed` marks a
 * cadence the member chose; without it the reminder job follows the
 * gecko's life stage and every_days is only a note of what was shown.
 */
export function withGeckoWeighIn(extra, geckoId, { on = true, everyDays = 14, since, fixed = false } = {}) {
  const geckos = { ...asObject(weighInSection(extra).geckos) };
  geckos[geckoId] = {
    on: Boolean(on),
    every_days: Math.max(7, Math.min(90, Number(everyDays) || 14)),
    ...(since ? { since } : {}),
    ...(fixed ? { fixed: true } : {}),
  };
  return withWeighIn(extra, { geckos });
}

/**
 * True when a gecko was added on or after the day the defaults start.
 * `defaultsFrom` is that day (from loadCareDefaultsFrom); without one, or
 * with one that is not a real day, CARE_DEFAULTS_FROM is used.
 */
export function coveredByDefaults(gecko, defaultsFrom = CARE_DEFAULTS_FROM) {
  const created = String(gecko?.created_date || gecko?.created_at || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(created) && created >= defaultsDay(defaultsFrom);
}

/**
 * The weigh-in reminder that applies to this gecko, the way the daily job
 * sees it: { on, everyDays, fixed, source } where source is 'chosen'
 * (the member set it), 'default' (new gecko, no choice made) or 'none'.
 * `weightGrams` is the latest weigh-in when the caller knows it, and
 * `defaultsFrom` the day the defaults start (loadCareDefaultsFrom).
 */
export function effectiveWeighIn(extra, gecko, { weightGrams, now = new Date(), defaultsFrom } = {}) {
  const stageDays = weighInIntervalDays(gecko, now, weightGrams !== undefined ? { weightGrams } : {});
  const memberEnabled = memberWeighInEnabled(extra);
  const entry = gecko?.id ? geckoWeighInSetting(extra, gecko.id) : null;
  if (entry) {
    const fixed = entry.fixed === true && Number.isFinite(Number(entry.every_days));
    const everyDays = fixed ? Math.max(7, Math.min(90, Math.round(Number(entry.every_days)))) : stageDays;
    return { on: entry.on === true && memberEnabled, chosenOn: entry.on === true, everyDays, fixed, source: 'chosen', memberEnabled, since: entry.since || null };
  }
  const isDefault = coveredByDefaults(gecko, defaultsFrom);
  return { on: isDefault && memberEnabled, chosenOn: isDefault, everyDays: stageDays, fixed: false, source: isDefault ? 'default' : 'none', memberEnabled, since: null };
}

/**
 * { [geckoId]: { on, every_days, since } } for every gecko with a weigh-in
 * reminder, defaults included (the shape nativeCareSchedule.js reads).
 */
export function effectiveWeighInMap(extra, geckos = [], { defaultsFrom } = {}) {
  const out = {};
  for (const gecko of geckos || []) {
    if (!gecko?.id || gecko.archived) continue;
    const eff = effectiveWeighIn(extra, gecko, { defaultsFrom });
    if (!eff.on) continue;
    const since = eff.since || String(gecko.created_date || '').slice(0, 10) || null;
    out[gecko.id] = { on: true, every_days: eff.everyDays, ...(since ? { since } : {}) };
  }
  return out;
}

// ---- Feeding, for a gecko in no feeding group ----

export function feedingSection(extra) {
  const care = asObject(asObject(extra).care_reminders);
  return asObject(care.feeding);
}

export function geckoFeedingSetting(extra, geckoId) {
  const entry = asObject(feedingSection(extra).geckos)[geckoId];
  return entry && typeof entry === 'object' ? entry : null;
}

/** extra_data with this gecko's own feeding reminder set (pure). */
export function withGeckoFeeding(extra, geckoId, { on = true, everyDays } = {}) {
  const base = asObject(extra);
  const care = asObject(base.care_reminders);
  const feeding = feedingSection(base);
  const geckos = { ...asObject(feeding.geckos) };
  const days = Number(everyDays);
  geckos[geckoId] = {
    on: Boolean(on),
    ...(Number.isFinite(days) && days > 0 ? { every_days: Math.max(1, Math.min(30, Math.round(days))) } : {}),
  };
  return { ...base, care_reminders: { ...care, feeding: { ...feeding, geckos } } };
}

/**
 * The feeding reminder for a gecko on its own (not in a feeding group):
 * { on, everyDays, source } as the daily job sees it. Geckos in a group
 * follow the group's schedule instead (source 'group'). `defaultsFrom`
 * is the day the defaults start (loadCareDefaultsFrom).
 */
export function effectiveGeckoFeeding(extra, gecko, { defaultsFrom } = {}) {
  if (gecko?.feeding_group_id) return { on: false, everyDays: null, source: 'group' };
  const entry = gecko?.id ? geckoFeedingSetting(extra, gecko.id) : null;
  const days = Number(entry?.every_days);
  const everyDays = Number.isFinite(days) && days > 0 ? Math.max(1, Math.min(30, Math.round(days))) : DEFAULT_GECKO_FEEDING_DAYS;
  if (entry && entry.on === false) return { on: false, everyDays, source: 'chosen' };
  if (entry && entry.on === true) return { on: true, everyDays, source: 'chosen' };
  const isDefault = coveredByDefaults(gecko, defaultsFrom);
  return { on: isDefault, everyDays, source: isDefault ? 'default' : 'none' };
}

/** extra_data with the member-wide switch set (pure). */
export function withMemberWeighIn(extra, enabled) {
  return withWeighIn(extra, { enabled: Boolean(enabled) });
}

async function readExtra(email) {
  const { data, error } = await supabase.from('profiles').select('extra_data').eq('email', email).maybeSingle();
  if (error) throw error;
  return asObject(data?.extra_data);
}

async function writeExtra(email, extra) {
  const { error } = await supabase.from('profiles').update({ extra_data: extra }).eq('email', email);
  if (error) throw error;
  return extra;
}

/** { memberEnabled, gecko, extra } for the screens that show the switch. */
export async function loadWeighInReminder(email, geckoId) {
  const extra = await readExtra(email);
  return { memberEnabled: memberWeighInEnabled(extra), gecko: geckoWeighInSetting(extra, geckoId), extra };
}

/** The member's stored reminder settings (profiles.extra_data). */
export async function loadCareReminderSettings(email) {
  if (!email) return {};
  return readExtra(email);
}

// The day is written once and never changes, so a good read is kept for
// the rest of the page load. A missing row is not kept: the migration
// that writes it may run after this copy of the app has loaded.
let storedDefaultsFrom = null;

/**
 * The day the life-stage defaults start (YYYY-MM-DD), read from the
 * public app_settings row the reminder jobs use. Falls back to
 * CARE_DEFAULTS_FROM when the row is missing, cannot be read, or does not
 * hold a real day, the same rule as public.care_reminder_defaults_from().
 * Never throws. `refresh` reads the row again.
 */
export async function loadCareDefaultsFrom({ refresh = false } = {}) {
  if (storedDefaultsFrom && !refresh) return storedDefaultsFrom;
  storedDefaultsFrom = null;
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'care_reminder_defaults_from')
      .maybeSingle();
    if (!error && isCareDefaultsDay(data?.value)) {
      storedDefaultsFrom = data.value;
      return storedDefaultsFrom;
    }
  } catch {
    // Offline or blocked: the fallback below.
  }
  return CARE_DEFAULTS_FROM;
}

/**
 * Turn one gecko's own feeding reminder on or off, or change how many
 * days apart. Reads the profile fresh first so it never overwrites
 * another change made in the meantime.
 */
export async function setGeckoFeedingReminder(email, geckoId, options) {
  if (!email || !geckoId) return null;
  const extra = await readExtra(email);
  return writeExtra(email, withGeckoFeeding(extra, geckoId, options));
}

/**
 * Turn one gecko's weigh-in reminder on or off. Reads the profile fresh
 * first so it never overwrites another change made in the meantime.
 */
export async function setGeckoWeighInReminder(email, geckoId, options) {
  if (!email || !geckoId) return null;
  const extra = await readExtra(email);
  return writeExtra(email, withGeckoWeighIn(extra, geckoId, options));
}

/**
 * The default after a gecko is added: on, unless the member turned weigh-in
 * reminders off in Settings or already chose for this gecko. Returns the
 * setting that applies.
 */
export async function ensureDefaultWeighInReminder(email, geckoId, { everyDays, since } = {}) {
  if (!email || !geckoId) return null;
  const extra = await readExtra(email);
  const existing = geckoWeighInSetting(extra, geckoId);
  if (existing) return { ...existing, memberEnabled: memberWeighInEnabled(extra) };
  if (!memberWeighInEnabled(extra)) return { on: false, memberEnabled: false };
  await writeExtra(email, withGeckoWeighIn(extra, geckoId, { on: true, everyDays, since }));
  return { on: true, every_days: everyDays, since, memberEnabled: true };
}

export async function loadMemberWeighInEnabled(email) {
  if (!email) return true;
  return memberWeighInEnabled(await readExtra(email));
}

export async function setMemberWeighInReminders(email, enabled) {
  if (!email) return null;
  const extra = await readExtra(email);
  return writeExtra(email, withMemberWeighIn(extra, enabled));
}
