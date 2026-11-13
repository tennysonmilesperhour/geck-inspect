// @vitest-environment jsdom
// The plain functions behind the long gecko form (experience review WP-3):
// reading a pasted hatch date, what a save keeps of it, searching the morph
// catalogue, the feeding group a weight falls in, and the draft of an
// unsaved new gecko kept in the browser.
import { afterEach, describe, expect, it } from 'vitest';
import { hatchDateFromParts, hatchDateStatus, hatchFieldsFromParts, hatchYearFromParts, hatchYearOnly, parseDateText } from '../form/hatchDate';
import { feedingGroupForWeight } from '../form/helpers';
import { countMorphMatches, searchMorphTags } from '../form/morphSearch';
import { clearGeckoFormDraft, readGeckoFormDraft, saveGeckoFormDraft } from '../form/draft';
import { ALL_MORPHS } from '../morphTagCatalog';

describe('parseDateText', () => {
  const feb24 = { year: '2026', month: '2', day: '24' };

  it('reads the three formats a member is likely to paste', () => {
    expect(parseDateText('2026-02-24')).toEqual(feb24);
    expect(parseDateText('02/24/2026')).toEqual(feb24);
    expect(parseDateText('24 Feb 2026')).toEqual(feb24);
  });

  it('reads the near relatives of those formats', () => {
    for (const text of ['2026/2/24', '2026.02.24', '2026-02-24T08:30:00Z', '2/24/2026', '02-24-2026', ' 24 February 2026 ',
      '24-Feb-2026', '24th Feb 2026', 'Feb 24, 2026', 'February 24 2026', 'Feb. 24, 2026']) {
      expect(parseDateText(text), text).toEqual(feb24);
    }
  });

  it('puts the month first in an all-number date, unless the first number can only be a day', () => {
    expect(parseDateText('03/04/2026')).toEqual({ year: '2026', month: '3', day: '4' });
    expect(parseDateText('24/02/2026')).toEqual(feb24);
  });

  it('reads a month and a year alone, leaving the day empty', () => {
    const feb = { year: '2026', month: '2', day: '' };
    expect(parseDateText('2026-02')).toEqual(feb);
    expect(parseDateText('02/2026')).toEqual(feb);
    expect(parseDateText('Feb 2026')).toEqual(feb);
  });

  it('refuses days that do not exist and text that is not a date', () => {
    for (const text of ['2026-02-30', '13/45/2026', '31 Apr 2026', '2026', 'Mango', '', null, '24 Foo 2026', '2/24/26']) {
      expect(parseDateText(text), String(text)).toBeNull();
    }
    // A leap day only in a leap year.
    expect(parseDateText('29 Feb 2024')).toEqual({ year: '2024', month: '2', day: '29' });
    expect(parseDateText('29 Feb 2026')).toBeNull();
  });
});

describe('hatchDateFromParts and hatchDateStatus', () => {
  it('makes a date only from three parts that name a real day', () => {
    const date = hatchDateFromParts('2026', '2', '24');
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 1, 24]);
    expect(hatchDateFromParts('2026', '2', '30')).toBeNull();
    expect(hatchDateFromParts('26', '2', '24')).toBeNull();
  });

  it('never invents a day or a month for an unfinished date', () => {
    expect(hatchDateFromParts('2026', '', '')).toBeNull();
    expect(hatchDateFromParts('2026', '2', '')).toBeNull();
    expect(hatchDateFromParts('', '2', '24')).toBeNull();
  });

  it('says where the row stands', () => {
    expect(hatchDateStatus('', '', '')).toBe('empty');
    expect(hatchDateStatus('2026', '', '')).toBe('partial');
    expect(hatchDateStatus('2026', '2', '')).toBe('partial');
    expect(hatchDateStatus('202', '2', '24')).toBe('partial');
    expect(hatchDateStatus('2026', '2', '31')).toBe('invalid');
    expect(hatchDateStatus('2026', '2', '24')).toBe('complete');
  });
});

// Owner decision E13: a year on its own is kept, as estimated_hatch_year.
describe('hatchFieldsFromParts: what a save keeps of the hatch row', () => {
  it('keeps a year alone as the year, with no date', () => {
    expect(hatchFieldsFromParts('2025', '', '')).toEqual({ hatch_date: null, estimated_hatch_year: 2025 });
  });

  it('keeps only the year of a year and a month, never a made-up day', () => {
    expect(hatchFieldsFromParts('2025', '3', '')).toEqual({ hatch_date: null, estimated_hatch_year: 2025 });
    // A day with no month, or a day that does not exist, keeps the year too.
    expect(hatchFieldsFromParts('2025', '', '14')).toEqual({ hatch_date: null, estimated_hatch_year: 2025 });
    expect(hatchFieldsFromParts('2025', '2', '30')).toEqual({ hatch_date: null, estimated_hatch_year: 2025 });
  });

  it('saves a whole date as the hatch date and clears the year, since the date says more', () => {
    expect(hatchFieldsFromParts('2025', '3', '7')).toEqual({ hatch_date: '2025-03-07', estimated_hatch_year: null });
    expect(hatchFieldsFromParts('2024', '12', '31')).toEqual({ hatch_date: '2024-12-31', estimated_hatch_year: null });
  });

  it('keeps nothing without a four-digit year', () => {
    expect(hatchFieldsFromParts('', '', '')).toEqual({ hatch_date: null, estimated_hatch_year: null });
    expect(hatchFieldsFromParts('202', '', '')).toEqual({ hatch_date: null, estimated_hatch_year: null });
    expect(hatchFieldsFromParts('', '3', '7')).toEqual({ hatch_date: null, estimated_hatch_year: null });
    expect(hatchYearFromParts('1850')).toBeNull();
    expect(hatchYearFromParts('20251')).toBeNull();
    expect(hatchYearFromParts('2025')).toBe(2025);
  });

  it('reads back a year alone from a saved gecko, and nothing when it has a date', () => {
    expect(hatchYearOnly({ hatch_date: null, estimated_hatch_year: 2025 })).toBe(2025);
    expect(hatchYearOnly({ hatch_date: '2025-03-07', estimated_hatch_year: 2025 })).toBeNull();
    expect(hatchYearOnly({ hatch_date: null, estimated_hatch_year: null })).toBeNull();
    expect(hatchYearOnly(null)).toBeNull();
  });
});

describe('feedingGroupForWeight', () => {
  const GROUPS = [
    { id: 'adults', label: 'A' },
    { id: 'hatchlings', label: 'B', auto_weight_min_g: 1, auto_weight_max_g: 10 },
    { id: 'subadults', label: 'C', auto_weight_min_g: 10.1, auto_weight_max_g: 30 },
  ];

  it('finds the group whose weight range holds the weight, ends included', () => {
    expect(feedingGroupForWeight(GROUPS, 4)?.id).toBe('hatchlings');
    expect(feedingGroupForWeight(GROUPS, '10')?.id).toBe('hatchlings');
    expect(feedingGroupForWeight(GROUPS, 22.5)?.id).toBe('subadults');
    expect(feedingGroupForWeight(GROUPS, 30)?.id).toBe('subadults');
  });

  it('finds none outside every range, and none for no weight', () => {
    expect(feedingGroupForWeight(GROUPS, 45)).toBeNull();
    expect(feedingGroupForWeight(GROUPS, '')).toBeNull();
    expect(feedingGroupForWeight(GROUPS, null)).toBeNull();
    expect(feedingGroupForWeight(GROUPS, 'abc')).toBeNull();
    expect(feedingGroupForWeight([], 4)).toBeNull();
  });
});

describe('searchMorphTags', () => {
  const names = (query, limit) => searchMorphTags(query, limit).map((m) => m.morph);

  it('finds catalogue tags as the member types, best match first', () => {
    expect(names('harl')[0]).toBe('Harlequin');
    expect(names('harl')).toEqual(expect.arrayContaining(['Extreme Harlequin', 'Red Harlequin']));
    // Starts-with beats a later word, which beats the middle of a word.
    expect(names('pin')[0]).toBe('Pinstripe');
    expect(names('axan')[0]).toBe('Axanthic');
    expect(names('axan')).toContain('Het Axanthic');
  });

  it('forgives doubled letters, case and hyphens', () => {
    expect(names('lily white')[0]).toBe('Lilly White');
    expect(names('LILLY')[0]).toBe('Lilly White');
    expect(names('capuccino')[0]).toBe('Cappuccino');
    expect(names('soft-scale')[0]).toBe('Soft Scale');
  });

  it('only ever returns tags from the catalogue, cut to the limit', () => {
    expect(names('zzz')).toEqual([]);
    expect(names('')).toEqual([]);
    expect(names('a', 5)).toHaveLength(5);
    for (const morph of names('e', 200)) expect(ALL_MORPHS.has(morph), morph).toBe(true);
    expect(countMorphMatches('harlequin')).toBeGreaterThan(names('harlequin', 3).length);
  });
});

describe('the kept draft of an unsaved new gecko', () => {
  const MEMBER = { id: 'u1', email: 'keeper@example.com' };
  const draft = (form = {}) => ({
    form: { name: 'Mango', morphs_traits: 'cream dorsal', morph_tags: ['Lilly White'], image_urls: ['https://cdn.example.com/a.webp'], quality_score: 7.5, is_public: true, ...form },
    hatch: { year: '2025', month: '6', day: '' },
    sire: { input: 'Spud', id: 'g2' },
    dam: { input: '', id: '' },
    crop: { 'https://cdn.example.com/a.webp': { x: 40, y: 60, life_stage: 'adult' }, 'https://cdn.example.com/gone.webp': { x: 1, y: 1 } },
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('round-trips text, choices and the addresses of uploaded photos, under the member id', () => {
    expect(saveGeckoFormDraft(MEMBER, draft())).toBe(true);
    expect(Object.keys(window.localStorage)).toEqual(['geck_gecko_form_draft_v1:u1']);
    const back = readGeckoFormDraft(MEMBER);
    expect(back.form).toMatchObject({ name: 'Mango', morphs_traits: 'cream dorsal', morph_tags: ['Lilly White'], quality_score: 7.5, is_public: true });
    expect(back.form.image_urls).toEqual(['https://cdn.example.com/a.webp']);
    expect(back.hatch).toEqual({ year: '2025', month: '6', day: '' });
    expect(back.sire).toEqual({ input: 'Spud', id: 'g2' });
    // Crop and tag choices only for photos still in the draft.
    expect(Object.keys(back.crop)).toEqual(['https://cdn.example.com/a.webp']);
  });

  it('keeps no photo files, no unknown fields and nothing that names the member', () => {
    saveGeckoFormDraft(MEMBER, draft({
      image_urls: ['https://cdn.example.com/a.webp', 'blob:http://localhost/123', 'data:image/png;base64,AAAA', { name: 'photo.jpg' }],
      created_by: MEMBER.email,
      id: 'should-not-be-kept',
      hatch_date: new Date(),
    }));
    const raw = window.localStorage.getItem('geck_gecko_form_draft_v1:u1');
    expect(raw).not.toContain('blob:');
    expect(raw).not.toContain('data:image');
    expect(raw).not.toContain('photo.jpg');
    expect(raw).not.toContain(MEMBER.email);
    expect(raw).not.toContain('should-not-be-kept');
  });

  it('keeps each member their own draft, and none for a guest', () => {
    saveGeckoFormDraft(MEMBER, draft());
    expect(readGeckoFormDraft({ id: 'u2', email: 'other@example.com' })).toBeNull();
    expect(saveGeckoFormDraft({ id: '', email: 'guest@local', is_guest: true }, draft())).toBe(false);
    expect(saveGeckoFormDraft(null, draft())).toBe(false);
    // The demo flag alone is enough to refuse, whatever the user object says.
    window.sessionStorage.setItem('geck_inspect_guest_mode', '1');
    expect(saveGeckoFormDraft({ id: 'u3', email: 'x@example.com' }, draft())).toBe(false);
    expect(readGeckoFormDraft(MEMBER)).toBeNull();
  });

  it('does not keep an empty form, forgets a draft after two weeks, and clears on request', () => {
    expect(saveGeckoFormDraft(MEMBER, { form: { name: '  ', image_urls: [] }, hatch: {}, sire: {}, dam: {}, crop: {} })).toBe(false);
    const day = 24 * 60 * 60 * 1000;
    saveGeckoFormDraft(MEMBER, draft(), 1_000);
    expect(readGeckoFormDraft(MEMBER, 1_000 + 13 * day)).not.toBeNull();
    expect(readGeckoFormDraft(MEMBER, 1_000 + 15 * day)).toBeNull();
    expect(window.localStorage.length).toBe(0);

    saveGeckoFormDraft(MEMBER, draft());
    clearGeckoFormDraft(MEMBER);
    expect(readGeckoFormDraft(MEMBER)).toBeNull();
    window.localStorage.setItem('geck_gecko_form_draft_v1:u1', 'not json');
    expect(readGeckoFormDraft(MEMBER)).toBeNull();
  });
});
