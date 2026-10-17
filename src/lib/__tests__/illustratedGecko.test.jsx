import React from 'react';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import TraitGecko, { traitAsset, CREST_PATHS, BASE_TONES } from '@/components/morphguide/TraitGecko';
import IllustratedGecko, { STUDY_MORPHS, fieldGuidePlate, hasIllustration } from '@/components/morphguide/IllustratedGecko';
import MorphEyeGuide, { EYE_COLOR_STUDIES, MorphEyeStudyPanel, eyeStudyForMorph } from '@/components/morphguide/MorphEyeGuide';
import { eyeStudyIdForMorph } from '@/components/morphguide/eyeStudyIndex';
import { pinSegments } from '@/components/morphguide/traitStudyMath';
import { SPECIMENS, STUDY_LESSONS, STUDY_QUESTIONS, MORPH_PROGRESSION_TRACKS, normalizedStudy, traitDescription } from '@/components/morphguide/patternStudy';
import PatternSpectrum, { MorphProgressionPlayer, CustomMorphComparator } from '@/components/morphguide/PatternSpectrum';
// Imported from its own file, as MorphDetail does: re-exporting it from
// the studio made the build give it a separate download on morph pages.
import { spectrumPositionFor } from '@/components/morphguide/spectrumPosition';
import { SpecimenPhoto } from '@/components/morphguide/SpecimenStudy';
import { MORPHS } from '@/data/morph-guide';
import { PROJECT_LINES, projectLinePlate } from '@/data/project-lines';
import MorphIndexCard from '@/components/morphguide/MorphIndexCard';
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
  it('validates all 6 morph progression tracks, stage plates, and anatomical callouts', () => {
    expect(MORPH_PROGRESSION_TRACKS).toHaveLength(6);
    for (const track of MORPH_PROGRESSION_TRACKS) {
      expect(track.steps.length).toBeGreaterThanOrEqual(4);
      for (const step of track.steps) {
        expect(slugs.has(step.slug)).toBe(true);
        expect(existsSync(`public${fieldGuidePlate(step.slug)}`)).toBe(true);
        expect(step.traits).toBeTruthy();
        expect(BASE_TONES[step.tone]).toBeTruthy();
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
  it('keeps progression copy within what the guide can show', () => {
    const text = (slug) => MORPH_PROGRESSION_TRACKS.flatMap(t => t.steps).filter(st => st.slug === slug)
      .map(st => [st.stage, st.note, ...st.pins.map(pt => `${pt.title} ${pt.detail}`)].join(' ')).join(' ');
    // Albino's inheritance is not proven yet (src/data/morph-guide.js).
    expect(text('albino')).not.toMatch(/\bTYR\b|\brecessive\b/i);
    // Phantom Pinstripe is a historical look, not proof of the Phantom gene.
    expect(text('phantom-pinstripe')).not.toMatch(/Phantom suppresses|melanin suppression/i);
    // One-copy Cappuccino is not "Melanistic" (that name belongs to Super Cappuccino).
    expect(text('cappuccino')).not.toMatch(/^\S*\s*Melanistic|Melanistic incomplete/i);
    // Spot counts are not a standard for Dalmatian or Super Dalmatian.
    expect(`${text('dalmatian')} ${text('super-dalmatian')}`).not.toMatch(/\d+\s*(to|-)\s*\d+\s*.*spots|\d+\+/i);
  });
  it('renders MorphProgressionPlayer with outer leader-line callouts and CustomMorphComparator cleanly', () => {
    const playerHtml = renderToStaticMarkup(
      <MemoryRouter>
        <MorphProgressionPlayer trackId="coverage" initialStep={3} />
      </MemoryRouter>
    );
    expect(playerHtml).toContain('Field guide progression');
    expect(playerHtml).toContain('Animate transition');
    expect(playerHtml).toContain('/morph-guide/field-guide-v1/harlequin.webp');
    expect(playerHtml).toContain('data-callout-leader="1"');
    expect(playerHtml).toContain('top:11.5%');
    expect(playerHtml).toContain('top:88.5%');

    const compHtml = renderToStaticMarkup(
      <MemoryRouter>
        <CustomMorphComparator initialA="flame" initialB="harlequin" />
      </MemoryRouter>
    );
    expect(compHtml).toContain('Crossfade any two morphs in the field guide');
    expect(compHtml).toContain('/morph-guide/field-guide-v1/flame.webp');
    expect(compHtml).toContain('/morph-guide/field-guide-v1/harlequin.webp');
    const offered = [...compHtml.matchAll(/<option value="([^"]+)"/g)].map(m => m[1]);
    expect(offered.length).toBeGreaterThan(0);
    for (const slug of offered) expect(existsSync(`public${fieldGuidePlate(slug)}`), slug).toBe(true);
    expect(offered).toContain('phantom');
    expect(offered).toContain('whiteout');
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
  const AWAITING_PLATE = [];
  it('provides a field guide plate for 100% of morphs in the guide, and renders drawings rather than real photos on MorphIndexCard', () => {
    for (const slug of STUDY_MORPHS) expect(slugs.has(slug)).toBe(true);
    expect(MORPHS.filter(m => !hasIllustration(m.slug)).map(m => m.slug)).toEqual(AWAITING_PLATE);
    for (const morph of MORPHS) {
      expect(hasIllustration(morph.slug), morph.slug).toBe(true);
      expect(existsSync(`public${fieldGuidePlate(morph.slug)}`), morph.slug).toBe(true);
      const html = renderToStaticMarkup(<IllustratedGecko morph={morph.slug} />);
      expect(html).toContain(fieldGuidePlate(morph.slug));
      const cardHtml = renderToStaticMarkup(
        <MemoryRouter>
          <MorphIndexCard
            morph={{
              ...morph,
              heroImage: 'https://example.com/real-gecko-photo.jpg',
              heroImages: ['https://example.com/real-gecko-photo.jpg'],
            }}
          />
        </MemoryRouter>
      );
      expect(cardHtml).toContain(fieldGuidePlate(morph.slug));
      expect(cardHtml).not.toContain('real-gecko-photo.jpg');
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
  it('draws the base and each requested layer straight from the precomputed pigment-only files, and interpolates masks smoothly without NaN across every base tone', () => {
    const html=renderToStaticMarkup(<TraitGecko traits={{ dorsal:1,lateral:1,pinstripe:1,spots:1,emptyBack:0.7,whitewall:0.8,whiteFactor:0.75,pied:0.8 }} />);
    expect(html).toContain('role="img"'); expect(html).toContain(traitAsset('side'));
    for (const layer of ['dorsal','lateral','pinstripe','spots','emptyBack','whitewall','whiteFactor','pied']) expect(html).toContain(`data-layer="${layer}"`);
    // Never the full edited drawings (a whole second animal), and no in-page pixel work.
    expect(html).not.toContain('ink-studies'); expect(html).not.toContain('data:image');
    expect(html).not.toContain('NaN');
    expect(Object.keys(BASE_TONES).length).toBeGreaterThanOrEqual(17);
    for (const toneKey of Object.keys(BASE_TONES)) {
      const toneHtml = renderToStaticMarkup(<TraitGecko view="side" tone={toneKey} fired={0.75} traits={{ dorsal: 0.6, lateral: 0.5, pinstripe: 0.7, tiger: 0.4, spots: 0.3, emptyBack: 0.4, whitewall: 0.5, whiteFactor: 0.5, pied: 0.4 }} />);
      expect(toneHtml).not.toContain('NaN');
      expect(toneHtml).toContain('feColorMatrix');
    }
    for (const v of [0.05, 0.25, 0.5, 0.85, 1]) {
      const midHtml = renderToStaticMarkup(<TraitGecko view="top" tone="mahogany" fired={0.6} traits={{ dorsal: v, lateral: v, pinstripe: v, tiger: v, spots: v, emptyBack: v, whitewall: v, whiteFactor: v, pied: v }} />);
      expect(midHtml).not.toContain('NaN');
      expect(midHtml).toContain('feColorMatrix');
    }
  });
  it('loads the eye studies only when a page shows them, from a lookup that agrees with the studies', () => {
    for (const morph of MORPHS) expect(eyeStudyIdForMorph(morph.slug)).toBe(eyeStudyForMorph(morph.slug)?.id ?? null);
    for (const slug of ['toString', 'constructor', '', undefined]) expect(eyeStudyIdForMorph(slug)).toBeNull();
    // Neither page imports the eye studies or the Field Notebook with the
    // page itself (about 23 kB together); both load when the page shows them.
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
      expect(statSync(`public${traitAsset(view,layer)}`).size).toBeLessThan(120 * 1024);
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

