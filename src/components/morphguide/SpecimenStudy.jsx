import { useId, useRef, useState } from 'react';
import { SPECIMENS, STUDY_QUESTIONS } from './patternStudy';

export function SpecimenPhoto({ specimen, annotated = true, className = '', previewPhotos = import.meta.env.DEV }) {
  const [failed, setFailed] = useState(false);
  const [point, setPoint] = useState(0);
  const [view, setView] = useState(0);
  const selected = specimen.views?.[view] || specimen;
  const points = selected.points;
  const uid = useId();
  // Unlicensed research references are viewable on their owner's site.
  // Only the local design preview or an explicitly cleared record embeds them.
  if (!previewPhotos && specimen.reuseApproved !== true) return <figure className={`rounded-xl border border-slate-700 bg-slate-950 p-5 ${className}`}>
    <p className="text-xs uppercase tracking-wider text-emerald-300">Real specimen reference</p>
    <figcaption className="mt-3 text-lg font-semibold text-white">{specimen.title}</figcaption>
    <p className="mt-2 text-sm text-slate-400">View the original photograph on the photographer’s site, then return here to compare what you see.</p>
    <a href={specimen.source} target="_blank" rel="noreferrer" className="inline-flex mt-4 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950">Open original photograph <span className="ml-2" aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a>
    {annotated && <ul className="mt-4 space-y-2 text-sm text-slate-300">{points.map(p => <li key={p.label}>{p.label}</li>)}</ul>}
    <p className="mt-4 text-xs text-slate-400">Photo reference: {specimen.credit}</p>
  </figure>;
  return <figure className={`overflow-hidden rounded-xl border border-slate-700 bg-slate-950 ${className}`}>
    <div className="relative bg-[#eee9df]">
      {failed ? <div className="p-8 text-center text-slate-700">Photo unavailable. <a className="underline" href={specimen.source} target="_blank" rel="noreferrer">Open the credited reference</a></div> : <img src={selected.src} width={selected.width || specimen.width} height={selected.height || specimen.height} alt={`${specimen.title}${selected.label ? ` · ${selected.label}` : ''}`} onError={() => setFailed(true)} className="block w-full h-auto" loading="lazy" />}
      {!failed && annotated && <><svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{points.map((p,i) => <g key={i}><line x1={p.x} y1={p.y} x2={Math.min(92,p.x+13)} y2={Math.max(8,p.y-17)} stroke={point === i ? '#35d2ad' : '#ffffff'} strokeWidth=".45" /><circle cx={p.x} cy={p.y} r=".75" fill="#ffffff" /></g>)}</svg>{points.map((p,i) => <button key={i} type="button" onClick={() => setPoint(i)} aria-label={`Feature ${i+1}: ${p.label}`} aria-pressed={point === i} aria-describedby={`${uid}-note`} style={{ left:`${Math.min(92,p.x+13)}%`, top:`${Math.max(8,p.y-17)}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full w-11 h-11 grid place-items-center focus-visible:outline focus-visible:outline-4 focus-visible:outline-emerald-300"><span className={`grid place-items-center rounded-full w-7 h-7 border-2 border-white font-bold shadow-lg ${point === i ? 'bg-emerald-500 text-slate-950' : 'bg-slate-950/80 text-white'}`}>{i+1}</span></button>)}</>}

    </div>
    <figcaption className="p-3">{specimen.views && <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Specimen viewpoint">{specimen.views.map((v,i) => <button type="button" key={v.label} aria-pressed={view === i} onClick={() => { setView(i); setPoint(0); setFailed(false); }} className={`rounded-lg border px-3 py-2 text-xs ${view === i ? 'border-emerald-400 text-white' : 'border-slate-700 text-slate-400'}`}>{v.label}</button>)}</div>}<p className="font-semibold text-sm text-slate-100">{specimen.title}</p>{annotated && <p id={`${uid}-note`} className="mt-1 text-sm text-emerald-200 min-h-10">{points[point]?.label}</p>}<a href={specimen.source} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-slate-400 underline underline-offset-2">Photo: {specimen.credit}</a></figcaption>
  </figure>;
}

export function RecognitionPractice() {
  const heading = useRef(null);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState(null);
  const question = STUDY_QUESTIONS[index];
  const specimen = SPECIMENS[question.specimen];
  return <div className="grid lg:grid-cols-2 gap-6 items-start" aria-label="Real specimen practice">
    <SpecimenPhoto key={specimen.id} specimen={specimen} annotated={choice !== null} />
    <div><p className="text-xs uppercase tracking-wider text-emerald-300">Observation {index + 1} of {STUDY_QUESTIONS.length}</p><h4 ref={heading} tabIndex={-1} className="text-xl text-white font-semibold mt-2 outline-none">{question.question}</h4><div className="mt-5 space-y-2">{question.answers.map((answer, i) => <button key={answer} type="button" onClick={() => setChoice(i)} aria-pressed={choice === i} className={`block text-left w-full p-3 rounded-xl border text-sm ${choice === i ? 'border-emerald-400 bg-emerald-500/15 text-white' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}>{answer}</button>)}</div>{choice !== null && <div aria-live="polite" className="rounded-xl bg-slate-950 p-4 mt-4"><p className="font-semibold text-emerald-300">{choice === question.correct ? 'That is the visible clue.' : 'Look again at the identifying feature.'}</p><p className="text-slate-300 text-sm mt-2">{question.explanation}</p><button type="button" onClick={() => { setIndex((index + 1) % STUDY_QUESTIONS.length); setChoice(null); requestAnimationFrame(() => heading.current?.focus({ preventScroll: true })); }} className="mt-4 rounded-lg bg-emerald-400 text-slate-950 font-semibold px-4 py-2">{index === STUDY_QUESTIONS.length - 1 ? 'Practice again' : 'Next observation'}</button></div>}<p className="text-xs text-slate-400 mt-5">Practice describing what is visible. Several trait names may apply to one animal.</p></div>
  </div>;
}
