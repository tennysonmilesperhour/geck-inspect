import { format, parseISO, differenceInCalendarDays, differenceInMonths } from 'date-fns';

// `last_fed_date`, `archived_date`, etc. are stored as `YYYY-MM-DD` (Postgres
// `date` type, no timezone). Use the user's local timezone when reading and
// writing ,  saving via `toISOString()` produces a UTC date, which renders as
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
  if (dateString instanceof Date) return dateString;
  return parseISO(dateString);
}

export function daysSinceLocal(dateString) {
  const d = parseLocalDate(dateString);
  if (!d) return null;
  return differenceInCalendarDays(new Date(), d);
}

// Human-readable age derived from a hatch_date string. Always parses the
// date in the user's local timezone so a hatch_date of '2025-12-01'
// doesn't roll back to Nov 30 in negative-offset timezones.
export function formatAge(hatchDate) {
  if (!hatchDate) return null;
  const d = parseLocalDate(hatchDate);
  if (!d) return null;
  const months = differenceInMonths(new Date(), d);
  if (months < 0) return null;
  if (months < 1) {
    const days = differenceInCalendarDays(new Date(), d);
    if (days < 0) return null;
    if (days === 0) return 'today';
    return `${days}d`;
  }
  if (months < 12) return `${months}mo`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem === 0 ? `${years}y` : `${years}y ${rem}mo`;
}
