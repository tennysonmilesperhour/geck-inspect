import React from 'react';
import { existsSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import TraitGecko, { traitAsset, CREST_PATHS, BASE_TONES } from '@/components/morphguide/TraitGecko';
import IllustratedGecko, { STUDY_MORPHS, fieldGuidePlate, hasIllustration } from '@/components/morphguide/IllustratedGecko';
import MorphEyeGuide, { EYE_COLOR_STUDIES, eyeStudyForMorph } from '@/components/morphguide/MorphEyeGuide';
import { pinSegments } from '@/components/morphguide/traitStudyMath';
import { SPECIMENS, STUDY_LESSONS, STUDY_QUESTIONS, MORPH_PROGRESSION_TRACKS, normalizedStudy, traitDescription } from '@/components/morphguide/patternStudy';
import PatternSpectrum, { spectrumPositionFor, MorphProgressionPlayer, CustomMorphComparator } from '@/components/morphguide/PatternSpectrum';
import { SpecimenPhoto } from '@/components/morphguide/SpecimenStudy';
import { MORPHS } from '@/data/morph-guide';
import { PROJECT_LINES, projectLinePlate } from '@/data/project-lines';
vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));
const slugs = new Set(MORPHS.map(m => m.slug));

describe('specimen-based lessons', () => {
  it('connects every lesson and practice question to credited specimen records and local approved assets', () => {
    expect(STUDY_LESSONS.length).toBeGreaterThanOrEqual(6);
    expect(STUDY_QUESTIONS.length).toBeGreaterThanOrEqual(8);
    for (const lesson of STUDY_LESSONS) {
      expect(slugs.has(lesson.guide)).toBe(true);
      expect(lesson.examples.length).toBeGreaterThan(1);
      lesson.examples.forEach(id => expect(SPECIMENS[id]?.credit).toBeTruthy());
    }
    for (const question of STUDY_QUESTIONS) {
      expect(SPECIMENS[question.specimen]).toBeTruthy();
      expect(question.answers[question.correct]).toBeTruthy();
      if (question.plateSlug) expect(slugs.has(question.plateSlug)).toBe(true);
    }
    for (const photo of Object.values(SPECIMENS)) {
      expect(photo.source).toMatch(/^https:\/\//);
      if (photo.reuseApproved) {
        expect(existsSync(`public${photo.src}`)).toBe(true);
      }
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
    expect(spectrumPositionFor('harlequin')).toEqual({ track:'coverage', pos:2 });
    expect(spectrumPositionFor('lilly-white')).toEqual({ track:'coverage', pos:2 });
    expect(spectrumPositionFor('brindle')).toEqual({ track:'features', pos:0 });
    expect(spectrumPositionFor('cappuccino')).toEqual({ track:'pigment', pos:0 });
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

describe('animated morph progression tracks', () => {
  it('validates all 5 morph progression tracks, stage plates, and anatomical callouts', () => {
    expect(MORPH_PROGRESSION_TRACKS).toHaveLength(5);
    for (const track of MORPH_PROGRESSION_TRACKS) {
      expect(track.steps.length).toBeGreaterThanOrEqual(4);
      for (const step of track.steps) {
        expect(slugs.has(step.slug)).toBe(true);
        expect(existsSync(`public${fieldGuidePlate(step.slug)}`)).toBe(true);
        expect(step.traits).toBeTruthy();
        expect(step.pins.length).toBeGreaterThan(0);
        for (const pt of step.pins) {
          expect(pt.x).toBeGreaterThanOrEqual(0);
          expect(pt.x).toBeLessThanOrEqual(100);
          expect(pt.y).toBeGreaterThanOrEqual(0);
          expect(pt.y).toBeLessThanOrEqual(100);
        }
      }
    }
  });
  it('renders MorphProgressionPlayer and CustomMorphComparator cleanly', () => {
    const playerHtml = renderToStaticMarkup(
      <MemoryRouter>
        <MorphProgressionPlayer trackId="coverage" initialStep={3} />
      </MemoryRouter>
    );
    expect(playerHtml).toContain('Field guide progression');
    expect(playerHtml).toContain('Animate transition');
    expect(playerHtml).toContain('/morph-guide/field-guide-v1/harlequin.webp');

    const compHtml = renderToStaticMarkup(
      <MemoryRouter>
        <CustomMorphComparator initialA="flame" initialB="harlequin" />
      </MemoryRouter>
    );
    expect(compHtml).toContain('Crossfade any two morphs in the field guide');
    expect(compHtml).toContain('/morph-guide/field-guide-v1/flame.webp');
    expect(compHtml).toContain('/morph-guide/field-guide-v1/harlequin.webp');
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
  it('provides a field guide plate for every morph in the guide and rejects unknown slugs', () => {
    expect(STUDY_MORPHS).toHaveLength(MORPHS.length);
    for (const morph of MORPHS) {
      expect(hasIllustration(morph.slug)).toBe(true);
      expect(existsSync(`public${fieldGuidePlate(morph.slug)}`)).toBe(true);
      const html = renderToStaticMarkup(<IllustratedGecko morph={morph.slug} />);
      expect(html).toContain(fieldGuidePlate(morph.slug));
    }
    for (const slug of ['unknown-morph', 'toString', '']) {
      expect(hasIllustration(slug)).toBe(false);
      const html = renderToStaticMarkup(<IllustratedGecko morph={slug} />);
      expect(html).not.toContain('<img');
      expect(html).not.toContain('<image');
    }
  });
  it('provides close-up eye study plates and project line field guide plates on disk', () => {
    expect(EYE_COLOR_STUDIES).toHaveLength(6);
    for (const study of EYE_COLOR_STUDIES) {
      expect(existsSync(`public${study.plate}`)).toBe(true);
    }
    const eyeHtml = renderToStaticMarkup(<MemoryRouter><MorphEyeGuide /></MemoryRouter>);
    expect(eyeHtml).toContain('Crested Gecko Eye Colors');
    expect(eyeHtml).toContain(EYE_COLOR_STUDIES[0].plate);
    expect(eyeStudyForMorph('albino')?.id).toBe('ruby-albino');
    expect(eyeStudyForMorph('axanthic')?.id).toBe('silver-gray');
    expect(eyeStudyForMorph('cappuccino')?.id).toBe('melanistic-dark');
    expect(eyeStudyForMorph('harlequin')).toBeNull();

    for (const line of PROJECT_LINES) {
      const plate = projectLinePlate(line.slug);
      expect(plate).toBe(`/morph-guide/project-lines-v1/${line.slug}.webp`);
      expect(existsSync(`public${plate}`)).toBe(true);
    }
    expect(projectLinePlate('unknown-line')).toBeNull();
  });
  it('keeps an accessible base until pigment extraction is ready and interpolates masks smoothly without NaN across all 8 base tones', () => {
    const html=renderToStaticMarkup(<TraitGecko traits={{ dorsal:1,lateral:1,pinstripe:1,spots:1 }} />);
    expect(html).toContain('role="img"'); expect(html).toContain(traitAsset('side'));
    expect(html).not.toContain('data-layer="pinstripe"');
    expect(html).not.toContain('NaN');
    for (const toneKey of Object.keys(BASE_TONES)) {
      const toneHtml = renderToStaticMarkup(<TraitGecko view="side" tone={toneKey} fired={0.75} traits={{ dorsal: 0.6, lateral: 0.5, pinstripe: 0.7, tiger: 0.4, spots: 0.3 }} />);
      expect(toneHtml).not.toContain('NaN');
      expect(toneHtml).toContain('feColorMatrix');
    }
    for (const v of [0.05, 0.25, 0.5, 0.85, 1]) {
      const midHtml = renderToStaticMarkup(<TraitGecko view="top" tone="mahogany" fired={0.6} traits={{ dorsal: v, lateral: v, pinstripe: v, tiger: v, spots: v }} />);
      expect(midHtml).not.toContain('NaN');
      expect(midHtml).toContain('feColorMatrix');
    }
  });
  it('starts with real specimens and offers studio, animated transitions, and recognition practice', () => {
    const html=renderToStaticMarkup(<MemoryRouter><PatternSpectrum focusSlug="pinstripe" /></MemoryRouter>);
    expect(html).toContain('Guided observations');
    expect(html).toContain('Pattern studio');
    expect(html).toContain('Test your eye');
    expect(html).toContain('Animated transitions');
    expect(html).toContain('data-trait-view="top"');
    expect(html).toContain(SPECIMENS.pin.src);
    expect(html).toContain('/MorphGuide/pinstripe');
  });
});

