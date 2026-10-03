/**
 * Unlisting a gecko (feature audit step 30, 3 Oct 2026).
 *
 * A listing is a gecko whose status is 'For Sale'. When it was listed, the
 * database saved the status it had before in geckos.status_before_listing
 * (migration 20261003030318_listing_keeps_prior_status.sql). Unlist puts
 * that status back instead of setting 'Pet', so a Holdback or a Proven
 * female keeps what she was.
 */

/** The statuses a gecko can go back to when it leaves the marketplace. */
export const UNLISTED_STATUSES = ['Pet', 'Future Breeder', 'Holdback', 'Ready to Breed', 'Proven'];

/** The status Unlist restores, or null when it is not known (listed before 3 Oct 2026). */
export function statusAfterUnlist(gecko) {
  const previous = gecko?.status_before_listing;
  return UNLISTED_STATUSES.includes(previous) ? previous : null;
}

/** The update Unlist sends: off the marketplace, back to the chosen status. */
export function unlistPatch(status) {
  if (!UNLISTED_STATUSES.includes(status)) throw new Error('Choose the status this gecko goes back to.');
  return { status, is_public: false };
}
