import { describe, expect, it } from 'vitest';
import { extractPigment, pigmentAlpha, spotRegions, STUDY_WIDTH, STUDY_HEIGHT } from '@/components/morphguide/pigmentExtract';
import { existsSync } from 'node:fs';
import { LAYER_SOURCE, SPOT_REGIONS, TRAIT_LAYER_ROOT } from '@/components/morphguide/traitLayers.generated';
import { layerSource } from '../../../scripts/precompute-trait-layers.mjs';

// A w x h RGBA image filled with one grey level.
const flat = (w, h, level) => {
  const a = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < a.length; i += 4) { a[i] = a[i + 1] = a[i + 2] = level; a[i + 3] = 255; }
  return a;
};
const paint = (img, w, x0, y0, x1, y1, level) => {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; img[i] = img[i + 1] = img[i + 2] = level; }
};
const alphaAt = (layer, w, x, y) => layer[(y * w + x) * 4 + 3];

describe('pigment extraction (precomputed Morph Guide layers)', () => {
  it('keeps only paler paint for cream and pin, and only darker paint for tiger and spots', () => {
    const w = 10, h = 10;
    const base = flat(w, h, 120);
    const edited = flat(w, h, 120);
    paint(edited, w, 0, 0, 5, 10, 200); // pale paint on the left half
    const cream = pigmentAlpha(base, edited, 'cream');
    expect(alphaAt(cream, w, 1, 1)).toBe(255);
    expect(alphaAt(cream, w, 8, 8)).toBe(0);
    // The same pale change is not dark pigment.
    expect(alphaAt(pigmentAlpha(base, edited, 'tiger'), w, 1, 1)).toBe(0);

    const darker = flat(w, h, 120);
    paint(darker, w, 0, 0, 5, 10, 60);
    const tiger = pigmentAlpha(base, darker, 'tiger');
    expect(alphaAt(tiger, w, 1, 1)).toBe(255);
    expect(alphaAt(tiger, w, 8, 8)).toBe(0);
  });

  it('ignores redraw drift under the threshold and fades in small differences', () => {
    const w = 4, h = 1;
    const base = flat(w, h, 100);
    const edited = flat(w, h, 100);
    paint(edited, w, 0, 0, 1, 1, 76); // 24 darker: drift, ignored
    paint(edited, w, 1, 0, 2, 1, 70); // 30 darker: just over, faint
    const layer = pigmentAlpha(base, edited, 'tiger');
    expect(alphaAt(layer, w, 0, 0)).toBe(0);
    expect(alphaAt(layer, w, 1, 0)).toBe(45);
  });

  it('turns painted spots into boxes in study coordinates and drops specks', () => {
    const w = 100, h = 60;
    const base = flat(w, h, 150);
    const edited = flat(w, h, 150);
    paint(edited, w, 10, 10, 20, 20, 40); // a 100-pixel spot
    paint(edited, w, 50, 30, 53, 33, 40); // a 9-pixel speck
    const { layer, regions } = extractPigment(base, edited, w, h, 'spots');
    expect(regions).toHaveLength(1);
    const [spot] = regions;
    expect(spot.x).toBeCloseTo(10 / w * STUDY_WIDTH);
    expect(spot.y).toBeCloseTo(10 / h * STUDY_HEIGHT);
    expect(spot.width).toBeCloseTo(11 / w * STUDY_WIDTH);
    expect(alphaAt(layer, w, 51, 31)).toBe(0); // speck cleared from the layer
    expect(alphaAt(layer, w, 15, 15)).toBe(255);
    expect(spotRegions(new Uint8ClampedArray(w * h * 4), w, h)).toEqual([]);
  });

  it('ships spot boxes for both views inside the drawing', () => {
    expect(TRAIT_LAYER_ROOT).toMatch(/^\/morph-guide\/trait-layers-v\d+$/);
    for (const view of ['side', 'top']) {
      expect(SPOT_REGIONS[view].length).toBeGreaterThan(20);
      for (const [x, y, width, height] of SPOT_REGIONS[view]) {
        expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
        expect(width).toBeGreaterThan(0); expect(height).toBeGreaterThan(0);
        expect(x + width).toBeLessThanOrEqual(STUDY_WIDTH + 2); expect(y + height).toBeLessThanOrEqual(STUDY_HEIGHT + 2);
      }
    }
  });

  // The drawings live in art/morph-guide/ink-studies-v3 and are not
  // deployed; the page shows layers built from them. A new drawing that
  // is committed without rebuilding the layers would never reach the site.
  it('ships layers built from the current drawings and settings', () => {
    expect(LAYER_SOURCE, 'Rebuild the layers: node scripts/precompute-trait-layers.mjs, then commit public/morph-guide/trait-layers-v1 and traitLayers.generated.js').toEqual(layerSource());
    expect(Object.keys(LAYER_SOURCE.drawings)).toHaveLength(10);
  });

  it('keeps the full-size drawings out of the deployed site', () => {
    expect(existsSync('public/morph-guide/ink-studies-v3'), 'New pattern-study drawings go in art/morph-guide/ink-studies-v3 (see art/README.md)').toBe(false);
  });
});
