import { useEffect, useId, useState } from 'react';

export const INK_ROOT = '/morph-guide/ink-studies-v2';
export const traitAsset = (view, trait = 'base') => `${INK_ROOT}/${view}-${trait}.webp`;
export const clampTrait = v => Math.max(0, Math.min(1, Number(v) || 0));

// These masks are registered to the actual raster drawings, not generic body shapes.
// Pinning is clipped to the crest rows: changing it cannot affect any other pixels.
export const CREST_PATHS = {
  side: ['M220 193 Q265 201 299 208 Q337 216 379 204 Q441 186 501 204 Q554 216 590 238 Q619 253 652 262'],
  top: ['M260 261 Q305 277 345 261 Q401 236 455 244 Q528 250 587 267 Q636 281 687 291', 'M260 351 Q298 341 342 359 Q399 388 453 375 Q525 366 584 351 Q638 337 686 330'],
};


const extractedLayers = new Map();
// Keep only newly dark pigment. A full edited plate would cover cream with its
// brown base; extracting the pigment lets spots coexist with cream and pinning.
function pigmentLayer(view, trait) {
  const key = view + trait;
  if (!extractedLayers.has(key)) extractedLayers.set(key, new Promise((resolve, reject) => {
    const base = new Image(); const edited = new Image();
    let loaded = 0;
    const ready = () => {
      if (++loaded < 2) return;
      const canvas = document.createElement('canvas'); canvas.width = base.naturalWidth; canvas.height = base.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(base, 0, 0); const original = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(edited, 0, 0, canvas.width, canvas.height);
      const layer = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < layer.data.length; i += 4) {
        const before = (original.data[i] + original.data[i+1] + original.data[i+2]) / 3;
        const after = (layer.data[i] + layer.data[i+1] + layer.data[i+2]) / 3;
        const delta = before - after;
        layer.data[i+3] = after < (trait === 'spots' ? 95 : 125) && delta > 25 ? Math.min(255, (delta - 25) * 6) : 0;
      }
      if (trait === 'spots') {
        const count = canvas.width * canvas.height; const seen = new Uint8Array(count); const components = [];
        for (let pixel = 0; pixel < count; pixel++) {
          if (seen[pixel] || layer.data[pixel*4+3] < 128) continue;
          const region = [pixel]; seen[pixel] = 1;
          for (let cursor = 0; cursor < region.length; cursor++) {
            const at = region[cursor];
            for (const next of [at-1, at+1, at-canvas.width, at+canvas.width]) {
              if (next >= 0 && next < count && !seen[next] && layer.data[next*4+3] >= 128 && (Math.abs(next-at) !== 1 || Math.floor(next/canvas.width) === Math.floor(at/canvas.width))) { seen[next] = 1; region.push(next); }
            }
          }
          if (region.length > 35) components.push(region);
          else region.forEach(at => { layer.data[at*4+3] = 0; });
        }
        components.sort((a,b) => ((a[0]*2654435761)>>>0) - ((b[0]*2654435761)>>>0));
        ctx.putImageData(layer, 0, 0);
        resolve({ src: canvas.toDataURL('image/png'), regions: components.map(region => { const xs = region.map(p => p % canvas.width), ys = region.map(p => Math.floor(p / canvas.width)); const x = Math.min(...xs), y = Math.min(...ys); return { x: x / canvas.width * 1000, y: y / canvas.height * 667, width: (Math.max(...xs) - x + 2) / canvas.width * 1000, height: (Math.max(...ys) - y + 2) / canvas.height * 667 }; }) });
      } else { ctx.putImageData(layer, 0, 0); resolve(canvas.toDataURL('image/png')); }
    };
    base.onload = ready; edited.onload = ready; base.onerror = reject; edited.onerror = reject;
    base.src = traitAsset(view); edited.src = traitAsset(view, trait);
  }));
  return extractedLayers.get(key);
}
function usePigments(view) {
  const [layers, setLayers] = useState({});
  useEffect(() => {
    let active = true;
    Promise.all(['tiger', 'spots'].map(trait => pigmentLayer(view, trait).then(src => [trait, src])))
      .then(entries => {
        if (!active) return;
        const result = Object.fromEntries(entries); setLayers({ ...result, view });
      }).catch(() => {});
    return () => { active = false; };
  }, [view]);
  return layers.view === view ? layers : {};
}

export default function TraitGecko({ view = 'side', traits = {}, className = '', title = 'Crested gecko pattern study', decorative = false }) {
  const uid = useId().replace(/:/g, '');
  const selectedView = view === 'top' ? 'top' : 'side';
  const pigments = usePigments(selectedView);
  const dorsal = clampTrait(traits.dorsal);
  const lateral = clampTrait(traits.lateral);
  const pin = clampTrait(traits.pinstripe);
  const tiger = clampTrait(traits.tiger);
  const spots = clampTrait(traits.spots);
  const image = (trait, extra = {}) => <image href={(trait === 'spots' ? pigments.spots?.src : pigments[trait]) || traitAsset(selectedView, trait)} width="1000" height="667" {...extra} />;
  const dorsalShape = selectedView === 'side'
    ? 'M120 150 L275 185 L360 195 L470 175 L570 203 L660 263 L644 293 L553 252 L453 246 L344 262 L263 245 L180 220 Z'
    : 'M110 298 L270 277 Q470 244 677 299 L677 323 Q470 367 270 335 L110 328 Z';
  // Flank coverage rises from the lower lateral region. The top view primarily
  // shows the dorsal field and pinning; flanks remain visible at the outer edges.
  const flankShape = selectedView === 'side'
    ? `M200 ${375 - lateral * 115} Q280 ${364 - lateral * 115} 350 ${380 - lateral * 115} T490 ${370 - lateral * 115} T600 ${378 - lateral * 115} L685 ${375 - lateral * 115} L685 490 L160 490 Z`
    : 'M175 80 L735 80 L735 255 L275 272 L175 260 Z M175 365 L280 351 L735 345 L735 550 L175 550 Z';
  return <div className={`relative overflow-hidden ${className}`} style={{ aspectRatio: '3/2', background: '#f4efdf' }} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : title} aria-hidden={decorative || undefined} data-trait-view={selectedView}>
    <svg viewBox="0 0 1000 667" className="w-full h-full" aria-hidden="true">
      <defs>
        <clipPath id={`${uid}-dorsal`}><path d={dorsalShape} /></clipPath>
        <clipPath id={`${uid}-flank`}><path d={flankShape} /></clipPath>
        <mask id={`${uid}-pin`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="667">
          {CREST_PATHS[selectedView].map((d, i) => <path key={d} d={d} fill="none" stroke="white" strokeWidth="17" strokeLinecap="round" pathLength="100" strokeDasharray={pin >= 1 ? undefined : `${pin * 9} ${9 - pin * 9}`} strokeDashoffset={i * 2} />)}
        </mask>
        <mask id={`${uid}-spots`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="667">
          {pigments.spots?.regions.slice(0, Math.round(pigments.spots.regions.length * spots)).map((r, i) => <rect key={i} {...r} fill="white" />)}
        </mask>
      </defs>
      {image('base', { 'data-layer': 'base' })}
      {tiger > 0 && pigments.tiger && image('tiger', { opacity: tiger, 'data-layer': 'tiger' })}
      {dorsal > 0 && image('cream', { opacity: dorsal, clipPath: `url(#${uid}-dorsal)`, 'data-layer': 'dorsal' })}
      {lateral > 0 && image('cream', { opacity: selectedView === 'top' ? lateral : 1, clipPath: `url(#${uid}-flank)`, 'data-layer': 'lateral' })}
      {spots > 0 && pigments.spots && image('spots', { opacity: 1, mask: `url(#${uid}-spots)`, 'data-layer': 'spots' })}
      {pin > 0 && image('pin', { mask: `url(#${uid}-pin)`, 'data-layer': 'pinstripe' })}
    </svg>
  </div>;
}
