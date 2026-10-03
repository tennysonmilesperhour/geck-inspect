// Server-side filters for the Morph ID expert review queue (audit step 29).
//
// The queue used to load every unverified gecko_images row 100 at a time
// and filter in the browser. Most of those rows were scraped listing
// photos, so a page could filter down to nothing and the queue looked
// empty with work left. Now the database does the filtering: only member
// submissions (a signed-in member sent the photo from Morph ID, which
// stamps training_meta.provenance and user_id), not rejected, and not
// already voted on by this reviewer. Pages are keyed on created_date so
// approving or rejecting an item never shifts the next page.

export const MEMBER_PROVENANCES = ['community', 'ai_then_expert'];

export const REVIEW_QUEUE_COLUMNS =
  'id, image_url, user_id, primary_morph, secondary_morph, secondary_traits, base_color, pattern_intensity, white_amount, fired_state, age_estimate, confidence_score, notes, verified, training_meta, created_date';

/**
 * Apply the member-submission filters to a gecko_images query builder.
 * `excludeIds` are rows this reviewer already voted on.
 */
export function applyReviewQueueFilters(query, { excludeIds = [] } = {}) {
  let q = query
    .eq('verified', false)
    .not('user_id', 'is', null)
    .in('training_meta->>provenance', MEMBER_PROVENANCES)
    .or('training_meta->>review_status.is.null,training_meta->>review_status.neq.rejected');
  // gecko_images.id is text; keep only plain id characters so the list
  // cannot break out of the PostgREST in() syntax.
  const ids = excludeIds.map(String).filter((id) => /^[0-9a-zA-Z_-]+$/.test(id));
  if (ids.length > 0) q = q.not('id', 'in', `(${ids.map((id) => `"${id}"`).join(',')})`);
  return q;
}

/**
 * Build one page of the queue. `after` is the created_date of the last
 * row already loaded (keyset paging); omit it for the first page.
 */
export function buildReviewQueuePage(supabase, {
  sort = 'newest',
  pageSize = 50,
  after = null,
  excludeIds = [],
} = {}) {
  const ascending = sort === 'oldest';
  let q = applyReviewQueueFilters(
    supabase.from('gecko_images').select(REVIEW_QUEUE_COLUMNS),
    { excludeIds },
  );
  if (after) q = ascending ? q.gt('created_date', after) : q.lt('created_date', after);
  return q.order('created_date', { ascending }).limit(pageSize);
}

/** Count of member submissions still waiting for this reviewer. */
export function buildReviewQueueCount(supabase, { excludeIds = [] } = {}) {
  return applyReviewQueueFilters(
    supabase.from('gecko_images').select('id', { count: 'exact', head: true }),
    { excludeIds },
  );
}
