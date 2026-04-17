/**
 * Stylized crested gecko SVG path library.
 *
 * All layers render against a shared 800×480 viewBox so the coordinate system
 * is stable across components. The paths describe a side-profile gecko perched
 * on a branch, head facing right, tail trailing left — the most recognizable
 * angle for morph ID.
 *
 * Each anatomical region is a SEPARATE path so pattern layers can be clipped
 * to just the dorsum, flanks, belly, legs, head, etc. — the pieces needed to
 * accurately place patterns like pinstripe (dorsal edges) vs flame (flanks).
 */

export const VIEWBOX = '0 0 800 480';

// ---- Silhouette (full gecko body + legs + head; used as master clip) ----
// Stylized side profile with prominent supraorbital crests, chunky head,
// plump body, four splayed limbs and tapered tail.
export const BODY_PATH = `
  M 75,235
  C 55,230 35,245 40,258
  C 45,270 70,278 95,270
  C 120,282 150,290 190,292
  L 255,298
  C 300,302 360,305 420,305
  C 470,303 520,300 560,293
  L 605,282
  C 625,280 645,280 660,275
  C 680,268 700,256 715,240
  C 735,218 740,200 728,184
  C 715,168 685,158 660,164
  C 640,168 628,175 620,180
  L 585,182
  C 530,180 470,178 420,180
  C 370,182 320,188 280,192
  L 220,200
  C 175,205 140,215 110,222
  L 85,228
  Z
`;

// ---- Dorsum (top 30% band of the body — receives dorsal pattern) ----
export const DORSUM_PATH = `
  M 80,230
  C 115,210 155,198 215,192
  L 285,186
  C 350,182 430,180 500,182
  L 585,184
  C 615,184 645,180 670,174
  C 690,170 705,170 715,180
  C 725,190 722,205 705,215
  L 680,222
  C 650,230 615,232 585,232
  L 460,232
  C 380,230 300,230 230,235
  L 160,242
  C 120,245 95,247 80,240
  Z
`;

// ---- Flanks (middle band — receives harlequin / tiger / flame) ----
export const FLANKS_PATH = `
  M 78,255
  C 120,252 170,252 220,255
  L 300,260
  C 380,262 460,262 540,258
  L 615,252
  C 645,250 670,252 690,250
  L 705,260
  C 692,275 665,282 625,282
  L 520,292
  C 440,298 350,302 270,298
  L 180,290
  C 130,286 95,278 72,268
  Z
`;

// ---- Belly (bottom edge and underside — receives white wall, fringe) ----
export const BELLY_PATH = `
  M 95,272
  C 140,285 200,294 280,300
  L 420,305
  C 500,303 560,298 610,287
  C 630,290 660,290 690,285
  L 700,295
  C 685,310 650,320 610,318
  L 480,322
  C 380,322 270,318 200,308
  L 130,298
  C 110,295 95,290 95,272
  Z
`;

// ---- Head (separate so it can tint differently — e.g. cappuccino dorsum) ----
export const HEAD_PATH = `
  M 595,175
  C 615,165 640,158 670,158
  C 700,158 725,172 730,195
  C 732,215 720,232 700,240
  C 680,246 660,247 640,244
  C 625,241 615,236 605,228
  L 595,210
  C 590,198 585,185 595,175
  Z
`;

// ---- Crests (scale ridges atop the head, running down the nape) ----
// A sequence of small triangular spikes along the dorsal ridge.
export function crestSpikes() {
  const spikes = [];
  // Dorsal ridge spikes from tail-base to top of head
  for (let i = 0; i < 42; i += 1) {
    const t = i / 41;
    // Arc from (120, 198) over the back to (670, 155)
    const x = 120 + t * 550;
    // Slight arc upward in the middle
    const y = 198 - Math.sin(t * Math.PI) * 22 - t * 3;
    const h = 6 + Math.sin(t * Math.PI) * 3;
    spikes.push({ x, y, h });
  }
  return spikes;
}

// Supraorbital crest — the signature "eyelash" ridge above each eye.
export const SUPRAORBITAL_PATH = `
  M 660,162
  C 672,154 688,152 700,156
  C 710,159 715,165 712,170
  C 708,175 695,170 685,170
  C 675,170 665,172 660,162 Z
`;

// ---- Legs (four legs — front-right, front-left-far, back-right, back-left-far) ----
// Near legs are drawn in full; far legs are partially hidden behind the body.
export const LEG_FRONT_NEAR_PATH = `
  M 595,268
  C 598,295 595,320 585,345
  C 578,365 575,385 583,400
  L 605,402
  C 618,390 625,368 625,345
  C 625,320 620,292 612,268
  Z
`;

export const LEG_FRONT_FAR_PATH = `
  M 615,275
  C 620,305 620,335 612,362
  C 606,382 605,395 612,402
  L 625,401
  C 632,390 635,368 635,342
  C 635,315 630,292 625,275
  Z
`;

export const LEG_BACK_NEAR_PATH = `
  M 180,285
  C 178,310 170,340 175,370
  C 178,390 185,400 195,400
  L 215,400
  C 220,390 225,365 225,335
  C 225,310 220,290 215,278
  Z
`;

export const LEG_BACK_FAR_PATH = `
  M 215,290
  C 218,315 215,345 218,370
  C 220,385 225,395 232,398
  L 245,395
  C 248,385 248,360 245,335
  C 242,310 238,290 232,280
  Z
`;

// Toe pads (lamellae) — simple rounded fingers at each foot
export function toePads(cx, cy, count = 4, spread = 22, size = 6) {
  const pads = [];
  for (let i = 0; i < count; i += 1) {
    const a = -Math.PI / 2 + (i - (count - 1) / 2) * 0.35;
    const px = cx + Math.cos(a) * spread;
    const py = cy + Math.sin(a) * spread + 8;
    pads.push({ cx: px, cy: py, r: size });
  }
  return pads;
}

// ---- Tail (curved, tapering) ----
export const TAIL_PATH = `
  M 85,245
  C 55,240 30,235 15,215
  C 5,200 8,180 25,175
  C 45,172 60,185 70,200
  C 78,212 85,225 90,238
  Z
`;

// ---- Eye ----
export const EYE_CENTER = { cx: 687, cy: 192 };
export const EYE_RADIUS = 11;

// ---- Nostril + mouth (tiny details) ----
export const NOSTRIL = { cx: 725, cy: 210 };
export const MOUTH_PATH = `M 695,228 C 710,235 720,234 727,228`;

// ---- Branch (perch) ----
export const BRANCH_PATH = `
  M 20,405
  C 150,395 340,396 480,400
  C 620,404 720,406 795,412
  L 795,478
  L 20,478
  Z
`;

// Utility — simple seeded PRNG so dalmatian/LW splotches stay stable across renders.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
