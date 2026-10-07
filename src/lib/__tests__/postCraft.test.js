import { describe, expect, it } from 'vitest';
import { buildGeckoFacts, describeAge, findAiTells, TWEAKS, MOMENT_PROMPTS } from '../postCraft';
import { POST_TEMPLATES } from '../socialMedia';
import { scrubDashes } from '../../../supabase/functions/_shared/promote';

const NOW = new Date('2026-10-07T12:00:00Z');

describe('describeAge', () => {
  it('rounds down and picks a sensible unit', () => {
    expect(describeAge('2026-10-01', NOW)).toBe('6 days');
    expect(describeAge('2026-09-01', NOW)).toBe('5 weeks');
    expect(describeAge('2026-03-10', NOW)).toBe('6 months');
    expect(describeAge('2025-08-20', NOW)).toBe('1 year and 1 month');
    expect(describeAge('2024-10-07', NOW)).toBe('2 years');
  });

  it('ignores missing and future dates', () => {
    expect(describeAge(null, NOW)).toBeNull();
    expect(describeAge('2027-01-01', NOW)).toBeNull();
  });
});

describe('buildGeckoFacts', () => {
  const gecko = {
    name: 'Juniper',
    morphs_traits: 'Lilly White, Harlequin',
    sex: 'Female',
    hatch_date: '2026-03-10',
    sire_name: 'Oak',
    dam_name: 'Willow',
    status: 'For Sale',
    asking_price: 350,
    tail_status: 'Tailless',
  };

  it('turns the gecko row into plain facts, including tail loss and price', () => {
    const { profile } = buildGeckoFacts({ gecko, now: NOW });
    expect(profile).toContain('Morph and traits: Lilly White, Harlequin');
    expect(profile).toContain('Sex: Female');
    expect(profile.some((f) => f.startsWith('Age: 6 months'))).toBe(true);
    expect(profile).toContain('Sire: Oak');
    expect(profile).toContain('Asking price: $350');
    expect(profile).toContain('Tail: Tailless');
  });

  it('uses parent rows for morphs when they are known', () => {
    const { profile } = buildGeckoFacts({
      gecko, sire: { name: 'Oak', morphs_traits: 'Sable' }, now: NOW,
    });
    expect(profile).toContain('Sire: Oak (Sable)');
  });

  it('leaves the price out when the gecko is not for sale', () => {
    const { profile } = buildGeckoFacts({ gecko: { ...gecko, status: 'Holdback' }, now: NOW });
    expect(profile.some((f) => f.startsWith('Asking price'))).toBe(false);
  });

  it('reports a weight change and a first-time milestone', () => {
    const weights = [
      { weight_grams: 31, record_date: '2026-10-05' },
      { weight_grams: 24, record_date: '2026-08-20' },
      { weight_grams: 4, record_date: '2026-04-01' },
    ];
    const { profile, recent } = buildGeckoFacts({ gecko, weights, now: NOW });
    expect(profile).toContain('Latest weight: 31g on Oct 5');
    expect(recent).toContain('Weight went from 24g (Aug 20) to 31g (Oct 5)');
    expect(recent).toContain('Just passed 30g for the first time');
  });

  it('keeps recent sheds and noted events, drops routine feedings and old entries', () => {
    const { recent } = buildGeckoFacts({
      gecko,
      sheds: [{ date: '2026-09-30', quality: 'complete' }, { date: '2026-01-01', quality: 'complete' }],
      events: [
        { event_type: 'feeding', event_date: '2026-10-01' },
        { event_type: 'feeding', event_date: '2026-10-02', notes: 'First time eating from the dish' },
        { event_type: 'cage_cleaning', event_date: '2026-10-03' },
        { event_type: 'custom', custom_event_name: 'Moved to adult enclosure', event_date: '2026-09-15' },
      ],
      now: NOW,
    });
    expect(recent[0]).toBe('Oct 2: Fed, "First time eating from the dish"');
    expect(recent).toContain('Sep 30: clean, complete shed');
    expect(recent).toContain('Sep 15: Moved to adult enclosure');
    expect(recent.some((r) => r.includes('Jan 1'))).toBe(false);
    expect(recent.some((r) => r.includes('Oct 1'))).toBe(false);
    expect(recent.some((r) => r.includes('Oct 3'))).toBe(false);
  });

  it('copes with a gecko that has nothing recorded', () => {
    expect(buildGeckoFacts({ gecko: { name: 'X' }, now: NOW })).toEqual({ profile: [], recent: [] });
    expect(buildGeckoFacts({ gecko: null })).toEqual({ profile: [], recent: [] });
  });
});

describe('findAiTells', () => {
  const labels = (t) => findAiTells(t).map((x) => x.label);

  it('flags the classic machine-written caption', () => {
    const found = labels('Meet Juniper! This stunning Lilly White is an absolute stunner — who else loves Lillies? \u{1F98E}✨\u{1F525}\u{1F60D}');
    expect(found).toEqual(expect.arrayContaining([
      'em dash', 'announcer opening', 'stock praise', 'empty adjective', 'engagement bait', 'emoji string',
    ]));
  });

  it('leaves a plain keeper caption alone', () => {
    expect(findAiTells('Juniper hit 31g this week. She was 4g in March and would not touch the dish for a month. Fired up in this shot.')).toEqual([]);
  });

  it('catches placeholders, pushy sales lines and exclamation overload', () => {
    expect(labels('Price is [price]. Won\'t last long!')).toEqual(expect.arrayContaining(['placeholder', 'pushy sales line']));
    expect(labels('Look at her! So pretty! Eating well! Shed today.')).toContain('too many exclamation points');
  });

  it('does not flag hyphenated compound words', () => {
    expect(findAiTells('A well-known line, crested-gecko-first.')).toEqual([]);
  });
});

describe('scrubDashes (server)', () => {
  it('removes em and en dashes without breaking number ranges', () => {
    expect(scrubDashes('She fired up — finally.')).toBe('She fired up, finally.');
    expect(scrubDashes('Eats 3–5 crickets')).toBe('Eats 3-5 crickets');
    expect(scrubDashes('Done —')).toBe('Done');
    expect(scrubDashes('well-known')).toBe('well-known');
  });
});

describe('composer copy', () => {
  it('has a moment prompt for every post type and unique tweak keys', () => {
    for (const t of POST_TEMPLATES) expect(MOMENT_PROMPTS[t.key]).toBeTruthy();
    expect(new Set(TWEAKS.map((t) => t.key)).size).toBe(TWEAKS.length);
  });
});
