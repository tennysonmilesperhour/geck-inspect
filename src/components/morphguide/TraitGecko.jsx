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
// The Morph Guide index draws about ten studies, most of them below the
// fold on a phone. Each one fetches its pictures only when it comes within
// 200 px of view (a full screen ahead fetched a second study, 116 KB, that
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
// Reveal painted islands at full pigment strength instead of fading a wash.
function CoverageMask({ id, value, region, view }) {
  const lateral = region === 'lateral';
  return <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="667">
    {value >= 1 ? <rect width="1000" height="667" fill="white" /> : <g fill="white">
      {Array.from({ length: 44 }, (_,i) => {
        const x = i*24, offset = Math.sin(i*1.8)*22 + Math.sin(i*.43)*30;
        const y = 430-value*260+offset;
        return lateral
          ? view === 'top'
            ? <g key={i}><ellipse cx={x} cy="150" rx={11+value*16} ry={Math.max(0,value*150+offset/3)} /><ellipse cx={x+8} cy="440" rx={12+value*14} ry={Math.max(0,value*130-offset/3)} /></g>
            : <path key={i} d={`M${x-8} 510 L${x-8} ${y+40} Q${x} ${y-25} ${x+14} ${y} L${x+37} 510 Z`} />
          : <ellipse key={i} cx={x} cy={view === 'top' ? 307 : 212} rx={value*20} ry={value*(view === 'top' ? 62 : 47)+1+Math.abs(offset)*value/4} />;
      })}
    </g>}
  </mask>;
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
export default function TraitGecko({ view = 'side', traits = {}, className = '', title = 'Crested gecko pattern study', decorative = false, focus = 'dorsal', annotate = false }) {
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
  const dorsal = clampTrait(traits.dorsal), lateral = clampTrait(traits.lateral), pin = clampTrait(traits.pinstripe), tiger = clampTrait(traits.tiger), spots = clampTrait(traits.spots);
  const image = (trait, extra = {}) => <image href={traitAsset(selectedView,trait)} width="1000" height="667" {...extra} />;
  return <div ref={frameRef} className={`relative overflow-hidden ${className}`} style={{ aspectRatio: '3/2', background: '#f4efdf' }} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : title} aria-hidden={decorative || undefined} data-trait-view={selectedView} data-ready={near}>
    {near && <svg viewBox="0 0 1000 667" className="w-full h-full" aria-hidden="true">
      <defs>
        <clipPath id={`${uid}-dorsal-region`}><path d={REGIONS[selectedView].dorsal} /></clipPath>
        <clipPath id={`${uid}-flank-region`}><path d={REGIONS[selectedView].lateral} /></clipPath>
        <CoverageMask id={`${uid}-dorsal`} value={dorsal} view={selectedView} region="dorsal" />
        <CoverageMask id={`${uid}-flank`} value={lateral} view={selectedView} region="lateral" />
        <mask id={`${uid}-pin`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="667">
          {CREST_PATHS[selectedView].flatMap((d,row) => pinSegments(pin,row).map((s,i) => <path key={`${row}-${i}`} d={d} fill="none" stroke="white" strokeWidth="16" pathLength="100" strokeDasharray={`${s.length} ${100-s.length}`} strokeDashoffset={-s.start} />))}
        </mask>
        <mask id={`${uid}-spots`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="667">
          {pigments.spots.regions.slice(0,Math.round(pigments.spots.regions.length*spots)).map(({ order,...r }) => <rect key={order} {...r} fill="white" />)}
        </mask>
      </defs>
      {image('base',{ 'data-layer':'base' })}
      {dorsal > 0 && <g clipPath={`url(#${uid}-dorsal-region)`}>{image('cream',{ mask:`url(#${uid}-dorsal)`, 'data-layer':'dorsal' })}</g>}
      {lateral > 0 && <g clipPath={`url(#${uid}-flank-region)`}>{image('cream',{ mask:`url(#${uid}-flank)`, 'data-layer':'lateral' })}</g>}
      {tiger > 0 && image('tiger',{ opacity:tiger, 'data-layer':'tiger' })}
      {spots > 0 && image('spots',{ mask:`url(#${uid}-spots)`, 'data-layer':'spots' })}
      {pin > 0 && image('pin',{ mask:`url(#${uid}-pin)`, 'data-layer':'pinstripe' })}
      {annotate && <RegionAnnotation view={selectedView} focus={focus} />}
    </svg>}
    {error && !decorative && <p role="status" className="absolute inset-x-2 bottom-2 rounded bg-white/95 p-2 text-xs text-amber-950">Pattern artwork could not load. Use the specimen photographs for this study.</p>}
  </div>;
}
