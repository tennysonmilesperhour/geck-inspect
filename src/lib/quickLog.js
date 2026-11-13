// The one-tap log that reminder links open (review item E2 15).
//
//   /log?type=weight|feeding|shed&gecko=<id>,<id>&group=<id>&more=<n>&from=<path>
//
// The reminder jobs build these links (public.care_log_link in
// supabase/migrations/20261015151100_reminders_and_offline_logging.sql):
// at most 10 ids of each kind, each made of letters, digits, "_" and "-",
// so the link passes the notification link rule. When a reminder covers
// more geckos than fit, `more` says how many were left out, so the page
// can say so instead of looking finished after the first 10.
//
// Screens inside the app are not held to 10 (experience review E3, 13 Nov
// 2026): quickLogLink puts the whole list in the router's state, which
// travels with the visit and not in the address. An address with no ids
// asks the page for the list itself: every active gecko with all=1, else
// everything due of that type.
//
// This file holds the parts with no React: reading the link, picking the
// geckos, the weight checks, and where to go back to afterwards. The
// screen is src/pages/QuickLog.jsx.
import { safeInternalPath } from '@/lib/safeInternalPath';

export const QUICK_LOG_TYPES = ['weight', 'feeding', 'shed'];
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_IDS = 10;
// Upper bound for `more`; a larger or malformed value is ignored.
const MAX_MORE = 100000;

// Safe ids, each once, in order. `max` is the cap for ids from an address.
function cleanIds(list, max = Infinity) {
  const seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    if (seen.size >= max) break;
    const id = String(raw ?? '').trim();
    if (ID_RE.test(id)) seen.add(id);
  }
  return [...seen];
}

function idList(value) {
  return cleanIds(String(value || '').split(','), MAX_IDS);
}

/** Where to go back to: a path inside the app, never /log itself. */
function cleanFrom(value) {
  const path = safeInternalPath(value || '', null);
  if (!path || /^\/log(?:[/?#]|$)/i.test(path)) return null;
  return path;
}

/** The count of geckos left out of the link, or 0. */
function moreCount(value) {
  const raw = String(value ?? '').trim();
  if (!/^\d{1,6}$/.test(raw)) return 0;
  const n = Number(raw);
  return n > 0 && n <= MAX_MORE ? n : 0;
}

/**
 * { type, geckoIds, groupIds, more, from } from the address bar. An
 * unknown type falls back to feeding, the most common reminder; a bad id
 * is dropped rather than trusted.
 */
export function parseQuickLogParams(search) {
  const params = new URLSearchParams(search || '');
  const rawType = String(params.get('type') || '').toLowerCase();
  // "fed" is what Field Mode's links say; accept it here too.
  const type = rawType === 'fed' ? 'feeding' : QUICK_LOG_TYPES.includes(rawType) ? rawType : 'feeding';
  return {
    type,
    geckoIds: idList(params.get('gecko')),
    groupIds: idList(params.get('group')),
    more: moreCount(params.get('more')),
    from: cleanFrom(params.get('from')),
  };
}

/**
 * What the log page was asked for, from the address and the router state:
 * the fields of parseQuickLogParams plus
 *   scope  'named' (the ids given), 'all' (every active gecko) or 'due'
 *          (everything due of this type), the last two worked out on the page
 *   inApp  false only for an address that carries its own ids, which is
 *          what a reminder email or a phone notification sends
 * A list passed in the router state wins over the address and has no cap.
 */
export function readQuickLog(search, state = null) {
  const parsed = parseQuickLogParams(search);
  const passed = state && typeof state === 'object' ? state.quickLog : null;
  if (passed && typeof passed === 'object') {
    const geckoIds = cleanIds(passed.geckoIds);
    const groupIds = cleanIds(passed.groupIds);
    if (geckoIds.length || groupIds.length) {
      return { ...parsed, geckoIds, groupIds, more: 0, scope: 'named', inApp: true };
    }
  }
  if (parsed.geckoIds.length || parsed.groupIds.length) return { ...parsed, scope: 'named', inApp: false };
  const all = new URLSearchParams(search || '').get('all') === '1';
  return { ...parsed, more: 0, scope: all ? 'all' : 'due', inApp: true };
}

/**
 * Where a screen inside the app sends the member to log: { to, state },
 * for <Link to state> or navigate(to, { state }). The whole list travels
 * in `state`, so it is not held to 10. The address carries the ids too
 * when they fit (a reload or a new tab then shows the same list), and
 * never `more`: the "N more are due" note is for reminder links only.
 * `all` marks a list that is the whole collection, so the page can build
 * it again if the state is lost.
 */
export function quickLogLink({ type = 'feeding', geckoIds = [], groupIds = [], from = null, all = false } = {}) {
  const geckos = cleanIds(geckoIds);
  const groups = cleanIds(groupIds);
  const any = geckos.length > 0 || groups.length > 0;
  const fits = geckos.length <= MAX_IDS && groups.length <= MAX_IDS;
  const params = new URLSearchParams();
  params.set('type', QUICK_LOG_TYPES.includes(type) ? type : 'feeding');
  if (any && fits) {
    if (geckos.length) params.set('gecko', geckos.join(','));
    if (groups.length) params.set('group', groups.join(','));
  } else if (all) {
    params.set('all', '1');
  }
  const back = cleanFrom(from);
  if (back) params.set('from', back);
  return {
    to: `/log?${params.toString().replace(/%2C/g, ',')}`,
    state: any ? { quickLog: { geckoIds: geckos, groupIds: groups } } : null,
  };
}

/**
 * The capped link, in the form the reminder jobs send. Screens inside the
 * app use quickLogLink.
 */
export function quickLogPath({ type = 'feeding', geckoIds = [], groupIds = [], from = null } = {}) {
  const params = new URLSearchParams();
  params.set('type', QUICK_LOG_TYPES.includes(type) ? type : 'feeding');
  const geckos = idList((geckoIds || []).join(','));
  const groups = idList((groupIds || []).join(','));
  if (geckos.length) params.set('gecko', geckos.join(','));
  if (groups.length) params.set('group', groups.join(','));
  // Ids past the first 10 do not fit in the link; say how many there were.
  const dropped = new Set((geckoIds || []).map((id) => String(id).trim()).filter((id) => ID_RE.test(id))).size - geckos.length;
  if (dropped > 0) params.set('more', String(dropped));
  const back = cleanFrom(from);
  if (back) params.set('from', back);
  // URLSearchParams writes "," as "%2C"; plain commas keep the link short
  // and identical to the ones the reminder jobs send.
  return `/log?${params.toString().replace(/%2C/g, ',')}`;
}

/**
 * The geckos this log is for, from the member's collection:
 *   listed:  the geckos named in the link, in the link's order
 *   groups:  [{ id, geckos }] for each feeding group named in the link,
 *            with its geckos that are not already listed
 *   missing: how many named geckos are not in the collection any more
 */
export function pickQuickLogGeckos({ geckos = [], geckoIds = [], groupIds = [] } = {}) {
  const byId = new Map((geckos || []).filter((g) => g && !g.archived).map((g) => [String(g.id), g]));
  const listed = [];
  let missing = 0;
  for (const id of geckoIds) {
    const gecko = byId.get(id);
    if (gecko) listed.push(gecko);
    else missing += 1;
  }
  const listedIds = new Set(listed.map((g) => String(g.id)));
  const groups = (groupIds || []).map((id) => ({
    id,
    geckos: [...byId.values()]
      .filter((g) => String(g.feeding_group_id || '') === id && !listedIds.has(String(g.id)))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
  }));
  return { listed, groups, missing };
}

/**
 * Where "Done" goes: the page named in `from`, else back one step when the
 * member came from inside the app (react-router keeps an index in
 * history.state), else the Dashboard. Returns a path or -1 (go back).
 */
export function quickLogReturnTarget({ from = null, historyIndex = 0 } = {}) {
  if (from) return from;
  if (Number(historyIndex) > 0) return -1;
  return '/Dashboard';
}

// ---- Weights ---------------------------------------------------------------

/**
 * Grams from what was typed ("18.5" or "18,5"), to one decimal, or null
 * when it is not a weight a crested gecko can have.
 */
export function parseGrams(raw) {
  const text = String(raw ?? '').replace(',', '.').trim();
  if (!text) return null;
  const grams = Math.round(Number(text) * 10) / 10;
  return Number.isFinite(grams) && grams > 0 && grams < 500 ? grams : null;
}

// How far from the last weight an entry may be before the page asks again.
export const BIG_WEIGHT_CHANGE = 0.3;

/**
 * True when an entry is more than 30 percent away from the last weight
 * (experience review E5). The usual cause is a slipped decimal point:
 * 151 for 15.1. Never true when there is no earlier weight.
 */
export function isBigWeightChange(grams, last) {
  const before = Number(last);
  if (last == null || !Number.isFinite(before) || before <= 0) return false;
  return Math.abs(Number(grams) - before) / before > BIG_WEIGHT_CHANGE;
}

/**
 * Each gecko's newest weigh-in from weight_records rows:
 * Map(geckoId -> { grams, date }).
 */
export function latestWeights(records = []) {
  const latest = new Map();
  for (const row of records || []) {
    const id = String(row?.gecko_id ?? '');
    const grams = row?.weight_grams == null ? NaN : Number(row.weight_grams);
    if (!id || !Number.isFinite(grams) || grams <= 0) continue;
    const date = String(row.record_date || '').slice(0, 10);
    const seen = latest.get(id);
    if (!seen || date > seen.date) latest.set(id, { grams, date });
  }
  return latest;
}

export function quickLogTitle(type) {
  if (type === 'weight') return 'Log a weigh-in';
  if (type === 'shed') return 'Log a shed';
  return 'Log a feeding';
}
