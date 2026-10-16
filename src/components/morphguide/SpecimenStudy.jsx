import { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SPECIMENS, STUDY_QUESTIONS } from './patternStudy';
import IllustratedGecko, { hasIllustration } from './IllustratedGecko';

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
      {failed ? <div className="p-8 text-center text-slate-700">Photo unavailable. <a className="underline" href={specimen.source} target="_blank" rel="noreferrer">Open the credited reference</a></div> : <img src={selected.src} width={selected.width || specimen.width} height={selected.height || specimen.height} alt={`${specimen.title}${selected.label ? ` · ${selected.label}` : ''}`} onError={() => setFailed(true)} className="block w-full h-auto max-h-[420px] object-contain mx-auto" loading="lazy" />}
      {!failed && annotated && <><svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{points.map((p,i) => <g key={i}><line x1={p.x} y1={p.y} x2={Math.min(92,p.x+13)} y2={Math.max(8,p.y-17)} stroke={point === i ? '#35d2ad' : '#ffffff'} strokeWidth=".45" /><circle cx={p.x} cy={p.y} r=".75" fill="#ffffff" /></g>)}</svg>{points.map((p,i) => <button key={i} type="button" onClick={() => setPoint(i)} aria-label={`Feature ${i+1}: ${p.label}`} aria-pressed={point === i} aria-describedby={`${uid}-note`} style={{ left:`${Math.min(92,p.x+13)}%`, top:`${Math.max(8,p.y-17)}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full w-11 h-11 grid place-items-center focus-visible:outline focus-visible:outline-4 focus-visible:outline-emerald-300"><span className={`grid place-items-center rounded-full w-7 h-7 border-2 border-white font-bold shadow-lg ${point === i ? 'bg-emerald-500 text-slate-950' : 'bg-slate-950/80 text-white'}`}>{i+1}</span></button>)}</>}
    </div>
    <figcaption className="p-3">{specimen.views && <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Specimen viewpoint">{specimen.views.map((v,i) => <button type="button" key={v.label} aria-pressed={view === i} onClick={() => { setView(i); setPoint(0); setFailed(false); }} className={`rounded-lg border px-3 py-2 text-xs ${view === i ? 'border-emerald-400 text-white' : 'border-slate-700 text-slate-400'}`}>{v.label}</button>)}</div>}<p className="font-semibold text-sm text-slate-100">{specimen.title}</p>{annotated && <p id={`${uid}-note`} className="mt-1 text-sm text-emerald-200 min-h-10">{points[point]?.label}</p>}<a href={specimen.source} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-slate-400 underline underline-offset-2">Photo: {specimen.credit}</a></figcaption>
  </figure>;
}

export function RecognitionPractice() {
  const heading = useRef(null);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState(null);
  const [history, setHistory] = useState({});
  const question = STUDY_QUESTIONS[index];
  const specimen = SPECIMENS[question.specimen];
  const plateMorph = specimen?.plateMorph;
  const answeredCount = Object.keys(history).length;
  const correctCount = Object.entries(history).filter(([qId, ans]) => {
    const q = STUDY_QUESTIONS.find(item => item.id === qId);
    return q && q.correct === ans;
  }).length;

  const pickAnswer = i => {
    setChoice(i);
    setHistory(prev => (prev[question.id] !== undefined ? prev : { ...prev, [question.id]: i }));
  };

  return (
    <div className="space-y-5" aria-label="Real specimen practice">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Observation questions">
          {STUDY_QUESTIONS.map((q, idx) => {
            const prevAns = history[q.id];
            const isCurrent = idx === index;
            const statusClass = isCurrent
              ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
              : prevAns !== undefined
              ? prevAns === q.correct
                ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-300'
                : 'border-amber-500/40 bg-amber-950/40 text-amber-200'
              : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white';
            return (
              <button
                key={q.id}
                type="button"
                aria-label={`Observation ${idx + 1}`}
                aria-pressed={isCurrent}
                onClick={() => {
                  setIndex(idx);
                  setChoice(history[q.id] ?? null);
                }}
                className={`h-8 min-w-8 rounded-lg border px-2 text-xs font-semibold transition-colors ${statusClass}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
        <div className="text-xs text-slate-300">
          Score: <span className="font-semibold text-emerald-300">{correctCount}</span> / {STUDY_QUESTIONS.length} ({answeredCount} completed)
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-4">
          {plateMorph && hasIllustration(plateMorph) && (
            <figure className="overflow-hidden rounded-xl border border-slate-700 bg-[#f4efdf] p-3">
              <div className="flex items-center justify-between gap-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[#564c3d]">
                <span>Field guide diagnostic plate</span>
                <span>{choice !== null ? `Reference: ${plateMorph.replaceAll('-', ' ')}` : 'Observe anatomical regions'}</span>
              </div>
              <IllustratedGecko morph={plateMorph} decorative className="w-full rounded-lg" />
            </figure>
          )}
          <SpecimenPhoto key={specimen.id} specimen={specimen} annotated={choice !== null} />
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-emerald-300">
            Observation {index + 1} of {STUDY_QUESTIONS.length}
          </p>
          <h4 ref={heading} tabIndex={-1} className="text-xl text-white font-semibold mt-2 outline-none">
            {question.question}
          </h4>
          <div className="mt-5 space-y-2">
            {question.answers.map((answer, i) => (
              <button
                key={answer}
                type="button"
                onClick={() => pickAnswer(i)}
                aria-pressed={choice === i}
                className={`block text-left w-full p-3.5 rounded-xl border text-sm transition-colors ${
                  choice === i
                    ? i === question.correct
                      ? 'border-emerald-400 bg-emerald-500/15 text-white'
                      : 'border-amber-400 bg-amber-500/15 text-white'
                    : choice !== null && i === question.correct
                    ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-200'
                    : 'border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                {answer}
              </button>
            ))}
          </div>
          {choice !== null && (
            <div aria-live="polite" className="rounded-xl border border-slate-800 bg-slate-950 p-4 mt-4">
              <p className={`font-semibold ${choice === question.correct ? 'text-emerald-300' : 'text-amber-300'}`}>
                {choice === question.correct ? 'That is the visible clue.' : 'Look again at the identifying feature.'}
              </p>
              <p className="text-slate-300 text-sm mt-2 leading-relaxed">{question.explanation}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const nextIdx = (index + 1) % STUDY_QUESTIONS.length;
                    setIndex(nextIdx);
                    setChoice(history[STUDY_QUESTIONS[nextIdx].id] ?? null);
                    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
                  }}
                  className="rounded-lg bg-emerald-400 text-slate-950 font-semibold px-4 py-2 text-sm"
                >
                  {index === STUDY_QUESTIONS.length - 1 ? 'Practice again' : 'Next observation'}
                </button>
                {plateMorph && (
                  <Link
                    to={`/MorphGuide/${plateMorph}`}
                    className="text-xs font-medium text-emerald-300 underline underline-offset-2"
                  >
                    Open the {plateMorph.replaceAll('-', ' ')} guide
                  </Link>
                )}
              </div>
            </div>
          )}
          <p className="text-xs text-slate-400 mt-5">
            Practice describing what is visible. Several trait names may apply to one animal, and a single photograph never confirms hidden genetics.
          </p>
        </div>
      </div>
    </div>
  );
}
