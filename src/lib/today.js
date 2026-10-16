// The Today screen (review item E3 25): what is due for the member's
// geckos today and overdue, each with a one-tap log, then the week ahead.
//
// Where the list comes from:
//   * a signed-in member: public.my_care_today in the database
//     (supabase/migrations/20261016090100_nav.sql), which uses the
//     reminder jobs' own rules, so the screen and the reminders agree;
//   * the guest demo and signed-out visitors: buildTodayFromRecords below,
//     the same rules in JavaScript, run over the demo collection.
// Both give the same shape:
//   { today, feedingReminders, weighInReminders,
//     items: [{ kind, key, geckoId, groupId, name, due, extra }] }
// kind is feeding, weigh_in, hatch, vet, task or pairing_window; due is
// the day it falls due (YYYY-MM-DD), oldest first, up to 7 days ahead.
//
// todayView turns that into what the screen shows: one card per kind of
// job that is due (all feedings together, all weigh-ins together, then
// each clutch, vet follow-up and task), each with one button, and a short
// "coming up" list. The feeding and weigh-in buttons open the one-tap log
// (/log, src/pages/QuickLog.jsx), so a feeding takes two taps from the
// Today tab: "Log feeding", then "Fed".
//
// Nothing here talks to the network except the two loaders at the end,
// so the rules can be tested on their own.
import { quickLogPath } from '@/lib/quickLog';
import { weighInIntervalDays } from '@/lib/lifeStage';

export const TODAY_PATH = '/Today';
export const TODAY_KINDS = ['feeding', 'weigh_in', 'hatch', 'vet', 'task', 'pairing_window'];
// How far ahead the list looks, the same as the database function.
export const TODAY_HORIZON_DAYS = 7;
// The life-stage defaults start on this day when the setting row cannot be
// read: the same day as CARE_DEFAULTS_FROM in src/lib/careReminders.js (a
// test checks they match). Kept here so this file does not load the
// Supabase client, which signed-out visitors may not need.
export const TODAY_DEFAULTS_FROM = '2026-10-16';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayQueryKey(owner) {
  return ['today', owner || null];
}

// ---- Dates (whole days, written YYYY-MM-DD) ------------------------------

function dayPart(value) {
  const text = String(value ?? '').slice(0, 10);
  return DAY_RE.test(text) ? text : null;
}

function dayNumber(day) {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function addDays(day, n) {
  const date = new Date((dayNumber(day) + n) * 86400000);
  return date.toISOString().slice(0, 10);
}

/** Days from `today` to `day`: 0 today, 1 tomorrow, -2 two days ago. */
export function daysFrom(today, day) {
  const a = dayPart(today);
  const b = dayPart(day);
  if (!a || !b) return null;
  return dayNumber(b) - dayNumber(a);
}

/** "today", "tomorrow", "in 3 days", "yesterday", "3 days ago". */
export function whenLabel(days) {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 1) return `in ${days} days`;
  return `${-days} days ago`;
}

/** "16 Oct" for a YYYY-MM-DD day, without the time-zone shift. */
export function shortDate(day) {
  const d = dayPart(day);
  if (!d) return '';
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ---- The list from the database -----------------------------------------

const asObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

/**
 * The database answer in the screen's shape. Items with an unknown kind
 * or no due day are dropped rather than shown wrong.
 */
export function normalizeToday(raw, fallbackToday) {
  const data = asObject(raw);
  const today = dayPart(data.today) || dayPart(fallbackToday);
  const items = (Array.isArray(data.items) ? data.items : [])
    .map((item) => ({
      kind: item?.kind,
      key: String(item?.key ?? ''),
      geckoId: item?.gecko_id ?? item?.geckoId ?? null,
      groupId: item?.group_id ?? item?.groupId ?? null,
      name: String(item?.name ?? ''),
      due: dayPart(item?.due),
      extra: asObject(item?.extra),
    }))
    .filter((item) => TODAY_KINDS.includes(item.kind) && item.due && item.key);
  return {
    today,
    feedingReminders: data.feeding_reminders !== false && data.feedingReminders !== false,
    weighInReminders: data.weigh_in_reminders !== false && data.weighInReminders !== false,
    items,
  };
}

/**
 * True when the database does not have my_care_today yet: the minutes
 * after the site deploys and before the migration has run. The screen
 * then says its list could not load, and still shows the collection.
 */
export function isTodayUnavailable(error) {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '42883') return true;
  return Number(error.status) === 404;
}

// ---- The same rules in JavaScript, for the demo --------------------------

/**
 * A gecko the lists count: not archived and not marked Sold. Today's due
 * list, its "Your geckos" strip and the Log tab all use this one rule.
 */
export const isActiveGecko = (g) => Boolean(g) && !g.archived && String(g.status || '') !== 'Sold';
const isActive = isActiveGecko;
const nameOf = (value, fallback) => String(value ?? '').trim() || fallback;

/**
 * The Today list from collection rows, by the rules the database function
 * uses (feeding groups, geckos in no group added since the defaults
 * started, weigh-ins by life stage and the 30-day line for older geckos,
 * and clutches in the incubator). Used for the demo collection, which
 * has no database behind it.
 *
 * `extra` is profiles.extra_data (care_reminders switches), `feedingOn`
 * the Feeding Alerts switch, `hatchAlertDays` the member's hatch window
 * for eggs with no expected date.
 */
export function buildTodayFromRecords({
  today,
  defaultsFrom = TODAY_DEFAULTS_FROM,
  geckos = [],
  feedingGroups = [],
  weightRecords = [],
  feedingRecords = [],
  eggs = [],
  breedingPlans = [],
  extra = {},
  feedingOn = true,
  hatchAlertDays = 60,
} = {}) {
  const day = dayPart(today);
  const horizon = addDays(day, TODAY_HORIZON_DAYS);
  const care = asObject(asObject(extra).care_reminders);
  const weighSection = asObject(care.weigh_in);
  const feedSection = asObject(care.feeding);
  const weighOn = weighSection.enabled !== false;
  const defaultsDay = dayPart(defaultsFrom) || TODAY_DEFAULTS_FROM;
  const items = [];
  const active = (geckos || []).filter(isActive);
  const groupIds = new Set((feedingGroups || []).map((g) => String(g.id)));

  if (feedingOn) {
    for (const group of feedingGroups || []) {
      if (group.feeding_reminder_enabled === false) continue;
      const last = dayPart(group.last_fed_date);
      if (!last) continue;
      const every = Math.max(Math.round(Number(group.interval_days) || 3), 1);
      items.push({
        kind: 'feeding',
        key: `group:${group.id}`,
        geckoId: null,
        groupId: String(group.id),
        name: nameOf(group.name, nameOf(group.label, 'A feeding group')),
        due: addDays(last, every),
        extra: { last, every_days: every, geckos: active.filter((g) => String(g.feeding_group_id || '') === String(group.id)).length },
      });
    }
    for (const gecko of active) {
      if (gecko.feeding_group_id && groupIds.has(String(gecko.feeding_group_id))) continue;
      const entry = asObject(asObject(feedSection.geckos)[gecko.id]);
      // String() so a stored "true" or "false" counts the way the SQL's
      // ->> 'on' reads it.
      if (String(entry.on) === 'false') continue;
      const created = dayPart(gecko.created_date);
      if (!(String(entry.on) === 'true' || (created && created >= defaultsDay))) continue;
      const days = Number(entry.every_days);
      const every = Number.isFinite(days) && /^\d{1,2}$/.test(String(entry.every_days)) ? Math.max(1, Math.min(30, days)) : 3;
      const fed = (feedingRecords || [])
        .filter((f) => String(f.animal_id) === String(gecko.id) && f.accepted !== false)
        .map((f) => dayPart(f.date))
        .filter(Boolean)
        .sort();
      const last = fed[fed.length - 1] || null;
      items.push({
        kind: 'feeding',
        key: `gecko:${gecko.id}`,
        geckoId: String(gecko.id),
        groupId: null,
        name: nameOf(gecko.name, 'A gecko'),
        due: addDays(last || created || day, every),
        extra: { last, every_days: every },
      });
    }
  }

  if (weighOn) {
    for (const gecko of active) {
      const entry = asObject(weighSection.geckos)[gecko.id];
      const chosen = entry && typeof entry === 'object' ? entry : null;
      const created = dayPart(gecko.created_date) || day;
      const weights = (weightRecords || [])
        .filter((w) => String(w.gecko_id) === String(gecko.id) && dayPart(w.record_date))
        .sort((a, b) => (dayPart(a.record_date) < dayPart(b.record_date) ? -1 : dayPart(a.record_date) > dayPart(b.record_date) ? 1
          : String(a.created_date || '') < String(b.created_date || '') ? -1 : 1));
      const latest = weights[weights.length - 1] || null;
      const lastDay = latest ? dayPart(latest.record_date) : null;
      if ((!chosen && created >= defaultsDay) || String(chosen?.on) === 'true') {
        const grams = latest ? Number(latest.weight_grams) : gecko.weight_grams;
        const fixed = String(chosen?.fixed) === 'true' && /^\d{1,3}$/.test(String(chosen.every_days));
        const every = fixed
          ? Math.max(7, Math.min(90, Number(chosen.every_days)))
          : weighInIntervalDays(gecko, day, { weightGrams: grams ?? null });
        const since = dayPart(chosen?.since);
        const due = lastDay
          ? addDays(lastDay, every)
          : gecko.weight_grams != null ? addDays(since || created, every) : addDays(since || created, 1);
        items.push({
          kind: 'weigh_in', key: `gecko:${gecko.id}`, geckoId: String(gecko.id), groupId: null,
          name: nameOf(gecko.name, 'A gecko'), due, extra: { last: lastDay, every_days: every, grams: grams ?? null },
        });
      } else if (!chosen && created < defaultsDay && lastDay) {
        // The weekly "not weighed in 30 days" line.
        items.push({
          kind: 'weigh_in', key: `gecko:${gecko.id}`, geckoId: String(gecko.id), groupId: null,
          name: nameOf(gecko.name, 'A gecko'), due: addDays(lastDay, 30), extra: { last: lastDay, every_days: 30, grams: gecko.weight_grams ?? null },
        });
      }
    }
  }

  // Clutches: eggs still incubating, one item per pairing and lay day.
  const plans = new Map((breedingPlans || []).map((p) => [String(p.id), p]));
  const byId = new Map((geckos || []).map((g) => [String(g.id), g]));
  const clutches = new Map();
  for (const egg of eggs || []) {
    if (egg.status !== 'Incubating' || egg.archived) continue;
    const laid = dayPart(egg.lay_date);
    if (!laid) continue;
    const key = `clutch:${egg.breeding_plan_id || 'none'}:${laid}`;
    const c = clutches.get(key) || { key, planId: egg.breeding_plan_id || null, laid, eggs: 0, expected: null };
    c.eggs += 1;
    const expected = dayPart(egg.hatch_date_expected);
    if (expected && (!c.expected || expected < c.expected)) c.expected = expected;
    clutches.set(key, c);
  }
  // Clamped to 1..365 days, as the database function does.
  const hatchDays = Math.min(Math.max(Math.round(Number(hatchAlertDays) || 60), 1), 365);
  for (const c of clutches.values()) {
    const lastDay = c.expected ? addDays(c.expected, 30) : addDays(c.laid, 150);
    if (day > lastDay) continue;
    const plan = c.planId ? plans.get(String(c.planId)) : null;
    items.push({
      kind: 'hatch',
      key: c.key,
      geckoId: null,
      groupId: null,
      name: nameOf(plan?.breeding_id, ''),
      due: c.expected ? addDays(c.expected, -7) : addDays(c.laid, hatchDays),
      extra: {
        eggs: c.eggs,
        lay_date: c.laid,
        expected: c.expected,
        plan_id: plan?.id ?? null,
        sire: plan ? byId.get(String(plan.sire_id))?.name ?? null : null,
        dam: plan ? byId.get(String(plan.dam_id))?.name ?? null : null,
      },
    });
  }

  const listed = items
    .filter((item) => item.due && item.due <= horizon)
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1
      : a.kind < b.kind ? -1 : a.kind > b.kind ? 1
        : a.name < b.name ? -1 : a.name > b.name ? 1 : a.key < b.key ? -1 : 1));
  return { today: day, feedingReminders: feedingOn, weighInReminders: weighOn, items: listed };
}

// ---- Logs kept on this phone ---------------------------------------------

/**
 * Feedings and weigh-ins saved on this phone that have not reached the
 * server yet (src/lib/offlineQueue.js). The list from the server cannot
 * know about them, so the screen shows them as "saved on this phone"
 * instead of asking for the same log twice.
 */
export function pendingLogs(queueItems = []) {
  const fed = new Set();
  const fedGroups = new Set();
  const weighed = new Set();
  for (const item of queueItems || []) {
    if (item?.entity !== 'FieldLog' || item.op !== 'create') continue;
    const d = asObject(item.data);
    if (!d.geckoId) continue;
    if (d.kind === 'fed' && d.accepted !== false) {
      fed.add(String(d.geckoId));
      // A gecko of a group fed counts as feeding the group (D21).
      if (d.feedingGroupId) fedGroups.add(String(d.feedingGroupId));
    } else if (d.kind === 'weight') {
      weighed.add(String(d.geckoId));
    }
  }
  return { fed, fedGroups, weighed };
}

function isPending(item, pending) {
  if (!pending) return false;
  if (item.kind === 'feeding') {
    return item.groupId ? pending.fedGroups.has(String(item.groupId)) : pending.fed.has(String(item.geckoId));
  }
  if (item.kind === 'weigh_in') return pending.weighed.has(String(item.geckoId));
  return false;
}

// ---- What the screen shows -----------------------------------------------

function list(names, max = 3) {
  if (names.length <= max) {
    if (names.length <= 1) return names.join('');
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

function pairLabel(extra) {
  const { sire, dam } = asObject(extra);
  if (sire && dam) return `${sire} x ${dam}`;
  return sire || dam || '';
}

function lineFor(item, today) {
  const days = daysFrom(today, item.due);
  const late = days < 0;
  if (item.kind === 'feeding') {
    const count = Number(item.extra.geckos);
    return {
      key: item.key,
      name: item.name,
      note: [item.groupId ? (count === 1 ? '1 gecko' : `${count || 0} geckos`) : null, late ? `due ${whenLabel(days)}` : 'due today'].filter(Boolean).join(', '),
      late,
    };
  }
  return { key: item.key, name: item.name, note: late ? `due ${whenLabel(days)}` : 'due today', late };
}

function hatchCard(item, today) {
  const eggs = Number(item.extra.eggs) || 1;
  const expected = item.extra.expected;
  const days = expected ? daysFrom(today, expected) : null;
  const title = eggs === 1 ? 'An egg is close to hatching' : `${eggs} eggs are close to hatching`;
  const pair = pairLabel(item.extra);
  // The pairing's own name when it has one (it usually names the pair),
  // else the sire and dam.
  const from = item.name || pair;
  let when;
  if (days === null) when = `Laid ${shortDate(item.extra.lay_date)}, inside the hatch window.`;
  else if (days > 0) when = `Expected to hatch ${whenLabel(days)} (${shortDate(expected)}).`;
  else if (days === 0) when = 'Expected to hatch today.';
  else when = `Expected ${whenLabel(days)}. Check on ${eggs === 1 ? 'it' : 'them'}.`;
  return {
    id: item.key,
    kind: 'hatch',
    title,
    detail: from ? `${from}. ${when}` : when,
    late: days !== null && days < 0,
    action: { label: 'Open the hatchery', to: '/Breeding?tab=hatchery' },
  };
}

function vetCard(item, today) {
  const days = daysFrom(today, item.due);
  const { reason, vet, visit } = item.extra;
  const visitText = [reason ? `for ${reason}` : null, visit ? `on ${shortDate(visit)}` : null, vet ? `with ${vet}` : null]
    .filter(Boolean).join(' ');
  return {
    id: item.key,
    kind: 'vet',
    title: `Vet follow-up for ${item.name}`,
    detail: `${days < 0 ? `Was due ${whenLabel(days)}` : 'Due today'}${visitText ? `. Visit ${visitText}.` : '.'}`,
    late: days < 0,
    action: item.geckoId ? { label: 'Open the record', to: `/GeckoDetail?id=${encodeURIComponent(item.geckoId)}` } : null,
  };
}

function taskCard(item, today) {
  const days = daysFrom(today, item.due);
  const isPlan = item.extra.plan === true;
  return {
    id: item.key,
    kind: 'task',
    title: item.name,
    detail: `${isPlan ? 'Season Planner plan' : 'Season Planner task'}, ${days < 0 ? `was due ${whenLabel(days)}` : 'due today'}${item.extra.recurring ? ' (repeats)' : ''}.`,
    late: days < 0,
    action: { label: 'Open the Season Planner', to: '/ProjectManager?tab=projects' },
  };
}

function pairingCard(item) {
  const pair = pairLabel(item.extra);
  const ends = item.extra.ends ? ` Open until ${shortDate(item.extra.ends)}.` : '';
  return {
    id: item.key,
    kind: 'pairing_window',
    title: `${item.name.trim() || 'Your'} pairing window is open`,
    detail: `${pair ? `${pair}.` : 'A pairing you planned.'}${ends}`,
    late: false,
    action: { label: 'Start the pairing', to: '/ProjectManager?tab=future' },
  };
}

function comingUpText(item) {
  if (item.kind === 'feeding') return `Feed ${item.name}`;
  if (item.kind === 'weigh_in') return `Weigh ${item.name}`;
  if (item.kind === 'hatch') {
    const eggs = Number(item.extra.eggs) || 1;
    const pair = pairLabel(item.extra) || item.name;
    return `${eggs === 1 ? 'An egg' : `${eggs} eggs`}${pair ? ` from ${pair}` : ''}: hatch window opens`;
  }
  if (item.kind === 'vet') return `Vet follow-up for ${item.name}`;
  if (item.kind === 'pairing_window') return `${item.name.trim() || 'A'} pairing window opens`;
  return item.name;
}

/**
 * The screen, from the list: { cards, comingUp, savedOnPhone, dueCount }.
 *   cards       what is due today or overdue, in the order shown. The
 *               feeding card comes first and its button opens the
 *               one-tap log for every gecko and group that is due.
 *   comingUp    [{ key, text, when }] for the next 7 days
 *   savedOnPhone names of geckos and groups logged on this phone and not
 *               synced yet (not asked for again)
 */
export function todayView(data, { today, pending = null, from = TODAY_PATH } = {}) {
  const day = dayPart(today) || data?.today;
  const items = Array.isArray(data?.items) ? data.items : [];
  const due = items.filter((item) => item.due <= day);
  const savedOnPhone = [];
  const cards = [];

  // The due items of one kind, less the ones already logged on this phone.
  const care = (kind) => due.filter((item) => {
    if (item.kind !== kind) return false;
    if (!isPending(item, pending)) return true;
    savedOnPhone.push(item.name);
    return false;
  });

  const feedings = care('feeding');
  if (feedings.length) {
    const geckoIds = feedings.filter((i) => i.geckoId).map((i) => i.geckoId);
    const groupIds = feedings.filter((i) => i.groupId).map((i) => i.groupId);
    const lines = feedings.map((i) => lineFor(i, day));
    cards.push({
      id: 'feeding',
      kind: 'feeding',
      title: feedings.length === 1 ? `Feed ${feedings[0].name}` : 'Feeding',
      detail: feedings.length === 1 ? null : `${list(feedings.map((i) => i.name))} are due for feeding.`,
      lines,
      late: lines.some((l) => l.late),
      action: { label: 'Log feeding', to: quickLogPath({ type: 'feeding', geckoIds, groupIds, from }) },
    });
  }

  const weighIns = care('weigh_in');
  if (weighIns.length) {
    const lines = weighIns.map((i) => lineFor(i, day));
    cards.push({
      id: 'weigh_in',
      kind: 'weigh_in',
      title: weighIns.length === 1 ? `Weigh ${weighIns[0].name}` : 'Weigh-ins',
      detail: weighIns.length === 1 ? null : `${list(weighIns.map((i) => i.name))} are due for a weigh-in.`,
      lines,
      late: lines.some((l) => l.late),
      action: {
        label: weighIns.length === 1 ? 'Log weigh-in' : 'Log weigh-ins',
        to: quickLogPath({ type: 'weight', geckoIds: weighIns.map((i) => i.geckoId), from }),
      },
    });
  }

  for (const item of due) {
    if (item.kind === 'hatch') cards.push(hatchCard(item, day));
    else if (item.kind === 'vet') cards.push(vetCard(item, day));
    else if (item.kind === 'task') cards.push(taskCard(item, day));
    else if (item.kind === 'pairing_window') cards.push(pairingCard(item, day));
  }

  // Already in date order (the list is oldest first). The row key names
  // the kind as well, because a gecko's feeding and its weigh-in share
  // the item key 'gecko:<id>', and a young gecko often has both in the
  // same week. Two rows with one key make React keep stale rows on
  // screen when the list refreshes.
  const comingUp = items
    .filter((item) => item.due > day && !isPending(item, pending))
    .map((item) => ({ key: `${item.kind}:${item.key}`, text: comingUpText(item), when: whenLabel(daysFrom(day, item.due)) }));

  return { cards, comingUp, savedOnPhone, dueCount: cards.length };
}

// ---- The Log tab -----------------------------------------------------------

/**
 * The Log tab's links for the whole collection: { feeding, weight, shed }.
 *
 * The one-tap log lists at most 10 geckos by name and points to Field
 * Mode for the rest, so the geckos due soonest (from the Today list, when
 * the phone has it) come first. A feeding goes by feeding group where
 * there is one: the log page lists every gecko in a group, so a rack of
 * 40 in four groups still fits, and geckos in no group follow.
 */
export function collectionLogLinks({ geckos = [], todayData = null, from = null } = {}) {
  const active = (geckos || []).filter(isActive);
  const due = new Map();
  for (const item of todayData?.items || []) {
    const id = item.groupId ? `group:${item.groupId}` : `${item.kind}:${item.geckoId}`;
    if (!due.has(id) || item.due < due.get(id)) due.set(id, item.due);
  }
  const NEVER = '9999-12-31';
  const byDue = (key) => (a, b) => {
    const da = due.get(key(a)) || NEVER;
    const db = due.get(key(b)) || NEVER;
    if (da !== db) return da < db ? -1 : 1;
    return String(a.name || '').localeCompare(String(b.name || ''));
  };

  const grouped = new Map();
  const loose = [];
  for (const gecko of active) {
    const group = String(gecko.feeding_group_id || '');
    if (group) {
      if (!grouped.has(group)) grouped.set(group, { id: group, name: group });
    } else {
      loose.push(gecko);
    }
  }
  const groupIds = [...grouped.values()].sort(byDue((g) => `group:${g.id}`)).map((g) => g.id);
  const looseIds = loose.sort(byDue((g) => `feeding:${g.id}`)).map((g) => String(g.id));
  const weighIds = [...active].sort(byDue((g) => `weigh_in:${g.id}`)).map((g) => String(g.id));
  const shedIds = [...active]
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    .map((g) => String(g.id));

  return {
    feeding: quickLogPath({ type: 'feeding', geckoIds: looseIds, groupIds, from }),
    weight: quickLogPath({ type: 'weight', geckoIds: weighIds, from }),
    shed: quickLogPath({ type: 'shed', geckoIds: shedIds, from }),
  };
}

// ---- Loaders --------------------------------------------------------------

/** A signed-in member's list, from the database. Throws on failure. */
export async function loadMemberToday(today) {
  const { supabase } = await import('@/lib/supabaseClient');
  const { data, error } = await supabase.rpc('my_care_today', { p_today: today });
  if (error) throw error;
  return normalizeToday(data, today);
}

/** The demo collection's list and geckos, for guests and signed-out visitors. */
export async function loadDemoToday(today) {
  const { guestMockFilter } = await import('@/lib/guestMockData');
  const [geckos, feedingGroups, weightRecords, eggs, breedingPlans] = await Promise.all([
    guestMockFilter('Gecko', {}),
    guestMockFilter('FeedingGroup', {}),
    guestMockFilter('WeightRecord', {}),
    guestMockFilter('Egg', {}),
    guestMockFilter('BreedingPlan', {}),
  ]);
  // The demo's records are dated from the clock, but TODAY_DEFAULTS_FROM is
  // a fixed day, so each week more demo geckos would count as added after
  // the life-stage defaults started and fall overdue at once. The demo
  // starts its defaults on the day it is shown, so its day looks the same
  // whenever it is opened.
  const data = buildTodayFromRecords({ today, defaultsFrom: today, geckos, feedingGroups, weightRecords, eggs, breedingPlans });
  return { ...data, geckos: geckos.filter(isActive) };
}
