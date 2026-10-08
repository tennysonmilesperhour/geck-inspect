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
// supabase/migrations/20261008081343_personal_weighin_reminders.sql.
import { supabase } from '@/lib/supabaseClient';

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

/** extra_data with this gecko's reminder set (pure). */
export function withGeckoWeighIn(extra, geckoId, { on = true, everyDays = 14, since } = {}) {
  const geckos = { ...asObject(weighInSection(extra).geckos) };
  geckos[geckoId] = { on: Boolean(on), every_days: Math.max(7, Math.min(90, Number(everyDays) || 14)), ...(since ? { since } : {}) };
  return withWeighIn(extra, { geckos });
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

/** { memberEnabled, gecko } for the screens that show the switch. */
export async function loadWeighInReminder(email, geckoId) {
  const extra = await readExtra(email);
  return { memberEnabled: memberWeighInEnabled(extra), gecko: geckoWeighInSetting(extra, geckoId) };
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
