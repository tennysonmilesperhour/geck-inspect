/**
 * Reads that used to need another member's email address.
 *
 * Signed-in members are losing the columns that hold other members'
 * emails (forum_likes.user_email, community_event_reactions.user_email,
 * forum_posts.created_by and the rest; see src/lib/memberColumns.js). The
 * few features that asked "is this mine" or "who wrote this" now ask the
 * database instead, through the functions in
 * supabase/migrations/20261028020000_member_email_reads.sql, which answer
 * without handing anyone's address to the browser.
 *
 * The site can deploy before that migration runs. Each helper then falls
 * back to the old read, which still works until
 * supabase/pending/member_email_columns_revoke.sql is applied (3 days
 * after the migration, so the fallback is never needed by then).
 */
// Loaded on first use, not with the page (src/lib/supabaseLazy.js).
import { getSupabase } from '@/lib/supabaseLazy';

/** The function is not in this database yet (PostgREST and Postgres codes). */
export function isMissingFunction(error) {
  if (!error) return false;
  return error.code === 'PGRST202' || error.code === '42883'
    || /could not find the function/i.test(error.message || '');
}

const unique = (values) => [...new Set((values || []).filter((v) => v != null && v !== '').map(String))];

/**
 * The ids of the signed-in member's own rows in one of the tables whose
 * owner column is an email (my_row_ids). Resolves to null when the function
 * is not there yet, so the caller can use its old filter.
 */
export async function myRowIds(table, { client } = {}) {
  const db = client || await getSupabase();
  const { data, error } = await db.rpc('my_row_ids', { p_table: table });
  if (error) {
    if (isMissingFunction(error)) return null;
    throw error;
  }
  return unique(Array.isArray(data) ? data : []);
}

/**
 * Like counts and "liked by me" for forum posts and comments, as a Map of
 * target id to { count, liked }. Every id asked for is in the map.
 * `email` is the member's own address, used only by the fallback.
 */
export async function forumLikeState(targetIds, { email = null, client } = {}) {
  const ids = unique(targetIds);
  const state = new Map(ids.map((id) => [id, { count: 0, liked: false }]));
  if (ids.length === 0) return state;
  const db = client || await getSupabase();
  const { data, error } = await db.rpc('forum_like_state', { p_target_ids: ids });
  if (!error) {
    for (const row of Array.isArray(data) ? data : []) {
      state.set(String(row.target_id), { count: Number(row.like_count) || 0, liked: row.liked === true });
    }
    return state;
  }
  if (!isMissingFunction(error)) throw error;
  // Before the migration: the old read, which members can still make then.
  const { data: rows, error: readError } = await db
    .from('forum_likes')
    .select(email ? 'target_id, user_email' : 'target_id')
    .in('target_id', ids);
  if (readError) throw readError;
  for (const row of rows || []) {
    const entry = state.get(String(row.target_id));
    if (!entry) continue;
    entry.count += 1;
    if (email && row.user_email === email) entry.liked = true;
  }
  return state;
}

/** The key Live Feed uses for one event. */
export const reactionKey = (eventType, eventId) => `${eventType}:${eventId}`;

/**
 * Live Feed reactions: { [eventKey]: { [reaction]: { count, mine } } } for
 * the events given. `email` is the member's own address, used only by the
 * fallback; signed out, nothing is ever "mine".
 */
export async function reactionState(events, { email = null, client } = {}) {
  const types = unique((events || []).map((e) => e?.event_type));
  const ids = unique((events || []).map((e) => e?.event_id));
  const state = {};
  if (types.length === 0 || ids.length === 0) return state;
  const add = (type, id, reaction, count, mine) => {
    const key = reactionKey(type, id);
    const forEvent = (state[key] ||= {});
    const entry = (forEvent[reaction] ||= { count: 0, mine: false });
    entry.count += count;
    entry.mine = entry.mine || mine;
  };
  const db = client || await getSupabase();
  const { data, error } = await db.rpc('community_reaction_state', { p_event_types: types, p_event_ids: ids });
  if (!error) {
    for (const row of Array.isArray(data) ? data : []) {
      add(row.event_type, row.event_id, row.reaction, Number(row.reaction_count) || 0, row.mine === true);
    }
    return state;
  }
  if (!isMissingFunction(error)) throw error;
  const { data: rows, error: readError } = await db
    .from('community_event_reactions')
    .select(email ? 'event_type, event_id, user_email, reaction' : 'event_type, event_id, reaction')
    .in('event_type', types)
    .in('event_id', ids);
  if (readError) throw readError;
  for (const row of rows || []) {
    add(row.event_type, row.event_id, row.reaction, 1, Boolean(email) && row.user_email === email);
  }
  return state;
}

/**
 * Tell the author of the post (or of the comment being answered) about a
 * new forum comment. The database finds who to tell and checks the
 * comment is the caller's (notify_forum_thread_author). Until that function
 * exists, `legacy()` runs the old browser-side notification instead.
 * Resolves to true when a notification was written.
 */
export async function notifyForumThreadAuthor(commentId, { legacy, client } = {}) {
  if (!commentId) return false;
  const db = client || await getSupabase();
  const { data, error } = await db.rpc('notify_forum_thread_author', { p_comment_id: String(commentId) });
  if (!error) return data === true;
  if (isMissingFunction(error) && legacy) {
    await legacy();
    return true;
  }
  throw error;
}
