/**
 * Breeding-history aggregation for a single female.
 *
 * Given her eggs and weight records, rolls them up per calendar year so
 * the profile card / certificates can show at a glance:
 *
 *   - how many eggs she laid
 *   - how many were infertile or failed (slug / stillbirth / infertile)
 *   - how many successfully hatched
 *   - how old she was that season
 *   - which season of her breeding career it was (1st, 2nd, ...)
 *   - her weight range during that season
 *
 * Status values in the eggs table: Incubating | Hatched | Infertile | Slug | Stillbirth
 * "Failed" buckets Slug + Stillbirth together with Infertile, matching the
 * existing Hatchery summary (see components/breeding/Hatchery.jsx).
 */

const FAILED_STATUSES = new Set(['Infertile', 'Slug', 'Stillbirth']);

// Window around the first/last lay date we consider part of the season
// for weight-range purposes. A month either side captures the gravid
// buildup and post-lay recovery without spilling into the next season.
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
 * @param {Array}  params.eggs — Egg rows for this dam (any shape, needs status + lay_date)
 * @param {Array}  params.weightRecords — WeightRecord rows for this gecko
 * @param {string|Date|null} params.hatchDate — the gecko's hatch_date
 * @returns {Array<{
 *   year: number,
 *   ageYears: number|null,
 *   seasonNumber: number,
 *   eggsLaid: number,
 *   hatched: number,
 *   infertile: number,
 *   failed: number,   // slug + stillbirth
 *   failedOrInfertile: number,
 *   incubating: number,
 *   unknown: number,
 *   hatchRate: number|null,  // 0..1, null if no resolved eggs yet
 *   weightMin: number|null,
 *   weightMax: number|null,
 *   firstLayDate: string,
 *   lastLayDate: string,
 * }>}
 */
export function summarizeBreedingHistory({ eggs = [], weightRecords = [], hatchDate = null } = {}) {
  const dob = toDate(hatchDate);
  const byYear = new Map();

  for (const egg of eggs) {
    if (!egg || egg.archived) continue;
    const laid = toDate(egg.lay_date);
    if (!laid) continue;
    const year = laid.getFullYear();

    let bucket = byYear.get(year);
    if (!bucket) {
      bucket = {
        year,
        eggsLaid: 0,
        hatched: 0,
        infertile: 0,
        failed: 0,
        incubating: 0,
        unknown: 0,
        firstLay: laid,
        lastLay: laid,
      };
      byYear.set(year, bucket);
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

  const rows = Array.from(byYear.values()).sort((a, b) => a.year - b.year);

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

    // Age during this season: use the midpoint of the lay window.
    const midpoint = new Date((b.firstLay.getTime() + b.lastLay.getTime()) / 2);
    const ageYears = dob ? yearsBetween(dob, midpoint) : null;

    return {
      year: b.year,
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
 * Lifetime totals across all seasons — handy for the top-line summary
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
