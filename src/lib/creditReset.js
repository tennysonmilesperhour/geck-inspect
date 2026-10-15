/**
 * When monthly allowances (Morph ID scans, health checks, AI drafts) reset.
 *
 * The database counts usage per calendar month in UTC
 * (consume_feature_credit keys each month as to_char(now() at time zone
 * 'utc', 'YYYY-MM'), and the edge functions and usage meter do the same).
 * So the new month starts at midnight UTC on the 1st, which in the US is
 * the evening of the last day of the month: 8 pm Eastern or 5 pm Pacific
 * in summer, 7 pm and 4 pm in winter. A member who reads "resets on the
 * 1st" and waits for the morning of the 1st has waited hours longer than
 * needed, and one who checks on the evening of the 31st sees a fresh
 * allowance "a day early". These helpers say the real moment in the
 * member's own time.
 *
 * Changing the boundary itself would mean changing the same rule in
 * about eight places at once, so it stays UTC (see
 * docs/planning/lifecycle-emails-2026-10.md, section 5).
 */

export const CREDIT_RESET_RULE =
  'Monthly allowances reset at midnight UTC on the 1st, which is the evening of the last day of the month in US time zones.';

/** The moment the next month's allowance starts: midnight UTC on the next 1st. */
export function nextCreditReset(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/**
 * "Oct 31 at 8:00 PM your time", for the member's own time zone (or the one
 * given, for tests). Falls back to the UTC rule if the browser cannot
 * format dates.
 */
export function creditResetLocalText(now = new Date(), timeZone = undefined) {
  const reset = nextCreditReset(now);
  try {
    const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone }).format(reset);
    const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone }).format(reset);
    return `${day} at ${time} your time`;
  } catch {
    return 'midnight UTC on the 1st';
  }
}
