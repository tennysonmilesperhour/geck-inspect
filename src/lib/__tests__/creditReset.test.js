// Monthly allowances turn over at midnight UTC (the database's month key),
// which is the evening before in the US. These checks pin the helper to
// that boundary and the member-facing words to the truth.
import { describe, expect, it } from 'vitest';
import { CREDIT_RESET_RULE, creditResetLocalText, creditResetWhen, nextCreditReset } from '../creditReset';
import { presentMorphIdError } from '../morphIdErrors';
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

  it('reads as a phrase after "resets" or "arrives"', () => {
    const mid = new Date('2026-10-15T12:00:00Z');
    expect(creditResetWhen(mid, 'America/Chicago')).toBe('on Oct 31 at 7:00 PM your time');
    // A time zone the browser cannot format falls back to the UTC rule.
    expect(creditResetWhen(mid, 'Not/AZone')).toBe('at midnight UTC on the 1st');
  });

  it('Morph ID out-of-credits copy says the real moment, not "on the 1st"', () => {
    const mid = new Date('2026-10-15T12:00:00Z');
    const free = presentMorphIdError({ code: 'morph_id_credits_exhausted' }, { isFreeTier: true, now: mid, timeZone: 'America/New_York' });
    expect(free.body).toBe('Your next free identification arrives on Oct 31 at 8:00 PM your time. Keeper includes 3 identifications a month.');
    const paid = presentMorphIdError({ code: 'morph_id_credits_exhausted' }, { isFreeTier: false, now: mid, timeZone: 'America/Los_Angeles' });
    expect(paid.body).toBe('Your credits reset on Oct 31 at 5:00 PM your time. Upgrade your plan to identify more geckos now.');
    expect(paid.retryable).toBe(false);
    expect(paid.cta).toEqual({ label: 'See plans', href: '/Membership' });
  });

  it('the Membership FAQ explains it without dashes', () => {
    const faq = MEMBERSHIP_FAQS.find((item) => item.q === 'When do monthly allowances reset?');
    expect(faq.a).toContain('midnight UTC on the 1st');
    expect(faq.a).toContain('8 pm Eastern or 5 pm Pacific');
    expect(`${faq.a} ${CREDIT_RESET_RULE}`).not.toMatch(/—|–|--/);
  });
});
