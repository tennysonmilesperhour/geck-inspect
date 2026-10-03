/**
 * One feeding and shed log (feature-completeness audit step 13, D21).
 *
 * Every surface that logs a feeding or a shed for a crested gecko goes
 * through here: the Dashboard's Mark fed, Batch Husbandry, Field Mode,
 * the gecko record's "+ Event", Project Manager and the feeding alerts.
 * That way each one writes the same per-gecko rows:
 *
 *   feeding_records { animal_id, date, food_type, accepted, notes }
 *   shed_records    { animal_id, date, quality, notes }
 *
 * and feeding group schedules move the same way everywhere.
 *
 * Why per-gecko rows: the gecko record, its passport and the buyer packet
 * read feeding_records, and the shed forecast reads shed_records. A
 * group-level "last fed" date alone left all of those empty.
 *
 * Why groups still move: the reminder job, the Dashboard and Project
 * Manager read feeding_groups.last_fed_date. Decision D21: a group counts
 * as fed when at least one of its geckos ate. A backdated log only moves
 * the group when it is newer than the group's current last fed date, so
 * logging last Tuesday's feeding never pulls a group back in time.
 */
import { FeedingRecord, ShedRecord, FeedingGroup, Gecko } from '@/entities/all';
import { todayLocalISO } from '@/lib/dateUtils';

export const DEFAULT_FOOD_TYPE = 'CGD';

// shed_records.quality has a CHECK constraint; these are its values.
export const SHED_QUALITY_OPTIONS = [
  { value: 'complete', label: 'Clean' },
  { value: 'partial', label: 'Partial' },
  { value: 'retained_toes', label: 'Stuck on toes' },
  { value: 'retained_eye_caps', label: 'Stuck eye caps' },
  { value: 'unknown', label: 'Not noted' },
];

export function shedQualityLabel(value) {
  return SHED_QUALITY_OPTIONS.find((q) => q.value === value)?.label || 'Not noted';
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A YYYY-MM-DD string, or today when the value is missing or malformed. */
export function normalizeLogDate(date) {
  if (typeof date === 'string' && ISO_DAY.test(date)) return date;
  return todayLocalISO();
}

/** True when a log date is in the future (the date inputs cap at today). */
export function isFutureDate(date, today = todayLocalISO()) {
  return typeof date === 'string' && date > today;
}

/**
 * Which feeding groups a set of feedings moves (D21: at least one gecko in
 * the group ate). Pure, so it is unit tested.
 *
 *   entries: [{ gecko: { feeding_group_id }, accepted }]
 *   groups:  feeding_groups rows ({ id, last_fed_date })
 *   date:    the feeding date, YYYY-MM-DD
 *
 * Returns [{ id, previous, next }] for each group whose last_fed_date is
 * empty or older than `date`.
 */
export function planGroupAdvances(entries, groups, date) {
  const fedGroupIds = new Set(
    (entries || [])
      .filter((e) => e && e.accepted !== false && e.gecko?.feeding_group_id)
      .map((e) => e.gecko.feeding_group_id),
  );
  const byId = new Map((groups || []).map((g) => [g.id, g]));
  const plans = [];
  for (const id of fedGroupIds) {
    const group = byId.get(id);
    if (!group) continue;
    const previous = group.last_fed_date || null;
    if (previous && previous >= date) continue;
    plans.push({ id, previous, next: date });
  }
  return plans;
}

async function loadGroups(ids, groups) {
  const known = new Map((groups || []).map((g) => [g.id, g]));
  const missing = ids.filter((id) => !known.has(id));
  if (missing.length > 0) {
    const fetched = await Promise.all(
      missing.map((id) => FeedingGroup.filter({ id }).then((rows) => rows?.[0] || null).catch(() => null)),
    );
    fetched.filter(Boolean).forEach((g) => known.set(g.id, g));
  }
  return [...known.values()];
}

/**
 * Move each fed gecko's group schedule to `date` (see planGroupAdvances).
 * A group the logger cannot update (a collection member logging the
 * owner's gecko, for example) is skipped, not fatal: the per-gecko
 * feeding row is the record that matters.
 */
export async function advanceGroupsForFeedings(entries, { date, groups } = {}) {
  const day = normalizeLogDate(date);
  const ids = [...new Set((entries || []).map((e) => e?.gecko?.feeding_group_id).filter(Boolean))];
  if (ids.length === 0) return { advanced: [], groupErrors: [] };
  const allGroups = await loadGroups(ids, groups);
  const plans = planGroupAdvances(entries, allGroups, day);
  const advanced = [];
  const groupErrors = [];
  for (const plan of plans) {
    try {
      await FeedingGroup.update(plan.id, { last_fed_date: plan.next });
      advanced.push(plan);
    } catch (error) {
      console.warn('Feeding group schedule not moved:', error);
      groupErrors.push({ id: plan.id, error });
    }
  }
  return { advanced, groupErrors };
}

/** Put groups back where they were, for an undo. */
export async function revertGroupAdvances(advanced) {
  for (const plan of advanced || []) {
    try {
      await FeedingGroup.update(plan.id, { last_fed_date: plan.previous });
    } catch (error) {
      console.warn('Feeding group schedule not restored:', error);
    }
  }
}

/**
 * Log one feeding per gecko and move their groups.
 *
 *   entries:  [{ gecko, accepted = true, notes = null, foodType }]
 *   date:     YYYY-MM-DD, defaults to today (backdating is allowed)
 *   foodType: default food for entries without their own
 *   groups:   feeding_groups rows already in memory (optional)
 *
 * Returns { records, advanced, groupErrors }. Pass the result to
 * undoFeedings to take it all back.
 */
export async function logFeedings({ entries, date, foodType = DEFAULT_FOOD_TYPE, groups } = {}) {
  const day = normalizeLogDate(date);
  const records = [];
  for (const entry of entries || []) {
    if (!entry?.gecko?.id) continue;
    const accepted = entry.accepted !== false;
    const record = await FeedingRecord.create({
      animal_id: entry.gecko.id,
      date: day,
      food_type: entry.foodType || foodType || DEFAULT_FOOD_TYPE,
      accepted,
      notes: entry.notes ?? null,
    });
    records.push(record);
  }
  const { advanced, groupErrors } = await advanceGroupsForFeedings(entries, { date: day, groups });
  return { records, advanced, groupErrors };
}

export async function undoFeedings(result) {
  for (const record of result?.records || []) {
    if (record?.id) await FeedingRecord.delete(record.id);
  }
  await revertGroupAdvances(result?.advanced);
}

/**
 * Geckos that belong to a feeding group. Uses the in-memory list when the
 * caller has one, otherwise asks the database.
 */
export async function geckosInGroup(group, geckos) {
  if (!group?.id) return [];
  const source = Array.isArray(geckos)
    ? geckos
    : await Gecko.filter({ feeding_group_id: group.id }).catch(() => []);
  return (source || []).filter((g) => g.feeding_group_id === group.id && !g.archived);
}

/**
 * "Mark fed" for a whole group: a feeding row for every gecko in it, then
 * the group schedule. A group with no geckos still moves, so the button
 * always does what it says.
 */
export async function markGroupFed({ group, geckos, date, foodType } = {}) {
  const day = normalizeLogDate(date);
  const members = await geckosInGroup(group, geckos);
  const result = await logFeedings({
    entries: members.map((gecko) => ({ gecko: { ...gecko, feeding_group_id: group.id }, accepted: true })),
    date: day,
    foodType: foodType || group.diet_type || DEFAULT_FOOD_TYPE,
    groups: [group],
  });
  if (members.length === 0 && (!group.last_fed_date || group.last_fed_date < day)) {
    await FeedingGroup.update(group.id, { last_fed_date: day });
    result.advanced.push({ id: group.id, previous: group.last_fed_date || null, next: day });
  }
  const lastFed = group.last_fed_date && group.last_fed_date > day ? group.last_fed_date : day;
  return { ...result, fedCount: members.length, lastFed };
}

/** Log one shed. */
export async function logShed({ gecko, date, quality = 'unknown', notes = null } = {}) {
  if (!gecko?.id) throw new Error('Pick a gecko first.');
  const value = SHED_QUALITY_OPTIONS.some((q) => q.value === quality) ? quality : 'unknown';
  return ShedRecord.create({
    animal_id: gecko.id,
    date: normalizeLogDate(date),
    quality: value,
    notes: notes || null,
  });
}

/**
 * Before the shared log, the gecko record's "+ Event" saved sheds and
 * feedings as general gecko_events. Those rows are folded in for display
 * and for the shed forecast, marked `legacy`, and never written back.
 * Pure, newest first.
 *
 *   feedings: feeding_records rows, sheds: shed_records rows
 *   events:   gecko_events rows (event_type, event_date timestamp, notes)
 */
export function mergeLegacyEvents({ feedings = [], sheds = [], events = [] } = {}) {
  const localDay = (ts) => {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const legacyFeedings = [];
  const legacySheds = [];
  for (const e of events || []) {
    const date = localDay(e?.event_date);
    if (!date) continue;
    if (e.event_type === 'shed') {
      legacySheds.push({ id: `event-${e.id}`, date, quality: 'unknown', notes: e.notes || null, legacy: true });
    } else if (e.event_type === 'feeding' || e.event_type === 'bug_feeding') {
      legacyFeedings.push({
        id: `event-${e.id}`,
        date,
        food_type: e.event_type === 'bug_feeding' ? 'Insects' : null,
        accepted: true,
        notes: e.notes || null,
        legacy: true,
      });
    }
  }
  const newestFirst = (a, b) => String(b.date).localeCompare(String(a.date));
  return {
    feedings: [...feedings, ...legacyFeedings].sort(newestFirst),
    sheds: [...sheds, ...legacySheds].sort(newestFirst),
  };
}

/**
 * True when an error means the sign-in has expired or is missing, rather
 * than a network or server problem. Field Mode uses it to show "Sign in"
 * instead of "check your connection".
 */
export function isAuthFailure(error) {
  if (!error) return false;
  const status = error.status ?? error.statusCode;
  if (status === 401) return true;
  if (error.code === 'PGRST301' || error.code === 'PGRST303') return true;
  const text = `${error.message || ''} ${error.error_description || ''}`.toLowerCase();
  return /not authenticated|jwt expired|invalid jwt|refresh token|auth session missing|session.*expired/.test(text);
}
