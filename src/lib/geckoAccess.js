/**
 * geckoAccess — helpers for "geckos this user can see / edit."
 *
 * Background: every gecko belongs to exactly one collection (see
 * supabase/migrations/20260507_collections.sql). Ownership and
 * collaboration both run through the `collection_members` table — a
 * user owns a collection iff they have a role='owner' member row for
 * it, and they collaborate iff they have a role='editor' or 'viewer'
 * row with status='accepted'.
 *
 * Surfaces that should show "the user's collection plus anything
 * shared with them" go through `getVisibleGeckos`. Surfaces that
 * specifically need ONLY rows the user personally created (e.g.
 * MarketplaceSell, PaidTier gecko-count enforcement) keep filtering
 * by `created_by` directly.
 */
import { Gecko, CollectionMember } from '@/entities/all';

/**
 * Resolve every collection_id the caller can read (owner OR accepted
 * member). Returns an empty array if the user has no memberships,
 * which is correct for users who own no geckos and have no shares.
 *
 * RLS limits CollectionMember.filter() to rows where the caller is
 * either the collection owner or the member themselves, so we don't
 * need to pass an explicit email filter — but we do drop unaccepted
 * invitations so a pending viewer can't see geckos before clicking
 * the accept link.
 */
export async function getAccessibleCollectionIds() {
  try {
    const rows = await CollectionMember.filter({ status: 'accepted' });
    return Array.isArray(rows) ? rows.map((r) => r.collection_id) : [];
  } catch {
    return [];
  }
}

/**
 * Fetch every gecko the user can see (own + shared). Pass through
 * `extraFilter` for additional column constraints (e.g. archived,
 * sex, status); pagination args mirror Gecko.filter so call sites can
 * drop in.
 *
 * Returns [] for users with no memberships, which matches the old
 * `Gecko.filter({ created_by: missingEmail })` behavior.
 */
export async function getVisibleGeckos(user, extraFilter = {}, sort = '-created_date', limit = null, skip = null) {
  if (!user?.email) return [];
  const ids = await getAccessibleCollectionIds();
  if (ids.length === 0) {
    // User has no memberships at all — fall back to the email-key
    // path so very-new users (whose default collection is created on
    // first gecko insert) still see the geckos they just created
    // before the trigger fires.
    return Gecko.filter({ ...extraFilter, created_by: user.email }, sort, limit, skip);
  }
  return Gecko.filter(
    { ...extraFilter, collection_id: { $in: ids } },
    sort,
    limit,
    skip,
  );
}

/**
 * Boolean: can this user write to (edit / delete) the given gecko?
 * Mirrors the geckos UPDATE/DELETE RLS policy on the server. UI
 * affordances should call this to gray out edit buttons rather than
 * letting the user click and getting an RLS denial.
 */
export function canWriteGecko(gecko, user, memberships) {
  if (!gecko || !user?.email) return false;
  if (gecko.created_by && gecko.created_by.toLowerCase() === user.email.toLowerCase()) {
    return true;
  }
  const m = (memberships || []).find(
    (cm) =>
      cm.collection_id === gecko.collection_id &&
      cm.status === 'accepted' &&
      (cm.role === 'owner' || cm.role === 'editor'),
  );
  return !!m;
}

/**
 * Convenience: split a list of geckos into "owned by me" and
 * "shared with me" buckets. Useful for the MyGeckos UI where shared
 * geckos get a "Shared by X" badge and possibly a separate section.
 */
export function partitionGeckosByOwnership(geckos, user) {
  const owned = [];
  const shared = [];
  const email = user?.email?.toLowerCase();
  for (const g of geckos || []) {
    if (email && g.created_by && g.created_by.toLowerCase() === email) {
      owned.push(g);
    } else {
      shared.push(g);
    }
  }
  return { owned, shared };
}
