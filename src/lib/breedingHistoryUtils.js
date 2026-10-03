/**
 * Breeding-history aggregation for a single female.
 *
 * Given her eggs, her breeding plans, and weight records, rolls them up
 * per breeding season so the profile card / certificates can show at a
 * glance:
 *
 *   - how many eggs she laid
 *   - how many were infertile or failed (slug / stillbirth / infertile)
 *   - how many successfully hatched
 *   - how old she was that season
 *   - which season of her breeding career it was (1st, 2nd, ...)
 *   - her weight range during that season
 *
 * A season is the calendar year the egg was laid in (decision D17), so
 * "2026" covers every egg laid from Jan 1 to Dec 31, 2026. Older plans
 * stored quarter labels such as "2026 Spring"; they no longer split a
 * year into several rows.
 *
 * Status values in the eggs table: Incubating | Hatched | Infertile | Slug | Stillbirth
 * "Failed" buckets Slug + Stillbirth together with Infertile, matching the
 * existing Hatchery summary (see components/breeding/Hatchery.jsx).
 */

import { seasonYearOf } from './seasons.js';

// Window around the first/last lay date we use for weight-range purposes.
// A month either side captures the gravid buildup and post-lay recovery
// without spilling into the next season.
const SEASON_PAD_DAYS = 30;

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function yearsBetween(from, to) {
  if (!from || !to) return null;
  const diffMs = to.getTime() - from.getTime();
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
}

/**
 * Aggregate a female's eggs + weights into one row per breeding season.
 *
 * @param {object} params
 * @param {Array}  params.eggs, Egg rows for this dam (status, lay_date, breeding_plan_id)
 * @param {Array}  [params.breedingPlans], BreedingPlan rows (accepted for older callers; the year comes from the lay date)
 * @param {Array}  params.weightRecords, WeightRecord rows for this gecko
 * @param {string|Date|null} params.hatchDate, the gecko's hatch_date
 * @returns {Array<{
 *   seasonLabel: string,       // the calendar year, e.g. "2026"
 *   year: number|null,
 *   seasonName: null,          // kept for older callers; seasons are years now
 *   ageYears: number|null,
 *   seasonNumber: number,      // 1st breeding season, 2nd, ...
 *   eggsLaid: number,
 *   hatched: number,
 *   infertile: number,
 *   failed: number,
 *   failedOrInfertile: number,
 *   incubating: number,
 *   unknown: number,
 *   hatchRate: number|null,
 *   weightMin: number|null,
 *   weightMax: number|null,
 *   firstLayDate: string,
 *   lastLayDate: string,
 * }>}
 */
export function summarizeBreedingHistory({
  eggs = [],
  weightRecords = [],
  hatchDate = null,
} = {}) {
  const dob = toDate(hatchDate);

  const byLabel = new Map();

  for (const egg of eggs) {
    if (!egg) continue;
    // NOTE: we keep archived eggs. In this codebase an egg is flagged
    // archived: true the moment it transitions out of "Incubating",
    // hatched, slug, infertile, and stillbirth all get archived
    // automatically (see EggDetailModal.handleSave and Hatchery.hand-
    // leMarkFailed). Skipping them here would erase almost every
    // resolved egg from the history, which is exactly the data we
    // want to show.
    const laid = toDate(egg.lay_date);
    if (!laid) continue;

    const year = seasonYearOf(egg.lay_date);
    if (!year) continue;
    const label = String(year);

    let bucket = byLabel.get(label);
    if (!bucket) {
      bucket = {
        seasonLabel: label,
        eggsLaid: 0,
        hatched: 0,
        infertile: 0,
        failed: 0,
        incubating: 0,
        unknown: 0,
        firstLay: laid,
        lastLay: laid,
      };
      byLabel.set(label, bucket);
    }

    bucket.eggsLaid += 1;
    if (laid < bucket.firstLay) bucket.firstLay = laid;
    if (laid > bucket.lastLay) bucket.lastLay = laid;

    const status = egg.status;
    if (status === 'Hatched') bucket.hatched += 1;
    else if (status === 'Infertile') bucket.infertile += 1;
    else if (status === 'Slug' || status === 'Stillbirth') bucket.failed += 1;
    else if (status === 'Incubating') bucket.incubating += 1;
    else bucket.unknown += 1;
  }

  // Sort oldest-first so seasonNumber ordinals line up chronologically.
  const rows = Array.from(byLabel.values()).sort((a, b) =>
    Number(a.seasonLabel) - Number(b.seasonLabel)
  );

  return rows.map((b, idx) => {
    const windowStart = addDays(b.firstLay, -SEASON_PAD_DAYS);
    const windowEnd = addDays(b.lastLay, SEASON_PAD_DAYS);

    let weightMin = null;
    let weightMax = null;
    for (const w of weightRecords) {
      const d = toDate(w?.record_date);
      if (!d || d < windowStart || d > windowEnd) continue;
      const grams = Number(w.weight_grams);
      if (!Number.isFinite(grams)) continue;
      if (weightMin == null || grams < weightMin) weightMin = grams;
      if (weightMax == null || grams > weightMax) weightMax = grams;
    }

    const resolved = b.hatched + b.infertile + b.failed;
    const hatchRate = resolved > 0 ? b.hatched / resolved : null;

    // Age during this season: midpoint of the lay window.
    const midpoint = new Date((b.firstLay.getTime() + b.lastLay.getTime()) / 2);
    const ageYears = dob ? yearsBetween(dob, midpoint) : null;

    return {
      seasonLabel: b.seasonLabel,
      year: Number(b.seasonLabel),
      seasonName: null,
      ageYears,
      seasonNumber: idx + 1,
      eggsLaid: b.eggsLaid,
      hatched: b.hatched,
      infertile: b.infertile,
      failed: b.failed,
      failedOrInfertile: b.infertile + b.failed,
      incubating: b.incubating,
      unknown: b.unknown,
      hatchRate,
      weightMin,
      weightMax,
      firstLayDate: b.firstLay.toISOString().slice(0, 10),
      lastLayDate: b.lastLay.toISOString().slice(0, 10),
    };
  });
}

/**
 * Lifetime totals across all seasons, handy for the top-line summary
 * on the profile card and on certificates.
 */
export function breedingHistoryTotals(rows = []) {
  const totals = rows.reduce(
    (acc, r) => {
      acc.seasons += 1;
      acc.eggsLaid += r.eggsLaid;
      acc.hatched += r.hatched;
      acc.failedOrInfertile += r.failedOrInfertile;
      acc.incubating += r.incubating;
      return acc;
    },
    { seasons: 0, eggsLaid: 0, hatched: 0, failedOrInfertile: 0, incubating: 0 }
  );
  const resolved = totals.hatched + totals.failedOrInfertile;
  totals.hatchRate = resolved > 0 ? totals.hatched / resolved : null;
  return totals;
}
