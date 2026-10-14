import { useEffect, useId, useRef, useState } from 'react';

function EnlargedPhoto({ specimen, blind, onClose }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} onClose={onClose} aria-label="Enlarged specimen photograph" className="m-auto max-w-[96vw] max-h-[96vh] rounded-2xl border border-stone-300 bg-[#f5f0e5] p-3 text-stone-900 backdrop:bg-black/80">
    <div className="mb-3 flex items-center justify-between gap-6"><span className="text-sm font-semibold">{blind ? 'Observation photograph' : specimen.name}</span><button type="button" autoFocus onClick={() => dialog.current?.close()} className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white">Close photograph</button></div>
    <img src={specimen.src} alt={blind ? 'Enlarged crested gecko for the visual observation question.' : specimen.description} className="max-h-[80vh] max-w-full h-auto w-auto mx-auto" />
  </dialog>;
}

export default function SpecimenFigure({ specimen, focus = 'lateral', annotated = true, blind = false, label, onLoadState, compact = false }) {
  const [point, setPoint] = useState(0);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(false);
  const zoomButton = useRef(null);
  const uid = useId();
  const points = specimen.features[focus] || [];
  const current = points[point] || points[0];
  return <figure className="min-w-0 overflow-hidden rounded-2xl border border-[#d9d5c8] bg-[#fffdf6] text-[#28392d]" data-study-specimen={specimen.id}>
    <div className="flex items-center justify-between gap-3 border-b border-[#e7e2d4] px-4 py-3"><p className="text-xs font-semibold tracking-wide">{label || (blind ? 'Observation photograph' : specimen.name)}</p><span className="text-[10px] uppercase tracking-widest text-stone-500">Real specimen</span></div>
    <div className="flex min-h-44 items-center justify-center bg-[#e9e6dd]">
      {failed ? <div role="status" className="p-6 text-sm">This photograph could not load. {blind ? 'Skip this observation below or try loading it again.' : <a className="underline" href={specimen.source} target="_blank" rel="noreferrer">Open the original record</a>}<button type="button" onClick={() => { setFailed(false); onLoadState?.('loading'); }} className="block mt-3 font-semibold underline">Try photograph again</button></div> : <div className="relative inline-block max-w-full">
        <img src={specimen.src} width={specimen.width} height={specimen.height} loading="lazy" alt={blind ? 'Crested gecko photograph for the visual observation question. A text description is available as a hint.' : specimen.description} onLoad={() => onLoadState?.('ready')} onError={() => { setFailed(true); onLoadState?.('error'); }} className={`block h-auto w-auto max-w-full mx-auto ${compact ? 'max-h-[340px]' : 'max-h-[440px]'}`} />
        {annotated && current && <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true"><circle cx={current.x} cy={current.y} r="4.5" fill="#ffffff20" stroke="white" strokeWidth="1.3" /><circle cx={current.x} cy={current.y} r="4.5" fill="none" stroke="#236b54" strokeWidth=".55" /><circle cx={current.x} cy={current.y} r=".65" fill="white" /></svg>}
      </div>}
    </div>
    <figcaption className="p-4">
      {annotated && points.length > 0 && <><div className="mb-2 flex flex-wrap gap-2" role="group" aria-label={`${specimen.name}: identifying regions`}>{points.map((p, i) => <button type="button" key={p.label} onClick={() => setPoint(i)} aria-pressed={point === i} aria-label={`Observation ${i + 1}: ${p.label}`} aria-describedby={`${uid}-observation`} className={`h-10 min-w-10 rounded-full border text-sm font-semibold ${point === i ? 'border-[#274d3c] bg-[#274d3c] text-white' : 'border-stone-300 text-stone-600'}`}>{i + 1}</button>)}</div><p id={`${uid}-observation`} className="min-h-12 text-sm leading-relaxed">{current?.label}</p></>}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
        {blind ? <span>Photo: {specimen.credit}</span> : <a href={specimen.source} target="_blank" rel="noreferrer" className="underline underline-offset-2">{specimen.name} · original record ↗</a>}
        {!failed && <button type="button" ref={zoomButton} onClick={() => setZoom(true)} className="min-h-10 font-semibold text-[#285842] underline underline-offset-2">Enlarge photo</button>}
      </div>
    </figcaption>
    {zoom && <EnlargedPhoto specimen={specimen} blind={blind} onClose={() => { setZoom(false); zoomButton.current?.focus(); }} />}
  </figure>;
}
