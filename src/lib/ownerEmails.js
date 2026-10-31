// Members' email addresses for admin lists, looked up by owner_profile_id.
// Rows that members read no longer carry another member's address
// (Part E item E1 4), so admin screens fill it in from read_profiles, which
// gives admins every address. Kept apart from adminData.js so the lazy
// Content moderation tab can use it without changing how AdminPanel is
// bundled.
import { supabase } from '@/lib/supabaseClient';

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
