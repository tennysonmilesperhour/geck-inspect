import React from 'react';
import { existsSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import TraitGecko, { traitAsset, CREST_PATHS } from '@/components/morphguide/TraitGecko';
import IllustratedGecko, { STUDY_MORPHS, hasIllustration } from '@/components/morphguide/IllustratedGecko';
import { pinSegments } from '@/components/morphguide/traitStudyMath';
import { SPECIMENS, STUDY_LESSONS, STUDY_QUESTIONS, normalizedStudy, traitDescription } from '@/components/morphguide/patternStudy';
import PatternSpectrum, { spectrumPositionFor } from '@/components/morphguide/PatternSpectrum';
import { SpecimenPhoto } from '@/components/morphguide/SpecimenStudy';
import { MORPHS } from '@/data/morph-guide';
vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));
const slugs = new Set(MORPHS.map(m => m.slug));

describe('specimen-based lessons', () => {
  it('connects every lesson and practice question to credited specimen records', () => {
    for (const lesson of STUDY_LESSONS) {
      expect(slugs.has(lesson.guide)).toBe(true);
      expect(lesson.examples.length).toBeGreaterThan(1);
      lesson.examples.forEach(id => expect(SPECIMENS[id]?.credit).toBeTruthy());
    }
    for (const question of STUDY_QUESTIONS) {
      expect(SPECIMENS[question.specimen]).toBeTruthy();
      expect(question.answers[question.correct]).toBeTruthy();
    }
    for (const photo of Object.values(SPECIMENS)) {
      expect(photo.source).toMatch(/^https:\/\//);
      for (const point of photo.points) { expect(point.x).toBeGreaterThanOrEqual(0); expect(point.x).toBeLessThanOrEqual(100); expect(point.y).toBeGreaterThanOrEqual(0); expect(point.y).toBeLessThanOrEqual(100); }
    }
  });
  it('clamps controls and uses descriptive rather than diagnostic grades', () => {
    expect(normalizedStudy({ lateral:9, spots:-1, tiger:'x' })).toEqual({ dorsal:0, lateral:1, pinstripe:0, tiger:0, spots:0 });
    expect(traitDescription('spots',1)).toBe('Dense');
    expect(traitDescription('pinstripe',1)).toBe('Continuous');
    expect(traitDescription('lateral',.7)).not.toMatch(/extreme|%/i);
  });
  it('opens appropriate studies without treating Phantom as a pin-continuity setting', () => {
    expect(spectrumPositionFor('pinstripe')).toEqual({ track:'pinning', pos:2 });
    expect(spectrumPositionFor('dalmatian')).toEqual({ track:'features', pos:0 });
    expect(spectrumPositionFor('phantom-pinstripe')).toBeNull();
    expect(spectrumPositionFor('patternless')).toBeNull();
  });
  it('links to the original photograph in production unless reuse is explicitly approved', () => {
    const html = renderToStaticMarkup(<SpecimenPhoto specimen={SPECIMENS.flame} previewPhotos={false} />);
    expect(html).not.toContain('<img');
    expect(html).not.toContain(SPECIMENS.flame.src);
    expect(html).toContain(SPECIMENS.flame.source);
    expect(html).toContain('Open original photograph');
    const cleared = renderToStaticMarkup(<SpecimenPhoto specimen={{ ...SPECIMENS.flame, reuseApproved: true }} previewPhotos={false} />);
    expect(cleared).toContain('<img');
    expect(cleared).toContain(SPECIMENS.flame.src);
  });
});

describe('pin continuity', () => {
  it('covers only the registered crest path with bounded, uneven, monotonic segments', () => {
    expect(pinSegments(0)).toEqual([]);
    expect(pinSegments(1)).toEqual([{ start:0,length:100 }]);
    for (const row of [0,1]) {
      let last=0;
      for (let n=0;n<=100;n++) {
        const segments=pinSegments(n/100,row);
        const total=segments.reduce((sum,s)=>sum+s.length,0);
        expect(total).toBeGreaterThanOrEqual(last-.000001);
        for (const s of segments) { expect(s.start).toBeGreaterThanOrEqual(0); expect(s.start+s.length).toBeLessThanOrEqual(100.00001); }
        last=total;
      }
      expect(new Set(pinSegments(.5,row).map(s=>s.length)).size).toBeGreaterThan(3);
    }
    expect(CREST_PATHS.side).toHaveLength(1);
    expect(CREST_PATHS.top).toHaveLength(2);
  });
});

describe('illustrated examples', () => {
  it('has local artwork for both views and every independent pigment layer', () => {
    for (const view of ['side','top']) for (const layer of ['base','cream','pin','tiger','spots']) expect(existsSync(`public${traitAsset(view,layer)}`)).toBe(true);
  });
  it('limits generic illustrations to supported visible patterns', () => {
    STUDY_MORPHS.forEach(slug => { expect(slugs.has(slug)).toBe(true); expect(hasIllustration(slug)).toBe(true); });
    for (const slug of ['albino','moonglow','axanthic','phantom-pinstripe','soft-scale','toString']) {
      expect(hasIllustration(slug)).toBe(false);
      const html=renderToStaticMarkup(<IllustratedGecko morph={slug} />);
      expect(html).not.toContain('<img'); expect(html).not.toContain('<image');
    }
  });
  it('keeps an accessible base until pigment extraction is ready rather than showing a wrong full edited plate', () => {
    const html=renderToStaticMarkup(<TraitGecko traits={{ dorsal:1,lateral:1,pinstripe:1,spots:1 }} />);
    expect(html).toContain('role="img"'); expect(html).toContain(traitAsset('side'));
    expect(html).not.toContain('data-layer="pinstripe"');
    expect(html).not.toContain('NaN');
  });
  it('starts with real specimens and offers studio and recognition practice', () => {
    const html=renderToStaticMarkup(<MemoryRouter><PatternSpectrum focusSlug="pinstripe" /></MemoryRouter>);
    expect(html).toContain('Guided observations'); expect(html).toContain('Pattern studio'); expect(html).toContain('Test your eye');
    expect(html).toContain('data-trait-view="top"'); expect(html).toContain(SPECIMENS.pin.src);
    expect(html).toContain('/MorphGuide/pinstripe');
  });
});
