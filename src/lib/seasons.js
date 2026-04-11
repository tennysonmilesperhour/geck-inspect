/**
 * Breeding-season helpers
 *
 * A "season" is a calendar quarter we use for planning future breeding
 * pairings. The actual biological breeding season varies by region, so
 * we use a simple meteorological quarter split and let the user pick
 * whichever quarter matches their plan.
 *
 *   spring -> Mar 1  – May 31
 *   summer -> Jun 1  – Aug 31
 *   fall   -> Sep 1  – Nov 30
 *   winter -> Dec 1  – Feb 28/29 (of the NEXT calendar year for dec,
 *             same calendar year for jan/feb — but we anchor winter to
 *             the Dec–Feb span that BEGINS in the target year)
 */

export const SEASONS = ['spring', 'summer', 'fall', 'winter'];

export const SEASON_LABELS = {
  spring: 'Spring',
  summer: 'Summer',
  fall: 'Fall',
  winter: 'Winter',
};

/**
 * Returns a { start, end, label } object for the given season/year,
 * where start/end are Date objects at the boundaries of the window.
 */
export function computeSeasonWindow(season, year) {
  if (!season || !year) return null;
  switch (season) {
    case 'spring':
      return {
        start: new Date(year, 2, 1),
        end: new Date(year, 5, 0, 23, 59, 59),
        label: `Mar 1 – May 31, ${year}`,
      };
    case 'summer':
      return {
        start: new Date(year, 5, 1),
        end: new Date(year, 8, 0, 23, 59, 59),
        label: `Jun 1 – Aug 31, ${year}`,
      };
    case 'fall':
      return {
        start: new Date(year, 8, 1),
        end: new Date(year, 11, 0, 23, 59, 59),
        label: `Sep 1 – Nov 30, ${year}`,
      };
    case 'winter':
      // Winter spans Dec of the target year through Feb of the next year.
      return {
        start: new Date(year, 11, 1),
        end: new Date(year + 1, 2, 0, 23, 59, 59),
        label: `Dec 1, ${year} – Feb ${new Date(year + 1, 2, 0).getDate()}, ${year + 1}`,
      };
    default:
      return null;
  }
}

/**
 * Returns 'future' | 'active' | 'past' based on current time.
 */
export function seasonStatus(season, year, now = new Date()) {
  const window = computeSeasonWindow(season, year);
  if (!window) return 'future';
  if (now < window.start) return 'future';
  if (now > window.end) return 'past';
  return 'active';
}
