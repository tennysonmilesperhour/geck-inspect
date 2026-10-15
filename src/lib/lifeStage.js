// How often to weigh a crested gecko, from its life stage.
//
// The stages are the care guide's own (src/data/care-guide.js, "Life
// Stages"): hatchling 0 to 3 g, juvenile 3 to 15 g or up to 12 months,
// sub-adult 15 to 35 g or 12 to 18 months, adult 35 g and up and 18
// months and up. A test checks these numbers against the guide's text, so
// the two cannot drift apart.
//
// The weigh-in reminder job uses the same rule
// (public.weighin_interval_days in
// supabase/migrations/20261015151100_reminders_and_offline_logging.sql),
// with the same test cases in supabase/tests/logging_regressions.sql and
// src/lib/__tests__/lifeStage.test.js. Change all three together.

export const JUVENILE_MAX_GRAMS = 15;
export const JUVENILE_MAX_MONTHS = 12;
export const SUBADULT_MAX_GRAMS = 35;
export const SUBADULT_MAX_MONTHS = 18;

// Days between weigh-ins for each stage. Growing animals change fast, so
// every two weeks; sub-adults every three; adults hold their weight, so
// once a month is enough.
export const WEIGH_IN_DAYS = { growing: 14, subadult: 21, adult: 30 };

const pad = (n) => String(n).padStart(2, '0');

function parseDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function dayKey({ y, m, d }) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function localDay(date) {
  return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() };
}

/**
 * The calendar day `months` before `day`, the way Postgres does
 * `date - interval 'N months'`: the same day of the month, or the last
 * day of that month when it is shorter (31 Mar minus 1 month is 28 or 29
 * Feb).
 */
export function monthsBefore(day, months) {
  const total = day.y * 12 + (day.m - 1) - months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const lastDay = new Date(y, m, 0).getDate();
  return { y, m, d: Math.min(day.d, lastDay) };
}

/**
 * 'growing' (hatchling or juvenile), 'subadult' or 'adult'.
 *   weightGrams: the latest weight, or null
 *   hatchDate:   YYYY-MM-DD, or null
 *   today:       YYYY-MM-DD or a Date (defaults to now)
 * Nothing known counts as growing: most first geckos are bought young.
 */
export function lifeStage({ weightGrams = null, hatchDate = null, today = new Date() } = {}) {
  const grams = weightGrams === null || weightGrams === undefined || weightGrams === '' ? null : Number(weightGrams);
  const weight = Number.isFinite(grams) ? grams : null;
  const hatched = parseDay(hatchDate);
  const on = today instanceof Date ? localDay(today) : parseDay(today) || localDay(new Date());
  if (weight === null && !hatched) return 'growing';
  const hatchedAfter = (months) => hatched && dayKey(hatched) > dayKey(monthsBefore(on, months));
  if ((weight !== null && weight < JUVENILE_MAX_GRAMS) || hatchedAfter(JUVENILE_MAX_MONTHS)) return 'growing';
  if ((weight !== null && weight < SUBADULT_MAX_GRAMS) || hatchedAfter(SUBADULT_MAX_MONTHS)) return 'subadult';
  return 'adult';
}

/**
 * Days between weigh-ins for this gecko: 14 while growing, 21 as a
 * sub-adult, 30 as an adult. `gecko` is a geckos row (weight_grams,
 * hatch_date); pass `weightGrams` when a newer weigh-in is known.
 */
export function weighInIntervalDays(gecko, now = new Date(), { weightGrams } = {}) {
  return WEIGH_IN_DAYS[lifeStage({
    weightGrams: weightGrams !== undefined ? weightGrams : gecko?.weight_grams ?? null,
    hatchDate: gecko?.hatch_date || null,
    today: now,
  })];
}

/** Plain words for the cadence, for the reminder switches. */
export function weighInCadenceLabel(days) {
  if (days === WEIGH_IN_DAYS.growing) return 'every 2 weeks while growing';
  if (days === WEIGH_IN_DAYS.subadult) return 'every 3 weeks as a sub-adult';
  if (days === WEIGH_IN_DAYS.adult) return 'once a month as an adult';
  return `every ${days} days`;
}
