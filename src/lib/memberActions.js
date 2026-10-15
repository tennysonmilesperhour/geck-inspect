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
import { supabase } from '@/lib/supabaseClient';

async function rpc(name, args, client = supabase) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return data;
}

/** The subset of these profile ids the signed-in member follows, as a Set of strings. */
export async function followedProfileIds(profileIds, { client = supabase } = {}) {
  const ids = [...new Set((profileIds || []).filter(Boolean).map(String))];
  if (ids.length === 0) return new Set();
  const rows = await rpc('follow_state', { p_profile_ids: ids }, client);
  // A setof text function comes back as plain strings.
  return new Set((rows || []).map((r) => String(typeof r === 'object' && r !== null ? Object.values(r)[0] : r)));
}

/** Follow (true) or unfollow (false). Resolves with the new state. */
export async function setFollow(profileId, follow, { client = supabase } = {}) {
  const state = await rpc('follow_profile', { p_profile_id: String(profileId), p_follow: Boolean(follow) }, client);
  return state === true;
}

/** Block a member: their posts, photos and listings are hidden and they cannot message you. */
export async function blockProfile(profileId, { client = supabase } = {}) {
  await rpc('block_profile', { p_profile_id: String(profileId) }, client);
}

/**
 * Send a message to a member you only know by profile id. Resolves with
 * the saved message row (it carries both addresses, as any message you
 * send does).
 */
export async function sendMessageToProfile(profileId, content, messageType = 'direct', { client = supabase } = {}) {
  return rpc('send_direct_message_to_profile', {
    p_profile_id: String(profileId),
    p_content: content,
    p_message_type: messageType,
  }, client);
}

/** The breeder page slug for a profile, or null. */
export async function breederSlugForProfile(profileId, { client = supabase } = {}) {
  if (!profileId) return null;
  const slug = await rpc('breeder_slug_for_profile', { p_profile_id: String(profileId) }, client);
  return typeof slug === 'string' && slug.trim() ? slug.trim() : null;
}
