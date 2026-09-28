/**
 * Breeding readiness for crested gecko females, from her latest weight and
 * her age.
 *
 * The numbers are the care guide's (src/data/care-guide.js, Breeding >
 * Breeding readiness): a first season needs at least 40 g and 18 months,
 * and the ideal window is 45 to 55 g at 24 months or more. A test keeps
 * these constants and the guide in step, so the badge can never give
 * different advice than the guide.
 *
 * The female is the limiting factor, so only females get a verdict. Breeding
 * one too early is the most common way keepers lose a female (egg-binding,
 * calcium loss), so "not yet" and "nearly" say exactly what is missing.
 */
import { differenceInCalendarDays, differenceInMonths } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';

export const FEMALE_MIN_WEIGHT_G = 40;
export const FEMALE_MIN_AGE_MONTHS = 18;
export const FEMALE_IDEAL_WEIGHT_G = 45;
export const FEMALE_IDEAL_AGE_MONTHS = 24;

// "Nearly" means within about one season's growth of both minimums.
const NEAR_WEIGHT_G = 35;
const NEAR_AGE_MONTHS = 15;

// A weight older than this may no longer be true; ask for a fresh one.
export const STALE_WEIGHT_DAYS = 60;

export const READINESS_LABELS = {
  ideal: 'Breeding ready',
  ready: 'Breeding ready',
  nearly: 'Nearly ready',
  not_yet: 'Not ready yet',
  unknown: 'Readiness unknown',
};

/** Latest weight for a gecko: newest weigh-in, else the weight on its record (undated). */
export function latestWeightOf(gecko, weightRecords = []) {
  const own = (weightRecords || [])
    .filter((record) => record.gecko_id === gecko?.id && Number.isFinite(Number(record.weight_grams)))
    .sort((a, b) => String(b.record_date || '').localeCompare(String(a.record_date || '')));
  if (own.length > 0) return { grams: Number(own[0].weight_grams), date: own[0].record_date || null };
  const onRecord = Number(gecko?.weight_grams);
  return Number.isFinite(onRecord) && onRecord > 0 ? { grams: onRecord, date: null } : { grams: null, date: null };
}

function isCrested(gecko) {
  return !gecko?.species || gecko.species === 'Crested Gecko';
}

const grams = (value) => `${Math.round(value * 10) / 10} g`;
const months = (value) => `${value} month${value === 1 ? '' : 's'}`;

/**
 * @param {object} gecko - needs sex, species, hatch_date
 * @param {{ grams: number|null, date: string|null }} weight - from latestWeightOf
 * @param {Date} [now]
 * @returns {null | {
 *   level: 'ideal'|'ready'|'nearly'|'not_yet'|'unknown',
 *   label: string, reason: string, stale: boolean,
 *   weightGrams: number|null, ageMonths: number|null, daysSinceWeighed: number|null,
 * }} null when the rule does not apply (not a crested gecko female)
 */
export function femaleReadiness(gecko, weight, now = new Date()) {
  if (!gecko || gecko.sex !== 'Female' || !isCrested(gecko)) return null;

  const hatched = parseLocalDate(gecko.hatch_date);
  const ageMonths = hatched ? differenceInMonths(now, hatched) : null;
  const weightGrams = weight?.grams ?? null;
  const weighedOn = parseLocalDate(weight?.date);
  const daysSinceWeighed = weighedOn ? differenceInCalendarDays(now, weighedOn) : null;
  const stale = weightGrams != null && (daysSinceWeighed == null || daysSinceWeighed > STALE_WEIGHT_DAYS);
  const result = (level, reason) => ({
    level, label: READINESS_LABELS[level], reason, stale, weightGrams, ageMonths, daysSinceWeighed,
  });
  const minimum = `The care guide minimum is ${FEMALE_MIN_WEIGHT_G} g and ${FEMALE_MIN_AGE_MONTHS} months.`;

  if (weightGrams == null) {
    return result('unknown', `Log a weight to check readiness. ${minimum}`);
  }
  if (ageMonths == null) {
    if (weightGrams < NEAR_WEIGHT_G) {
      return result('not_yet', `${grams(weightGrams)}. ${minimum}`);
    }
    return result('unknown', `${grams(weightGrams)}, but her age decides too. Add a hatch date. ${minimum}`);
  }

  const weightOk = weightGrams >= FEMALE_MIN_WEIGHT_G;
  const ageOk = ageMonths >= FEMALE_MIN_AGE_MONTHS;
  const current = `${grams(weightGrams)} at ${months(ageMonths)}`;
  if (weightOk && ageOk) {
    if (weightGrams >= FEMALE_IDEAL_WEIGHT_G && ageMonths >= FEMALE_IDEAL_AGE_MONTHS) {
      return result('ideal', `${current}, in the ideal window (${FEMALE_IDEAL_WEIGHT_G} g or more at ${FEMALE_IDEAL_AGE_MONTHS} months or more).`);
    }
    return result('ready', `${current}, past the ${FEMALE_MIN_WEIGHT_G} g and ${FEMALE_MIN_AGE_MONTHS} month minimum. Ideal is ${FEMALE_IDEAL_WEIGHT_G} to 55 g at ${FEMALE_IDEAL_AGE_MONTHS} months or more.`);
  }

  const missing = [
    weightOk ? null : `${grams(FEMALE_MIN_WEIGHT_G - weightGrams)} more weight`,
    ageOk ? null : `${months(FEMALE_MIN_AGE_MONTHS - ageMonths)} more age`,
  ].filter(Boolean).join(' and ');
  const nearly = weightGrams >= NEAR_WEIGHT_G && ageMonths >= NEAR_AGE_MONTHS;
  return result(nearly ? 'nearly' : 'not_yet', `${current}. Needs ${missing}. ${minimum}`);
}

// Levels worth a badge on a collection card. "Not yet" on every juvenile
// would be noise; the gecko page and the pairing dialogs say it instead.
const CARD_LEVELS = new Set(['ideal', 'ready', 'nearly']);
const CARD_HIDDEN_STATUSES = new Set(['Pet', 'Sold']);

export function showReadinessOnCard(gecko, readiness) {
  return !!readiness && !gecko?.archived && !CARD_HIDDEN_STATUSES.has(gecko?.status) && CARD_LEVELS.has(readiness.level);
}

/** Readiness straight from a gecko and the weigh-ins already loaded for it. */
export function readinessFor(gecko, weightRecords = [], now = new Date()) {
  return femaleReadiness(gecko, latestWeightOf(gecko, weightRecords), now);
}
