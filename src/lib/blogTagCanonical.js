/**
 * Blog tag pages that rank for a search a product page answers better.
 *
 * Search Console (weekly growth report, 12 Oct 2026) had /blog/tag/records
 * at position 10.4 for "gecko breeding records", the search
 * /breeding-records was built for. The tag page's canonical link names
 * that page, which asks search engines to show it instead, and the tag
 * page shows a box linking there so readers get the same choice.
 *
 * The blog is shelved (no new posts); this only points existing tag pages
 * at the right page.
 */
export const TAG_CANONICAL = {
  records: {
    path: '/breeding-records',
    title: 'Crested gecko breeding records',
    blurb: 'Pairings, clutches, egg-lay and hatch dates, and every hatchling linked back to its parents, in one log.',
    cta: 'Open the breeding records page',
  },
};

/** The page a tag's canonical should name, or null to keep the tag page. */
export function tagCanonicalTarget(slug) {
  return Object.prototype.hasOwnProperty.call(TAG_CANONICAL, slug) ? TAG_CANONICAL[slug] : null;
}
