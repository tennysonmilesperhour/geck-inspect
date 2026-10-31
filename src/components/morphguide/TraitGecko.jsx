import { useEffect, useId, useRef, useState } from 'react';
import { pinSegments } from './traitStudyMath';
import { SPOT_REGIONS, TRAIT_LAYER_ROOT } from './traitLayers.generated';

// The drawings and their pigment layers are made once, ahead of time, by
// scripts/precompute-trait-layers.mjs from the ink studies in
// art/morph-guide/ink-studies-v3/. Each trait file holds only the paint
// that trait adds (transparent everywhere else), so it sits on the base
// animal directly. Until October 2026 every visitor's browser downloaded
// the ten full drawings (2.26 MB) and worked the layers out pixel by
// pixel, which froze a phone for about 3 seconds.
export const INK_ROOT = TRAIT_LAYER_ROOT;
export const traitAsset = (view, trait = 'base') => `${INK_ROOT}/${view}-${trait}.webp`;
export const clampTrait = v => Math.max(0, Math.min(1, Number(v) || 0));

// Registered to crest scales. Pinning cannot recolor the broad dorsal field.
export const CREST_PATHS = {
  side: ['M200 273 Q242 276 285 295 Q332 302 380 283 Q427 265 475 258 Q522 243 570 224 Q617 209 665 198 Q712 210 760 211'],
  top: ['M260 261 Q305 277 345 261 Q401 236 455 244 Q528 250 587 267 Q636 281 687 291', 'M260 351 Q298 341 342 359 Q399 388 453 375 Q525 366 584 351 Q638 337 686 330'],
};
export const UPPER_CREST_SIDE = 'M200 212 Q250 202 300 204 Q345 218 380 228 Q427 225 475 208 Q522 187 570 170 Q617 159 665 158 Q712 168 760 181';

export const REGIONS = {
  side: {
    dorsal: 'M140 245 Q215 198 300 204 Q380 228 475 208 Q570 170 665 158 Q735 168 820 205 L780 225 Q712 210 665 198 Q570 224 475 258 Q380 283 332 302 Q265 292 200 273 Z',
    lateral: 'M295 302 Q380 283 475 258 Q570 224 665 198 L770 215 L795 480 L300 560 Z',
  },
  top: {
    dorsal: 'M65 294 Q143 219 258 277 Q469 241 680 297 L680 329 Q472 379 258 335 Q145 386 65 335 Z',
    lateral: 'M165 80 L746 80 L746 277 Q478 221 265 274 L165 260 Z M165 365 L267 346 Q478 395 746 343 L746 550 L165 550 Z',
  },
};
// Full-canvas complementary partitions along the dorsolateral crest boundary so
// head crown, tail, limbs, and upper flanks are never clipped off.
export const CLIP_REGIONS = {
  side: {
    dorsal: 'M60 95 L985 95 L985 615 L775 615 L760 211 Q712 210 665 198 Q617 209 570 224 Q522 243 475 258 Q427 265 380 283 Q332 302 285 295 Q242 276 200 273 L115 280 L60 280 Z',
    lateral: 'M60 280 L115 280 L200 273 Q242 276 285 295 Q332 302 380 283 Q427 265 475 258 Q522 243 570 224 Q617 209 665 198 Q712 210 760 211 L775 615 L60 615 Z',
  },
  top: {
    dorsal: 'M55 294 Q143 219 258 274 Q469 235 685 288 L760 260 L995 260 L995 560 L760 560 L685 335 Q472 385 258 342 Q145 386 55 335 Z',
    lateral: 'M140 70 L760 70 L760 260 L685 288 Q469 235 258 274 L140 255 Z M140 360 L258 342 Q472 385 685 335 L760 560 L140 560 Z',
  },
};

export const BASE_TONES = {
  // Natural & Warm Bases
  buckskin: { label: 'Buckskin', group: 'natural', swatch: '#a8875a', matrix: null },
  cream: { label: 'Cream / Buff', group: 'natural', swatch: '#dcc59a', matrix: [1.08, 0.06, 0, 0, 0.05, 0.04, 1.04, 0.02, 0, 0.04, 0.02, 0.04, 0.88, 0, 0.02, 0, 0, 0, 1, 0] },
  yellow: { label: 'Golden Yellow', group: 'natural', swatch: '#d6a438', matrix: [1.05, 0.05, 0, 0, 0.02, 0.04, 1.01, 0, 0, 0.01, 0, 0, 0.72, 0, -0.03, 0, 0, 0, 1, 0] },
  orange: { label: 'Tangerine', group: 'natural', swatch: '#cb6828', matrix: [1.06, 0.05, 0, 0, 0.02, 0.03, 0.86, 0, 0, -0.01, 0, 0, 0.62, 0, -0.03, 0, 0, 0, 1, 0] },
  red: { label: 'Red Base', group: 'natural', swatch: '#9c3424', matrix: [1.04, 0.05, 0, 0, 0.01, 0.02, 0.69, 0, 0, -0.03, 0, 0, 0.58, 0, -0.03, 0, 0, 0, 1, 0] },
  mahogany: { label: 'Dark Mahogany', group: 'natural', swatch: '#4a281b', matrix: [0.76, 0.04, 0, 0, -0.04, 0.02, 0.66, 0, 0, -0.04, 0, 0.02, 0.58, 0, -0.03, 0, 0, 0, 1, 0] },
  chocolate: { label: 'Chocolate', group: 'natural', swatch: '#633924', matrix: [0.84, 0.05, 0, 0, -0.02, 0.03, 0.71, 0, 0, -0.03, 0, 0.02, 0.58, 0, -0.03, 0, 0, 0, 1, 0] },
  olive: { label: 'Olive / Moss', group: 'natural', swatch: '#6b7544', matrix: [0.82, 0.08, 0, 0, -0.02, 0.05, 0.92, 0.02, 0, 0, 0, 0.04, 0.72, 0, -0.02, 0, 0, 0, 1, 0] },
  // Dark & Melanistic Gene Bases
  phantom: { label: 'Phantom Taupe', group: 'dark', swatch: '#54473e', matrix: [0.62, 0.18, 0.05, 0, -0.02, 0.14, 0.60, 0.06, 0, -0.02, 0.10, 0.14, 0.54, 0, -0.01, 0, 0, 0, 1, 0] },
  cappuccino: { label: 'Cappuccino', group: 'dark', swatch: '#382a24', matrix: [0.58, 0.10, 0.02, 0, -0.05, 0.06, 0.52, 0.03, 0, -0.05, 0.04, 0.06, 0.46, 0, -0.04, 0, 0, 0, 1, 0] },
  sable: { label: 'Sable Umber', group: 'dark', swatch: '#2b1f1a', matrix: [0.52, 0.08, 0.02, 0, -0.06, 0.05, 0.46, 0.02, 0, -0.06, 0.03, 0.05, 0.40, 0, -0.05, 0, 0, 0, 1, 0] },
  melanistic: { label: 'Super Dark / Melanistic', group: 'dark', swatch: '#1c1716', matrix: [0.38, 0.08, 0.02, 0, -0.07, 0.05, 0.36, 0.02, 0, -0.07, 0.04, 0.05, 0.34, 0, -0.06, 0, 0, 0, 1, 0] },
  // Hypo, Lavender, Monochrome & Amelanistic Bases
  lavender: { label: 'Lavender Slate', group: 'modifier', swatch: '#7b6f82', matrix: [0.68, 0.18, 0.14, 0, 0.01, 0.16, 0.62, 0.14, 0, 0, 0.18, 0.18, 0.72, 0, 0.03, 0, 0, 0, 1, 0] },
  hypo: { label: 'Hypo Peach-Tan', group: 'modifier', swatch: '#c89268', matrix: [1.04, 0.08, 0.02, 0, 0.05, 0.06, 0.94, 0.04, 0, 0.03, 0.04, 0.06, 0.80, 0, 0.02, 0, 0, 0, 1, 0] },
  axanthic: { label: 'Axanthic Gray', group: 'modifier', swatch: '#6e7276', matrix: [0.42, 0.44, 0.14, 0, -0.02, 0.40, 0.45, 0.15, 0, -0.02, 0.38, 0.44, 0.18, 0, -0.01, 0, 0, 0, 1, 0] },
  leucistic: { label: 'Moonglow / Leucistic', group: 'modifier', swatch: '#ede9df', matrix: [0.75, 0.25, 0.10, 0, 0.16, 0.22, 0.76, 0.10, 0, 0.15, 0.18, 0.24, 0.66, 0, 0.14, 0, 0, 0, 1, 0] },
  albino: { label: 'Albino', group: 'modifier', swatch: '#f2dec4', matrix: [1.08, 0.08, 0, 0, 0.08, 0.06, 0.98, 0.04, 0, 0.06, 0.04, 0.06, 0.88, 0, 0.05, 0, 0, 0, 1, 0] },
};

// Each group lists its tone ids, read from the group field on BASE_TONES, so
// a tone added above shows up in the Pattern studio picker without a second
// edit here.
export const BASE_TONE_GROUPS = [
  { id: 'natural', label: 'Warm & Natural Bases' },
  { id: 'dark', label: 'Dark & Melanistic Genes' },
  { id: 'modifier', label: 'Hypo, Lavender, Axanthic & Albino' },
].map((group) => ({
  ...group,
  tones: Object.keys(BASE_TONES).filter((id) => BASE_TONES[id].group === group.id),
}));

function smoothstep(x) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

function buildToneMatrix(tone, fired) {
  const f = clampTrait(fired === undefined ? 1 : fired);
  const identity = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  const base = BASE_TONES[tone]?.matrix || identity;
  if (f >= 0.999 && !BASE_TONES[tone]?.matrix) return null;
  // Firing down softens contrast and lightens the dermal melanophore layer smoothly
  const lift = (1 - f) * 0.075;
  const scale = 1 - (1 - f) * 0.06;
  const out = [...base];
  for (const row of [0, 1, 2]) {
    out[row * 5 + 0] *= scale;
    out[row * 5 + 1] *= scale;
    out[row * 5 + 2] *= scale;
    out[row * 5 + 4] += lift;
  }
  return out.map(n => Number(n.toFixed(4))).join(' ');
}

function buildWhiteFactorMatrix(whiteFactor) {
  const w = clampTrait(whiteFactor);
  if (w <= 0.001) return null;
  // Smoothly shifts warm cream/apricot pattern into pure chalk-white (#faf8f2)
  const r = Number((1 + w * 0.14).toFixed(4));
  const g = Number((1 + w * 0.18).toFixed(4));
  const b = Number((1 + w * 0.32).toFixed(4));
  const lift = Number((w * 0.08).toFixed(4));
  return `${r} 0.04 0 0 ${lift} 0.03 ${g} 0.02 0 ${lift} 0.04 0.06 ${b} 0 ${lift} 0 0 0 1 0`;
}

const layersByView = new Map();
function pigmentsFor(view) {
  if (!layersByView.has(view)) {
    const regions = (SPOT_REGIONS[view] || []).map(([x, y, width, height], order) => ({ x, y, width, height, order }));
    layersByView.set(view, {
      view,
      cream: { src: traitAsset(view, 'cream') },
      pin: { src: traitAsset(view, 'pin') },
      tiger: { src: traitAsset(view, 'tiger') },
      spots: { src: traitAsset(view, 'spots'), regions },
    });
  }
  return layersByView.get(view);
}
// Same shape as before ({ view, cream: { src }, ..., spots: { src, regions } }),
// so the study preview keeps working, but ready at once: nothing to compute.
export function usePigments(view) {
  return pigmentsFor(view === 'top' ? 'top' : 'side');
}
// A page can draw several studies (the Field Notebook, the quiz), most of
// them below the fold on a phone. Each one fetches its pictures only when
// it comes within 200 px of view (a full screen ahead fetched a second study, 116 KB, that
// most phone visitors never scroll to). Without IntersectionObserver
// (server render, tests, old browsers) everything draws straight away.
function useNearViewport() {
  const ref = useRef(null);
  const [near, setNear] = useState(() => typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function');
  useEffect(() => {
    if (near || !ref.current) return undefined;
    const observer = new window.IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setNear(true); observer.disconnect(); }
    }, { rootMargin: '200px 0px' });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [near]);
  return [ref, near];
}
// Smoothly reveals pre-painted watercolor islands with organic feathered lobes
// so scrubbing from 0.00 to 1.00 never shows vertical bars or sudden jumps.
function CoverageMask({ id, value, emptyBack = 0, region, view }) {
  const lateral = region === 'lateral';
  const v = clampTrait(value);
  const eb = lateral ? 0 : clampTrait(emptyBack);
  const fullBlend = smoothstep((v - 0.78) / 0.22);
  const blurId = `${id}-feather`;
  return (
    <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="667">
      <defs>
        <filter id={blurId} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
      </defs>
      {fullBlend > 0 && <rect width="1000" height="667" fill="white" fillOpacity={fullBlend} />}
      {v > 0 && fullBlend < 1 && (
        <g fill="white" filter={`url(#${blurId})`}>
          {Array.from({ length: 34 }, (_, i) => {
            const u = i / 33;
            const wave = Math.sin(i * 1.7 + 0.4) * 0.5 + Math.cos(i * 0.65) * 0.5;
            if (lateral) {
              const x = 140 + u * 645;
              const startAt = Math.max(0, Math.min(0.42, 0.14 + wave * 0.14 + Math.abs(u - 0.48) * 0.18));
              const p = smoothstep((v - startAt * (1 - v)) / Math.max(0.18, 1 - startAt * 0.6));
              if (p <= 0) return null;
              const alpha = smoothstep(Math.min(1, p * 2.1));
              if (view === 'top') {
                const ryTop = 18 + p * (155 + wave * 28);
                const ryBot = 18 + p * (145 - wave * 26);
                const rx = 18 + p * 28;
                return (
                  <g key={i} fillOpacity={alpha}>
                    <ellipse cx={x} cy={135 + p * 85} rx={rx} ry={ryTop} />
                    <ellipse cx={x + 6} cy={495 - p * 80} rx={rx} ry={ryBot} />
                  </g>
                );
              }
              const topY = 545 - p * (340 + wave * 34);
              const rx = 22 + p * 32;
              const ry = Math.max(18, (565 - topY) * 0.62);
              return (
                <ellipse
                  key={i}
                  cx={x}
                  cy={(topY + 555) * 0.5}
                  rx={rx}
                  ry={ry}
                  fillOpacity={alpha}
                />
              );
            }
            // Dorsal coverage: nucleates across the dorsal saddle first, then
            // expands smoothly to the head crown and down the tail.
            const x = 95 + u * 860;
            const distFromSaddle = Math.abs(u - 0.42);
            const startAt = Math.max(0, Math.min(0.48, distFromSaddle * 0.42 + wave * 0.08));
            const p = smoothstep((v - startAt * (1 - v)) / Math.max(0.18, 1 - startAt * 0.65));
            if (p <= 0) return null;
            const alpha = smoothstep(Math.min(1, p * 2.2));
            const cy = view === 'top'
              ? (x < 685 ? 308 + wave * 12 : 315 + (x - 685) * 0.42)
              : (x < 710 ? 235 - (x - 320) * 0.14 + wave * 10 : 210 + (x - 710) * 1.15);
            const rx = 24 + p * 44;
            const ry = 16 + p * (x > 700 ? 155 : view === 'top' ? 88 : 78);
            return <ellipse key={i} cx={x} cy={cy} rx={rx} ry={ry} fillOpacity={alpha} />;
          })}
        </g>
      )}
      {/* Empty Back clearing: erases the interior dorsal saddle between the crest rows */}
      {eb > 0 && (
        <g fill="black" filter={`url(#${blurId})`}>
          {view === 'top' ? (
            <path
              d="M210 296 Q360 258 520 264 Q615 274 685 298 L685 325 Q615 349 520 358 Q360 364 210 326 Z"
              fillOpacity={smoothstep(eb)}
              stroke="black"
              strokeWidth={8 + eb * 22}
              strokeOpacity={smoothstep(eb)}
            />
          ) : (
            <path
              d="M205 246 Q330 226 475 214 Q585 190 675 174 L670 202 Q575 218 475 248 Q340 278 205 266 Z"
              fillOpacity={smoothstep(eb)}
              stroke="black"
              strokeWidth={6 + eb * 18}
              strokeOpacity={smoothstep(eb)}
            />
          )}
        </g>
      )}
    </mask>
  );
}

export function RegionAnnotation({ view, focus }) {
  const pinning = focus === 'pinstripe', dorsal = focus === 'dorsal' || focus === 'tiger';
  const label = pinning
    ? 'Paired crest rows'
    : dorsal
    ? 'Dorsal field'
    : focus === 'spots'
    ? 'Discrete pigment spots'
    : focus === 'structural'
    ? 'Dorsal & flank wall'
    : 'Flanks and limbs';
  return <g fill="none" stroke="#21544a" strokeWidth="2.5" opacity=".92">
    {pinning ? (
      <>
        {CREST_PATHS[view].map(d => <path key={d} d={d} strokeWidth="20" opacity=".24" />)}
        {view === 'side' && <path d={UPPER_CREST_SIDE} strokeWidth="16" opacity=".22" />}
      </>
    ) : (
      <path d={REGIONS[view][dorsal ? 'dorsal' : 'lateral']} strokeDasharray="5 5" />
    )}
    <path d={view === 'top' ? (pinning || dorsal ? 'M500 87 L500 170 L450 242' : 'M500 87 L610 125 L628 200') : (pinning ? 'M500 84 L515 155 L522 243' : dorsal ? 'M500 84 L500 155 L520 212' : 'M500 84 L545 160 L505 328')} />
    <rect x="355" y="40" width="290" height="44" rx="8" fill="#f4efdf" strokeWidth="1.2" />
    <text x="500" y="69" textAnchor="middle" fontFamily="Georgia, serif" fontSize="20" fill="#21544a" stroke="none">{label}</text>
  </g>;
}
export default function TraitGecko({
  view = 'side',
  traits = {},
  tone = 'buckskin',
  fired = 1,
  className = '',
  title = 'Crested gecko pattern study',
  decorative = false,
  focus = 'dorsal',
  annotate = false,
}) {
  const uid = useId().replace(/:/g,'');
  const selectedView = view === 'top' ? 'top' : 'side';
  const pigments = usePigments(selectedView);
  const [frameRef, near] = useNearViewport();
  const [error, setError] = useState(false);
  // SVG <image> has no error event React can listen to, so check the base
  // drawing with a plain Image (the browser reuses the same download).
  useEffect(() => {
    if (!near || typeof window === 'undefined' || typeof window.Image !== 'function') return undefined;
    let active = true;
    const probe = new window.Image();
    probe.onload = () => { if (active) setError(false); };
    probe.onerror = () => { if (active) setError(true); };
    probe.src = traitAsset(selectedView);
    return () => { active = false; };
  }, [near, selectedView]);
  const dorsal = clampTrait(traits.dorsal);
  const lateral = clampTrait(traits.lateral);
  const pin = clampTrait(traits.pinstripe);
  const tiger = clampTrait(traits.tiger);
  const spots = clampTrait(traits.spots);
  const emptyBack = clampTrait(traits.emptyBack);
  const whitewall = clampTrait(traits.whitewall);
  const whiteFactor = clampTrait(traits.whiteFactor);
  const pied = clampTrait(traits.pied);
  const toneMatrix = buildToneMatrix(tone, fired);
  const toneFilter = toneMatrix ? `url(#${uid}-tone)` : undefined;
  const whiteMatrix = buildWhiteFactorMatrix(whiteFactor);
  const patternFilter = whiteMatrix ? `url(#${uid}-whitefactor)` : undefined;
  const image = (trait, extra = {}) => <image href={traitAsset(selectedView,trait)} width="1000" height="667" {...extra} />;
  const spotRegions = pigments.spots.regions;
  const pinMaskPaths = selectedView === 'side' ? [...CREST_PATHS.side, UPPER_CREST_SIDE] : CREST_PATHS.top;
  return <div ref={frameRef} className={`relative overflow-hidden ${className}`} style={{ aspectRatio: '3/2', background: '#f4efdf' }} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : title} aria-hidden={decorative || undefined} data-trait-view={selectedView} data-ready={near}>
    {near && <svg viewBox="0 0 1000 667" className="w-full h-full" aria-hidden="true">
      <defs>
        {toneMatrix && (
          <filter id={`${uid}-tone`} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={toneMatrix} />
          </filter>
        )}
        {whiteMatrix && (
          <filter id={`${uid}-whitefactor`} data-layer="whiteFactor" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={whiteMatrix} />
          </filter>
        )}
        <filter id={`${uid}-soft`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <clipPath id={`${uid}-dorsal-region`}><path d={CLIP_REGIONS[selectedView].dorsal} /></clipPath>
        <clipPath id={`${uid}-flank-region`}><path d={CLIP_REGIONS[selectedView].lateral} /></clipPath>
        <CoverageMask id={`${uid}-dorsal`} value={Math.max(dorsal, whiteFactor * 0.85)} emptyBack={emptyBack} view={selectedView} region="dorsal" />
        <CoverageMask id={`${uid}-flank`} value={Math.max(lateral, whiteFactor * 0.72)} view={selectedView} region="lateral" />
        <mask id={`${uid}-pin`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="667">
          {pinMaskPaths.flatMap((d,row) => pinSegments(Math.max(pin, whiteFactor * 0.85),row).map((s,i) => <path key={`${row}-${i}`} d={d} fill="none" stroke="white" strokeLinecap="round" strokeWidth={18 + Math.max(pin, whiteFactor * 0.85) * 6} strokeOpacity={Math.min(1, Math.max(pin, whiteFactor * 0.85) * 5)} pathLength="100" strokeDasharray={`${s.length} ${100-s.length}`} strokeDashoffset={-s.start} />))}
        </mask>
        <mask id={`${uid}-spots`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="667">
          {spotRegions.map(({ order, x, y, width, height }, idx) => {
            const start = (idx / Math.max(1, spotRegions.length)) * 0.88;
            const local = smoothstep((spots - start) / 0.12);
            if (local <= 0) return null;
            const scale = 0.45 + 0.55 * local;
            return (
              <ellipse
                key={order}
                cx={x + width / 2}
                cy={y + height / 2}
                rx={(width / 2 + 1.5) * scale}
                ry={(height / 2 + 1.5) * scale}
                fill="white"
                fillOpacity={local}
              />
            );
          })}
        </mask>
      </defs>
      {image('base',{ 'data-layer':'base', filter: toneFilter })}
      {emptyBack > 0 && <g data-layer="emptyBack" />}
      {(dorsal > 0 || whiteFactor > 0) && <g clipPath={`url(#${uid}-dorsal-region)`} filter={patternFilter}>{image('cream',{ mask:`url(#${uid}-dorsal)`, 'data-layer':'dorsal' })}</g>}
      {(lateral > 0 || whiteFactor > 0) && <g clipPath={`url(#${uid}-flank-region)`} filter={patternFilter}>{image('cream',{ mask:`url(#${uid}-flank)`, 'data-layer':'lateral' })}</g>}
      {whitewall > 0 && (
        <g clipPath={`url(#${uid}-flank-region)`} data-layer="whitewall" filter={`url(#${uid}-soft)`} opacity={Math.min(0.92, 0.35 + whitewall * 0.58)}>
          {selectedView === 'top' ? (
            <>
              <path d="M290 225 Q470 198 635 245" fill="none" stroke="#f7f2e4" strokeLinecap="round" strokeWidth={10 + whitewall * 28} />
              <path d="M290 392 Q470 420 635 372" fill="none" stroke="#f7f2e4" strokeLinecap="round" strokeWidth={10 + whitewall * 28} />
            </>
          ) : (
            <path
              d="M315 352 Q425 326 535 286 Q605 262 652 248"
              fill="none"
              stroke="#f8f4e8"
              strokeLinecap="round"
              strokeWidth={12 + whitewall * 38}
            />
          )}
        </g>
      )}
      {tiger > 0 && image('tiger',{ opacity: Math.pow(tiger, 0.85), 'data-layer':'tiger', filter: toneFilter })}
      {spots > 0 && image('spots',{ mask:`url(#${uid}-spots)`, 'data-layer':'spots' })}
      {(pin > 0 || whiteFactor > 0) && <g filter={patternFilter}>{image('pin',{ mask:`url(#${uid}-pin)`, 'data-layer':'pinstripe' })}</g>}
      {pied > 0 && (
        <g data-layer="pied" opacity={Math.min(0.95, 0.45 + pied * 0.5)}>
          {selectedView === 'top' ? (
            <>
              <ellipse cx="485" cy="312" rx={38 + pied * 58} ry={42 + pied * 48} fill="#faf7f0" stroke="#e8cfc6" strokeWidth="3" filter={`url(#${uid}-soft)`} />
              {pied > 0.25 && <circle cx="315" cy="145" r={16 + pied * 18} fill="#faf6ee" stroke="#ead2c9" strokeWidth="2.5" filter={`url(#${uid}-soft)`} />}
              {pied > 0.25 && <circle cx="635" cy="485" r={18 + pied * 20} fill="#faf6ee" stroke="#ead2c9" strokeWidth="2.5" filter={`url(#${uid}-soft)`} />}
            </>
          ) : (
            <>
              <path
                d={`M${510 - pied * 45} 215 Q${560 + pied * 35} 195 ${615 + pied * 25} 218 L${620 + pied * 20} 325 Q${555} 348 ${495 - pied * 35} 320 Z`}
                fill="#faf7f0"
                stroke="#e8cfc6"
                strokeWidth="3"
                filter={`url(#${uid}-soft)`}
              />
              {pied > 0.2 && <ellipse cx="290" cy="495" rx={18 + pied * 20} ry={14 + pied * 14} fill="#faf6ee" stroke="#ead2c9" strokeWidth="2.5" filter={`url(#${uid}-soft)`} />}
              {pied > 0.2 && <ellipse cx="645" cy="435" rx={20 + pied * 22} ry={15 + pied * 14} fill="#faf6ee" stroke="#ead2c9" strokeWidth="2.5" filter={`url(#${uid}-soft)`} />}
            </>
          )}
        </g>
      )}
      {annotate && <RegionAnnotation view={selectedView} focus={focus} />}
    </svg>}
    {error && !decorative && <p role="status" className="absolute inset-x-2 bottom-2 rounded bg-white/95 p-2 text-xs text-amber-950">Pattern artwork could not load. Use the specimen photographs for this study.</p>}
  </div>;
}
