// The daily canary reads recognize-gecko-morph's Server-Timing header so a
// slow identification says where the time went (scripts/canary/serverTiming.mjs).
import { describe, expect, it } from 'vitest';
import { COLD_START_EMBED_MS, describeTiming, isColdStart, parseServerTiming } from '../serverTiming.mjs';
import { serverTimingHeader } from '../../../supabase/functions/_shared/morph-timing.ts';

describe('parseServerTiming', () => {
  it('reads every step the function sends', () => {
    expect(parseServerTiming('auth;dur=120, db;dur=900, embed;dur=1500, claude;dur=30500, total;dur=33800')).toEqual({
      auth: 120, db: 900, embed: 1500, claude: 30500, total: 33800,
    });
  });

  it('reads what the function writes', () => {
    const header = serverTimingHeader({ auth: 98, embed: 62_400, neighbors: 610, claude: 31_200, total: 97_000 });
    expect(parseServerTiming(header)).toEqual({ auth: 98, embed: 62_400, neighbors: 610, claude: 31_200, total: 97_000 });
  });

  it('copes with a missing or odd header', () => {
    expect(parseServerTiming(null)).toEqual({});
    expect(parseServerTiming(undefined)).toEqual({});
    expect(parseServerTiming('')).toEqual({});
    expect(parseServerTiming('cache;desc="hit", embed;dur=abc, claude;dur=31000')).toEqual({ claude: 31000 });
  });
});

describe('cold starts', () => {
  it('labels a call whose embedding took over 30 s as a Replicate cold start', () => {
    expect(COLD_START_EMBED_MS).toBe(30_000);
    expect(isColdStart({ embed: 62_000 })).toBe(true);
    expect(isColdStart({ embed: 30_001 })).toBe(true);
    expect(isColdStart({ embed: 30_000 })).toBe(false);
    expect(isColdStart({ embed: 1_800 })).toBe(false);
    expect(isColdStart({})).toBe(false);
  });

  it('prints the embed and Claude split next to the 100 s check', () => {
    expect(describeTiming({ embed: 62_000, claude: 31_000 })).toBe('embed 62.0s (Replicate cold start), Claude 31.0s');
    expect(describeTiming({ embed: 1_500, claude: 30_500 })).toBe('embed 1.5s, Claude 30.5s');
    expect(describeTiming({ claude: 30_500 })).toBe('Claude 30.5s');
    expect(describeTiming({})).toBe('');
  });
});
