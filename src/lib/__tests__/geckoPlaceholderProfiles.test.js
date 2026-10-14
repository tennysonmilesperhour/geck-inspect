import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GECKO_ART_STYLES, geckoArtStyle, geckoPlaceholderAsset, geckoPlaceholderProfile, normalizeGeckoArtStyle } from '../geckoPlaceholderProfiles';

const NOW = new Date(2026, 9, 14, 12);
const profile = gecko => geckoPlaceholderProfile(gecko, NOW);

describe('record-driven gecko artwork', () => {
  it('inherits the owner default, keeps individual overrides, and restores the stable mix', () => {
    const gecko = { id: 'owner-preference', inherited_placeholder_style: 'nouveau' };
    expect(profile(gecko).style.id).toBe('nouveau');
    expect(profile({ ...gecko, inherited_placeholder_style: 'woodcut' }).style.id).toBe('woodcut');
    expect(profile({ ...gecko, placeholder_style: 'celestial' }).style.id).toBe('celestial');
    expect(profile({ ...gecko, placeholder_style: 'invalid' }).style.id).toBe('nouveau');
    expect(profile({ ...gecko, placeholder_style: null, inherited_placeholder_style: null }).style.id).toBe(geckoArtStyle(gecko).id);
    expect(geckoPlaceholderProfile(gecko, NOW, 'terracotta').style.id).toBe('terracotta');
  });

  it('honors every saved style as age and sex change, and restores the original automatic style', () => {
    const gecko = { id: 'chosen-style', name: 'Fern' };
    const originalStyle = profile(gecko).style.id;
    for (const { id } of GECKO_ART_STYLES) {
      expect(profile({ ...gecko, placeholder_style: id }).style.id).toBe(id);
      expect(profile({ ...gecko, placeholder_style: id, sex: 'Female', hatch_date: '2026-09-14' }))
        .toMatchObject({ style: { id }, sex: 'female', ageGroup: 'hatchling' });
      expect(geckoPlaceholderProfile({ ...gecko, placeholder_style: id }, NOW, 'woodcut').style.id).toBe('woodcut');
    }
    for (const placeholder_style of [null, undefined, '', 'automatic', 'unknown', '../../file', 5]) {
      expect(normalizeGeckoArtStyle(placeholder_style)).toBeNull();
      expect(profile({ ...gecko, placeholder_style }).style.id).toBe(originalStyle);
    }
  });

  it('keeps a saved animal in the same family after edits and reordering', () => {
    const gecko = { id: '9c4a4b22-8191-4286-8ed5-10475aa7f37f', name: 'Fern', sex: 'Unsexed' };
    const family = geckoArtStyle(gecko).id;
    expect(geckoArtStyle({ ...gecko, name: 'New name', sex: 'Female', hatch_date: '2026-09-01' }).id).toBe(family);
    const collection = Array.from({ length: 100 }, (_, i) => ({ id: `animal-${i}` }));
    const before = Object.fromEntries(collection.map(g => [g.id, geckoArtStyle(g).id]));
    for (const g of [...collection].reverse()) expect(geckoArtStyle(g).id).toBe(before[g.id]);
    expect(new Set(Object.values(before)).size).toBe(5);
  });

  it('uses the recorded sex, with a neutral default for missing or uncertain values', () => {
    expect(profile({ sex: 'Female' }).sex).toBe('female');
    expect(profile({ sex: ' male ' }).sex).toBe('male');
    for (const sex of [undefined, '', 'Unsexed', 'Unknown', 'Probable female']) {
      expect(profile({ sex }).sex).toBe('unsexed');
    }
  });

  it.each([
    ['2026-10-14', 'hatchling', '0d'],
    ['2026-10-01', 'hatchling', '13d'],
    ['2026-04-15', 'hatchling', '5mo'],
    ['2026-04-14', 'juvenile', '6mo'],
    ['2025-04-15', 'juvenile', '1y 5mo'],
    ['2025-04-14', 'adult', '1y 6mo'],
    ['2024-10-14', 'adult', '2y'],
  ])('selects age artwork at calendar boundaries for %s', (hatch_date, group, detail) => {
    expect(profile({ hatch_date })).toMatchObject({ ageGroup: group, artStage: group, ageDetail: detail });
  });

  it('accepts the Date objects used by the live edit form', () => {
    expect(profile({ hatch_date: new Date(2026, 8, 14) })).toMatchObject({ ageGroup: 'hatchling', ageDetail: '1mo' });
  });

  it('does not invent an age from missing, invalid or future dates', () => {
    for (const hatch_date of [undefined, '', 'invalid', '2026-02-31', '2026-10-15', new Date('invalid'), 123]) {
      expect(profile({ hatch_date })).toMatchObject({ ageGroup: 'unknown', ageLabel: 'Age not set', ageDetail: null, artStage: 'adult' });
    }
  });

  it('does not turn an estimated hatch year into a made-up birthday', () => {
    expect(profile({ estimated_hatch_year: 2024 })).toMatchObject({ ageGroup: 'adult', ageDetail: 'Hatched ~2024' });
    expect(profile({ estimated_hatch_year: 2025 })).toMatchObject({ ageGroup: 'unknown', ageDetail: 'Hatched ~2025' });
    expect(profile({ estimated_hatch_year: 2026 })).toMatchObject({ ageGroup: 'unknown', ageDetail: 'Hatched ~2026' });
    expect(profile({ estimated_hatch_year: 2027 })).toMatchObject({ ageGroup: 'unknown', ageDetail: null });
    expect(profile({ estimated_hatch_year: 2024, hatch_date: '2026-09-14' })).toMatchObject({ ageGroup: 'hatchling', ageDetail: '1mo' });
  });

  it('ships both resolutions for every style and age, including the unknown-age default', () => {
    for (const style of GECKO_ART_STYLES) {
      for (const hatch_date of ['2026-09-14', '2025-12-14', '2024-04-14', null]) {
        const p = geckoPlaceholderProfile({ hatch_date }, NOW, style.id);
        const small = geckoPlaceholderAsset(p, 500);
        const large = geckoPlaceholderAsset(p, 800);
        expect(small).toContain('-512.webp');
        expect(large).toContain('-1024.webp');
        for (const asset of [small, large]) expect(existsSync(resolve('public', asset.slice(1))), asset).toBe(true);
      }
    }
  });
});
