/**
 * Morph Guide photo submissions (feature audit step 4, D3, 2 Oct 2026).
 *
 * Members submit photos of a morph from /MorphGuideSubmission, an admin
 * approves or rejects them in the Admin Panel, and approved photos show
 * on that morph's page (/MorphGuide/<slug>) with the member's name.
 *
 * `morph_reference_images.morph_guide_id` holds the built-in morph slug
 * (for example 'lilly-white'), so a photo always maps to one of the
 * morphs in src/data/morph-guide.js and to exactly one morph page. The
 * column is plain text with no foreign key, so no schema change was
 * needed for that.
 */
import { MORPHS, getMorph } from '@/data/morph-guide';
import { supabase } from '@/lib/supabaseClient';

export const CONTRIBUTOR_FALLBACK = 'a Geck Inspect member';

/** The built-in morphs, sorted by name, for the submission form. */
export function submissionMorphOptions() {
  return MORPHS.map((m) => ({ slug: m.slug, name: m.name })).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

/**
 * Name of the morph a submission is for. Older rows could hold a
 * morph_guides row id, so a lookup of those names can be passed in.
 */
export function submissionMorphName(morphGuideId, legacyNamesById = {}) {
  if (!morphGuideId) return 'Unknown morph';
  return getMorph(morphGuideId)?.name || legacyNamesById[morphGuideId] || 'Unknown morph';
}

/** Where a submission's notification should send the member. */
export function submissionMorphLink(morphGuideId) {
  return getMorph(morphGuideId) ? `/MorphGuide/${morphGuideId}` : '/MorphGuide';
}

/**
 * The notification row for an approve or reject decision. Approvals go to
 * the morph page where the photo now shows. Rejections get their own type
 * (so the title no longer says "Submission approved") and link back to
 * the submission form.
 */
export function reviewNotification(submission, action, morphName, reason = '') {
  const approved = action === 'approved';
  const why = reason && reason.trim() ? ` Reason: ${reason.trim()}` : '';
  return {
    user_email: submission.submitted_by_email,
    type: approved ? 'submission_approved' : 'submission_rejected',
    content: approved
      ? `Your ${morphName} photo is now on the ${morphName} page of the Morph Guide. Thank you!`
      : `Your ${morphName} photo was not added to the Morph Guide.${why}`,
    link: approved ? submissionMorphLink(submission.morph_guide_id) : '/MorphGuideSubmission',
  };
}

/** A display name to credit, never an email. */
export function contributorCredit(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed || trimmed.includes('@')) return CONTRIBUTOR_FALLBACK;
  return trimmed;
}

/**
 * Approved member photos for a morph page, read through the
 * morph_community_photos database function (it returns names, never
 * emails). Until that function exists, or on any error, this returns an
 * empty list so the page simply shows no member photos.
 */
export async function fetchMorphCommunityPhotos(slug, { limit = 12, client = supabase } = {}) {
  if (!slug || !client) return [];
  try {
    const { data, error } = await client.rpc('morph_community_photos', {
      p_slug: slug,
      p_limit: limit,
    });
    if (error || !Array.isArray(data)) return [];
    return data
      .filter((row) => row && row.image_url)
      .map((row) => ({
        id: `submission-${row.id}`,
        submission_id: row.id,
        image_url: row.image_url,
        credit: contributorCredit(row.contributor_name),
        // Profile id (never an email), so blocking and reporting can name
        // the contributor. Returned once the moderation migration is live.
        owner_profile_id: row.contributor_id || null,
      }));
  } catch {
    return [];
  }
}
