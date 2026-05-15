/**
 * Stylized crested gecko SVG path library (side profile).
 *
 * 800 by 480 viewBox. Head on the right, tail on the left. Animal sits in a
 * relaxed perched posture, dorsal arch over hips and shoulders, head raised,
 * limbs bent with wide-splayed toe pads gripping a horizontal branch.
 *
 * Every pattern overlay clips to BODY_PATH plus HEAD_PATH so no fill bleeds
 * past the silhouette regardless of intensity. DORSUM_PATH, FLANKS_PATH and
 * BELLY_PATH define horizontal bands used by region-specific layers (tiger,
 * harlequin, white wall, belly tone, etc).
 */

export const VIEWBOX = '0 0 800 480';

export const BODY_ELLIPSE  = { cx: 380, cy: 262, rx: 218, ry: 70 };
export const HEAD_ELLIPSE  = { cx: 680, cy: 198, rx: 80, ry: 54 };
export const NECK_JOIN_X   = 600;
export const DORSUM_TOP_Y  = 194;
export const BELLY_BOT_Y   = 326;

// Body silhouette. Closed clockwise path from the front-top where the body
// meets the back of the head. Distinct shoulder hump, gentle mid-back dip,
// hip hump, then a clearly tapered tail-base on the left, full belly across
// the bottom, up the throat. Drawn so the head path overlaps and hides the
// short neck-stub at the front.
export const BODY_PATH = `
  M 602,200
  C 588,188 568,182 545,184
  C 510,188 470,196 430,202
  C 380,208 330,210 285,206
  C 245,202 215,196 195,200
  C 178,204 162,214 152,228
  C 144,242 142,256 148,266
  C 136,272 124,282 118,294
  C 142,304 174,312 210,316
  C 260,322 320,326 380,326
  C 440,326 500,322 545,316
  C 580,310 605,298 618,280
  C 628,262 628,242 622,224
  C 616,212 610,206 602,200 Z
`;

// Head silhouette. Wedge that tapers from a broad crown to a defined snout.
// The lower jaw bows out behind the mouth and tucks back to meet the neck,
// giving the face a clear "jowl" line.
export const HEAD_PATH = `
  M 608,194
  C 622,170 648,156 678,152
  C 708,148 738,158 754,180
  C 766,196 766,216 754,230
  C 746,240 734,244 718,244
  C 718,250 712,254 702,256
  C 686,260 668,256 650,250
  C 632,244 618,232 610,218
  C 604,210 604,200 608,194 Z
`;

// Tail. Tapered to a point at the bottom-left with a downward curl. The
// path closes back to the hip with an explicit vertical line so the tail
// attaches to the body across the full hip width, not just a single point.
export const TAIL_PATH = `
  M 170,210
  C 135,210 95,216 60,230
  C 32,242 14,260 14,280
  C 14,294 22,302 34,302
  C 50,302 72,290 92,274
  C 116,258 140,242 160,228
  C 168,222 172,232 170,242
  L 170,210 Z
`;

// Dorsum band, clipped to BODY_PATH.
export const DORSUM_PATH = `
  M 138,210
  C 220,194 360,184 500,190
  C 555,192 595,200 618,212
  L 618,252
  C 555,242 380,240 230,252
  C 178,256 145,252 138,242 Z
`;

// Flanks band, used by lateral pattern layers.
export const FLANKS_PATH = `
  M 120,250
  L 624,250
  L 624,296
  L 120,296 Z
`;

// Belly band.
export const BELLY_PATH = `
  M 120,292
  L 624,292
  L 624,330
  L 120,330 Z
`;

// Dorsal crest spikes from above the eye to the hip.
export function crestSpikes() {
  const spikes = [];
  const startX = 602, endX = 178;
  const startY = 188, endY = 214;
  const count = 42;
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const x = startX + t * (endX - startX);
    // Arch up over the dorsum so spike bases trace the gecko's curved back
    const y = startY + t * (endY - startY) - Math.sin(t * Math.PI) * 8;
    const h = 5 + Math.sin(t * Math.PI) * 4;
    spikes.push({ x, y, h });
  }
  return spikes;
}

// Supraorbital crest, the iconic "eyelash" ridge. Sits clearly above and
// forward of the eye so it reads as a prominent ridge in a glance.
export const SUPRAORBITAL_PATH = `
  M 648,162
  C 666,148 696,144 720,154
  C 736,162 740,174 730,182
  C 712,186 690,184 672,182
  C 660,180 648,172 648,162 Z
`;

// Legs. Each leg is drawn as a single closed shape: narrow at the hip,
// widening into a defined foot at the bottom. The shape has a slight forward
// kink mid-way that reads as a knee. Near-side legs render in front of the
// body fill, far-side ones behind it for depth.

// Front near leg.
export const LEG_FRONT_NEAR_PATH = `
  M 540,278
  C 532,302 524,332 520,360
  C 516,378 514,392 514,406
  C 514,412 518,414 524,414
  L 558,414
  C 562,412 564,408 562,402
  C 558,388 558,374 562,360
  C 568,340 576,316 580,290
  C 582,278 576,270 564,268
  C 552,266 542,270 540,278 Z
`;

// Front far leg.
export const LEG_FRONT_FAR_PATH = `
  M 568,288
  C 568,310 568,332 570,352
  C 572,372 574,388 578,400
  C 580,404 586,404 590,402
  L 602,400
  C 604,396 602,390 600,384
  C 596,366 592,346 588,326
  C 586,310 584,296 580,288
  C 578,282 572,282 568,288 Z
`;

// Back near leg.
export const LEG_BACK_NEAR_PATH = `
  M 220,278
  C 212,302 204,332 200,360
  C 196,378 194,392 194,406
  C 194,412 198,414 204,414
  L 238,414
  C 242,412 244,408 242,402
  C 238,388 238,374 242,360
  C 248,340 256,316 260,290
  C 262,278 256,270 244,268
  C 232,266 222,270 220,278 Z
`;

// Back far leg.
export const LEG_BACK_FAR_PATH = `
  M 250,288
  C 250,310 250,332 252,352
  C 254,372 256,388 260,400
  C 262,404 268,404 272,402
  L 284,400
  C 286,396 284,390 282,384
  C 278,366 274,346 270,326
  C 268,310 266,296 262,288
  C 260,282 254,282 250,288 Z
`;

// Toe pads (lamellae) builder. Toes splay outward and slightly downward from
// the foot center so they read as gripping fingers on the branch.
export function toePads(cx, cy, count = 5, spread = 11, size = 3.2) {
  const pads = [];
  for (let i = 0; i < count; i += 1) {
    const a = -Math.PI / 2 + (i - (count - 1) / 2) * 0.42;
    const px = cx + Math.cos(a) * spread;
    const py = cy + Math.sin(a) * spread + 10;
    pads.push({ cx: px, cy: py, r: size });
  }
  return pads;
}

// Foot center coordinates (BaseBody calls toePads at these positions).
// Set slightly above leg-bottom y so toes splay out past the leg silhouette.
export const FOOT_FRONT_NEAR = { cx: 540, cy: 402 };
export const FOOT_FRONT_FAR  = { cx: 594, cy: 392 };
export const FOOT_BACK_NEAR  = { cx: 220, cy: 402 };
export const FOOT_BACK_FAR   = { cx: 276, cy: 392 };

// Eye + face landmarks.
export const EYE_CENTER = { cx: 690, cy: 192 };
export const EYE_RADIUS = 13;

// Ear opening (small dark recess behind the eye, a real crested gecko has
// no external pinna so the ear is just a hole).
export const EAR_CENTER = { cx: 642, cy: 218 };
export const EAR_RADIUS = 4;

export const NOSTRIL = { cx: 744, cy: 204 };
export const MOUTH_PATH = `M 696,232 C 716,242 736,240 748,228`;

// A subtle throat fold (dewlap line) under the jaw. Pure cosmetic detail.
export const THROAT_PATH = `M 624,238 C 640,246 660,250 686,252`;

// Branch the gecko perches on.
export const BRANCH_PATH = `
  M 20,408
  C 150,400 340,402 480,406
  C 620,410 720,412 795,418
  L 795,478
  L 20,478 Z
`;

// Seeded PRNG so pattern blotches stay stable between renders.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BODY_CLIP_ID = 'gecko-body-clip';
