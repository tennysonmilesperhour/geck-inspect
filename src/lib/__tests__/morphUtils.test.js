import { describe, it, expect } from 'vitest';
import {
  morphSlug,
  morphDisplayName,
  pickBestMorphRecord,
  indexMorphsBySlug,
} from '../morphUtils';

describe('morphSlug', () => {
  it('lowercases and hyphenates multi-word names', () => {
    expect(morphSlug('Harlequin')).toBe('harlequin');
    expect(morphSlug('Extreme Harlequin')).toBe('extreme-harlequin');
    expect(morphSlug('Lilly White')).toBe('lilly-white');
  });

  it('strips parenthetical qualifiers', () => {
    expect(morphSlug('Hypo (Hypomelanistic)')).toBe('hypo');
  });

  it('collapses slash-separated names', () => {
    expect(morphSlug('Tiger / Brindle')).toBe('tiger-brindle');
  });

  it('returns null for empty or punctuation-only input', () => {
    expect(morphSlug('')).toBeNull();
    expect(morphSlug(null)).toBeNull();
    expect(morphSlug('()')).toBeNull();
  });

  it('round-trips against every KNOWN_MORPH_SLUGS entry via morphDisplayName', () => {
    // morphSlug(morphDisplayName(slug)) must be the identity for canonical slugs.
    for (const slug of [
      'axanthic', 'extreme-harlequin', 'lilly-white', 'super-soft-scale', 'tiger-brindle',
    ]) {
      expect(morphSlug(morphDisplayName(slug))).toBe(slug);
    }
  });
});

describe('morphDisplayName', () => {
  it('title-cases slug segments', () => {
    expect(morphDisplayName('extreme-harlequin')).toBe('Extreme Harlequin');
    expect(morphDisplayName('lilly-white')).toBe('Lilly White');
  });

  it('returns empty string for falsy input', () => {
    expect(morphDisplayName('')).toBe('');
    expect(morphDisplayName(null)).toBe('');
  });
});

describe('pickBestMorphRecord', () => {
  it('returns null for empty input and the sole record for singletons', () => {
    expect(pickBestMorphRecord([])).toBeNull();
    expect(pickBestMorphRecord(null)).toBeNull();
    const only = { morph_name: 'Harlequin' };
    expect(pickBestMorphRecord([only])).toBe(only);
  });

  it('prefers a record with a usable image over one without', () => {
    const withImg = { example_image_url: 'https://cdn.example.com/harley.jpg', description: 'x' };
    const noImg = { description: 'a much longer description that would otherwise score higher '.repeat(3) };
    expect(pickBestMorphRecord([noImg, withImg])).toBe(withImg);
  });

  it('treats known-broken image hosts as no image', () => {
    const broken = { example_image_url: 'https://i.ytimg.com/thumb.jpg' };
    const good = { example_image_url: 'https://cdn.example.com/g.jpg' };
    expect(pickBestMorphRecord([broken, good])).toBe(good);
  });

  it('falls back to longest description when neither has an image', () => {
    const short = { description: 'short' };
    const long = { description: 'a considerably longer description of the morph' };
    expect(pickBestMorphRecord([short, long])).toBe(long);
  });
});

describe('indexMorphsBySlug', () => {
  it('keys by slug and keeps the best row per slug', () => {
    const rows = [
      { morph_name: 'Harlequin', description: 'short' },
      { morph_name: 'Harlequin', example_image_url: 'https://cdn.example.com/h.jpg', description: 'x' },
      { morph_name: 'Lilly White', description: 'the white one' },
    ];
    const idx = indexMorphsBySlug(rows);
    expect(Object.keys(idx).sort()).toEqual(['harlequin', 'lilly-white']);
    expect(idx.harlequin.example_image_url).toBe('https://cdn.example.com/h.jpg');
  });

  it('skips rows whose name does not slugify', () => {
    const idx = indexMorphsBySlug([{ morph_name: '' }, { morph_name: 'Flame' }]);
    expect(Object.keys(idx)).toEqual(['flame']);
  });

  it('handles empty and nullish input', () => {
    expect(indexMorphsBySlug([])).toEqual({});
    expect(indexMorphsBySlug(null)).toEqual({});
  });
});
