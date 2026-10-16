import { useEffect, useId, useState } from 'react';
import { pinSegments } from './traitStudyMath';

export const INK_ROOT = '/morph-guide/ink-studies-v3';
export const traitAsset = (view, trait = 'base') => `${INK_ROOT}/${view}-${trait}.webp`;
export const clampTrait = v => Math.max(0, Math.min(1, Number(v) || 0));

// Registered to crest scales. Pinning cannot recolor the broad dorsal field.
export const CREST_PATHS = {
  side: ['M220 193 Q265 201 299 208 Q337 216 379 204 Q441 186 501 204 Q554 216 590 238 Q619 253 652 262'],
  top: ['M260 261 Q305 277 345 261 Q401 236 455 244 Q528 250 587 267 Q636 281 687 291', 'M260 351 Q298 341 342 359 Q399 388 453 375 Q525 366 584 351 Q638 337 686 330'],
};
export const REGIONS = {
  side: {
    dorsal: 'M80 173 Q172 140 269 204 Q335 221 398 204 Q474 183 561 220 L658 266 L642 288 Q554 242 451 246 Q342 268 263 245 L180 220 L83 213 Z',
    lateral: 'M177 272 Q267 247 354 268 Q471 240 645 289 L676 491 L158 491 Z',
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
    dorsal: 'M65 120 L995 120 L995 555 L665 555 L645 288 Q554 242 451 246 Q342 265 263 245 L180 220 L65 213 Z',
    lateral: 'M65 213 L180 220 L263 245 Q342 265 451 246 Q554 242 645 288 L665 555 L65 555 Z',
  },
  top: {
    dorsal: 'M55 294 Q143 219 258 274 Q469 235 685 288 L760 260 L995 260 L995 560 L760 560 L685 335 Q472 385 258 342 Q145 386 55 335 Z',
    lateral: 'M140 70 L760 70 L760 260 L685 288 Q469 235 258 274 L140 255 Z M140 360 L258 342 Q472 385 685 335 L760 560 L140 560 Z',
  },
};

export const BASE_TONES = {
  buckskin: { label: 'Buckskin', matrix: null },
  mahogany: { label: 'Dark Mahogany', matrix: [0.76, 0.04, 0, 0, -0.04, 0.02, 0.66, 0, 0, -0.04, 0, 0.02, 0.58, 0, -0.03, 0, 0, 0, 1, 0] },
  red: { label: 'Red Base', matrix: [1.06, 0.06, 0, 0, 0.02, 0.02, 0.68, 0, 0, -0.03, 0, 0, 0.56, 0, -0.04, 0, 0, 0, 1, 0] },
  yellow: { label: 'Golden Yellow', matrix: [1.06, 0.05, 0, 0, 0.02, 0.04, 1.02, 0, 0, 0.01, 0, 0, 0.72, 0, -0.03, 0, 0, 0, 1, 0] },
  axanthic: { label: 'Axanthic Gray', matrix: [0.42, 0.44, 0.14, 0, -0.02, 0.40, 0.45, 0.15, 0, -0.02, 0.38, 0.44, 0.18, 0, -0.01, 0, 0, 0, 1, 0] },
};

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

const extractedLayers = new Map();
function loadDrawing(src) {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Drawing unavailable')); image.src = src;
  });
}
// Extract added pigment so redraw drift never replaces the base animal.
async function extractPigment(view, trait) {
  const [base, edited] = await Promise.all([loadDrawing(traitAsset(view)), loadDrawing(traitAsset(view, trait))]);
  const canvas = document.createElement('canvas'); canvas.width = base.naturalWidth; canvas.height = base.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(base, 0, 0); const original = ctx.getImageData(0, 0, canvas.width, canvas.height);
  ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(edited, 0, 0, canvas.width, canvas.height);
  const layer = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const light = trait === 'cream' || trait === 'pin';
  for (let i = 0; i < layer.data.length; i += 4) {
    const before = (original.data[i] + original.data[i+1] + original.data[i+2]) / 3;
    const after = (layer.data[i] + layer.data[i+1] + layer.data[i+2]) / 3;
    const delta = light ? after - before : before - after;
    const pigment = light ? after > 150 && before < 215 : after < (trait === 'spots' ? 92 : 125);
    layer.data[i+3] = pigment && delta > 28 ? Math.min(255, (delta - 28) * 8) : 0;
  }
  const regions = [];
  if (trait === 'spots') {
    const count = canvas.width * canvas.height; const seen = new Uint8Array(count);
    for (let pixel = 0; pixel < count; pixel++) {
      if (seen[pixel] || layer.data[pixel*4+3] < 128) continue;
      const region = [pixel]; seen[pixel] = 1;
      let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
      for (let cursor = 0; cursor < region.length; cursor++) {
        const at = region[cursor], x = at % canvas.width, y = Math.floor(at / canvas.width);
        minX = Math.min(minX,x); maxX = Math.max(maxX,x); minY = Math.min(minY,y); maxY = Math.max(maxY,y);
        for (const next of [at-1, at+1, at-canvas.width, at+canvas.width]) {
          if (next >= 0 && next < count && !seen[next] && layer.data[next*4+3] >= 128 && (Math.abs(next-at) !== 1 || Math.floor(next/canvas.width) === y)) { seen[next] = 1; region.push(next); }
        }
      }
      if (region.length < 40) region.forEach(at => { layer.data[at*4+3] = 0; });
      else regions.push({ x: minX/canvas.width*1000, y: minY/canvas.height*667, width: (maxX-minX+2)/canvas.width*1000, height: (maxY-minY+2)/canvas.height*667, order: (pixel*2654435761)>>>0 });
    }
    regions.sort((a,b) => a.order-b.order);
  }
  ctx.putImageData(layer, 0, 0);
  return { src: canvas.toDataURL('image/png'), regions };
}
function pigmentsFor(view) {
  if (!extractedLayers.has(view)) extractedLayers.set(view, Promise.all(['cream','pin','tiger','spots'].map(async trait => [trait, await extractPigment(view,trait)]))
    .then(entries => ({ ...Object.fromEntries(entries), view })));
  return extractedLayers.get(view);
}
export function usePigments(view) {
  const [layers, setLayers] = useState({});
  useEffect(() => {
    let active = true;
    pigmentsFor(view).then(result => { if (active) setLayers(result); })
      .catch(() => { if (active) setLayers({ view, error: true }); extractedLayers.delete(view); });
    return () => { active = false; };
  }, [view]);
  return layers.view === view ? layers : {};
}

// Smoothly reveals pre-painted watercolor islands with organic feathered lobes
// so scrubbing from 0.00 to 1.00 never shows vertical bars or sudden jumps.
function CoverageMask({ id, value, region, view }) {
  const lateral = region === 'lateral';
  const v = clampTrait(value);
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
              const x = 115 + u * 625;
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
              const topY = 485 - p * (275 + wave * 34);
              const rx = 20 + p * 30;
              const ry = Math.max(16, (525 - topY) * 0.62);
              return (
                <ellipse
                  key={i}
                  cx={x}
                  cy={(topY + 515) * 0.5}
                  rx={rx}
                  ry={ry}
                  fillOpacity={alpha}
                />
              );
            }
            // Dorsal coverage: nucleates across the dorsal saddle first, then
            // expands smoothly to the head crown and down the tail.
            const x = 75 + u * 900;
            const distFromSaddle = Math.abs(u - 0.38);
            const startAt = Math.max(0, Math.min(0.48, distFromSaddle * 0.42 + wave * 0.08));
            const p = smoothstep((v - startAt * (1 - v)) / Math.max(0.18, 1 - startAt * 0.65));
            if (p <= 0) return null;
            const alpha = smoothstep(Math.min(1, p * 2.2));
            const cy = view === 'top'
              ? (x < 685 ? 308 + wave * 12 : 315 + (x - 685) * 0.42)
              : (x < 645 ? 212 + (x - 320) * 0.11 + wave * 10 : 275 + (x - 645) * 0.52);
            const rx = 22 + p * 42;
            const ry = 14 + p * (x > 650 ? 135 : view === 'top' ? 88 : 68);
            return <ellipse key={i} cx={x} cy={cy} rx={rx} ry={ry} fillOpacity={alpha} />;
          })}
        </g>
      )}
    </mask>
  );
}

export function RegionAnnotation({ view, focus }) {
  const pinning = focus === 'pinstripe', dorsal = focus === 'dorsal' || focus === 'tiger';
  const label = pinning ? 'Paired crest rows' : dorsal ? 'Dorsal field' : focus === 'spots' ? 'Discrete pigment spots' : 'Flanks and limbs';
  return <g fill="none" stroke="#21544a" strokeWidth="2.5" opacity=".9">
    {pinning ? CREST_PATHS[view].map(d => <path key={d} d={d} strokeWidth="22" opacity=".22" />) : <path d={REGIONS[view][dorsal ? 'dorsal' : 'lateral']} strokeDasharray="5 5" />}
    <path d={view === 'top' ? (pinning || dorsal ? 'M500 87 L500 170 L450 242' : 'M500 87 L610 125 L628 200') : (pinning || dorsal ? 'M500 90 L500 145 L455 193' : 'M500 90 L645 142 L480 308')} />
    <rect x="363" y="43" width="274" height="43" rx="8" fill="#f4efdf" strokeWidth="1" />
    <text x="500" y="71" textAnchor="middle" fontFamily="Georgia, serif" fontSize="20" fill="#21544a" stroke="none">{label}</text>
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
  const dorsal = clampTrait(traits.dorsal), lateral = clampTrait(traits.lateral), pin = clampTrait(traits.pinstripe), tiger = clampTrait(traits.tiger), spots = clampTrait(traits.spots);
  const toneMatrix = buildToneMatrix(tone, fired);
  const toneFilter = toneMatrix ? `url(#${uid}-tone)` : undefined;
  const image = (trait, extra = {}) => <image href={pigments[trait]?.src || traitAsset(selectedView,trait)} width="1000" height="667" {...extra} />;
  const spotRegions = pigments.spots?.regions || [];
  return <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio: '3/2', background: '#f4efdf' }} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : title} aria-hidden={decorative || undefined} data-trait-view={selectedView} data-ready={!!pigments.cream} aria-busy={!pigments.cream && !pigments.error}>
    <svg viewBox="0 0 1000 667" className="w-full h-full" aria-hidden="true">
      <defs>
        {toneMatrix && (
          <filter id={`${uid}-tone`} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={toneMatrix} />
          </filter>
        )}
        <clipPath id={`${uid}-dorsal-region`}><path d={CLIP_REGIONS[selectedView].dorsal} /></clipPath>
        <clipPath id={`${uid}-flank-region`}><path d={CLIP_REGIONS[selectedView].lateral} /></clipPath>
        <CoverageMask id={`${uid}-dorsal`} value={dorsal} view={selectedView} region="dorsal" />
        <CoverageMask id={`${uid}-flank`} value={lateral} view={selectedView} region="lateral" />
        <mask id={`${uid}-pin`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="667">
          {CREST_PATHS[selectedView].flatMap((d,row) => pinSegments(pin,row).map((s,i) => <path key={`${row}-${i}`} d={d} fill="none" stroke="white" strokeLinecap="round" strokeWidth={15 + pin * 3} strokeOpacity={Math.min(1, pin * 5)} pathLength="100" strokeDasharray={`${s.length} ${100-s.length}`} strokeDashoffset={-s.start} />))}
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
      {dorsal > 0 && pigments.cream && <g clipPath={`url(#${uid}-dorsal-region)`}>{image('cream',{ mask:`url(#${uid}-dorsal)`, 'data-layer':'dorsal' })}</g>}
      {lateral > 0 && pigments.cream && <g clipPath={`url(#${uid}-flank-region)`}>{image('cream',{ mask:`url(#${uid}-flank)`, 'data-layer':'lateral' })}</g>}
      {tiger > 0 && pigments.tiger && image('tiger',{ opacity: Math.pow(tiger, 0.85), 'data-layer':'tiger', filter: toneFilter })}
      {spots > 0 && pigments.spots && image('spots',{ mask:`url(#${uid}-spots)`, 'data-layer':'spots' })}
      {pin > 0 && pigments.pin && image('pin',{ mask:`url(#${uid}-pin)`, 'data-layer':'pinstripe' })}
      {annotate && <RegionAnnotation view={selectedView} focus={focus} />}
    </svg>
    {pigments.error && !decorative && <p role="status" className="absolute inset-x-2 bottom-2 rounded bg-white/95 p-2 text-xs text-amber-950">Pattern artwork could not load. Use the specimen photographs for this study.</p>}
  </div>;
}

