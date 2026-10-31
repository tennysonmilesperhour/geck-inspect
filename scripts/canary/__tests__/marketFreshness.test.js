import { describe, expect, it } from 'vitest';
import { fullPassFreshness, MAX_AGE_DAYS } from '../marketFreshness.mjs';

const NOW = Date.parse('2026-10-28T02:00:00Z');

describe('daily canary full market pass', () => {
  it('fails on the 28 Oct 2026 state: pass on 19 Oct, US full day on 6 Oct', () => {
    const r = fullPassFreshness({ last_complete_pass_at: '2026-10-19T20:15:38Z', coverage_pct: 0.4, us_last_full_day: '2026-10-06' }, NOW);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain('last complete pass 2026-10-19');
    expect(r.detail).toContain('US Price Index last full day 2026-10-06');
    expect(r.detail).toContain('0.4% of live listings');
  });

  it('passes when both dates are recent', () => {
    const r = fullPassFreshness({ last_complete_pass_at: '2026-10-26T20:00:00Z', coverage_pct: 96, us_last_full_day: '2026-10-27' }, NOW);
    expect(r).toEqual({ ok: true, detail: expect.stringContaining('96% of live listings') });
  });

  it('fails when only the Price Index day is old', () => {
    expect(fullPassFreshness({ last_complete_pass_at: '2026-10-27T00:00:00Z', coverage_pct: 90, us_last_full_day: '2026-10-10' }, NOW).ok).toBe(false);
  });

  it(`allows up to ${MAX_AGE_DAYS} days, so one missed weekly run is not an alarm on its own day`, () => {
    const edge = new Date(NOW - MAX_AGE_DAYS * 86_400_000 + 60_000).toISOString();
    expect(fullPassFreshness({ last_complete_pass_at: edge, coverage_pct: 50, us_last_full_day: '2026-10-27' }, NOW).ok).toBe(true);
  });

  it('fails, and says why, before the migration adds the dates', () => {
    const r = fullPassFreshness({ new_last_3_days: 60 }, NOW);
    expect(r.ok).toBe(false);
    expect(r.detail).toContain('not applied');
    expect(fullPassFreshness({ last_complete_pass_at: null, us_last_full_day: null }, NOW).ok).toBe(false);
  });
});
