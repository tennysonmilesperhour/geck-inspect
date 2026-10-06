import { useId, useMemo } from 'react';
import {
  ILLUSTRATED_GECKO_PRESETS,
  DEFAULT_PALETTE,
  normalizePhenotype,
  mixHex,
} from '@/components/morphguide/illustratedGeckoPresets';

/**
 * A stylized, top-down crested gecko drawn in SVG, used as morph art in the
 * Morph Guide. It is not a photo and not a genetic prediction: it is a
 * diagram that shows WHERE each pattern sits on the body (back, flanks,
 * crest rows, legs) so a visitor can learn what to look for.
 *
 * Usage:
 *   <IllustratedGecko morph="harlequin" size={160} />
 *   <IllustratedGecko phenotype={{ dorsal: 1, lateral: 0.4 }} />
 *
 * The drawing is parametric: every pattern is a number from 0 to 1 (or a
 * spot count for Dalmatian), so the Pattern Spectrum can slide smoothly
 * from one morph to the next. See illustratedGeckoPresets.js for the
 * phenotype fields.
 *
 * Only the top view exists; `view` is accepted for forward compatibility.
 */

// ---------------------------------------------------------------------------
// Geometry. Everything here is computed once at module load, because the
// body shape never changes; only colors and pattern amounts do.
// ---------------------------------------------------------------------------

const VIEW_W = 240;
const VIEW_H = 384;

/** Catmull-Rom interpolation of one coordinate. */
function cr(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/**
 * Sample a smooth curve through points [x, y, r] and return frames:
 * position, unit normal (pointing to the gecko's left when facing the
 * head... it only matters that it is consistent), radius and arc length.
 */
function sampleSpine(points, perSeg = 16) {
  const out = [];
  const n = points.length;
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];
    const steps = i === n - 2 ? perSeg + 1 : perSeg;
    for (let k = 0; k < steps; k += 1) {
      const t = k / perSeg;
      out.push({
        x: cr(p0[0], p1[0], p2[0], p3[0], t),
        y: cr(p0[1], p1[1], p2[1], p3[1], t),
        r: Math.max(0.6, cr(p0[2], p1[2], p2[2], p3[2], t)),
      });
    }
  }
  let len = 0;
  for (let i = 0; i < out.length; i += 1) {
    const a = out[Math.max(0, i - 1)];
    const b = out[Math.min(out.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    out[i].tx = dx / d;
    out[i].ty = dy / d;
    out[i].nx = -dy / d;
    out[i].ny = dx / d;
    if (i > 0) len += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y);
    out[i].s = len;
  }
  out.forEach((f) => { f.u = f.s / len; });
  return out;
}

const f1 = (v) => Math.round(v * 10) / 10;

/** Closed outline around a sampled spine, with radius scaled by `rf`. */
function tubePath(frames, rf = () => 1) {
  const left = [];
  const right = [];
  frames.forEach((f, i) => {
    const r = f.r * rf(f, i);
    left.push(`${f1(f.x + f.nx * r)},${f1(f.y + f.ny * r)}`);
    right.push(`${f1(f.x - f.nx * r)},${f1(f.y - f.ny * r)}`);
  });
  const last = frames[frames.length - 1];
  const lr = last.r * rf(last, frames.length - 1);
  const capX = last.x + last.tx * lr;
  const capY = last.y + last.ty * lr;
  return `M${left.join('L')}Q${f1(capX)},${f1(capY)} ${right.reverse().join('L')}Z`;
}

/** A polyline along the spine at a signed offset (fraction of radius). */
function offsetLine(frames, off, from = 0, to = 1) {
  const pts = frames.filter((f) => f.u >= from && f.u <= to);
  return pts.map((f, i) => `${i ? 'L' : 'M'}${f1(f.x + f.nx * f.r * off)},${f1(f.y + f.ny * f.r * off)}`).join('');
}

/** Frame nearest to a normalized arc position. */
function frameAt(frames, u) {
  const idx = Math.max(0, Math.min(frames.length - 1, Math.round(u * (frames.length - 1))));
  return frames[idx];
}

// Spine from the neck to the curled tail tip: [x, y, radius].
const SPINE_POINTS = [
  [120, 96, 22],
  [120, 124, 25],
  [120, 168, 34],
  [120.5, 212, 34],
  [120, 248, 22],
  [119, 284, 12.5],
  [116, 318, 10],
  [124, 348, 8.4],
  [146, 362, 7],
  [168, 354, 5.6],
  [174, 334, 4.6],
  [162, 324, 3.6],
  [153, 333, 2.6],
];
const SPINE = sampleSpine(SPINE_POINTS, 14);
// Normalized arc positions of landmarks along SPINE.
const U_HIPS = SPINE.find((f) => f.y >= 250).u;
const BODY_PATH = tubePath(SPINE);

const HEAD_PATH =
  'M120,12C136,12 150,21 157,37C164,52 168,68 170,84C172,100 162,112 146,117C137,120 128,121 120,121C112,121 103,120 94,117C78,112 68,100 70,84C72,68 76,52 83,37C90,21 104,12 120,12Z';
const EYES = [
  { cx: 81, cy: 58, side: -1 },
  { cx: 159, cy: 58, side: 1 },
];

// Legs: shoulder/hip, elbow/knee, wrist/ankle, with the foot direction.
// Defined for the gecko's left side (screen left) and mirrored.
const LEG_DEFS = [
  { key: 'front', pts: [[104, 132, 8.5], [74, 140, 7], [62, 108, 5.4]], toeDir: [-0.35, -1] },
  { key: 'back', pts: [[106, 232, 9.5], [70, 226, 7.6], [60, 268, 5.8]], toeDir: [-0.4, 1] },
];

function mirrorPts(pts) {
  return pts.map(([x, y, r]) => [VIEW_W - x, y, r]);
}

function buildLeg(pts, toeDir) {
  const frames = sampleSpine(pts, 10);
  const wrist = pts[pts.length - 1];
  const len = Math.hypot(toeDir[0], toeDir[1]);
  const dx = toeDir[0] / len;
  const dy = toeDir[1] / len;
  const base = Math.atan2(dy, dx);
  const toes = [-64, -32, 0, 30, 60].map((deg, i) => {
    const a = base + (deg * Math.PI) / 180;
    const l = [10, 13.5, 14.5, 13.5, 10.5][i];
    const tipX = wrist[0] + Math.cos(a) * l;
    const tipY = wrist[1] + Math.sin(a) * l;
    return {
      d: `M${f1(wrist[0])},${f1(wrist[1])}L${f1(tipX)},${f1(tipY)}`,
      pad: { cx: f1(tipX + Math.cos(a) * 1.2), cy: f1(tipY + Math.sin(a) * 1.2), r: 3.3, rot: (a * 180) / Math.PI },
    };
  });
  return { frames, path: tubePath(frames), toes, wrist };
}

const LEGS = LEG_DEFS.flatMap((def) => [
  { ...buildLeg(def.pts, def.toeDir), key: `${def.key}-l` },
  { ...buildLeg(mirrorPts(def.pts), [-def.toeDir[0], def.toeDir[1]]), key: `${def.key}-r` },
]);

// Crest rows: the raised scales that run from behind each eye down the
// back. On a crested gecko they sit at the edge of the back, which is
// exactly where a Pinstripe's cream line runs.
const CREST_OFF = 0.62;
const CREST_FROM = SPINE[0].u;
const CREST_TO = U_HIPS + 0.03;
const CREST_ROWS = [-1, 1].map((side) => ({
  side,
  body: offsetLine(SPINE, side * CREST_OFF, CREST_FROM, CREST_TO),
  // Head part: from over the eye back to the neck.
  head: side < 0
    ? 'M77,44C71,62 76,86 90,100C97,108 103,111 106,116'
    : 'M163,44C169,62 164,86 150,100C143,108 137,111 134,116',
}));

/** Small spikes along the crest rows, pointing out from the spine. */
const CREST_SPIKES = (() => {
  const spikes = [];
  [-1, 1].forEach((side) => {
    for (let u = CREST_FROM + 0.01; u <= CREST_TO; u += 0.0165) {
      const f = frameAt(SPINE, u);
      const bx = f.x + f.nx * f.r * CREST_OFF * side;
      const by = f.y + f.ny * f.r * CREST_OFF * side;
      const h = 3.2 + 1.6 * (f.r / 34);
      // Spikes lean back toward the tail and outward.
      const ox = f.nx * side * 0.75 - f.tx * 0.65;
      const oy = f.ny * side * 0.75 - f.ty * 0.65;
      const ol = Math.hypot(ox, oy);
      const tipX = bx + (ox / ol) * h;
      const tipY = by + (oy / ol) * h;
      const w = 1.5;
      spikes.push({
        u,
        side,
        d: `M${f1(bx - f.tx * w)},${f1(by - f.ty * w)}L${f1(tipX)},${f1(tipY)}L${f1(bx + f.tx * w)},${f1(by + f.ty * w)}Z`,
      });
    }
  });
  return spikes;
})();

/** Eyelash crest spikes, the fringe above each eye. */
const LASHES = EYES.flatMap((e) => {
  const out = [];
  for (let i = 0; i < 8; i += 1) {
    const a = (-162 + i * 21) * (Math.PI / 180);
    const ang = e.side > 0 ? a + Math.PI * 0.12 : Math.PI - a - Math.PI * 0.12;
    const r0 = 12;
    const bx = e.cx + Math.cos(ang) * r0;
    const by = e.cy + Math.sin(ang) * r0;
    const l = 5.5 + (i % 2) * 2.2 - Math.abs(i - 3.5) * 0.35;
    out.push(`M${f1(bx - Math.sin(ang) * 1.5)},${f1(by + Math.cos(ang) * 1.5)}L${f1(bx + Math.cos(ang) * l)},${f1(by + Math.sin(ang) * l)}L${f1(bx + Math.sin(ang) * 1.5)},${f1(by - Math.cos(ang) * 1.5)}Z`);
  }
  return out;
});

/** Deterministic pseudo-random numbers, so every render looks the same. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (a, b, x) => {
  if (b === a) return x >= b ? 1 : 0;
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Flank blotches (Harlequin). Each has a threshold: it appears once the
// coverage passes it, so pattern grows smoothly as coverage rises.
const FLANK_BLOBS = (() => {
  const r = rng(7);
  const blobs = [];
  for (let i = 0; i < 52; i += 1) {
    const side = i % 2 ? 1 : -1;
    const u = CREST_FROM + 0.02 + r() * (U_HIPS + 0.1 - CREST_FROM);
    const f = frameAt(SPINE, u);
    const off = 0.84 + r() * 0.34;
    blobs.push({
      x: f.x + f.nx * f.r * off * side,
      y: f.y + f.ny * f.r * off * side,
      rx: 4.5 + r() * 5.5,
      ry: 7 + r() * 9,
      rot: (Math.atan2(f.ny, f.nx) * 180) / Math.PI + (r() - 0.5) * 50,
      t: r() * 0.6,
    });
  }
  return blobs;
})();

// Leg blotches: Harlequin pattern climbing onto the legs.
const LEG_BLOBS = (() => {
  const r = rng(21);
  const out = [];
  LEGS.forEach((leg) => {
    for (let i = 0; i < 5; i += 1) {
      const f = leg.frames[Math.floor(r() * (leg.frames.length - 2))];
      out.push({ x: f.x, y: f.y, rx: 4.5 + r() * 4, ry: 3.5 + r() * 3, rot: r() * 180, t: 0.12 + r() * 0.45 });
    }
  });
  return out;
})();

// Tricolor accent patches (the third color, usually red or orange).
const ACCENT_BLOBS = (() => {
  const r = rng(99);
  const out = [];
  for (let i = 0; i < 16; i += 1) {
    const side = i % 2 ? 1 : -1;
    const u = CREST_FROM + 0.04 + r() * (U_HIPS - CREST_FROM);
    const f = frameAt(SPINE, u);
    const off = 0.72 + r() * 0.3;
    out.push({ x: f.x + f.nx * f.r * off * side, y: f.y + f.ny * f.r * off * side, rx: 5 + r() * 4, ry: 8 + r() * 8, rot: (Math.atan2(f.ny, f.nx) * 180) / Math.PI });
  }
  return out;
})();

// Dalmatian spots. The first ~45 land on the body; later ones spread to
// the head, legs and tail, which is how a Super Dalmatian reads.
const SPOTS = (() => {
  const r = rng(1234);
  const out = [];
  for (let i = 0; i < 150; i += 1) {
    const zone = i < 45 ? 'body' : ['body', 'head', 'leg', 'tail', 'body'][i % 5];
    let x;
    let y;
    if (zone === 'head') {
      x = 92 + r() * 56;
      y = 30 + r() * 78;
    } else if (zone === 'leg') {
      const leg = LEGS[Math.floor(r() * LEGS.length)];
      const f = leg.frames[Math.floor(r() * leg.frames.length)];
      x = f.x + (r() - 0.5) * f.r;
      y = f.y + (r() - 0.5) * f.r;
    } else {
      const u = zone === 'tail' ? U_HIPS + r() * (0.98 - U_HIPS) : CREST_FROM + r() * (U_HIPS + 0.03 - CREST_FROM);
      const f = frameAt(SPINE, u);
      const off = (r() * 2 - 1) * 0.9;
      x = f.x + f.nx * f.r * off;
      y = f.y + f.ny * f.r * off;
    }
    out.push({ x, y, r: 1.5 + r() * (i % 7 === 0 ? 3.4 : 2.2), red: r() });
  }
  return out;
})();

// Lilly White white blocks: bold, clean-edged white on the flanks, the
// crest edges, the lips and the legs.
const LW_BLOCKS = (() => {
  const r = rng(555);
  const out = [];
  for (let i = 0; i < 20; i += 1) {
    const side = i % 2 ? 1 : -1;
    const u = CREST_FROM + 0.03 + (i / 20) * (U_HIPS - CREST_FROM) + r() * 0.02;
    const f = frameAt(SPINE, u);
    const off = 0.7 + r() * 0.4;
    out.push({
      x: f.x + f.nx * f.r * off * side,
      y: f.y + f.ny * f.r * off * side,
      w: 12 + r() * 10,
      h: 16 + r() * 16,
      rot: (Math.atan2(f.ny, f.nx) * 180) / Math.PI + (r() - 0.5) * 30,
      t: r() * 0.6,
    });
  }
  return out;
})();

// ---------------------------------------------------------------------------
// Pattern builders (pure functions of the normalized phenotype)
// ---------------------------------------------------------------------------

/**
 * The cream back (Flame). `amount` 0..1 grows the width; `tongues` 0..1
 * adds the flame-shaped points that lick down toward the flanks.
 */
function dorsalPath(amount, tongues, style) {
  const width = style === 'solid' ? 0.66 : style === 'saddle' ? 0.74 : 0.3 + 0.24 * amount;
  const amp = style === 'flame' ? tongues * 0.62 : 0;
  const from = style === 'saddle' ? 0 : SPINE[2].u;
  const to = Math.min(1, U_HIPS + (style === 'flame' ? 0.06 + 0.05 * amount : 0.04));
  const frames = SPINE.filter((f) => f.u >= from && f.u <= to);
  const period = 0.062;
  return tubePath(frames, (f) => {
    if (style === 'saddle') {
      const pinch = 1 - 0.28 * Math.pow(Math.sin(((f.u - from) / (to - from)) * Math.PI * 3), 2);
      return width * pinch * Math.max(0.15, smooth(to, to - 0.08, f.u));
    }
    const phase = ((f.u - from) / period) % 1;
    const tooth = phase < 0.5 ? phase * 2 : (1 - phase) * 2; // 0..1 triangle
    const taper = smooth(to, to - 0.08, f.u) * smooth(from - 0.001, from + 0.03, f.u);
    return (width + amp * Math.pow(tooth, 3)) * Math.max(0.15, taper);
  });
}

/** Pinstripe segments along each crest row. */
function pinSegments(amount) {
  if (amount <= 0) return [];
  const r = rng(77);
  const segs = [];
  const step = 0.022;
  [-1, 1].forEach((side) => {
    let k = 0;
    for (let u = CREST_FROM + 0.005; u < CREST_TO - 0.004; u += step) {
      const posBias = (u - CREST_FROM) / (CREST_TO - CREST_FROM);
      const t = 0.55 * posBias + 0.45 * r();
      const grow = smooth(t, t + 0.12, amount * 1.12);
      if (grow > 0.02) {
        const end = Math.min(CREST_TO, u + step * (0.35 + 0.65 * grow));
        segs.push({ key: `${side}-${k}`, d: offsetLine(SPINE, side * CREST_OFF, u, end), o: grow });
      }
      k += 1;
    }
  });
  return segs;
}

function tigerBands(amount, brindle) {
  if (amount <= 0) return [];
  const r = rng(brindle ? 314 : 271);
  const bands = [];
  const count = 9;
  for (let i = 0; i < count; i += 1) {
    const u = SPINE[3].u + (i / count) * (U_HIPS + 0.12 - SPINE[3].u) + (brindle ? (r() - 0.5) * 0.02 : 0);
    const f = frameAt(SPINE, u);
    const pieces = brindle ? [[-1.1, -0.35], [-0.2, 0.25], [0.4, 1.1]] : [[-1.1, 1.1]];
    pieces.forEach(([a, b], j) => {
      if (brindle && r() < 0.18) return;
      const wob = brindle ? (r() - 0.5) * 6 : 0;
      const w = (brindle ? 3 + r() * 4 : 4.4) * (0.4 + 0.6 * amount) * (f.r / 30 + 0.35);
      const ax = f.x + f.nx * f.r * a;
      const ay = f.y + f.ny * f.r * a;
      const bx = f.x + f.nx * f.r * b;
      const by = f.y + f.ny * f.r * b;
      // Bands bow backward a little at the middle, like real tiger stripes.
      const mx = (ax + bx) / 2 - f.tx * (4 + wob);
      const my = (ay + by) / 2 - f.ty * (4 + wob);
      bands.push({ key: `${i}-${j}`, d: `M${f1(ax)},${f1(ay)}Q${f1(mx)},${f1(my)} ${f1(bx)},${f1(by)}`, w });
    });
  }
  return bands;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IllustratedGecko({
  morph,
  phenotype,
  size,
  view = 'top',
  className = '',
  title,
  decorative = false,
}) {
  const rawId = useId();
  const uid = `ig${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const preset = morph ? ILLUSTRATED_GECKO_PRESETS[morph] : null;
  const p = useMemo(
    () => normalizePhenotype({ ...(preset?.phenotype || {}), ...(phenotype || {}) }),
    [preset, phenotype],
  );
  void view;

  const pal = { ...DEFAULT_PALETTE, ...p.palette };
  const outline = pal.outline;
  const crestColor = pal.crest || mixHex(pal.base, '#ffffff', 0.22);
  const dorsalColor = p.dorsalStyle === 'solid' ? (pal.dorsal || mixHex(pal.base, '#ffffff', 0.35)) : pal.pattern;
  const pinColor = p.phantom ? mixHex(pal.base, pal.pattern, 0.28) : pal.pattern;
  const lwWhite = '#fbf9f2';

  const dorsal = useMemo(
    () => (p.dorsal > 0.01 ? dorsalPath(p.dorsal, p.flameTongues, p.dorsalStyle) : null),
    [p.dorsal, p.flameTongues, p.dorsalStyle],
  );
  const pins = useMemo(() => pinSegments(p.pinstripe), [p.pinstripe]);
  const bands = useMemo(() => tigerBands(p.tiger, p.brindle), [p.tiger, p.brindle]);

  const lateral = p.lateral;
  const spotCount = Math.round(p.dalmatian);
  const label = title || (preset ? `${preset.label} crested gecko illustration` : 'Crested gecko illustration');

  const clip = `${uid}-clip`;
  const style = size ? { width: size, height: (size * VIEW_H) / VIEW_W } : undefined;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? 'true' : undefined}
      aria-label={decorative ? undefined : label}
    >
      <defs>
        <clipPath id={clip}>
          <path d={BODY_PATH} />
          <path d={HEAD_PATH} />
          {LEGS.map((l) => <path key={l.key} d={l.path} />)}
        </clipPath>
        <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id={`${uid}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#000" floodOpacity="0.45" />
        </filter>
        <pattern id={`${uid}-scales`} width="6" height="5.2" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.3" r="1" fill="#000" opacity="0.12" />
          <circle cx="4.5" cy="3.9" r="1" fill="#000" opacity="0.12" />
        </pattern>
        <radialGradient id={`${uid}-eye`} cx="40%" cy="38%" r="70%">
          <stop offset="0%" stopColor={mixHex(pal.eye, '#ffffff', 0.35)} />
          <stop offset="100%" stopColor={mixHex(pal.eye, '#000000', 0.25)} />
        </radialGradient>
      </defs>

      {/* Outline pass: every part stroked thick in the outline color,
          then filled on top, so the joins read as one animal. */}
      <g filter={`url(#${uid}-shadow)`} stroke={outline} strokeWidth="5" strokeLinejoin="round" fill={outline}>
        <path d={BODY_PATH} />
        {LEGS.map((l) => (
          <g key={l.key}>
            <path d={l.path} />
            {l.toes.map((t, i) => (
              <g key={i}>
                <path d={t.d} strokeWidth="7.4" strokeLinecap="round" fill="none" />
                <ellipse cx={t.pad.cx} cy={t.pad.cy} rx={t.pad.r + 1.6} ry={t.pad.r * 0.82 + 1.6} transform={`rotate(${t.pad.rot} ${t.pad.cx} ${t.pad.cy})`} strokeWidth="0" />
              </g>
            ))}
          </g>
        ))}
        <path d={HEAD_PATH} />
        {EYES.map((e) => <circle key={e.cx} cx={e.cx} cy={e.cy} r="13.6" strokeWidth="0" />)}
      </g>

      {/* Base color fill */}
      <g fill={pal.base}>
        {LEGS.map((l) => (
          <g key={l.key}>
            <path d={l.path} />
            {l.toes.map((t, i) => (
              <g key={i}>
                <path d={t.d} stroke={pal.base} strokeWidth="3.6" strokeLinecap="round" fill="none" />
                <ellipse cx={t.pad.cx} cy={t.pad.cy} rx={t.pad.r} ry={t.pad.r * 0.82} transform={`rotate(${t.pad.rot} ${t.pad.cx} ${t.pad.cy})`} />
              </g>
            ))}
          </g>
        ))}
        <path d={BODY_PATH} />
        <path d={HEAD_PATH} />
      </g>

      {/* Pattern layers, clipped to the silhouette */}
      <g clipPath={`url(#${clip})`}>
        {/* Bicolor / Cappuccino / Flame back */}
        {dorsal && (
          <path d={dorsal} fill={dorsalColor} opacity={p.dorsalStyle === 'flame' ? Math.min(1, 0.25 + p.dorsal) : Math.min(1, p.dorsal)} />
        )}
        {/* Head blaze that continues the back pattern between the eyes */}
        {p.dorsal > 0.01 && p.dorsalStyle !== 'solid' && (
          <path
            d="M120,44C126,44 131,62 132,82C133,100 128,114 120,120C112,114 107,100 108,82C109,62 114,44 120,44Z"
            fill={dorsalColor}
            opacity={p.dorsalStyle === 'saddle' ? 1 : 0.7 * smooth(0.2, 0.9, p.dorsal)}
          />
        )}

        {/* Tricolor third color */}
        {p.tricolor > 0 && ACCENT_BLOBS.map((b, i) => (
          <ellipse key={i} cx={f1(b.x)} cy={f1(b.y)} rx={b.rx} ry={b.ry} transform={`rotate(${f1(b.rot)} ${f1(b.x)} ${f1(b.y)})`} fill={pal.accent} opacity={p.tricolor * 0.95} />
        ))}

        {/* Harlequin: flank wash for Extreme, then blotches, then legs */}
        {lateral > 0.7 && (
          <g opacity={smooth(0.7, 1, lateral)}>
            {[-1, 1].map((side) => (
              <path
                key={side}
                d={offsetLine(SPINE, side * 0.98, CREST_FROM, U_HIPS + 0.06)}
                stroke={pal.pattern}
                strokeWidth={6 + 8 * smooth(0.7, 1, lateral)}
                strokeLinecap="round"
                fill="none"
              />
            ))}
          </g>
        )}
        {lateral > 0 && FLANK_BLOBS.map((b, i) => {
          const g = smooth(b.t, b.t + 0.22, lateral);
          if (g <= 0.01) return null;
          const s = 0.35 + 0.65 * g + 0.55 * smooth(0.65, 1, lateral);
          return (
            <ellipse key={i} cx={f1(b.x)} cy={f1(b.y)} rx={f1(b.rx * s)} ry={f1(b.ry * s)} transform={`rotate(${f1(b.rot)} ${f1(b.x)} ${f1(b.y)})`} fill={pal.pattern} opacity={Math.min(1, 0.4 + g)} />
          );
        })}
        {lateral > 0.25 && LEG_BLOBS.map((b, i) => {
          const g = smooth(b.t + 0.1, b.t + 0.35, lateral);
          if (g <= 0.01) return null;
          const s = 0.4 + 0.6 * g + 0.5 * smooth(0.75, 1, lateral);
          return (
            <ellipse key={i} cx={f1(b.x)} cy={f1(b.y)} rx={f1(b.rx * s)} ry={f1(b.ry * s)} transform={`rotate(${f1(b.rot)} ${f1(b.x)} ${f1(b.y)})`} fill={pal.pattern} opacity={g} />
          );
        })}

        {/* Tiger and Brindle bands */}
        {bands.map((b) => (
          <path key={b.key} d={b.d} stroke={pal.dark} strokeWidth={f1(b.w)} strokeLinecap="round" fill="none" opacity={0.25 + 0.6 * p.tiger} />
        ))}

        {/* Lilly White: bold white blocks plus white lips */}
        {p.lillyWhite > 0 && (
          <g>
            {LW_BLOCKS.map((b, i) => {
              const g = smooth(b.t, b.t + 0.3, p.lillyWhite);
              if (g <= 0.01) return null;
              return (
                <rect key={i} x={f1(b.x - (b.w * g) / 2)} y={f1(b.y - (b.h * g) / 2)} width={f1(b.w * g)} height={f1(b.h * g)} rx="6" transform={`rotate(${f1(b.rot)} ${f1(b.x)} ${f1(b.y)})`} fill={lwWhite} />
              );
            })}
            <path d="M70,76C69,94 78,110 96,119C90,106 84,92 82,74ZM170,76C171,94 162,110 144,119C150,106 156,92 158,74Z" fill={lwWhite} opacity={smooth(0.2, 0.8, p.lillyWhite)} />
            {LEGS.map((l) => (
              <circle key={l.key} cx={f1(l.frames[Math.floor(l.frames.length / 2)].x)} cy={f1(l.frames[Math.floor(l.frames.length / 2)].y)} r={5 * smooth(0.3, 1, p.lillyWhite)} fill={lwWhite} />
            ))}
          </g>
        )}

        {/* Dalmatian spots */}
        {spotCount > 0 && SPOTS.slice(0, Math.min(SPOTS.length, spotCount)).map((s, i) => (
          <circle key={i} cx={f1(s.x)} cy={f1(s.y)} r={f1(s.r)} fill={s.red < p.redSpots ? pal.redSpot : pal.spot} />
        ))}

        {/* Soft dorsal highlight and scale texture for depth */}
        <path d={offsetLine(SPINE, 0, SPINE[2].u, 0.85)} stroke="#ffffff" strokeWidth="18" strokeLinecap="round" fill="none" opacity="0.13" filter={`url(#${uid}-soft)`} />
        <path d="M120,30C132,30 140,50 142,72C140,90 132,100 120,102C108,100 100,90 98,72C100,50 108,30 120,30Z" fill="#ffffff" opacity="0.08" filter={`url(#${uid}-soft)`} />
        {[-1, 1].map((side) => (
          <path key={side} d={offsetLine(SPINE, side * 1.05, 0, 1)} stroke="#000000" strokeWidth="9" fill="none" opacity="0.2" filter={`url(#${uid}-soft)`} />
        ))}
        <rect width={VIEW_W} height={VIEW_H} fill={`url(#${uid}-scales)`} />
      </g>

      {/* Crest rows: the base line, then pinstripe cream on top */}
      <g fill="none" strokeLinecap="round">
        {CREST_ROWS.map((row) => (
          <g key={row.side} stroke={mixHex(crestColor, outline, 0.25)} strokeWidth="2" opacity="0.8">
            <path d={row.body} />
            <path d={row.head} />
          </g>
        ))}
        {pins.map((s) => (
          <path key={s.key} d={s.d} stroke={pinColor} strokeWidth="5" opacity={s.o} />
        ))}
        {p.pinstripe > 0.6 && CREST_ROWS.map((row) => (
          <path key={`h${row.side}`} d={row.head} stroke={pinColor} strokeWidth="3.4" opacity={smooth(0.6, 1, p.pinstripe)} />
        ))}
      </g>
      <g>
        {CREST_SPIKES.map((sp, i) => {
          const pinned = pins.length > 0 && p.pinstripe > 0.05 && ((sp.u - CREST_FROM) / (CREST_TO - CREST_FROM)) < p.pinstripe * 1.05;
          return <path key={i} d={sp.d} fill={pinned ? pinColor : crestColor} stroke={outline} strokeWidth="0.6" strokeLinejoin="round" />;
        })}
      </g>

      {/* Eyes with eyelash crests */}
      {EYES.map((e) => (
        <g key={e.cx}>
          <circle cx={e.cx} cy={e.cy} r="11" fill={`url(#${uid}-eye)`} />
          <ellipse cx={e.cx + e.side * 1.2} cy={e.cy} rx="1.7" ry="7.8" fill={p.albino ? mixHex(pal.eye, '#3a0008', 0.55) : '#120d0a'} />
          <circle cx={e.cx - 3} cy={e.cy - 3.5} r="2" fill="#ffffff" opacity="0.85" />
        </g>
      ))}
      <g fill={crestColor} stroke={outline} strokeWidth="0.7" strokeLinejoin="round">
        {LASHES.map((d, i) => <path key={i} d={d} />)}
      </g>

      {/* Nostrils */}
      <circle cx="112" cy="20" r="1.7" fill={outline} opacity="0.8" />
      <circle cx="128" cy="20" r="1.7" fill={outline} opacity="0.8" />
    </svg>
  );
}

/** True when the Morph Guide slug has an illustration preset. */
export { hasIllustration } from '@/components/morphguide/illustratedGeckoPresets';
