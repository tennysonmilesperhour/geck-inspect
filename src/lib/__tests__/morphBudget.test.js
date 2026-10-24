// Morph ID's time budget (supabase/functions/_shared/morph-budget.ts,
// 17 Oct 2026): everything counts from arrival, the embedding has its own
// deadline, and no analyzer call starts that cannot finish. The embedding
// deadline and the analyzer minimum come from the same numbers, so no
// request gets past the embedding with too little time left.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLAUDE_MAX_MS,
  CLAUDE_START_MARGIN_MS,
  NEIGHBOR_QUERY_MS,
  REQUEST_BUDGET_MS,
  claudeMinMs,
  claudeTimeoutMs,
  deadlineSignal,
  morphDeadlines,
  skipClaude,
} from '../../../supabase/functions/_shared/morph-budget.ts';

const ARRIVED = 1_800_000_000_000;

describe('morph budget', () => {
  afterEach(() => vi.useRealTimers());

  it('asks for more analyzer time with more photos: 32 s up to two, 42.5 s for five', () => {
    expect([1, 2, 3, 4, 5].map(claudeMinMs)).toEqual([32_000, 32_000, 35_500, 39_000, 42_500]);
    // Out-of-range counts are treated as the nearest real one.
    expect(claudeMinMs(0)).toBe(32_000);
    expect(claudeMinMs(9)).toBe(42_500);
    // Five-photo answers run up to 41 s; the minimum covers them.
    expect(claudeMinMs(5)).toBeGreaterThan(41_000);
  });

  it('gives the embedding until 69.5 s (one or two photos) or 59 s (five), and the reference query 3 s more', () => {
    expect(morphDeadlines(ARRIVED, 1)).toEqual({
      embed: ARRIVED + 69_500,
      neighbors: ARRIVED + 72_500,
      end: ARRIVED + 105_000,
    });
    expect(morphDeadlines(ARRIVED, 2)).toEqual(morphDeadlines(ARRIVED, 1));
    expect(morphDeadlines(ARRIVED, 5)).toEqual({
      embed: ARRIVED + 59_000,
      neighbors: ARRIVED + 62_000,
      end: ARRIVED + 105_000,
    });
  });

  it('keeps the whole request 15 s inside the browser limit (120 s)', () => {
    expect(REQUEST_BUDGET_MS).toBe(105_000);
    expect(120_000 - REQUEST_BUDGET_MS).toBe(15_000);
  });

  it('times the analyzer at min(90 s, time left) with no 15 s floor', () => {
    expect(claudeTimeoutMs(ARRIVED, ARRIVED + 2_000)).toBe(CLAUDE_MAX_MS);
    expect(claudeTimeoutMs(ARRIVED, ARRIVED + 20_000)).toBe(85_000);
    expect(claudeTimeoutMs(ARRIVED, ARRIVED + 95_000)).toBe(10_000);
    expect(claudeTimeoutMs(ARRIVED, ARRIVED + 110_000)).toBe(0);
  });

  it('never lets the analyzer run past arrival + 105 s', () => {
    for (const startAfter of [0, 5_000, 15_000, 40_000, 70_000, 78_000, 100_000]) {
      const now = ARRIVED + startAfter;
      expect(now + claudeTimeoutMs(ARRIVED, now)).toBeLessThanOrEqual(ARRIVED + 105_000);
    }
  });

  it('starts the analyzer for any request whose reference query ends by its deadline, for every photo count', () => {
    for (const photos of [1, 2, 3, 4, 5]) {
      const { embed, neighbors } = morphDeadlines(ARRIVED, photos);
      // The limits agree: embedding deadline + query + start margin + analyzer minimum = budget.
      expect(embed - ARRIVED + NEIGHBOR_QUERY_MS + CLAUDE_START_MARGIN_MS + claudeMinMs(photos)).toBe(REQUEST_BUDGET_MS);
      // A request whose evidence arrives in time is never refused, even a
      // reference query cut off at its deadline (the answer then goes ahead
      // without references a few milliseconds later).
      expect(skipClaude(ARRIVED, embed, photos)).toBe(false);
      expect(skipClaude(ARRIVED, neighbors, photos)).toBe(false);
      expect(skipClaude(ARRIVED, neighbors + 50, photos)).toBe(false);
      expect(skipClaude(ARRIVED, neighbors + CLAUDE_START_MARGIN_MS, photos)).toBe(false);
      expect(skipClaude(ARRIVED, neighbors + CLAUDE_START_MARGIN_MS + 1, photos)).toBe(true);
    }
  });

  it('no longer starts a five-photo call with 32.6 s left (an embedding done at 72 s)', () => {
    // Before, a boot finishing at 72 s passed the 27 s check and the call
    // was cut off at 105 s; the embedding would now have stopped at 59 s.
    const now = ARRIVED + 72_400;
    expect(claudeTimeoutMs(ARRIVED, now)).toBe(32_600);
    expect(skipClaude(ARRIVED, now, 5)).toBe(true);
    expect(skipClaude(ARRIVED, now, 1)).toBe(false);
    expect(morphDeadlines(ARRIVED, 5).embed).toBeLessThan(now);
  });

  it('aborts a deadline signal at the deadline or when the parent aborts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(ARRIVED);
    const timed = deadlineSignal(ARRIVED + 3_000);
    vi.advanceTimersByTime(2_999);
    expect(timed.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(timed.signal.aborted).toBe(true);

    const parent = new AbortController();
    const linked = deadlineSignal(ARRIVED + 60_000, parent.signal);
    parent.abort();
    expect(linked.signal.aborted).toBe(true);
    linked.clear();

    const cleared = deadlineSignal(Date.now() + 1_000);
    cleared.clear();
    vi.advanceTimersByTime(5_000);
    expect(cleared.signal.aborted).toBe(false);
  });
});
