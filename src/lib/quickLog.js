// The one-tap log that reminder links open (review item E2 15).
//
//   /log?type=weight|feeding|shed&gecko=<id>,<id>&group=<id>&from=<path>
//
// The reminder jobs build these links (public.care_log_link in
// supabase/migrations/20261015151100_reminders_and_offline_logging.sql):
// at most 10 ids of each kind, each made of letters, digits, "_" and "-",
// so the link passes the notification link rule. This file holds the
// parts with no React: reading the link, picking the geckos, and where
// to go back to afterwards. The screen is src/pages/QuickLog.jsx.
import { safeInternalPath } from '@/lib/safeInternalPath';

export const QUICK_LOG_TYPES = ['weight', 'feeding', 'shed'];
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_IDS = 10;

function idList(value) {
  const seen = new Set();
  for (const raw of String(value || '').split(',')) {
    const id = raw.trim();
    if (ID_RE.test(id) && !seen.has(id)) seen.add(id);
    if (seen.size >= MAX_IDS) break;
  }
  return [...seen];
}

/** Where to go back to: a path inside the app, never /log itself. */
function cleanFrom(value) {
  const path = safeInternalPath(value || '', null);
  if (!path || /^\/log(?:[/?#]|$)/i.test(path)) return null;
  return path;
}

/**
 * { type, geckoIds, groupIds, from } from the address bar. An unknown
 * type falls back to feeding, the most common reminder; a bad id is
 * dropped rather than trusted.
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
    from: cleanFrom(params.get('from')),
  };
}

/** The link for a quick log, for screens inside the app that open one. */
export function quickLogPath({ type = 'feeding', geckoIds = [], groupIds = [], from = null } = {}) {
  const params = new URLSearchParams();
  params.set('type', QUICK_LOG_TYPES.includes(type) ? type : 'feeding');
  const geckos = idList((geckoIds || []).join(','));
  const groups = idList((groupIds || []).join(','));
  if (geckos.length) params.set('gecko', geckos.join(','));
  if (groups.length) params.set('group', groups.join(','));
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

export function quickLogTitle(type) {
  if (type === 'weight') return 'Log a weigh-in';
  if (type === 'shed') return 'Log a shed';
  return 'Log a feeding';
}
