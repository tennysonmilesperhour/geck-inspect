/**
 * The healthy weight range for a crested gecko's age, drawn behind the
 * weight chart so "is 18 g normal at 8 months?" answers itself.
 *
 * The numbers are the care guide's (src/data/care-guide.js). Its Life Stages
 * table gives the pace: hatchlings up to 3 g by 3 months, juveniles 3 to 15 g
 * by 12 months, sub-adults 15 to 35 g by 18 months, and adults 35 to 60 g
 * (Overview). Real geckos run ahead of or behind that pace, so the band is
 * the guide's pace shifted up to three months either way:
 *
 *   lower edge: each stage boundary reached three months late
 *   upper edge: each stage boundary reached three months early, rising to
 *               the 60 g adult ceiling six months after adulthood
 *
 * Hatch weight is about 1.5 to 3 g. A test keeps these anchors and the guide
 * in step, so the chart can never disagree with the care guide.
 */
import { differenceInCalendarDays } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';

// Stage boundaries from the care guide's Life Stages table: [months, grams].
export const STAGE_PACE = [
  [3, 3],   // Hatchling: 0 to 3 g, 0 to 3 months
  [12, 15], // Juvenile: 3 to 15 g, 3 to 12 months
  [18, 35], // Sub-adult: 15 to 35 g, 12 to 18 months; adult from 18 months
];
export const ADULT_MIN_G = 35;
export const ADULT_MAX_G = 60;
export const HATCH_MIN_G = 1.5;
export const PACE_WINDOW_MONTHS = 3;

// Band edges as [months, grams] points, built from the anchors above.
export const LOWER_EDGE = [
  [0, HATCH_MIN_G],
  ...STAGE_PACE.map(([m, g]) => [m + PACE_WINDOW_MONTHS, g]),
];
export const UPPER_EDGE = [
  [0, STAGE_PACE[0][1]],
  ...STAGE_PACE.slice(1).map(([m, g]) => [m - PACE_WINDOW_MONTHS, g]),
  [STAGE_PACE[STAGE_PACE.length - 1][0] + 2 * PACE_WINDOW_MONTHS, ADULT_MAX_G],
];

// Days per average month, for fractional ages.
const DAYS_PER_MONTH = 30.4375;

function interpolate(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return points[points.length - 1][1];
}

const round1 = (value) => Math.round(value * 10) / 10;

/** Typical weight range at an age in months: { low, high } in grams. */
export function growthBandAt(ageMonths) {
  if (!Number.isFinite(ageMonths) || ageMonths < 0) return null;
  return {
    low: round1(interpolate(LOWER_EDGE, ageMonths)),
    high: round1(interpolate(UPPER_EDGE, ageMonths)),
  };
}

/** Age in months (fractional) on a date, from a YYYY-MM-DD hatch date. */
export function ageInMonths(hatchDate, onDate) {
  const hatch = hatchDate ? parseLocalDate(hatchDate) : null;
  const day = typeof onDate === 'string' ? parseLocalDate(onDate) : onDate;
  if (!hatch || !day || Number.isNaN(hatch.getTime()) || Number.isNaN(day.getTime())) return null;
  const days = differenceInCalendarDays(day, hatch);
  return days < 0 ? null : days / DAYS_PER_MONTH;
}

/** The band only applies to crested geckos with a known hatch date. */
export function hasGrowthBand(gecko) {
  const crested = !gecko?.species || gecko.species === 'Crested Gecko';
  return crested && Boolean(gecko?.hatch_date);
}

const ageLabel = (months) => {
  const whole = Math.round(months);
  if (whole < 1) return 'under a month';
  if (whole < 24) return `${whole} month${whole === 1 ? '' : 's'}`;
  const years = Math.floor(whole / 12);
  return `${years} years`;
};

/**
 * Where a weight sits against the band on a date.
 * @returns {null | { level: 'below'|'within'|'above', low, high, ageMonths, text }}
 */
export function growthVerdict(gecko, grams, onDate = new Date()) {
  if (!hasGrowthBand(gecko) || grams === null || grams === '' || !Number.isFinite(Number(grams))) return null;
  const age = ageInMonths(gecko.hatch_date, onDate);
  const band = growthBandAt(age);
  if (!band) return null;
  const weight = Number(grams);
  const range = `${band.low} to ${band.high} g`;
  const at = ageLabel(age);
  if (weight < band.low) {
    return {
      level: 'below', ...band, ageMonths: age,
      text: `${weight} g is below the typical ${range} for ${at}. Keep weighing weekly and check feeding and temperatures.`,
    };
  }
  if (weight > band.high) {
    return {
      level: 'above', ...band, ageMonths: age,
      text: age >= STAGE_PACE[STAGE_PACE.length - 1][0]
        ? `${weight} g is above the typical ${range} for an adult. Watch for fat pads and feed CGD three times a week.`
        : `${weight} g is ahead of the typical ${range} for ${at}. Fast growth is usually fine; just keep an eye on it.`,
    };
  }
  return { level: 'within', ...band, ageMonths: age, text: `${weight} g is within the typical ${range} for ${at}.` };
}

/**
 * Adds band: [low, high] to chart points ({ record_date, ... }) so the chart
 * can shade the healthy range behind the weight line.
 */
export function withGrowthBand(points, gecko) {
  if (!hasGrowthBand(gecko)) return points;
  return points.map((point) => {
    const band = growthBandAt(ageInMonths(gecko.hatch_date, point.record_date));
    return band ? { ...point, band: [band.low, band.high] } : point;
  });
}
