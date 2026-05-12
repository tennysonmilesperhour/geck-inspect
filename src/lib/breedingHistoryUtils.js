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
 * Seasons are keyed on the BreedingPlan.breeding_season string
 * ("2024 Spring", etc.). If a plan has no stored season, or an egg has
 * no linked plan, we fall back to inferring the season from the lay date
 * with the exact same month rule Breeding.jsx uses ,  so everything in
 * the app groups under the same labels.
 *
 * Status values in the eggs table: Incubating | Hatched | Infertile | Slug | Stillbirth
 * "Failed" buckets Slug + Stillbirth together with Infertile, matching the
 * existing Hatchery summary (see components/breeding/Hatchery.jsx).
 */

import {
  inferSeasonLabel,
  parseSeasonLabel,
  compareSeasonLabels,
} from './seasons.js';

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
 * @param {Array}  params.eggs ,  Egg rows for this dam (status, lay_date, breeding_plan_id)
 * @param {Array}  [params.breedingPlans] ,  BreedingPlan rows (for breeding_season lookup)
 * @param {Array}  params.weightRecords ,  WeightRecord rows for this gecko
 * @param {string|Date|null} params.hatchDate ,  the gecko's hatch_date
 * @returns {Array<{
 *   seasonLabel: string,       // e.g. "2024 Spring"
 *   year: number|null,
 *   seasonName: string|null,   // "Spring" | "Summer" | "Fall" | "Winter"
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
  breedingPlans = [],
  weightRecords = [],
  hatchDate = null,
} = {}) {
  const dob = toDate(hatchDate);
  const planById = new Map();
  for (const plan of breedingPlans) {
    if (plan?.id) planById.set(plan.id, plan);
  }

  const byLabel = new Map();

  for (const egg of eggs) {
    if (!egg) continue;
    // NOTE: we keep archived eggs. In this codebase an egg is flagged
    // archived: true the moment it transitions out of "Incubating" , 
    // hatched, slug, infertile, and stillbirth all get archived
    // automatically (see EggDetailModal.handleSave and Hatchery.hand-
    // leMarkFailed). Skipping them here would erase almost every
    // resolved egg from the history, which is exactly the data we
    // want to show.
    const laid = toDate(egg.lay_date);
    if (!laid) continue;

    const plan = egg.breeding_plan_id ? planById.get(egg.breeding_plan_id) : null;
    const label = plan?.breeding_season || inferSeasonLabel(laid);
    if (!label) continue;

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
    compareSeasonLabels(a.seasonLabel, b.seasonLabel)
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

    const parsed = parseSeasonLabel(b.seasonLabel);

    return {
      seasonLabel: b.seasonLabel,
      year: parsed?.year ?? null,
      seasonName: parsed?.season ?? null,
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
 * Lifetime totals across all seasons ,  handy for the top-line summary
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
