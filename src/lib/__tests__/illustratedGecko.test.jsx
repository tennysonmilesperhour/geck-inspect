import React from 'react';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import TraitGecko, { traitAsset, CREST_PATHS } from '@/components/morphguide/TraitGecko';
import IllustratedGecko, { STUDY_MORPHS, fieldGuidePlate, hasIllustration } from '@/components/morphguide/IllustratedGecko';
import MorphEyeGuide, { EYE_COLOR_STUDIES, MorphEyeStudyPanel, eyeStudyForMorph } from '@/components/morphguide/MorphEyeGuide';
import { eyeStudyIdForMorph } from '@/components/morphguide/eyeStudyIndex';
import { pinSegments } from '@/components/morphguide/traitStudyMath';
import { SPECIMENS, STUDY_LESSONS, STUDY_QUESTIONS, normalizedStudy, traitDescription } from '@/components/morphguide/patternStudy';
import PatternSpectrum, { spectrumPositionFor } from '@/components/morphguide/PatternSpectrum';
import { SpecimenPhoto } from '@/components/morphguide/SpecimenStudy';
import { MORPHS } from '@/data/morph-guide';
import { PROJECT_LINES, projectLinePlate } from '@/data/project-lines';
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
  // Guide entries added in October 2026 that have no field guide plate yet.
  // They show the "use documented specimen photographs" panel instead. Paint
  // a plate (public/morph-guide/field-guide-v1/<slug>.webp), add a preset in
  // illustratedGeckoPresets.js and take the slug off this list.
  const AWAITING_PLATE = ['phantom','empty-back','super-empty-back','whiteout','super-whiteout','luwak','super-lilly-white','super-cappuccino','super-sable','super-highway'];
  it('provides a field guide plate for every morph in the guide that has one, and rejects unknown slugs', () => {
    for (const slug of STUDY_MORPHS) expect(slugs.has(slug)).toBe(true);
    expect(MORPHS.filter(m => !hasIllustration(m.slug)).map(m => m.slug).sort()).toEqual([...AWAITING_PLATE].sort());
    for (const morph of MORPHS.filter(m => hasIllustration(m.slug))) {
      expect(existsSync(`public${fieldGuidePlate(morph.slug)}`)).toBe(true);
      const html = renderToStaticMarkup(<IllustratedGecko morph={morph.slug} />);
      expect(html).toContain(fieldGuidePlate(morph.slug));
    }
    for (const slug of AWAITING_PLATE) {
      const html = renderToStaticMarkup(<IllustratedGecko morph={slug} />);
      expect(html).toContain('Use documented specimen photographs');
      expect(html).not.toContain('<img');
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
  it('draws the base and each requested layer straight from the precomputed pigment-only files, and interpolates masks smoothly without NaN', () => {
    const html=renderToStaticMarkup(<TraitGecko traits={{ dorsal:1,lateral:1,pinstripe:1,spots:1 }} />);
    expect(html).toContain('role="img"'); expect(html).toContain(traitAsset('side'));
    for (const layer of ['dorsal','lateral','pinstripe','spots']) expect(html).toContain(`data-layer="${layer}"`);
    // Never the full edited drawings (a whole second animal), and no in-page pixel work.
    expect(html).not.toContain('ink-studies'); expect(html).not.toContain('data:image');
    expect(html).not.toContain('NaN');
    for (const v of [0.05, 0.25, 0.5, 0.85, 1]) {
      const midHtml = renderToStaticMarkup(<TraitGecko view="top" tone="mahogany" fired={0.6} traits={{ dorsal: v, lateral: v, pinstripe: v, tiger: v, spots: v }} />);
      expect(midHtml).not.toContain('NaN');
      expect(midHtml).toContain('feColorMatrix');
    }
  });
  it('loads the eye studies only when a page shows them, from a lookup that agrees with the studies', () => {
    for (const morph of MORPHS) expect(eyeStudyIdForMorph(morph.slug)).toBe(eyeStudyForMorph(morph.slug)?.id ?? null);
    for (const slug of ['toString', 'constructor', '', undefined]) expect(eyeStudyIdForMorph(slug)).toBeNull();
    // Neither page imports the studies or the pattern studio with the page
    // itself (about 12 kB together); both load when the page shows them.
    for (const page of ['src/pages/MorphGuide.jsx', 'src/pages/MorphDetail.jsx']) {
      const src = readFileSync(page, 'utf8');
      for (const mod of ['MorphEyeGuide', 'PatternSpectrum']) {
        expect(src, `${page} ${mod}`).not.toMatch(new RegExp(`^\\s*import\\s[^;]*from\\s+['"]@/components/morphguide/${mod}['"]`, 'm'));
      }
    }
    const albino = renderToStaticMarkup(<MorphEyeStudyPanel slug="albino" />);
    expect(albino).toContain(eyeStudyForMorph('albino').plate);
    expect(renderToStaticMarkup(<MorphEyeStudyPanel slug="harlequin" />)).toBe('');
  });
  it('keeps every shipped study file small enough for a phone on the Morph Guide', () => {
    for (const view of ['side','top']) for (const layer of ['base','cream','pin','tiger','spots']) {
      expect(statSync(`public${traitAsset(view,layer)}`).size).toBeLessThan(60 * 1024);
    }
  });
  it('starts with real specimens and offers studio and recognition practice', () => {
    const html=renderToStaticMarkup(<MemoryRouter><PatternSpectrum focusSlug="pinstripe" /></MemoryRouter>);
    expect(html).toContain('Guided observations'); expect(html).toContain('Pattern studio'); expect(html).toContain('Test your eye');
    expect(html).toContain('data-trait-view="top"'); expect(html).toContain(SPECIMENS.pin.src);
    expect(html).toContain('/MorphGuide/pinstripe');
  });
});

