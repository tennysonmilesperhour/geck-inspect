// Morph ID's time budget (supabase/functions/_shared/morph-budget.ts,
// 17 Oct 2026): everything counts from arrival, the embedding has its own
// deadline, and no analyzer call starts that cannot finish.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLAUDE_MAX_MS,
  CLAUDE_MIN_MS,
  REQUEST_BUDGET_MS,
  claudeTimeoutMs,
  deadlineSignal,
  morphDeadlines,
  skipClaude,
} from '../../../supabase/functions/_shared/morph-budget.ts';

const ARRIVED = 1_800_000_000_000;

describe('morph budget', () => {
  afterEach(() => vi.useRealTimers());

  it('gives the embedding until 75 s and the reference query until 78 s after arrival', () => {
    expect(morphDeadlines(ARRIVED)).toEqual({
      embed: ARRIVED + 75_000,
      neighbors: ARRIVED + 78_000,
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

  it('skips the analyzer below 27 s left and calls it at exactly 27 s', () => {
    expect(CLAUDE_MIN_MS).toBe(27_000);
    expect(skipClaude(ARRIVED, ARRIVED + 105_000 - 27_000)).toBe(false);
    expect(skipClaude(ARRIVED, ARRIVED + 105_000 - 26_999)).toBe(true);
    // A request still waiting on the embedding at its 75 s deadline has
    // 30 s left; a slow reference query (78 s) leaves exactly 27 s.
    expect(skipClaude(ARRIVED, ARRIVED + 75_000)).toBe(false);
    expect(skipClaude(ARRIVED, ARRIVED + 78_000)).toBe(false);
    expect(skipClaude(ARRIVED, ARRIVED + 80_000)).toBe(true);
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
