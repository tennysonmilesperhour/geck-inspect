/**
 * Shed Forecast v1 (ROADMAP item 12).
 *
 * Pure heuristic for predicting a crested gecko's next shed window. No React,
 * no Supabase calls: the caller passes plain record arrays so this stays
 * unit-testable.
 *
 * Heuristic, documented for future tuning:
 *
 * Inputs
 *   - sheds:     ShedRecord rows (shed_records table), each with a `date`
 *                (YYYY-MM-DD). Order does not matter, we sort internally.
 *   - weights:   WeightRecord rows (weight_records table), each with
 *                `record_date` and `weight_grams`.
 *   - hatchDate: the gecko's hatch_date string, if known.
 *   - today:     injectable "now" for tests, defaults to the real today.
 *
 * Base interval
 *   - With 3 or more recorded sheds, use the median of the animal's own
 *     inter-shed intervals (median is robust to one missed log entry).
 *     The window is that median plus or minus ~15% (minimum 3 days).
 *   - Otherwise fall back to an age-based default. Juveniles (under ~12
 *     months old, or under ~15g if age is unknown) shed roughly every 2 to 3
 *     weeks, so the window is 14 to 21 days after the last shed. Adults shed
 *     roughly every 4 to 6 weeks, so 28 to 42 days.
 *
 * Adjustment
 *   - Recent weight gain above ~5% over roughly 30 days shortens the window
 *     by ~20%. Growth drives shedding: a Lilly White packing on grams will
 *     cycle faster than a settled adult Harlequin at a stable weight.
 *
 * Anchor
 *   - The window is anchored on the most recent recorded shed. With zero
 *     sheds logged (but a known hatch_date) we project the default cycle
 *     forward from today at low confidence.
 *   - If the computed window is already fully in the past (the animal is
 *     past due), we clamp it forward so the card still shows something
 *     actionable instead of a stale range.
 *
 * Output
 *   { windowStart: Date, windowEnd: Date, confidence: 'low'|'medium'|'high',
 *     basis: string }
 *   - confidence is 'high' only with 4 or more recorded sheds, 'medium' with
 *     exactly 3, and 'low' otherwise.
 *   - Returns null when there is no usable data at all (no shed records and
 *     no hatch_date), so the UI can simply render nothing.
 */
import {
  addDays,
  differenceInCalendarDays,
  differenceInMonths,
  format,
} from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';

const JUVENILE_MAX_MONTHS = 12;
const JUVENILE_MAX_GRAMS = 15;
const JUVENILE_WINDOW = { lo: 14, hi: 21, label: 'every 2 to 3 weeks' };
const ADULT_WINDOW = { lo: 28, hi: 42, label: 'every 4 to 6 weeks' };
const GROWTH_GAIN_THRESHOLD = 0.05; // 5% gain over ~30 days
const GROWTH_SHORTEN_FACTOR = 0.8; // shortens the window ~20%

function toValidDate(value) {
  const d = parseLocalDate(value);
  if (!d || Number.isNaN(d.getTime())) return null;
  return d;
}

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Fractional weight gain over roughly the last 30 days, or null when the
// weight log is too sparse or too stale to trust.
function recentGrowthRate(weights, today) {
  const recs = (weights || [])
    .map((w) => ({
      date: toValidDate(w.record_date || w.date),
      grams: Number(w.weight_grams ?? w.weight),
    }))
    .filter((r) => r.date && Number.isFinite(r.grams) && r.grams > 0)
    .sort((a, b) => a.date - b.date);
  if (recs.length < 2) return null;

  const latest = recs[recs.length - 1];
  // A weigh-in older than ~6 weeks tells us nothing about current growth.
  if (differenceInCalendarDays(today, latest.date) > 45) return null;

  // Baseline: the earlier record closest to 30 days before the latest one.
  const target = addDays(latest.date, -30);
  let baseline = null;
  let bestGap = Infinity;
  for (const r of recs.slice(0, -1)) {
    const gap = Math.abs(differenceInCalendarDays(r.date, target));
    if (gap < bestGap) {
      baseline = r;
      bestGap = gap;
    }
  }
  const span = differenceInCalendarDays(latest.date, baseline.date);
  // Under 2 weeks apart is too noisy, over ~2 months is no longer "recent".
  if (span < 14 || span > 60) return null;
  return (latest.grams - baseline.grams) / baseline.grams;
}

// Latest known weight in grams, or null.
function latestWeightGrams(weights) {
  const recs = (weights || [])
    .map((w) => ({
      date: toValidDate(w.record_date || w.date),
      grams: Number(w.weight_grams ?? w.weight),
    }))
    .filter((r) => r.date && Number.isFinite(r.grams) && r.grams > 0)
    .sort((a, b) => a.date - b.date);
  return recs.length > 0 ? recs[recs.length - 1].grams : null;
}

export function predictNextShed({
  sheds = [],
  weights = [],
  hatchDate = null,
  today = new Date(),
} = {}) {
  const now = toValidDate(today) || new Date();

  const shedDates = (sheds || [])
    .map((s) => toValidDate(s?.date ?? s?.shed_date ?? s))
    .filter(Boolean)
    .sort((a, b) => a - b);

  const hatched = toValidDate(hatchDate);
  if (shedDates.length === 0 && !hatched) return null;

  const shedCount = shedDates.length;
  const lastShed = shedCount > 0 ? shedDates[shedDates.length - 1] : null;

  // Life stage, used only when the animal lacks its own shed rhythm.
  const ageMonths = hatched ? differenceInMonths(now, hatched) : null;
  const grams = latestWeightGrams(weights);
  const isJuvenile =
    (ageMonths != null && ageMonths >= 0 && ageMonths < JUVENILE_MAX_MONTHS) ||
    (ageMonths == null && grams != null && grams < JUVENILE_MAX_GRAMS);
  const stage = isJuvenile ? JUVENILE_WINDOW : ADULT_WINDOW;
  const stageName = isJuvenile ? 'juvenile' : 'adult';

  // Base window offsets in days from the anchor date.
  let loDays;
  let hiDays;
  let basis;
  if (shedCount >= 3) {
    const intervals = [];
    for (let i = 1; i < shedDates.length; i++) {
      const gap = differenceInCalendarDays(shedDates[i], shedDates[i - 1]);
      if (gap > 0) intervals.push(gap);
    }
    if (intervals.length >= 2) {
      const med = Math.round(median(intervals));
      const spread = Math.max(3, Math.round(med * 0.15));
      loDays = med - spread;
      hiDays = med + spread;
      basis = `Based on ${shedCount} recorded sheds, median ${med} days apart`;
    }
  }
  if (loDays == null) {
    loDays = stage.lo;
    hiDays = stage.hi;
    basis =
      shedCount > 0
        ? `Based on ${shedCount} recorded shed${shedCount === 1 ? '' : 's'}, using a typical ${stageName} cycle (${stage.label})`
        : `No sheds logged yet, projecting a typical ${stageName} cycle (${stage.label}) from today`;
  }

  // Growth adjustment: fast-growing geckos cycle sooner.
  const growth = recentGrowthRate(weights, now);
  if (growth != null && growth > GROWTH_GAIN_THRESHOLD) {
    loDays = Math.max(1, Math.round(loDays * GROWTH_SHORTEN_FACTOR));
    hiDays = Math.max(loDays + 1, Math.round(hiDays * GROWTH_SHORTEN_FACTOR));
    basis += ', shortened for recent weight gain';
  }

  const anchor = lastShed || now;
  let windowStart = addDays(anchor, loDays);
  let windowEnd = addDays(anchor, hiDays);

  // Past-due clamp: keep the window actionable instead of stale.
  if (windowEnd < now) {
    windowStart = now;
    windowEnd = addDays(now, Math.max(3, hiDays - loDays));
  } else if (windowStart < now) {
    windowStart = now;
  }

  let confidence = 'low';
  if (shedCount >= 4) confidence = 'high';
  else if (shedCount === 3) confidence = 'medium';

  return { windowStart, windowEnd, confidence, basis };
}

// Tiny display helper for the UI: "Jun 14 to 21" or "Jun 28 to Jul 4".
export function formatShedWindow(prediction) {
  if (!prediction) return '';
  const { windowStart, windowEnd } = prediction;
  const sameMonth =
    windowStart.getMonth() === windowEnd.getMonth() &&
    windowStart.getFullYear() === windowEnd.getFullYear();
  const start = format(windowStart, 'MMM d');
  const end = sameMonth ? format(windowEnd, 'd') : format(windowEnd, 'MMM d');
  return `${start} to ${end}`;
}
