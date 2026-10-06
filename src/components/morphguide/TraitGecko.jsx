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
const REGIONS = {
  side: {
    dorsal: 'M80 173 Q172 140 269 204 Q335 221 398 204 Q474 183 561 220 L658 266 L642 288 Q554 242 451 246 Q342 268 263 245 L180 220 L83 213 Z',
    lateral: 'M177 272 Q267 247 354 268 Q471 240 645 289 L676 491 L158 491 Z',
  },
  top: {
    dorsal: 'M65 294 Q143 219 258 277 Q469 241 680 297 L680 329 Q472 379 258 335 Q145 386 65 335 Z',
    lateral: 'M165 80 L746 80 L746 277 Q478 221 265 274 L165 260 Z M165 365 L267 346 Q478 395 746 343 L746 550 L165 550 Z',
  },
};
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
function usePigments(view) {
  const [layers, setLayers] = useState({});
  useEffect(() => {
    let active = true;
    pigmentsFor(view).then(result => { if (active) setLayers(result); })
      .catch(() => { if (active) setLayers({ view, error: true }); extractedLayers.delete(view); });
    return () => { active = false; };
  }, [view]);
  return layers.view === view ? layers : {};
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
function RegionAnnotation({ view, focus }) {
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
  const dorsal = clampTrait(traits.dorsal), lateral = clampTrait(traits.lateral), pin = clampTrait(traits.pinstripe), tiger = clampTrait(traits.tiger), spots = clampTrait(traits.spots);
  const image = (trait, extra = {}) => <image href={pigments[trait]?.src || traitAsset(selectedView,trait)} width="1000" height="667" {...extra} />;
  return <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio: '3/2', background: '#f4efdf' }} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : title} aria-hidden={decorative || undefined} data-trait-view={selectedView} data-ready={!!pigments.cream} aria-busy={!pigments.cream && !pigments.error}>
    <svg viewBox="0 0 1000 667" className="w-full h-full" aria-hidden="true">
      <defs>
        <clipPath id={`${uid}-dorsal-region`}><path d={REGIONS[selectedView].dorsal} /></clipPath>
        <clipPath id={`${uid}-flank-region`}><path d={REGIONS[selectedView].lateral} /></clipPath>
        <CoverageMask id={`${uid}-dorsal`} value={dorsal} view={selectedView} region="dorsal" />
        <CoverageMask id={`${uid}-flank`} value={lateral} view={selectedView} region="lateral" />
        <mask id={`${uid}-pin`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="667">
          {CREST_PATHS[selectedView].flatMap((d,row) => pinSegments(pin,row).map((s,i) => <path key={`${row}-${i}`} d={d} fill="none" stroke="white" strokeWidth="16" pathLength="100" strokeDasharray={`${s.length} ${100-s.length}`} strokeDashoffset={-s.start} />))}
        </mask>
        <mask id={`${uid}-spots`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="667">
          {pigments.spots?.regions.slice(0,Math.round(pigments.spots.regions.length*spots)).map(({ order,...r }) => <rect key={order} {...r} fill="white" />)}
        </mask>
      </defs>
      {image('base',{ 'data-layer':'base' })}
      {dorsal > 0 && pigments.cream && <g clipPath={`url(#${uid}-dorsal-region)`}>{image('cream',{ mask:`url(#${uid}-dorsal)`, 'data-layer':'dorsal' })}</g>}
      {lateral > 0 && pigments.cream && <g clipPath={`url(#${uid}-flank-region)`}>{image('cream',{ mask:`url(#${uid}-flank)`, 'data-layer':'lateral' })}</g>}
      {tiger > 0 && pigments.tiger && image('tiger',{ opacity:tiger, 'data-layer':'tiger' })}
      {spots > 0 && pigments.spots && image('spots',{ mask:`url(#${uid}-spots)`, 'data-layer':'spots' })}
      {pin > 0 && pigments.pin && image('pin',{ mask:`url(#${uid}-pin)`, 'data-layer':'pinstripe' })}
      {annotate && <RegionAnnotation view={selectedView} focus={focus} />}
    </svg>
    {pigments.error && !decorative && <p role="status" className="absolute inset-x-2 bottom-2 rounded bg-white/95 p-2 text-xs text-amber-950">Pattern artwork could not load. Use the specimen photographs for this study.</p>}
  </div>;
}
