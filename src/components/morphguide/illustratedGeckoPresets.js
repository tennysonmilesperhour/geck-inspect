/**
 * Phenotypes for the illustrated crested gecko (IllustratedGecko.jsx),
 * keyed by Morph Guide slug (src/data/morph-guide.js MORPHS).
 *
 * A phenotype is a plain object. Every field is optional:
 *   palette      { base, dark, pattern, accent, dorsal, crest, outline, eye, spot, redSpot }
 *   dorsal       0..1  how much of the back is pattern colored (Flame back)
 *   dorsalStyle  'flame' (cream with flame points), 'solid' (Bicolor, a clean
 *                second color), 'saddle' (Cappuccino, connected to the head)
 *   flameTongues 0..1  flame points licking down from the back
 *   lateral      0..1  Harlequin coverage: flanks, then legs, then near-solid
 *   pinstripe    0..1  cream along the crest rows (0.5 is a Partial Pinstripe)
 *   phantom      bool  pinstripe scales stay body colored (Phantom Pinstripe)
 *   tricolor     0..1  third color patches (red or orange)
 *   tiger        0..1  dark bands across the back
 *   brindle      bool  break the bands up (Brindle)
 *   dalmatian    0..150 spot count; past ~45 they reach head, legs and tail
 *   redSpots     0..1  share of spots that are red
 *   lillyWhite   0..1  bold white blocks, white lips and legs
 *   albino       bool  red eyes, no black anywhere
 *
 * These are teaching diagrams, not genetic predictions.
 */

export const DEFAULT_PALETTE = {
  base: '#b8652c',
  dark: '#3b2214',
  pattern: '#f3dfae',
  accent: '#c8461f',
  outline: '#241510',
  eye: '#c9a03e',
  spot: '#1e1410',
  redSpot: '#b3261e',
};

const DEFAULTS = {
  palette: {},
  dorsal: 0,
  dorsalStyle: 'flame',
  flameTongues: 0,
  lateral: 0,
  pinstripe: 0,
  phantom: false,
  tricolor: 0,
  tiger: 0,
  brindle: false,
  dalmatian: 0,
  redSpots: 0,
  lillyWhite: 0,
  albino: false,
};

const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

/** Fill in defaults and clamp numbers, so the renderer never sees junk. */
export function normalizePhenotype(input = {}) {
  const p = { ...DEFAULTS, ...input, palette: { ...(input.palette || {}) } };
  ['dorsal', 'flameTongues', 'lateral', 'pinstripe', 'tricolor', 'tiger', 'redSpots', 'lillyWhite'].forEach((k) => {
    p[k] = clamp01(p[k]);
  });
  p.dalmatian = Math.max(0, Math.min(150, Number(p.dalmatian) || 0));
  if (!['flame', 'solid', 'saddle'].includes(p.dorsalStyle)) p.dorsalStyle = 'flame';
  return p;
}

function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

/** Mix two hex colors; t = 0 gives a, t = 1 gives b. */
export function mixHex(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `#${c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
}

const ORANGE = { base: '#c0602a', dark: '#4a2614', pattern: '#f4dca2' };
const RED = { base: '#8f2c22', dark: '#3a120d', pattern: '#f5e3b8', outline: '#1f0c09', eye: '#c8862e' };
const DARK_RED = { base: '#6a1d18', dark: '#2a0b08', pattern: '#f7ecd2', outline: '#1a0806', eye: '#c8862e' };

/**
 * slug -> { label, phenotype, goal? }. `goal` marks a look breeders are
 * still working toward rather than a proven morph (Moonglow).
 */
export const ILLUSTRATED_GECKO_PRESETS = {
  patternless: {
    label: 'Patternless',
    phenotype: { palette: { base: '#c46c2c', outline: '#2a160c' } },
  },
  bicolor: {
    label: 'Bicolor',
    phenotype: { palette: { base: '#6e4024', dorsal: '#d39a52', outline: '#22130a' }, dorsal: 1, dorsalStyle: 'solid' },
  },
  flame: {
    label: 'Flame',
    phenotype: { palette: ORANGE, dorsal: 1, flameTongues: 1 },
  },
  harlequin: {
    label: 'Harlequin',
    phenotype: { palette: RED, dorsal: 1, flameTongues: 1, lateral: 0.55 },
  },
  'extreme-harlequin': {
    label: 'Extreme Harlequin',
    phenotype: { palette: DARK_RED, dorsal: 1, flameTongues: 1, lateral: 1 },
  },
  pinstripe: {
    label: 'Pinstripe',
    phenotype: { palette: { ...ORANGE, base: '#b4521f', pattern: '#f6dd92' }, dorsal: 0.2, lateral: 0.3, pinstripe: 1 },
  },
  'phantom-pinstripe': {
    label: 'Phantom Pinstripe',
    phenotype: { palette: { base: '#6a5a34', dark: '#2e2614', pattern: '#ead9a6', outline: '#1d180c' }, dorsal: 0.25, lateral: 0.5, pinstripe: 1, phantom: true },
  },
  tricolor: {
    label: 'Tricolor',
    phenotype: { palette: { base: '#2e2320', pattern: '#f3e8cf', accent: '#c4471d', outline: '#120c0a', eye: '#b98a3a' }, dorsal: 0.9, flameTongues: 0.8, lateral: 0.6, tricolor: 1 },
  },
  tiger: {
    label: 'Tiger',
    phenotype: { palette: { base: '#cf8a32', dark: '#33190c' }, tiger: 1 },
  },
  brindle: {
    label: 'Brindle',
    phenotype: { palette: { base: '#9a6a3a', dark: '#2a170c' }, tiger: 1, brindle: true },
  },
  'extreme-brindle': {
    label: 'Extreme Brindle',
    phenotype: { palette: { base: '#7a5230', dark: '#1e1008' }, tiger: 1, brindle: true, lateral: 0.2, dorsal: 0.2 },
  },
  'tiger-brindle': {
    label: 'Tiger / Brindle',
    phenotype: { palette: { base: '#b07a3e', dark: '#2c170b' }, tiger: 0.85, brindle: true },
  },
  dalmatian: {
    label: 'Dalmatian',
    phenotype: { palette: { base: '#d8b35a', outline: '#2a1d0c' }, dalmatian: 32 },
  },
  'super-dalmatian': {
    label: 'Super Dalmatian',
    phenotype: { palette: { base: '#e6d3a0', outline: '#2c2416' }, dalmatian: 140, redSpots: 0.18 },
  },
  'lilly-white': {
    label: 'Lilly White',
    phenotype: { palette: { base: '#6b4a30', pattern: '#efdfba', outline: '#1e140c' }, dorsal: 0.7, flameTongues: 0.5, lateral: 0.2, lillyWhite: 1 },
  },
  'white-wall': {
    label: 'White Wall',
    phenotype: { palette: { base: '#a35a2a', pattern: '#fbf9f2' }, lateral: 1, dorsal: 0.3 },
  },
  frappuccino: {
    label: 'Frappuccino',
    phenotype: { palette: { base: '#4a2e1c', pattern: '#f1e2c4', outline: '#160d07' }, dorsal: 1, dorsalStyle: 'saddle', lillyWhite: 1 },
  },
  axanthic: {
    label: 'Axanthic',
    phenotype: {
      palette: { base: '#7d7f82', dark: '#1c1c1d', pattern: '#eceded', outline: '#141415', eye: '#9aa1a8', crest: '#a9abae' },
      dorsal: 0.85,
      flameTongues: 0.8,
      lateral: 0.45,
    },
  },
  cappuccino: {
    label: 'Cappuccino',
    phenotype: { palette: { base: '#3d2416', pattern: '#e5cfa6', outline: '#140b06', crest: '#5a3a26' }, dorsal: 1, dorsalStyle: 'saddle' },
  },
  albino: {
    label: 'Albino',
    phenotype: {
      palette: { base: '#eab486', dark: '#cf8f60', pattern: '#fdf1d6', outline: '#a8724c', eye: '#d23a4e', crest: '#f4cfa8', spot: '#d99a6a' },
      dorsal: 0.85,
      flameTongues: 0.8,
      lateral: 0.45,
      albino: true,
    },
  },
  hypo: {
    label: 'Hypo',
    phenotype: { palette: { base: '#e39a52', pattern: '#fdeec8', outline: '#6a4022', crest: '#f0b878' }, dorsal: 0.8, flameTongues: 0.6, lateral: 0.3 },
  },
  moonglow: {
    label: 'Moonglow (breeding goal)',
    goal: true,
    phenotype: { palette: { base: '#f3efe4', pattern: '#ffffff', outline: '#a49c8a', eye: '#3a3632', crest: '#ffffff' } },
  },
  'red-base': {
    label: 'Red Base',
    phenotype: { palette: { ...RED, pattern: '#b23a2c' }, dorsal: 0.6, flameTongues: 0.5 },
  },
  'orange-base': {
    label: 'Orange Base',
    phenotype: { palette: { ...ORANGE, base: '#d9772a', pattern: '#f2b25e' }, dorsal: 0.6, flameTongues: 0.5 },
  },
  'yellow-base': {
    label: 'Yellow Base',
    phenotype: { palette: { base: '#d9b02e', pattern: '#f5e28a', outline: '#2c220a' }, dorsal: 0.6, flameTongues: 0.5 },
  },
  olive: {
    label: 'Olive',
    phenotype: { palette: { base: '#5f5f2e', pattern: '#a8a466', outline: '#1a1a0c' }, dorsal: 0.6, flameTongues: 0.5 },
  },
  chocolate: {
    label: 'Chocolate',
    phenotype: { palette: { base: '#4a2c18', pattern: '#7a5236', outline: '#140b05' }, dorsal: 0.6, flameTongues: 0.5 },
  },
  lavender: {
    label: 'Lavender',
    phenotype: { palette: { base: '#8a7896', pattern: '#c9b9d2', outline: '#241d2a', crest: '#a897b3' }, dorsal: 0.6, flameTongues: 0.5 },
  },
  buckskin: {
    label: 'Buckskin',
    phenotype: { palette: { base: '#a8875a', pattern: '#c9ad82', outline: '#2a2014' }, dorsal: 0.6, flameTongues: 0.5 },
  },
  cream: {
    label: 'Cream',
    phenotype: { palette: { ...ORANGE, pattern: '#fbf6e6' }, dorsal: 1, flameTongues: 1, lateral: 0.45 },
  },
};

/** True when the Morph Guide slug has an illustration preset. */
export function hasIllustration(slug) {
  return Object.prototype.hasOwnProperty.call(ILLUSTRATED_GECKO_PRESETS, slug);
}

// ---------------------------------------------------------------------------
// Spectrum interpolation, used by PatternSpectrum.jsx.
// ---------------------------------------------------------------------------

const lerp = (a, b, t) => a + (b - a) * t;

function lerpPalette(a, b, t) {
  const pa = { ...DEFAULT_PALETTE, ...a };
  const pb = { ...DEFAULT_PALETTE, ...b };
  const out = {};
  Object.keys({ ...pa, ...pb }).forEach((k) => {
    const ca = pa[k] || pb[k];
    const cb = pb[k] || pa[k];
    out[k] = mixHex(ca, cb, t);
  });
  return out;
}

/**
 * Blend two phenotypes. Numbers and colors interpolate; booleans and
 * styles switch at the halfway point.
 */
export function lerpPhenotype(a, b, t) {
  const na = normalizePhenotype(a);
  const nb = normalizePhenotype(b);
  const out = {};
  Object.keys(DEFAULTS).forEach((k) => {
    if (k === 'palette') out.palette = lerpPalette(na.palette, nb.palette, t);
    else if (typeof na[k] === 'number') out[k] = lerp(na[k], nb[k], t);
    else out[k] = t < 0.5 ? na[k] : nb[k];
  });
  return out;
}

/** Phenotype at a fractional position along a list of keyframe phenotypes. */
export function phenotypeAlong(keyframes, pos) {
  const max = keyframes.length - 1;
  const x = Math.max(0, Math.min(max, pos));
  const i = Math.min(max - 1, Math.floor(x));
  return lerpPhenotype(keyframes[i], keyframes[i + 1], x - i);
}

// One shared red palette for the coverage track, so the only thing that
// changes while scrubbing is the pattern itself.
const TRACK_PALETTE = { base: '#9a3624', dark: '#3a120d', pattern: '#f5e3b8', outline: '#200d09', eye: '#c8862e' };

export const COVERAGE_KEYFRAMES = [
  { palette: TRACK_PALETTE },
  { palette: TRACK_PALETTE, dorsal: 1, flameTongues: 1 },
  { palette: TRACK_PALETTE, dorsal: 1, flameTongues: 1, lateral: 0.55 },
  { palette: TRACK_PALETTE, dorsal: 1, flameTongues: 1, lateral: 1 },
];

const PIN_PALETTE = { base: '#b4521f', dark: '#4a2614', pattern: '#f6dd92', outline: '#26140a' };

export const PINNING_KEYFRAMES = [
  { palette: PIN_PALETTE, dorsal: 0.2, lateral: 0.3, pinstripe: 0 },
  { palette: PIN_PALETTE, dorsal: 0.2, lateral: 0.3, pinstripe: 0.5 },
  { palette: PIN_PALETTE, dorsal: 0.2, lateral: 0.3, pinstripe: 1 },
];
