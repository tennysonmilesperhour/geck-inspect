// Where Morph ID's time goes (supabase/functions/_shared/morph-timing.ts):
// a Server-Timing header and one log line per request, with no photo URL
// and nothing about the member.
import { describe, expect, it } from 'vitest';
import {
  MorphTiming,
  TIMING_STEPS,
  serverTimingHeader,
  timingLogLine,
} from '../../../supabase/functions/_shared/morph-timing.ts';

describe('serverTimingHeader', () => {
  it('reads "auth;dur=120, embed;dur=1500" in whole ms', () => {
    expect(serverTimingHeader({ auth: 120.4, embed: 1499.6 })).toBe('auth;dur=120, embed;dur=1500');
  });

  it('skips steps that did not run and keeps the step order', () => {
    expect(serverTimingHeader({ total: 33_000, claude: 30_000, auth: 100 }))
      .toBe('auth;dur=100, claude;dur=30000, total;dur=33000');
    expect(serverTimingHeader({ auth: undefined, embed: Number.NaN })).toBe('');
    expect(serverTimingHeader({ photo: 5 })).toBe('');
  });

  it('names every step the canary reads', () => {
    expect(TIMING_STEPS).toEqual(['auth', 'db', 'embed', 'neighbors', 'wait', 'claude', 'writes', 'total']);
  });
});

describe('MorphTiming', () => {
  it('adds repeated steps, times promises that reject, and measures total from arrival', async () => {
    let clock = 1_000;
    const timing = new MorphTiming(1_000, () => clock);
    timing.add('db', 300);
    timing.add('db', 200);
    // The clock moves while each promise is pending.
    const later = (ms, settle) => Promise.resolve().then(() => {
      clock += ms;
      return settle();
    });
    const slow = timing.measure('claude', later(30_000, () => 'answer'));
    await expect(slow).resolves.toBe('answer');
    const failing = timing.measure('neighbors', later(3_000, () => { throw new Error('timeout'); }));
    await expect(failing).rejects.toThrow('timeout');
    clock = 40_000;
    timing.finish();
    expect(timing.snapshot()).toEqual({ db: 500, neighbors: 3_000, claude: 30_000, total: 39_000 });
  });
});

describe('timingLogLine', () => {
  it('holds the outcome, status, photo count and step times only', () => {
    const line = timingLogLine({
      outcome: 'ok',
      status: 200,
      photoCount: 2,
      durations: { auth: 110, embed: 62_000.7, claude: 31_000, total: 97_000 },
    });
    expect(JSON.parse(line)).toEqual({
      event: 'morph_id_timing',
      outcome: 'ok',
      status: 200,
      photos: 2,
      ms: { auth: 110, embed: 62_001, claude: 31_000, total: 97_000 },
    });
  });

  it('never carries a URL, even when one is passed as the outcome', () => {
    const line = timingLogLine({
      outcome: 'upstream_timeout',
      status: 502,
      photoCount: 1,
      durations: { total: 76_000 },
    });
    expect(line).not.toMatch(/https?:\/\//);
    expect(line).not.toMatch(/@/);
  });
});
