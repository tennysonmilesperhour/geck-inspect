/**
 * Following, blocking and messaging another member by profile id.
 *
 * Since 15 Oct 2026 the database no longer gives one member another
 * member's email address (read_profiles returns it only to admins, or to a
 * caller who already passed that address). Follows, blocks and messages are
 * still stored by email, so these actions go through database functions
 * that take the profile id and look the address up on the server
 * (supabase/migrations/20261015130000_comms_and_exposure.sql). A new follow
 * also notifies the member from the database, with fixed wording.
 */
// Loaded on first use, not with the page (src/lib/supabaseLazy.js).
import { getSupabase } from '@/lib/supabaseLazy';

async function rpc(name, args, client) {
  const db = client || await getSupabase();
  const { data, error } = await db.rpc(name, args);
  if (error) throw error;
  return data;
}

/** The subset of these profile ids the signed-in member follows, as a Set of strings. */
export async function followedProfileIds(profileIds, { client } = {}) {
  const ids = [...new Set((profileIds || []).filter(Boolean).map(String))];
  if (ids.length === 0) return new Set();
  const rows = await rpc('follow_state', { p_profile_ids: ids }, client);
  // A setof text function comes back as plain strings.
  return new Set((rows || []).map((r) => String(typeof r === 'object' && r !== null ? Object.values(r)[0] : r)));
}

/** Follow (true) or unfollow (false). Resolves with the new state. */
export async function setFollow(profileId, follow, { client } = {}) {
  const state = await rpc('follow_profile', { p_profile_id: String(profileId), p_follow: Boolean(follow) }, client);
  return state === true;
}

/** Block a member: their posts, photos and listings are hidden and they cannot message you. */
export async function blockProfile(profileId, { client } = {}) {
  await rpc('block_profile', { p_profile_id: String(profileId) }, client);
}

/**
 * Send a message to a member you only know by profile id. Resolves with
 * the saved message row (it carries both addresses, as any message you
 * send does).
 */
export async function sendMessageToProfile(profileId, content, messageType = 'direct', { client } = {}) {
  return rpc('send_direct_message_to_profile', {
    p_profile_id: String(profileId),
    p_content: content,
    p_message_type: messageType,
  }, client);
}

/** The breeder page slug for a profile, or null. */
export async function breederSlugForProfile(profileId, { client } = {}) {
  if (!profileId) return null;
  const slug = await rpc('breeder_slug_for_profile', { p_profile_id: String(profileId) }, client);
  return typeof slug === 'string' && slug.trim() ? slug.trim() : null;
}

/**
 * What to tell a member whose message did not send. Since the October 2026 release
 * (supabase/migrations/20261015151000_followups.sql) the database only
 * accepts a member's message to someone with a public profile, the owner
 * of a public gecko, or someone who has messaged them, and caps new
 * conversations at 20 an hour. Those refusals get a plain explanation
 * instead of "please try again", which would never work.
 */
export function messageSendErrorText(error) {
  const code = error?.code;
  const message = String(error?.message || '');
  if (code === '54000' || /too many new conversations/i.test(message)) {
    return 'You have started a lot of new conversations in the last hour. Try again later.';
  }
  if (code === '42501' && /row-level security/i.test(message)) {
    return 'This member is not taking messages from new contacts. You can message members with a public profile, sellers with a public gecko, or anyone who has messaged you.';
  }
  // prevent_blocked_message: one of you has blocked the other.
  if (/conversation is unavailable/i.test(message)) {
    return 'This conversation is unavailable.';
  }
  return 'Failed to send message. Please try again.';
}
