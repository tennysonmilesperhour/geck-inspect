import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: vi.fn() } }));

import {
  describeDayWord,
  describeFact,
  describeValue,
  daysSince,
  formatUsd,
  gameShareText,
  markNewSince,
  marketTodayLines,
  morphLabel,
  pctChange,
  priceGameScore,
  scoreWord,
  sexAgeLabel,
  shortDay,
  staleNote,
  storeSlugFromUrl,
  timeAgo,
} from '../marketHabit';

const NOW = new Date('2026-09-30T15:00:00Z');

describe('formatting', () => {
  it('formats dollars and percent changes', () => {
    expect(formatUsd(1234.6)).toBe('$1,235');
    expect(formatUsd(null)).toBe('$0');
    expect(formatUsd('x')).toBe('');
    expect(pctChange(110, 100)).toBe(10);
    expect(pctChange(95, 100)).toBe(-5);
    expect(pctChange(100, 0)).toBeNull();
    expect(pctChange(100, null)).toBeNull();
  });

  it('reads dates as calendar days', () => {
    expect(shortDay('2026-08-29')).toBe('Aug 29');
    expect(daysSince('2026-09-28', NOW)).toBe(2);
    expect(daysSince(null, NOW)).toBeNull();
  });

  it('labels sex, age and morphs', () => {
    expect(sexAgeLabel('female', 'adult')).toBe('Female adult');
    expect(sexAgeLabel('unsexed', null)).toBe('Unsexed');
    expect(sexAgeLabel(null, 'hatchling')).toBe('Hatchling');
    expect(morphLabel(['Lilly White', 'Harlequin'])).toBe('Lilly White Harlequin');
    expect(morphLabel([])).toBe('Crested gecko');
  });
});

describe('describeValue', () => {
  const base = { value: 6907, value_low: 4840, value_high: 9942, priced: 17, geckos: 99 };

  it('says tracking just started when there is no history', () => {
    const v = describeValue(base);
    expect(v.headline).toBe('Your crested geckos: $4,840 to $9,942');
    expect(v.detail).toMatch(/Tracking started/);
    expect(v.note).toBe('17 of 99 priced. Add morph traits to the rest to include them.');
  });

  it('prefers the 30 day change, then the 7 day change', () => {
    expect(describeValue({ ...base, value_30d: 6400 }).detail).toBe('Up 7.9% in 30 days');
    expect(describeValue({ ...base, value_7d: 7000 }).detail).toBe('Down 1.3% this week');
    expect(describeValue({ ...base, value_30d: 6907 }).detail).toBe('Steady over 30 days');
  });

  it('returns null when nothing is priced', () => {
    expect(describeValue({ ...base, priced: 0 })).toBeNull();
    expect(describeValue(null)).toBeNull();
  });
});

describe('marketTodayLines', () => {
  const data = {
    value: { value: 6907, value_low: 4840, value_high: 9942, priced: 17, geckos: 99 },
    market: { last_check_day: '2026-08-29', fresh: false },
    watch: { alerts: 0, matches_24h: 0 },
    morphs: [{ trait: 'Lilly White', new_7d: 3, p50: 400 }],
  };

  it('builds value, watch set-up and morph news lines', () => {
    const lines = marketTodayLines(data, NOW);
    expect(lines.map((l) => l.id)).toEqual(['value', 'watch-setup', 'morph-news']);
    expect(lines[2].label).toBe('3 new Lilly White listings this week');
    expect(lines[2].stale).toBe('US listings last checked Aug 29.');
  });

  it('shows matches instead of the set-up line when a watch fired', () => {
    const lines = marketTodayLines({ ...data, watch: { alerts: 2, matches_24h: 1 } }, NOW);
    expect(lines[1].label).toBe('1 new watchlist match');
  });

  it('leaves out the stale note when data is fresh', () => {
    const lines = marketTodayLines({ ...data, market: { last_check_day: '2026-09-30' } }, NOW);
    expect(lines.some((l) => l.stale)).toBe(false);
    expect(staleNote('2026-09-29', NOW)).toBeNull();
  });
});

describe('brief wording', () => {
  it('describes the day against a typical day', () => {
    expect(describeDayWord({ word: 'slow', new_listings: 22, typical_new: 64 }))
      .toBe('A slow day: 22 new against a typical 64');
    expect(describeDayWord({ word: null })).toBeNull();
  });

  it('describes each kind of fact', () => {
    expect(describeFact({ kind: 'cut_wave', day: '2026-05-24', cuts: 1210, typical_cuts: 412, median_cut_pct: 0.375 }))
      .toBe('Price cuts ran at more than twice the usual rate on May 24: 1,210 cuts against a typical 412, a typical cut of 38%.');
    expect(describeFact({ kind: 'mover', trait: 'Empty Back', p50: 300, p50_before: 250, day: '2026-06-07', day_before: '2026-05-17', for_sale: 94 }))
      .toBe('The middle asking price for Empty Back rose from $250 to $300 between May 17 and Jun 7 (94 for sale).');
    expect(describeFact({ kind: 'korea_gap', trait: 'Axanthic', kr_p50: 400, us_p50: 700 }))
      .toMatch(/^Axanthic asks less in Korea/);
    expect(describeFact(null)).toBeNull();
  });
});

describe('tape helpers', () => {
  it('marks events newer than the last visit', () => {
    const events = [
      { event_id: 'a', at: '2026-09-30T14:00:00Z' },
      { event_id: 'b', at: '2026-09-29T10:00:00Z' },
    ];
    expect(markNewSince(events, '2026-09-30T12:00:00Z').map((e) => e.isNew)).toEqual([true, false]);
    expect(markNewSince(events, null).every((e) => e.isNew === false)).toBe(true);
  });

  it('writes relative times', () => {
    expect(timeAgo('2026-09-30T14:48:00Z', NOW)).toBe('12 min ago');
    expect(timeAgo('2026-09-30T12:00:00Z', NOW)).toBe('3 h ago');
    expect(timeAgo('2026-09-28T12:00:00Z', NOW)).toMatch(/Sep 28/);
  });
});

describe('Guess the Price', () => {
  it('scores like the database', () => {
    expect(priceGameScore(265, 265)).toBe(100);
    expect(priceGameScore(300, 265)).toBe(89);
    expect(priceGameScore(795, 265)).toBe(0);
    expect(priceGameScore(0, 265)).toBe(0);
  });

  it('names the score and builds share text', () => {
    expect(scoreWord(97)).toBe('Spot on');
    expect(scoreWord(20)).toBe('Way off');
    const text = gameShareText('2026-09-30', [
      { guessed: true, score: 91 },
      { guessed: true, score: 60 },
      { guessed: true, score: 10 },
    ]);
    expect(text).toBe('Guess the Price, Sep 30: 161 of 300\n[x] [~] [ ]\ngeckinspect.com');
  });
});

describe('seller view', () => {
  it('reads the store slug from a MorphMarket link', () => {
    expect(storeSlugFromUrl('https://www.morphmarket.com/stores/GeckoNerd/')).toBe('geckonerd');
    expect(storeSlugFromUrl('morphmarket.com/stores/lilly-lane?tab=animals')).toBe('lilly-lane');
    expect(storeSlugFromUrl('Lilly Lane Geckos')).toBeNull();
    expect(storeSlugFromUrl('')).toBeNull();
  });
});
