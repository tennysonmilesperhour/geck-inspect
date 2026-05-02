import { format, parseISO, differenceInCalendarDays } from 'date-fns';

// `last_fed_date`, `archived_date`, etc. are stored as `YYYY-MM-DD` (Postgres
// `date` type, no timezone). Use the user's local timezone when reading and
// writing — saving via `toISOString()` produces a UTC date, which renders as
// "yesterday" for users east of UTC during the early-morning hours and as
// "tomorrow" for users west of UTC during the late-evening hours.

export function todayLocalISO() {
  return format(new Date(), 'yyyy-MM-dd');
}

// Parse a `YYYY-MM-DD` string as local midnight. `new Date('2026-05-02')`
// would parse as UTC midnight per the JS spec, which shifts the calendar
// day for any non-UTC user.
export function parseLocalDate(dateString) {
  if (!dateString) return null;
  return parseISO(dateString);
}

export function daysSinceLocal(dateString) {
  const d = parseLocalDate(dateString);
  if (!d) return null;
  return differenceInCalendarDays(new Date(), d);
}
