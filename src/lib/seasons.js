/**
 * Breeding-season helpers
 *
 * A "season" is a calendar quarter we use for planning future breeding
 * pairings. The actual biological breeding season varies by region, so
 * we use a simple meteorological quarter split and let the user pick
 * whichever quarter matches their plan.
 *
 *   spring -> Mar 1 – May 31
 *   summer -> Jun 1 – Aug 31
 *   fall   -> Sep 1 – Nov 30
 *   winter -> Dec 1 – Feb 28/29
 *
 * THE WINTER RULE (canon): a winter belongs to the calendar year it
 * ENDS in. "2027 Winter" means Dec 1, 2026 through the end of Feb
 * 2027. Every helper in this file (window math, status checks, label
 * inference) follows that one rule, so
 * seasonStatus(inferSeasonLabel(date)) is always 'active' at `date`.
 * It also means a December clutch and the following January clutch
 * share one season label, which is how breeders think about a winter.
 * (Historical note: window math used to anchor winter to the year it
 * STARTS in while labels anchored Jan/Feb to their own year, so a
 * January record could report its own season as 'future'.)
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
      // Winter belongs to the year it ENDS in: "<year> Winter" spans
      // Dec 1 of the previous year through the end of Feb of `year`.
      return {
        start: new Date(year - 1, 11, 1),
        end: new Date(year, 2, 0, 23, 59, 59),
        label: `Dec 1, ${year - 1} – Feb ${new Date(year, 2, 0).getDate()}, ${year}`,
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

// ---------------------------------------------------------------------------
// Stored-season helpers
//
// BreedingPlan.breeding_season is stored as "<year> <Season>", e.g.
// "2024 Spring", "2024 Summer", "2024 Fall", "2024 Winter", by
// Breeding.jsx's getCurrentSeason(). When we need to group eggs or
// plans whose breeding_season field is blank, we fall back to inferring
// from a date with the exact same rule:
//
//   Mar-May  -> Spring
//   Jun-Aug  -> Summer
//   Sep-Nov  -> Fall
//   Dec/Jan/Feb -> Winter
//
// Winter follows THE WINTER RULE from the file header: it belongs to
// the year it ends in. Jan 2027 -> "2027 Winter" and Dec 2026 ->
// "2027 Winter" (same season, one label), matching
// computeSeasonWindow('winter', 2027) exactly.
// ---------------------------------------------------------------------------

const SEASON_NAME_BY_MONTH = [
  'Winter', 'Winter',           // Jan, Feb
  'Spring', 'Spring', 'Spring', // Mar, Apr, May
  'Summer', 'Summer', 'Summer', // Jun, Jul, Aug
  'Fall',   'Fall',   'Fall',   // Sep, Oct, Nov
  'Winter',                     // Dec
];

/**
 * Infer the "<year> <Season>" label from any Date (or ISO string).
 * Returns null for invalid input.
 */
export function inferSeasonLabel(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  // December belongs to the NEXT year's winter (see THE WINTER RULE).
  const year = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
  return `${year} ${SEASON_NAME_BY_MONTH[d.getMonth()]}`;
}

/** "<year> <Season>" for right now. */
export function currentSeasonLabel(now = new Date()) {
  return inferSeasonLabel(now);
}

/**
 * Parse a stored label into { year, season }, where `season` is the
 * capitalized name ('Spring' | 'Summer' | 'Fall' | 'Winter') and `year`
 * is a number. Returns null if the input doesn't parse.
 */
export function parseSeasonLabel(label) {
  if (!label || typeof label !== 'string') return null;
  const m = label.trim().match(/^(\d{4})\s+(Spring|Summer|Fall|Winter)$/i);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const season = m[2][0].toUpperCase() + m[2].slice(1).toLowerCase();
  return { year, season };
}

/**
 * Chronological sort comparator for "<year> <Season>" labels.
 * Unknown / malformed labels sort to the end.
 */
export function compareSeasonLabels(a, b) {
  const pa = parseSeasonLabel(a);
  const pb = parseSeasonLabel(b);
  if (!pa && !pb) return 0;
  if (!pa) return 1;
  if (!pb) return -1;
  if (pa.year !== pb.year) return pa.year - pb.year;
  const order = { Winter: 0, Spring: 1, Summer: 2, Fall: 3 };
  return order[pa.season] - order[pb.season];
}
