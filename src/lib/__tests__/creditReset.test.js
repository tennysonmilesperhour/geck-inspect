// Monthly allowances turn over at midnight UTC (the database's month key),
// which is the evening before in the US. These checks pin the helper to
// that boundary and the member-facing words to the truth.
import { describe, expect, it } from 'vitest';
import { CREDIT_RESET_RULE, creditResetLocalText, nextCreditReset } from '../creditReset';
import { MEMBERSHIP_FAQS } from '../membershipSeo';

// The month key the database uses: to_char(now() at time zone 'utc', 'YYYY-MM').
const monthKey = (d) => d.toISOString().slice(0, 7);

describe('credit reset', () => {
  it('is the next midnight UTC on the 1st, the same moment the month key changes', () => {
    const now = new Date('2026-10-31T23:59:59Z');
    const reset = nextCreditReset(now);
    expect(reset.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(monthKey(new Date(reset.getTime() - 1))).toBe('2026-10');
    expect(monthKey(reset)).toBe('2026-11');
  });

  it('rolls into January', () => {
    expect(nextCreditReset(new Date('2026-12-15T12:00:00Z')).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('says the evening before in US time zones', () => {
    const mid = new Date('2026-10-15T12:00:00Z');
    expect(creditResetLocalText(mid, 'America/New_York')).toBe('Oct 31 at 8:00 PM your time');
    expect(creditResetLocalText(mid, 'America/Los_Angeles')).toBe('Oct 31 at 5:00 PM your time');
    // November reset: daylight saving time has ended.
    expect(creditResetLocalText(new Date('2026-11-15T12:00:00Z'), 'America/New_York')).toBe('Nov 30 at 7:00 PM your time');
    expect(creditResetLocalText(mid, 'Europe/London')).toBe('Nov 1 at 12:00 AM your time');
  });

  it('the Membership FAQ explains it without dashes', () => {
    const faq = MEMBERSHIP_FAQS.find((item) => item.q === 'When do monthly allowances reset?');
    expect(faq.a).toContain('midnight UTC on the 1st');
    expect(faq.a).toContain('8 pm Eastern or 5 pm Pacific');
    expect(`${faq.a} ${CREDIT_RESET_RULE}`).not.toMatch(/—|–|--/);
  });
});
