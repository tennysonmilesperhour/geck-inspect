// Admin panel data access (feature-completeness audit, step 22).
//
// Each Admin tile asks the database for exactly what it shows, through
// admin-only functions (see supabase/migrations/20261003022847_admin_panel_rpcs.sql),
// instead of downloading whole tables into the browser. Downloading
// gecko_images pulled every image embedding and still stopped at the
// API's row limit, so the counts were wrong as well as slow.
//
// "Real accounts" are profiles with a login. Legacy rows imported from
// the old platform have no login and cannot read a message, so they are
// left out of the counts and out of mass messages.
import { supabase } from '@/lib/supabaseClient';

async function rpc(name) {
  const { data, error } = await supabase.rpc(name);
  if (error) throw error;
  return data;
}

export const fetchOverviewStats = () => rpc('admin_overview_stats');
export const fetchAccountDirectory = async () => (await rpc('admin_account_directory')) || [];
export const fetchHealthStatus = () => rpc('admin_health_status');

// Turn the RPC's parallel arrays into the { key, value } points the
// sparklines read.
export function seriesPoints(series, key) {
  const labels = series?.labels || [];
  const values = series?.[key] || [];
  return labels.map((label, i) => ({ key: label, value: Number(values[i] || 0) }));
}

export const BROADCAST_GROUPS = ['all', 'experts', 'reviewers', 'admins', 'non_experts'];

// Who a mass message would reach: real accounts only, never the sender.
export function broadcastRecipients(directory, group, senderEmail) {
  const sender = String(senderEmail || '').toLowerCase();
  const base = (directory || []).filter(
    (u) => u.has_login && u.email && u.email.toLowerCase() !== sender,
  );
  switch (group) {
    case 'experts':
      return base.filter((u) => u.is_expert === true);
    case 'reviewers':
      return base.filter((u) => u.role === 'expert_reviewer' || u.role === 'admin');
    case 'admins':
      return base.filter((u) => u.role === 'admin');
    case 'non_experts':
      return base.filter((u) => !u.is_expert && u.role !== 'admin');
    default:
      return base;
  }
}

// The deploy this browser is running, stamped at build time by
// vite.config.js. Falls back to "dev" in local runs and tests.
export function buildInfo() {
  /* global __BUILD_INFO__ */
  const info = typeof __BUILD_INFO__ !== 'undefined' ? __BUILD_INFO__ : null;
  return {
    commit: info?.commit || 'dev',
    shortCommit: (info?.commit || 'dev').slice(0, 7),
    branch: info?.branch || null,
    builtAt: info?.builtAt || null,
    deployEnv: info?.env || null,
  };
}

// A scheduled job needs attention when it is switched on and its last run
// failed, or it has failed in the last week.
export function jobNeedsAttention(job) {
  if (!job || job.error) return true;
  if (!job.active) return false;
  return job.last_status === 'failed' || Number(job.failures_7d || 0) > 0;
}

// Admin accounts are left out of every analytics view: in September 2026
// the admin account produced 60% of signed-in events and held 37% of all
// geckos, so unfiltered charts mostly measured Tennyson's own use.
export function adminEmailSet(users) {
  return new Set(
    (users || [])
      .filter((u) => u?.role === 'admin' && u.email)
      .map((u) => String(u.email).toLowerCase()),
  );
}

function isAdminEvent(event, admins) {
  if (event?.properties?.is_admin === true) return true;
  const email = event?.user_email ? String(event.user_email).toLowerCase() : null;
  return Boolean(email && admins.has(email));
}

/**
 * Events with admin activity removed. A browser session that ever carried
 * an admin event is dropped whole, so the admin's signed-out page views
 * in the same tab do not count as a visitor either.
 */
export function withoutAdminEvents(events, admins) {
  if (!admins || admins.size === 0) {
    return (events || []).filter((e) => e?.properties?.is_admin !== true);
  }
  const adminSessions = new Set();
  for (const e of events || []) {
    if (e?.session_id && isAdminEvent(e, admins)) adminSessions.add(e.session_id);
  }
  return (events || []).filter(
    (e) => !isAdminEvent(e, admins) && !(e?.session_id && adminSessions.has(e.session_id)),
  );
}

/** Rows (geckos, photos, plans, profiles) not owned by an admin account. */
export function withoutAdminRows(rows, admins, field = 'created_by') {
  if (!admins || admins.size === 0) return rows || [];
  return (rows || []).filter((r) => {
    const value = r?.[field] ? String(r[field]).toLowerCase() : null;
    return !(value && admins.has(value));
  });
}

/**
 * Photos and forum rows with their owner's email put back as `created_by`.
 * Signed-in accounts, admins included, are losing created_by on those
 * tables (supabase/pending/member_email_columns_revoke.sql), so admin
 * screens read owner_profile_id and look the address up in the profiles
 * list, which gives admins every address. A row whose owner has no
 * profile gets null. Keeps the `truncated` flag fetchAllRows sets.
 */
export function withOwnerEmails(rows, profiles) {
  const emailById = new Map(
    (profiles || []).filter((p) => p?.id != null && p.email).map((p) => [String(p.id), p.email]),
  );
  const out = (rows || []).map((r) => ({
    ...r,
    created_by: r?.owner_profile_id != null ? emailById.get(String(r.owner_profile_id)) ?? null : null,
  }));
  if (rows?.truncated) out.truncated = rows.truncated;
  return out;
}

/** The same, reading just those profiles with read_profiles (100 ids per request). */
export async function withOwnerEmailsFetched(rows, { client = supabase } = {}) {
  const ids = [...new Set((rows || []).map((r) => r?.owner_profile_id).filter((v) => v != null).map(String))];
  const profiles = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await client.rpc('read_profiles').select('id, email').in('id', ids.slice(i, i + 100));
    if (error) throw error;
    profiles.push(...(data || []));
  }
  return withOwnerEmails(rows, profiles);
}

// Plain words for the product events a member's admin card lists. Events
// not named here are shown as their own name with the underscores turned
// into spaces ("market_view" becomes "Market view").
const ACTIVITY_LABELS = {
  animal_created: 'Added a gecko',
  gecko_added: 'Added a gecko',
  first_gecko_added: 'Added a first gecko',
  animal_updated: 'Edited a gecko',
  gecko_updated: 'Edited a gecko',
  weight_logged: 'Logged a weigh-in',
  egg_logged: 'Logged an egg',
  quick_log: 'Used the one-tap log',
  login_completed: 'Signed in',
  signup_completed: 'Created an account',
  morph_id_result: 'Ran Morph ID',
  checkout_started: 'Opened checkout',
  checkout_completed: 'Finished checkout',
  billing_portal_opened: 'Opened the billing portal',
  membership_viewed: 'Viewed Membership',
};

export function activityLabel(eventName) {
  const name = String(eventName || '').trim();
  if (!name) return 'Activity';
  if (ACTIVITY_LABELS[name]) return ACTIVITY_LABELS[name];
  const words = name.replace(/^\$/, '').replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Activity';
}

// ----- reading a whole table for the analytics screens --------------------
//
// The API returns at most 1,000 rows per request (the project's row limit).
// The two analytics screens (AnalyticsDashboard and ProductAnalytics) asked
// for up to 20,000 user_events rows and every row of gecko_images, and each
// request silently stopped at 1,000: on 16 Oct 2026 user_events held 12,043
// rows (1,813 in the last 7 days alone) and gecko_images 3,809, so every
// chart past the newest 1,000 rows was short. These helpers read the rows a
// page at a time, and only the columns a chart uses (a gecko_images row
// carries a 768-number image embedding the charts never look at).

export const ADMIN_PAGE_SIZE = 1000;
// A ceiling so a runaway table cannot freeze the browser. Far above
// today's largest table; the screens log a warning if it is ever reached.
export const ADMIN_MAX_ROWS = 200000;

/**
 * Every row a query matches, read a page at a time. buildQuery(withCount)
 * returns a fresh query each time; the first page asks for the exact total,
 * so the loop knows when it has everything even if the server's page limit
 * is smaller than pageSize. Callers order on a unique key so no row is
 * skipped or read twice between pages.
 * Resolves to the rows, with `truncated: true` set on the array when
 * maxRows stopped it early.
 */
export async function fetchAllRows(buildQuery, { pageSize = ADMIN_PAGE_SIZE, maxRows = ADMIN_MAX_ROWS } = {}) {
  const rows = [];
  let total = null;
  while (rows.length < maxRows) {
    const from = rows.length;
    const { data, error, count } = await buildQuery(from === 0).range(from, from + pageSize - 1);
    if (error) throw error;
    if (from === 0 && Number.isFinite(count)) total = count;
    const page = Array.isArray(data) ? data : [];
    if (page.length === 0) break;
    rows.push(...page);
    if (total != null ? rows.length >= total : page.length < pageSize) break;
  }
  const result = rows.length > maxRows ? rows.slice(0, maxRows) : rows;
  result.truncated = rows.length >= maxRows && (total == null || total > maxRows);
  return result;
}

/**
 * Chosen columns of one table, oldest first, every row (or every row
 * since `since` on `dateColumn`). Reads as the signed-in admin, so the
 * table's own admin read rule applies.
 */
export function fetchAdminTable(table, columns, { since = null, dateColumn = 'created_date', idColumn = 'id' } = {}) {
  return fetchAllRows((withCount) => {
    let query = supabase.from(table).select(columns, withCount ? { count: 'exact' } : undefined);
    if (since) query = query.gte(dateColumn, since);
    return query
      .order(dateColumn, { ascending: true, nullsFirst: true })
      .order(idColumn, { ascending: true });
  });
}

/** Every member profile. Admins get every row from read_profiles. */
export function fetchAllProfiles(columns = '*') {
  return fetchAllRows((withCount) => supabase
    .rpc('read_profiles', { p_emails: null }, withCount ? { count: 'exact' } : undefined)
    .select(columns)
    .order('created_date', { ascending: true, nullsFirst: true })
    .order('id', { ascending: true }));
}

// The user_events columns the analytics charts read.
export const USER_EVENT_COLUMNS = 'id,event_name,user_email,session_id,page,properties,created_date';

// Plain names for the tables the analytics screens read.
const TABLE_WORDS = {
  profiles: 'accounts',
  geckos: 'geckos',
  gecko_images: 'photos',
  forum_posts: 'forum posts',
  forum_comments: 'forum comments',
  breeding_plans: 'breeding plans',
  direct_messages: 'messages',
  user_events: 'events',
};

/**
 * The line an analytics screen shows above its charts when a table did not
 * load (it is counted as empty, so its numbers read as zero) or was cut
 * short at ADMIN_MAX_ROWS. Null when everything loaded. Before this the
 * only sign was in the browser console, so a failed table looked like a
 * real zero.
 */
export function analyticsLoadNotice({ failed = [], truncated = false } = {}) {
  const parts = [];
  const names = [...new Set(failed || [])].map((t) => TABLE_WORDS[t] || String(t).replace(/_/g, ' '));
  if (names.length) {
    const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
    parts.push(`Could not load ${list}, so ${names.length === 1 ? 'those numbers show' : 'their numbers show'} as zero. Refresh to try again.`);
  }
  if (truncated) parts.push('A table has more rows than this screen reads, so some numbers are a lower bound.');
  return parts.length ? parts.join(' ') : null;
}
