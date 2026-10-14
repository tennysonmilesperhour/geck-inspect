import { useEffect, useId, useState } from 'react';
import { CREST_PATHS, REGIONS, RegionAnnotation, traitAsset, usePigments } from '@/components/morphguide/TraitGecko';
import { isolatePigment, orderedIslands, pigmentIslands, selectedIslands, studyPinSegments, normalizeStages } from './patternIslands';

const stageCache = new Map();
const WIDTH = 1000, HEIGHT = 667;
function imageFrom(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Pattern layer unavailable'));
    img.src = src;
  });
}
async function stagesFor(src, view, region) {
  const image = await imageFrom(src);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH; canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.save();
  if (region !== 'spots') ctx.clip(new Path2D(REGIONS[view][region]));
  ctx.drawImage(image, 0, 0, WIDTH, HEIGHT);
  ctx.restore();
  const original = ctx.getImageData(0, 0, WIDTH, HEIGHT);
  const { labels, groups } = pigmentIslands(original.data, WIDTH, HEIGHT);
  const ordered = orderedIslands(groups, region, view);
  return [null, ...[1, 2, 3, 4].map(stage => {
    const pixels = isolatePigment(original.data, labels, selectedIslands(ordered, stage));
    ctx.putImageData(new ImageData(pixels, WIDTH, HEIGHT), 0, 0);
    return canvas.toDataURL('image/png');
  })];
}
function useStudyStages(pigments, view) {
  const [layers, setLayers] = useState({});
  useEffect(() => {
    if (!pigments.cream) return;
    let active = true;
    if (!stageCache.has(view)) stageCache.set(view, Promise.all([
      stagesFor(pigments.cream.src, view, 'dorsal'),
      stagesFor(pigments.cream.src, view, 'lateral'),
      stagesFor(pigments.spots.src, view, 'spots'),
    ]).then(([dorsal, lateral, spots]) => ({ view, dorsal, lateral, spots })));
    stageCache.get(view).then(result => { if (active) setLayers(result); }).catch(() => {
      stageCache.delete(view);
      if (active) setLayers({ view, error: true });
    });
    return () => { active = false; };
  }, [pigments, view]);
  return layers.view === view ? layers : {};
}

export default function PatternDrawing({ stages = {}, view = 'side', focus = 'lateral', annotate = false, className = '' }) {
  const selectedView = view === 'top' ? 'top' : 'side';
  const values = normalizeStages(stages);
  const pigments = usePigments(selectedView);
  const layers = useStudyStages(pigments, selectedView);
  const uid = useId().replaceAll(':', '');
  const error = pigments.error || layers.error;
  const ready = !!layers.dorsal;
  return <div className={`relative overflow-hidden bg-[#f4efdf] ${className}`} data-study-drawing={selectedView} data-ready={ready} role="img" aria-label={`Illustrated crested gecko, ${selectedView} view. Separate pattern features, not an identified specimen.`} aria-busy={!ready && !error}>
    <svg viewBox="0 0 1000 667" className="block w-full h-auto" aria-hidden="true">
      <defs><mask id={`${uid}-crest`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="667">
        {CREST_PATHS[selectedView].flatMap((d, row) => studyPinSegments(values.pinstripe, row).map((s, i) => <path key={`${row}-${i}`} d={d} fill="none" stroke="white" strokeWidth="16" pathLength="100" strokeDasharray={`${s.length} ${100 - s.length}`} strokeDashoffset={-s.start} />))}
      </mask></defs>
      <image data-layer="base" href={traitAsset(selectedView)} width="1000" height="667" />
      {ready && ['dorsal', 'lateral'].map(region => values[region] > 0 && <image key={region} data-layer={region} href={layers[region][values[region]]} width="1000" height="667" />)}
      {ready && values.tiger > 0 && <image data-layer="banding" href={pigments.tiger.src} width="1000" height="667" />}
      {ready && values.spots > 0 && <image data-layer="spots" href={layers.spots[values.spots]} width="1000" height="667" />}
      {ready && values.pinstripe > 0 && <image data-layer="pinstripe" href={pigments.pin.src} mask={`url(#${uid}-crest)`} width="1000" height="667" />}
      {annotate && <RegionAnnotation view={selectedView} focus={focus} />}
    </svg>
    {!ready && <p role="status" className="absolute bottom-2 inset-x-3 rounded bg-white/90 p-2 text-center text-xs text-stone-700">{error ? 'Drawing unavailable. The real specimen photographs remain available.' : 'Preparing the pattern study…'}</p>}
  </div>;
}
