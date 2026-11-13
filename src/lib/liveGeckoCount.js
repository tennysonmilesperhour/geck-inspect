// How many live (not archived) geckos a member's collection holds, as My
// Geckos counts them: their own geckos plus collections shared with them
// (getVisibleGeckos in src/lib/geckoAccess.js). A head count, so no rows
// are downloaded.
//
// Morph ID uses it to tell a member who is really on step 1 of the guided
// first gecko from one with a flag left over from an earlier visit.
import { getAccessibleCollectionIds } from '@/lib/geckoAccess';

/**
 * @param {object} client - the Supabase client
 * @param {string} email - the member's email (the created_by of their geckos)
 * @returns {Promise<number|null>} null without an email; throws on a failed read
 */
export async function countLiveGeckos(client, email) {
  if (!email) return null;
  const ids = await getAccessibleCollectionIds();
  let query = client
    .from('geckos')
    .select('id', { count: 'exact', head: true })
    .or('archived.is.null,archived.eq.false');
  // No memberships yet: a new member's default collection is made with
  // their first gecko, so their own rows are found by owner_profile_id
  // (members cannot filter on created_by, an email; owner decision E16).
  if (ids.length > 0) {
    query = query.in('collection_id', ids);
  } else {
    const ownerId = await import('@/lib/ownerRows').then((m) => m.myProfileId()).catch(() => null);
    if (!ownerId) throw new Error('Your profile could not be read.');
    query = query.eq('owner_profile_id', ownerId);
  }
  const { count, error } = await query;
  if (error) throw error;
  return Number.isFinite(count) ? count : 0;
}
