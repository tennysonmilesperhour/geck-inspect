import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));

import { MORPHS } from '@/data/morph-guide';
import IllustratedGecko from '@/components/morphguide/IllustratedGecko';
import PatternSpectrum, { SPECTRUM_TRACKS, spectrumPositionFor } from '@/components/morphguide/PatternSpectrum';
import {
  ILLUSTRATED_GECKO_PRESETS,
  hasIllustration,
  lerpPhenotype,
  normalizePhenotype,
  phenotypeAlong,
} from '@/components/morphguide/illustratedGeckoPresets';

const SLUGS = new Set(MORPHS.map((m) => m.slug));

const REQUIRED = [
  'flame', 'harlequin', 'extreme-harlequin', 'pinstripe', 'phantom-pinstripe', 'tricolor', 'bicolor',
  'patternless', 'tiger', 'brindle', 'dalmatian', 'super-dalmatian', 'lilly-white', 'axanthic',
  'cappuccino', 'albino', 'moonglow',
];

describe('illustrated gecko presets', () => {
  it('every preset slug is a real Morph Guide slug', () => {
    Object.keys(ILLUSTRATED_GECKO_PRESETS).forEach((slug) => {
      expect(SLUGS.has(slug), slug).toBe(true);
    });
  });

  it('covers the required morphs', () => {
    REQUIRED.forEach((slug) => expect(hasIllustration(slug), slug).toBe(true));
    expect(hasIllustration('not-a-morph')).toBe(false);
    expect(hasIllustration('toString')).toBe(false);
  });

  it('labels Moonglow as a breeding goal', () => {
    expect(ILLUSTRATED_GECKO_PRESETS.moonglow.goal).toBe(true);
    expect(ILLUSTRATED_GECKO_PRESETS.moonglow.label).toMatch(/goal/i);
  });

  it('every spectrum link points at a real morph', () => {
    Object.values(SPECTRUM_TRACKS).forEach((track) => {
      track.stops.forEach((s) => s.slugs.forEach((l) => expect(SLUGS.has(l.slug), l.slug).toBe(true)));
      if (track.note) expect(SLUGS.has(track.note.slug)).toBe(true);
      expect(track.keyframes.length).toBe(track.stops.length);
    });
  });

  it('no em or en dashes in any copy', () => {
    const text = JSON.stringify([ILLUSTRATED_GECKO_PRESETS, SPECTRUM_TRACKS]);
    expect(text).not.toMatch(/[–—]/);
  });
});

describe('phenotype helpers', () => {
  it('clamps junk values', () => {
    const p = normalizePhenotype({ lateral: 4, dalmatian: -3, dorsalStyle: 'nope' });
    expect(p.lateral).toBe(1);
    expect(p.dalmatian).toBe(0);
    expect(p.dorsalStyle).toBe('flame');
  });

  it('interpolates numbers and colors', () => {
    const mid = lerpPhenotype({ lateral: 0, palette: { base: '#000000' } }, { lateral: 1, palette: { base: '#ffffff' } }, 0.5);
    expect(mid.lateral).toBeCloseTo(0.5);
    expect(mid.palette.base).toBe('#808080');
    const end = phenotypeAlong(SPECTRUM_TRACKS.coverage.keyframes, 99);
    expect(end.lateral).toBe(1);
  });

  it('finds the spectrum position for a morph page', () => {
    expect(spectrumPositionFor('harlequin')).toEqual({ track: 'coverage', pos: 2 });
    expect(spectrumPositionFor('pinstripe')).toEqual({ track: 'pinning', pos: 2 });
    expect(spectrumPositionFor('dalmatian')).toBeNull();
  });
});

describe('rendering', () => {
  it('renders every preset as an accessible SVG', () => {
    Object.keys(ILLUSTRATED_GECKO_PRESETS).forEach((slug) => {
      const html = renderToStaticMarkup(<IllustratedGecko morph={slug} size={120} />);
      expect(html).toMatch(/^<svg/);
      expect(html).toContain('role="img"');
      expect(html).not.toContain('NaN');
    });
  });

  it('renders the spectrum on both tracks', () => {
    const a = renderToStaticMarkup(<MemoryRouter><PatternSpectrum focusSlug="flame" /></MemoryRouter>);
    expect(a).toContain('Flame');
    expect(a).toContain('/MorphGuide/flame');
    const b = renderToStaticMarkup(<MemoryRouter><PatternSpectrum initialTrack="pinning" initialPosition={1} /></MemoryRouter>);
    expect(b).toContain('Partial Pinstripe');
    expect(b).toContain('/MorphGuide/phantom-pinstripe');
    expect(b).not.toContain('NaN');
  });
});
