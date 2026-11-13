/**
 * The hatch date row of the gecko form: a year box, a month list and a day
 * box. Pure functions, no React, so tests can check them without a browser.
 *
 * A hatch date is only saved when the three parts make a real calendar
 * day. A year without a whole date (owner decision E13, 13 Nov 2026) is
 * kept as the year alone, in estimated_hatch_year: the app never turns
 * part of a date into an invented birthday.
 */

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

function monthFromName(word) {
  const w = String(word || '').toLowerCase().replace(/\.$/, '');
  if (w.length < 3) return null;
  const index = MONTH_NAMES.findIndex((name) => name === w || (w.length <= 4 && name.startsWith(w)));
  return index === -1 ? null : index + 1;
}

/** True when year, month and day name a day that exists (no 30 February). */
function isRealDay(year, month, day) {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function parts(year, month, day = null) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (day !== null && (!Number.isInteger(day) || !isRealDay(year, month, day))) return null;
  return { year: String(year), month: String(month), day: day === null ? '' : String(day) };
}

/**
 * Read a date a member pasted or typed in one go. Understands
 * 2026-02-24, 02/24/2026, 24 Feb 2026, Feb 24, 2026 and February 24 2026,
 * and a month and year alone (2026-02, Feb 2026). With numbers only the
 * month comes first, as in the United States, unless the first number can
 * only be a day (24/02/2026).
 *
 * Returns { year, month, day } as the strings the form keeps (day is ''
 * when the text has none), or null when the text is not a date.
 */
export function parseDateText(text) {
  const raw = String(text || '').trim();
  if (!raw || raw.length > 40) return null;

  // 2026-02-24, 2026/2/24, 2026.02.24, and anything after a T or a space.
  let m = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (m) return parts(Number(m[1]), Number(m[2]), Number(m[3]));

  // 02/24/2026 (month first), or 24/02/2026 when the first number is over 12.
  m = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const year = Number(m[3]);
    return a > 12 && b <= 12 ? parts(year, b, a) : parts(year, a, b);
  }

  // 24 Feb 2026, 24 February, 2026
  m = raw.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+(\d{4})$/);
  if (m) return parts(Number(m[3]), monthFromName(m[2]), Number(m[1]));

  // Feb 24, 2026 and February 24 2026
  m = raw.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
  if (m) return parts(Number(m[3]), monthFromName(m[1]), Number(m[2]));

  // A month and a year: 2026-02, 02/2026, Feb 2026.
  m = raw.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (m) return parts(Number(m[1]), Number(m[2]));
  m = raw.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (m) return parts(Number(m[2]), Number(m[1]));
  m = raw.match(/^([A-Za-z]{3,9})\.?,?\s+(\d{4})$/);
  if (m) return parts(Number(m[2]), monthFromName(m[1]));

  return null;
}

/**
 * The Date to save for the three boxes, or null when they are empty,
 * unfinished or name a day that does not exist. Local midnight, so the
 * calendar day never shifts with the time zone.
 */
export function hatchDateFromParts(year, month, day) {
  if (!year || String(year).length !== 4 || !month || !day) return null;
  const y = Number(year);
  const mo = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  if (mo < 1 || mo > 12 || !isRealDay(y, mo, d)) return null;
  return new Date(y, mo - 1, d);
}

/**
 * Where the row stands, for the line under it:
 *   'empty'    nothing entered
 *   'partial'  some of it entered, not yet a date
 *   'invalid'  all three entered, but no such day (31 February)
 *   'complete' a real date, which is what will be saved
 */
export function hatchDateStatus(year, month, day) {
  if (!year && !month && !day) return 'empty';
  if (hatchDateFromParts(year, month, day)) return 'complete';
  return year && String(year).length === 4 && month && day ? 'invalid' : 'partial';
}

/** The year in the Year box as a number, when it is four digits from 1900 to 2100; else null. */
export function hatchYearFromParts(year) {
  if (!/^\d{4}$/.test(String(year ?? ''))) return null;
  const y = Number(year);
  return y >= 1900 && y <= 2100 ? y : null;
}

/**
 * What a save writes for the three boxes. A real date goes in hatch_date
 * and clears estimated_hatch_year, since the date says more. Anything less
 * with a year in it (the year alone, a year and a month, a day that does
 * not exist) keeps only the year: there is no column for a month on its
 * own, and no day is ever made up.
 */
export function hatchFieldsFromParts(year, month, day) {
  const date = hatchDateFromParts(year, month, day);
  if (date) {
    const two = (n) => String(n).padStart(2, '0');
    return { hatch_date: `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`, estimated_hatch_year: null };
  }
  return { hatch_date: null, estimated_hatch_year: hatchYearFromParts(year) };
}

/**
 * The year to show for a gecko that has a hatch year but no hatch date
 * (saved by the form or a spreadsheet import), or null. Screens show it
 * as a year, never as a day or a month.
 */
export function hatchYearOnly(gecko) {
  if (!gecko || gecko.hatch_date) return null;
  const year = Number(gecko.estimated_hatch_year);
  return Number.isInteger(year) && year > 0 ? year : null;
}
