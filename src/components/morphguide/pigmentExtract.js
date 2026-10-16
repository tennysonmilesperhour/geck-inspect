// Pulls one trait's added pigment out of an ink study, as a transparent
// layer over the plain base animal.
//
// Each trait drawing (cream, pin, tiger, spots) is the base drawing with
// that pigment painted on. Subtracting the base keeps only the paint, so
// redraw drift between the two pictures never replaces the animal.
//
// This used to run in every visitor's browser on the Morph Guide (two
// 1536 x 1024 drawings per trait, every pixel read twice, about 3 seconds
// of a frozen phone). The drawings never change, so
// scripts/precompute-trait-layers.mjs now runs it once and the page loads
// the finished layers. The arithmetic is unchanged from the browser
// version, so the layers look the same.
//
// Pure functions on RGBA byte arrays: no DOM, no canvas, so Node and the
// tests can run them.

export const PIGMENT_TRAITS = ['cream', 'pin', 'tiger', 'spots'];

// The drawings' coordinate box (TraitGecko's SVG viewBox).
export const STUDY_WIDTH = 1000;
export const STUDY_HEIGHT = 667;

/**
 * Returns a new RGBA array: the edited drawing's colours, with alpha set
 * only where the trait added pigment. `light` traits (cream, pin) add pale
 * paint; the others add dark paint.
 */
export function pigmentAlpha(base, edited, trait) {
  const layer = new Uint8ClampedArray(edited);
  const light = trait === 'cream' || trait === 'pin';
  for (let i = 0; i < layer.length; i += 4) {
    const before = (base[i] + base[i + 1] + base[i + 2]) / 3;
    const after = (layer[i] + layer[i + 1] + layer[i + 2]) / 3;
    const delta = light ? after - before : before - after;
    const pigment = light ? after > 150 && before < 215 : after < (trait === 'spots' ? 92 : 125);
    layer[i + 3] = pigment && delta > 28 ? Math.min(255, (delta - 28) * 8) : 0;
  }
  return layer;
}

/**
 * Spots only: finds each painted spot (4-connected pixels at least half
 * opaque), clears specks under 40 pixels from the layer in place, and
 * returns one box per spot in study coordinates. The boxes come back in a
 * fixed pseudo-random order so the spots slider reveals them scattered
 * across the body rather than front to back.
 */
export function spotRegions(layer, width, height) {
  const count = width * height;
  const seen = new Uint8Array(count);
  const regions = [];
  for (let pixel = 0; pixel < count; pixel++) {
    if (seen[pixel] || layer[pixel * 4 + 3] < 128) continue;
    const region = [pixel];
    seen[pixel] = 1;
    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (let cursor = 0; cursor < region.length; cursor++) {
      const at = region[cursor], x = at % width, y = Math.floor(at / width);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (const next of [at - 1, at + 1, at - width, at + width]) {
        if (next >= 0 && next < count && !seen[next] && layer[next * 4 + 3] >= 128 && (Math.abs(next - at) !== 1 || Math.floor(next / width) === y)) {
          seen[next] = 1;
          region.push(next);
        }
      }
    }
    if (region.length < 40) region.forEach((at) => { layer[at * 4 + 3] = 0; });
    else regions.push({
      x: minX / width * STUDY_WIDTH,
      y: minY / height * STUDY_HEIGHT,
      width: (maxX - minX + 2) / width * STUDY_WIDTH,
      height: (maxY - minY + 2) / height * STUDY_HEIGHT,
      order: (pixel * 2654435761) >>> 0,
    });
  }
  regions.sort((a, b) => a.order - b.order);
  return regions;
}

/** Both steps for one trait. Returns { layer, regions }. */
export function extractPigment(base, edited, width, height, trait) {
  const layer = pigmentAlpha(base, edited, trait);
  const regions = trait === 'spots' ? spotRegions(layer, width, height) : [];
  return { layer, regions };
}
