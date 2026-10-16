/**
 * Crested gecko husbandry numbers: the one place they are written down.
 *
 * Before October 2026 the care guide carried two life-stage weight scales
 * (its feeding table said hatchlings are 0 to 8 g, its life stages said 0
 * to 3 g), the incubation table and the app's hatch estimates used
 * different windows, and shed intervals were stated two ways. Everything
 * that states one of these numbers now reads it from here:
 *
 *   - the care guide (src/data/care-guide.js) builds its tables and quick
 *     facts from these values
 *   - life stages and weigh-in reminders (src/lib/lifeStage.js), the
 *     weight chart's healthy band (src/lib/growthBand.js), the shed
 *     forecast (src/lib/shedPrediction.js), breeding readiness
 *     (src/lib/breedingReadiness.js) and hatch estimates
 *     (src/lib/incubationProfiles.js)
 *
 * The weigh-in reminder job in the database cannot import JavaScript, so
 * a test compares its SQL with these numbers (src/lib/__tests__/
 * lifeStage.test.js), and scripts/check-genetics-consistency.mjs checks
 * the prose surfaces (keepers guides, blog, llms.txt, emails) against
 * them on every build.
 *
 * Keep this file dependency-free: Node build scripts import it.
 *
 * Where the hobby disagrees, the numbers are the conservative common
 * ground, and the care guide says so in words.
 */

// ---------- life stages --------------------------------------------------
// A stage ends at a weight OR an age, whichever comes later: a 20 g gecko
// that is 10 months old is still a juvenile, and so is a 10 g gecko at 14
// months. `maxGrams` and `maxMonths` are exclusive upper ends; the adult
// stage has none.
//
// shedWeeks: how often a healthy gecko of this stage usually sheds. Growth
// drives shedding, so young animals shed far more often.
// gainPerMonth: the usual healthy weight gain in grams a month. Real
// geckos vary a lot with temperature, diet and genetics; a gecko below the
// low end for two weigh-ins in a row is worth a husbandry check. Each
// range contains the pace the stage boundaries imply (a juvenile going
// from 3 to 15 g in 9 months gains about 1.3 g a month). Adults hold their
// weight instead (about 2 g either way month to month).
export const LIFE_STAGES = [
  { id: 'hatchling', label: 'Hatchling', plural: 'Hatchlings', maxGrams: 3, maxMonths: 3, shedWeeks: [1, 2], gainPerMonth: [0.5, 1.5] },
  { id: 'juvenile', label: 'Juvenile', plural: 'Juveniles', maxGrams: 15, maxMonths: 12, shedWeeks: [2, 3], gainPerMonth: [1, 4] },
  { id: 'subadult', label: 'Sub-adult', plural: 'Sub-adults', maxGrams: 35, maxMonths: 18, shedWeeks: [3, 4], gainPerMonth: [1, 4] },
  { id: 'adult', label: 'Adult', plural: 'Adults', maxGrams: null, maxMonths: null, shedWeeks: [4, 6], gainPerMonth: null },
];

/** How much a healthy adult's weight usually moves month to month (g). */
export const ADULT_MONTHLY_SWING_G = 2;

export const LIFE_STAGE_BY_ID = Object.fromEntries(LIFE_STAGES.map((s) => [s.id, s]));

/** Senior care starts here (years). */
export const SENIOR_YEARS = 10;

/** Typical weight at hatching, in grams. */
export const HATCH_WEIGHT_G = { min: 1.5, max: 3 };

/** Typical healthy adult weight, in grams. */
export const ADULT_WEIGHT_G = { min: 35, max: 60 };

/** Lifespan with good care, in years. */
export const LIFESPAN_YEARS = { min: 15, max: 20 };

// ---------- weigh-ins ----------------------------------------------------
// Days between the app's weigh-in reminders for each reminder stage.
// Hatchlings and juveniles share "growing". These are the reminder
// defaults, so they are the least often a keeper should weigh: the care
// guide suggests weekly for a new or struggling hatchling.
export const WEIGH_IN_DAYS = { growing: 14, subadult: 21, adult: 30 };

// ---------- breeding -----------------------------------------------------
// The female is the limiting factor. The app's readiness badge enforces
// femaleMin; femaleIdeal is the window most experienced breeders wait for.
export const BREEDING = {
  femaleMinGrams: 40,
  femaleMinMonths: 18,
  femaleIdealGrams: [45, 55],
  femaleIdealMonths: 24,
  maleMinGrams: [25, 30],
  maleMinMonths: 12,
  maleIdealGrams: 35,
  maleIdealMonths: 18,
  clutchEggs: 2,
  clutchEveryWeeks: [4, 6],
};

// ---------- incubation ---------------------------------------------------
// The three temperature ranges the app offers for hatch estimates and
// alerts (profiles.incubation_temperature_range stores the id). Days are
// counted from the lay date. alertDay is when the hatch alert starts; the
// database default for the balanced profile (65) matches.
//
// Above about 80°F (27°C) the hobby reports more deformed and weak
// hatchlings, so no profile goes there.
export const INCUBATION_MAX_SAFE_F = 80;
export const INCUBATION_MAX_SAFE_C = 27;

export const INCUBATION_PROFILES = [
  {
    id: 'cool',
    label: 'Cool and steady',
    fahrenheit: '68 to 71°F',
    celsius: '20 to 22°C',
    minDays: 90,
    maxDays: 120,
    estimatedDays: 105,
    alertDay: 85,
    summary: 'A slower incubation timeline with more time for development.',
    breederNote: 'Breeders often choose this range when they prefer a slower incubation. Hatchlings may emerge later, so steady conditions and patience matter.',
    guideNote: 'Slow. Many breeders report strong, vigorous hatchlings.',
  },
  {
    id: 'balanced',
    label: 'Balanced room temperature',
    fahrenheit: '72 to 75°F',
    celsius: '22 to 24°C',
    minDays: 70,
    maxDays: 90,
    estimatedDays: 80,
    alertDay: 65,
    summary: 'A common middle range that balances development time and predictability.',
    breederNote: 'Many crested gecko breeders use this range because it avoids pushing development while keeping the hatch window manageable.',
    guideNote: 'The hobby default. A predictable hatch window.',
  },
  {
    id: 'warm',
    label: 'Warm',
    fahrenheit: '76 to 78°F',
    celsius: '24 to 26°C',
    minDays: 60,
    maxDays: 75,
    estimatedDays: 68,
    alertDay: 55,
    summary: 'A faster timeline that calls for closer temperature monitoring.',
    breederNote: 'Warmer incubation can shorten development time. Stable control is especially important, and eggs should never be allowed to overheat.',
    guideNote: 'Faster. Hold it steady; a spike past 80°F (27°C) is the risk.',
  },
];

export const INCUBATION_BY_ID = Object.fromEntries(INCUBATION_PROFILES.map((p) => [p.id, p]));

/** Shortest and longest incubation across the profiles, in days. */
export const INCUBATION_DAYS = {
  min: Math.min(...INCUBATION_PROFILES.map((p) => p.minDays)),
  max: Math.max(...INCUBATION_PROFILES.map((p) => p.maxDays)),
};

// ---------- words ----------------------------------------------------------
// Plain-language renderings, so every surface says a number the same way.

/** "3 to 15 g", "under 3 g", "35 g+" */
export function stageGrams(id) {
  const index = LIFE_STAGES.findIndex((s) => s.id === id);
  const stage = LIFE_STAGES[index];
  if (!stage) return '';
  const from = index > 0 ? LIFE_STAGES[index - 1].maxGrams : 0;
  if (stage.maxGrams === null) return `${from} g+`;
  if (from === 0) return `under ${stage.maxGrams} g`;
  return `${from} to ${stage.maxGrams} g`;
}

/** "Hatchling (under 3 g)", "Adult (35 g+)" */
export function stageWithGrams(id) {
  const stage = LIFE_STAGE_BY_ID[id];
  return stage ? `${stage.label} (${stageGrams(id)})` : '';
}

/** "1 to 4 g a month" */
export function stageGainWords(id) {
  const stage = LIFE_STAGE_BY_ID[id];
  if (!stage?.gainPerMonth) return '';
  const [lo, hi] = stage.gainPerMonth;
  return `${lo} to ${hi} g a month`;
}

/** "3 to 12 months", "0 to 3 months", "18+ months" */
export function stageMonths(id) {
  const index = LIFE_STAGES.findIndex((s) => s.id === id);
  const stage = LIFE_STAGES[index];
  if (!stage) return '';
  const from = index > 0 ? LIFE_STAGES[index - 1].maxMonths : 0;
  if (stage.maxMonths === null) return `${from}+ months`;
  return `${from} to ${stage.maxMonths} months`;
}

/** "every 1 to 2 weeks" */
export function stageShedWords(id) {
  const stage = LIFE_STAGE_BY_ID[id];
  if (!stage) return '';
  const [lo, hi] = stage.shedWeeks;
  return `every ${lo} to ${hi} weeks`;
}

/** The whole shed rhythm in one sentence fragment, hatchling to adult. */
export function shedRhythmSentence() {
  const parts = LIFE_STAGES.map((s) => `${stageShedWords(s.id)} as ${s.id === 'adult' ? 'an adult' : `a ${s.label.toLowerCase()}`}`);
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** "40 g and 18 months" */
export function femaleMinimumWords() {
  return `${BREEDING.femaleMinGrams} g and ${BREEDING.femaleMinMonths} months`;
}

/** "25 to 30 g and 12 months" */
export function maleMinimumWords() {
  const [lo, hi] = BREEDING.maleMinGrams;
  return `${lo} to ${hi} g and ${BREEDING.maleMinMonths} months`;
}
