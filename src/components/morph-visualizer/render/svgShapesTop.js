/**
 * Top-down (aerial) view of the stylized crested gecko.
 * Same 800×480 viewBox as the side view so layouts stay consistent.
 *
 * Orientation: head on the right, tail on the left ,  a mirror of the side
 * view axis so users can switch between views without spatially disorienting.
 * All four legs are visible splayed outward. Crest rails run along both
 * dorso-lateral edges.
 *
 * NOTE: the top view is intentionally simpler than the side view for now.
 * It's a useful second angle for inspecting dorsal patterns (pinstripe
 * rails, empty back, cappuccino coffee-stain, dalmatian spotting).
 */

export const VIEWBOX_TOP = '0 0 800 480';

// Main body is a large stretched ellipse running horizontally through the frame.
export const BODY_TOP = { cx: 380, cy: 260, rx: 240, ry: 78 };

// Head: rounded arrowhead on the right
export const HEAD_TOP_PATH = `
  M 560,210
  C 590,205 630,208 665,220
  C 700,232 720,250 720,262
  C 720,275 700,292 665,302
  C 630,312 590,316 560,310
  C 550,300 548,278 550,260
  C 552,240 552,220 560,210 Z
`;

// Full silhouette ,  body ellipse + head + tail blend. Used as body clipPath.
export const BODY_TOP_PATH = `
  M 140,265
  C 160,200 250,188 380,185
  C 510,184 600,200 640,220
  C 680,240 710,256 708,268
  C 706,278 680,295 640,310
  C 600,325 510,335 380,332
  C 250,332 160,320 140,265 Z
`;

// Tail ,  curves off to the left
export const TAIL_TOP_PATH = `
  M 155,260
  C 110,252 70,258 42,274
  C 20,288 16,306 34,312
  C 58,318 92,302 122,290
  C 138,284 152,275 155,268 Z
`;

// Crest rails ,  two parallel paired lines along the dorso-lateral edges.
// Each rail runs from the hip to the supraorbital area on its side.
export const CREST_TOP_RAIL_UPPER = `
  M 170,205
  C 270,190 400,186 530,190
  C 590,192 630,200 660,215
`;
export const CREST_TOP_RAIL_LOWER = `
  M 170,315
  C 270,328 400,332 530,328
  C 590,325 630,318 660,305
`;

// Legs: each leg is a stout bean splaying outward from the body.
// Front legs live under the shoulders (~ x 500), back legs under hips (~ x 230).
export const LEG_TOP_FRONT_UP = `
  M 500,220
  C 485,200 465,175 455,150
  C 450,138 460,128 478,130
  C 500,135 520,162 530,190
  C 538,205 530,220 518,222
  Z
`;
export const LEG_TOP_FRONT_DOWN = `
  M 500,302
  C 485,322 465,348 455,372
  C 450,384 460,394 478,392
  C 500,388 520,360 530,332
  C 538,318 530,302 518,300
  Z
`;
export const LEG_TOP_BACK_UP = `
  M 230,218
  C 215,198 200,172 193,148
  C 190,135 202,126 219,130
  C 240,137 258,165 266,190
  C 272,205 262,220 250,220
  Z
`;
export const LEG_TOP_BACK_DOWN = `
  M 230,304
  C 215,324 200,350 193,374
  C 190,386 202,396 219,392
  C 240,385 258,357 266,332
  C 272,317 262,302 250,300
  Z
`;

// Toe pads at the end of each leg (wider and more lamella-y from above)
export const LEG_TOE_POSITIONS = [
  { cx: 468, cy: 128, spread: 10, count: 5 }, // front-up
  { cx: 468, cy: 394, spread: 10, count: 5 }, // front-down
  { cx: 209, cy: 128, spread: 10, count: 5 }, // back-up
  { cx: 209, cy: 394, spread: 10, count: 5 }, // back-down
];

export function topToePads(cx, cy, count = 5, spread = 10, size = 2.6, axisDown = true) {
  const pads = [];
  for (let i = 0; i < count; i += 1) {
    const a = Math.PI * 0.5 + (i - (count - 1) / 2) * 0.32 * (axisDown ? 1 : -1);
    const px = cx + Math.cos(a) * spread;
    const py = cy + Math.sin(a) * spread;
    pads.push({ cx: px, cy: py, r: size });
  }
  return pads;
}

// Supraorbital crest "eyelash" ,  two curves above each eye on the head (from above
// they flank the midline).
export const SUPRAORBITAL_TOP_UPPER = `
  M 618,214
  C 640,205 670,206 692,214
`;
export const SUPRAORBITAL_TOP_LOWER = `
  M 618,308
  C 640,317 670,316 692,308
`;

// Eyes (two, one on each side of the head). From above, eyes sit laterally.
export const EYES_TOP = [
  { cx: 648, cy: 228, r: 9 },
  { cx: 648, cy: 294, r: 9 },
];

// Nostrils (on the snout from above ,  two dots near the tip).
export const NOSTRILS_TOP = [
  { cx: 714, cy: 254 },
  { cx: 714, cy: 270 },
];

// Dorsum band ,  strip down the spine for pinstripe/cappuccino rendering.
export const DORSUM_TOP_PATH = `
  M 160,230
  C 260,218 400,212 540,216
  C 600,218 645,225 678,240
  L 678,285
  C 640,298 600,305 540,308
  C 400,312 260,306 160,295 Z
`;

// Spine midline ,  used as a guide line for symmetric patterns.
export const SPINE_TOP_PATH = 'M 160,262 C 280,258 430,258 620,260';

// Branch ,  a horizontal limb with the gecko perched on top (from above
// we see the gecko sitting across a narrow branch).
export const BRANCH_TOP_PATH = `
  M 20,350
  C 130,340 300,336 400,340
  C 550,344 700,348 795,354
  L 795,380
  C 700,386 550,392 400,388
  C 300,386 130,384 20,386
  Z
`;
