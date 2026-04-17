/**
 * Stylized crested gecko SVG path library.
 *
 * All layers render against a shared 800×480 viewBox so the coordinate system
 * is stable across components. The paths describe a side-profile gecko perched
 * on a branch, head facing right, tail trailing left — the most recognizable
 * angle for morph ID.
 *
 * The silhouette is intentionally built from smooth, geometric curves rather
 * than a single hand-drawn loop. That gives a clean, predictable illustration
 * that reads well at any zoom and layers cleanly under pattern overlays.
 */

export const VIEWBOX = '0 0 800 480';

// Key anatomical reference points — used by both paths and helpers.
export const BODY_ELLIPSE  = { cx: 395, cy: 252, rx: 235, ry: 58 };
export const HEAD_ELLIPSE  = { cx: 666, cy: 208, rx: 72,  ry: 48 };
export const NECK_JOIN_X   = 600;
export const DORSUM_TOP_Y  = 200;
export const BELLY_BOT_Y   = 308;

// Single silhouette = body ellipse + head ellipse + tail bulge.
// We express it as a series of cubic curves for a smooth outline.
export const BODY_PATH = `
  M 738,215
  C 745,188 728,165 700,158
  C 670,152 636,158 616,178
  C 610,184 596,190 580,192
  L 330,204
  C 260,208 195,212 155,210
  C 115,208 90,200 75,218
  C 60,238 55,258 65,276
  C 80,298 130,308 200,312
  L 440,310
  C 520,308 580,300 612,290
  C 632,284 655,280 680,270
  C 710,258 732,242 738,215 Z
`;

// Head region, used by layers that want to tint only the head.
export const HEAD_PATH = `
  M 598,188
  C 610,170 640,156 668,156
  C 696,156 720,170 730,195
  C 736,215 726,238 700,250
  C 678,258 656,258 635,252
  C 618,248 605,236 598,220
  C 592,208 592,196 598,188 Z
`;

// ---- Dorsum band (top ~35%, clipped to body) ----
export const DORSUM_PATH = `
  M 60,215
  C 200,195 420,188 600,194
  C 680,196 720,205 730,215
  L 730,248
  C 600,240 400,240 200,248
  C 110,252 70,250 60,240 Z
`;

// ---- Flanks band (middle — clipped to body) ----
export const FLANKS_PATH = `
  M 55,248
  L 735,248
  L 735,285
  L 55,285
  Z
`;

// ---- Belly band (bottom — clipped to body) ----
export const BELLY_PATH = `
  M 55,282
  L 735,282
  L 735,325
  L 55,325
  Z
`;

// ---- Crest spikes — dorsal ridge from hip to crown ----
export function crestSpikes() {
  const spikes = [];
  const startX = 165, endX = 670;
  const startY = 208, endY = 162;
  for (let i = 0; i < 46; i += 1) {
    const t = i / 45;
    const x = startX + t * (endX - startX);
    // Gentle arch rising at the center to trace the gecko's curved back
    const y = startY + t * (endY - startY) - Math.sin(t * Math.PI) * 8;
    const h = 5 + Math.sin(t * Math.PI) * 2.5;
    spikes.push({ x, y, h });
  }
  return spikes;
}

// Supraorbital crest — the signature "eyelash" ridge above the eye.
export const SUPRAORBITAL_PATH = `
  M 648,164
  C 666,156 688,154 706,160
  C 718,164 724,172 718,180
  C 706,184 690,182 674,180
  C 662,179 648,174 648,164 Z
`;

// ---- Legs ----
// Near legs drawn in full; far legs partially hidden.
export const LEG_FRONT_NEAR_PATH = `
  M 598,280
  C 602,308 598,338 588,358
  C 580,378 578,392 588,400
  L 610,400
  C 622,388 628,365 628,340
  C 628,315 622,295 614,278
  Z
`;

export const LEG_FRONT_FAR_PATH = `
  M 618,286
  C 622,314 622,342 614,368
  C 608,386 608,396 616,402
  L 629,400
  C 636,390 638,368 636,344
  C 636,320 632,298 628,284
  Z
`;

export const LEG_BACK_NEAR_PATH = `
  M 170,288
  C 168,314 160,344 164,372
  C 168,392 178,402 188,400
  L 208,400
  C 214,390 218,365 218,335
  C 218,312 212,292 206,280
  Z
`;

export const LEG_BACK_FAR_PATH = `
  M 208,294
  C 212,320 210,348 212,372
  C 214,388 220,398 227,400
  L 240,396
  C 242,386 242,360 240,336
  C 238,314 234,294 230,282
  Z
`;

// Toe pads (lamellae) — signature wide gecko feet.
export function toePads(cx, cy, count = 5, spread = 11, size = 3.2) {
  const pads = [];
  for (let i = 0; i < count; i += 1) {
    const a = -Math.PI / 2 + (i - (count - 1) / 2) * 0.32;
    const px = cx + Math.cos(a) * spread;
    const py = cy + Math.sin(a) * spread + 6;
    pads.push({ cx: px, cy: py, r: size });
  }
  return pads;
}

// ---- Tail (curved, tapering) ----
export const TAIL_PATH = `
  M 82,245
  C 54,240 28,230 18,210
  C 10,195 20,178 38,176
  C 58,174 72,188 82,204
  C 90,218 92,232 92,244
  Z
`;

// ---- Eye ----
export const EYE_CENTER = { cx: 682, cy: 196 };
export const EYE_RADIUS = 12;

// ---- Nostril + mouth ----
export const NOSTRIL = { cx: 722, cy: 212 };
export const MOUTH_PATH = `M 686,232 C 700,240 718,238 724,228`;

// ---- Branch (perch) ----
export const BRANCH_PATH = `
  M 20,405
  C 150,395 340,396 480,400
  C 620,404 720,406 795,412
  L 795,478
  L 20,478
  Z
`;

// Utility — seeded PRNG so dalmatian/LW splotches stay stable across renders.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Shared clip-path id — use it anywhere patterns need to stay on the body.
export const BODY_CLIP_ID = 'gecko-body-clip';
