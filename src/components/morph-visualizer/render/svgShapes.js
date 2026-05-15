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
 *
 * Anatomical landmarks targeted from photo reference:
 *   - Distinct shoulder hump (~x=560) and hip hump (~x=215) along the dorsum
 *   - Full rounded belly that sags below the leg attach line
 *   - Triangular head broadest behind the supraorbital crests, tapering to a
 *     short rounded snout
 *   - Pronounced lower jaw that bows down and tucks back to the throat,
 *     giving a defined jowl
 *   - Bent limbs with a clear elbow / knee joint kicking back from the body
 */

export const VIEWBOX = '0 0 800 480';

export const BODY_ELLIPSE  = { cx: 380, cy: 268, rx: 230, ry: 72 };
export const HEAD_ELLIPSE  = { cx: 692, cy: 198, rx: 92, ry: 56 };
export const NECK_JOIN_X   = 605;
export const DORSUM_TOP_Y  = 196;
export const BELLY_BOT_Y   = 338;

// Body silhouette. Closed clockwise path. Trace from back-of-head where it
// joins the dorsum, down behind the jowl into the flank, across the belly,
// up over the hip, around the tail-base, then back along the dorsum to the
// start. The dorsum has a clear shoulder peak (~x=555) and hip peak
// (~x=240) with a gentle valley between, so the silhouette doesn't read as
// a uniform sausage. The earlier draft had a sharp notch on the underside
// near the front-leg attach point; this version sweeps cleanly through.
export const BODY_PATH = `
  M 608,214
  C 626,232 628,260 618,286
  C 605,308 578,322 548,330
  C 488,340 412,344 335,340
  C 275,336 222,328 188,316
  C 166,306 150,290 150,272
  C 150,250 160,226 184,210
  C 222,194 282,186 348,188
  C 410,190 462,194 510,196
  C 548,198 580,202 598,206
  C 606,208 610,212 608,214 Z
`;

// Head silhouette. Wedge that tapers from a broad crown to a defined snout.
// The crown rises clearly above the eye to read as a "shelf" for the
// supraorbital crests; the lower jaw bows down behind the mouth and tucks
// back to the throat, giving the face a pronounced jowl rather than a flat
// bottom edge.
export const HEAD_PATH = `
  M 600,200
  C 612,176 642,156 682,150
  C 722,146 760,160 780,184
  C 790,200 786,218 770,228
  C 758,234 744,236 730,236
  C 728,248 716,254 698,254
  C 668,254 642,248 622,238
  C 608,228 598,214 600,200 Z
`;

// Tail. Tapers from a wide hip attachment out to a soft point on the
// lower-left, drooping down as it goes so the tip rests near the branch
// rather than floating mid-air. The path closes back to the hip with an
// explicit vertical line so the tail attaches across the full back-of-body
// height, not just a single point. Upper and lower edges converge to a
// real point at the tip rather than a blunt flipper end.
export const TAIL_PATH = `
  M 174,236
  C 132,244 88,258 50,282
  C 24,300 10,322 12,338
  C 16,348 30,344 50,330
  C 88,308 132,290 168,278
  C 174,276 178,278 174,290
  L 174,294 Z
`;

// Dorsum band, clipped to BODY_PATH. Spans the upper third of the body,
// with control points pulled in slightly so the band hugs the dorsal arch
// rather than running straight across.
export const DORSUM_PATH = `
  M 152,228
  C 220,206 360,194 500,196
  C 555,198 595,206 622,222
  L 622,256
  C 555,246 380,244 230,256
  C 178,260 145,256 138,246 Z
`;

// Flanks band, used by lateral pattern layers.
export const FLANKS_PATH = `
  M 120,254
  L 624,254
  L 624,300
  L 120,300 Z
`;

// Belly band, sized to cover the new fuller belly.
export const BELLY_PATH = `
  M 120,294
  L 624,294
  L 624,340
  L 120,340 Z
`;

// Dorsal crest spikes from above the eye to the hip. Spike base x/y traces
// the new dorsal arch so spikes grow off the back, not above it.
export function crestSpikes() {
  const spikes = [];
  const startX = 600, endX = 180;
  const startY = 196, endY = 220;
  const count = 42;
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const x = startX + t * (endX - startX);
    // Arch up over the dorsum so spike bases follow the curved back rather
    // than a straight line (deepest arch over the mid-back / shoulder).
    const y = startY + t * (endY - startY) - Math.sin(t * Math.PI) * 10;
    const h = 5 + Math.sin(t * Math.PI) * 4;
    spikes.push({ x, y, h });
  }
  return spikes;
}

// Supraorbital crest, the iconic "eyelash" ridge. Sits clearly above and
// forward of the eye so it reads as a prominent ridge in a glance. Drawn
// as an elongated tear-drop with a slight upward tilt so it looks like a
// frill rather than a bump.
export const SUPRAORBITAL_PATH = `
  M 644,166
  C 666,148 700,142 728,150
  C 744,156 750,168 740,178
  C 720,184 696,184 672,182
  C 656,180 644,174 644,166 Z
`;

// Supraorbital spikes, the row of pointed scales sitting on top of the
// supraorbital ridge. These are what give the crested gecko its "eyelash"
// look in profile. Each entry is { x, y, h } with the base point and spike
// height; Crests.jsx renders them as small triangles aimed up-and-back so
// they look like a row of frill-tips above the eye, not a smooth bump.
export function supraorbitalSpikes() {
  const spikes = [];
  // Fan along the top of the supraorbital ridge from rear-of-eye forward.
  // Y values arc gently downward toward the snout matching the ridge curve.
  const points = [
    { x: 660, y: 156, h: 8 },
    { x: 672, y: 150, h: 9 },
    { x: 686, y: 146, h: 10 },
    { x: 700, y: 144, h: 10 },
    { x: 714, y: 146, h: 9 },
    { x: 726, y: 150, h: 8 },
    { x: 736, y: 156, h: 7 },
  ];
  for (const p of points) spikes.push(p);
  return spikes;
}

// Legs. Each leg is drawn as a single closed shape with a clearly bent
// silhouette: the upper leg runs down from the shoulder/hip, kicks back at
// the elbow/knee, then the lower leg runs forward and down to the foot.
// Near-side legs render in front of the body fill, far-side ones behind
// it for depth.

// Front near leg. Knee on the back edge near y=350.
export const LEG_FRONT_NEAR_PATH = `
  M 524,282
  C 514,304 504,330 502,354
  C 502,372 506,388 514,400
  C 518,408 524,414 532,415
  L 558,415
  C 564,414 568,408 568,400
  C 566,386 562,370 560,354
  C 560,338 564,322 570,304
  C 574,290 572,280 562,278
  C 548,276 532,276 524,282 Z
`;

// Front far leg.
export const LEG_FRONT_FAR_PATH = `
  M 572,290
  C 568,312 568,332 572,352
  C 574,372 578,388 584,400
  C 586,404 592,406 596,403
  L 606,400
  C 608,396 606,390 602,382
  C 596,366 592,348 590,330
  C 590,314 590,300 586,290
  C 582,284 576,284 572,290 Z
`;

// Back near leg. Knee on the back edge near y=350.
export const LEG_BACK_NEAR_PATH = `
  M 204,282
  C 194,304 184,330 182,354
  C 182,372 186,388 194,400
  C 198,408 204,414 212,415
  L 238,415
  C 244,414 248,408 248,400
  C 246,386 242,370 240,354
  C 240,338 244,322 250,304
  C 254,290 252,280 242,278
  C 228,276 212,276 204,282 Z
`;

// Back far leg.
export const LEG_BACK_FAR_PATH = `
  M 252,290
  C 248,312 248,332 252,352
  C 254,372 258,388 264,400
  C 266,404 272,406 276,403
  L 286,400
  C 288,396 286,390 282,382
  C 276,366 272,348 270,330
  C 270,314 270,300 266,290
  C 262,284 256,284 252,290 Z
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
export const FOOT_FRONT_NEAR = { cx: 545, cy: 404 };
export const FOOT_FRONT_FAR  = { cx: 597, cy: 394 };
export const FOOT_BACK_NEAR  = { cx: 225, cy: 404 };
export const FOOT_BACK_FAR   = { cx: 277, cy: 394 };

// Eye + face landmarks. Eye sits in the middle-back of the head, behind the
// supraorbital crest, with the nostril near the snout tip and the mouth
// curving back along the lower jaw.
export const EYE_CENTER = { cx: 700, cy: 195 };
export const EYE_RADIUS = 14;

// Ear opening (small dark recess behind the eye, a real crested gecko has
// no external pinna so the ear is just a hole).
export const EAR_CENTER = { cx: 648, cy: 222 };
export const EAR_RADIUS = 4;

export const NOSTRIL = { cx: 758, cy: 198 };
export const MOUTH_PATH = `M 700,236 C 720,246 740,244 754,230`;

// A subtle throat fold (dewlap line) under the jaw. Pure cosmetic detail.
export const THROAT_PATH = `M 624,242 C 642,250 662,254 690,256`;

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
