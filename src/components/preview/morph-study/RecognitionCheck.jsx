import { useRef, useState } from 'react';
import SpecimenFigure from './SpecimenFigure';
import { REVIEW_LESSONS, REVIEW_QUESTIONS, REVIEW_SPECIMENS, recognitionSummary } from './reviewStudyData';

export default function RecognitionCheck({ onReviewLesson }) {
  const [index, setIndex] = useState(0);
  const [attempts, setAttempts] = useState({});
  const [hints, setHints] = useState({});
  const [photoState, setPhotoState] = useState('loading');
  const [repeated, setRepeated] = useState(false);
  const heading = useRef(null);
  const finished = index === REVIEW_QUESTIONS.length;
  const summary = recognitionSummary(attempts);
  const moveTo = next => {
    setIndex(next); setPhotoState('loading');
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  };
  if (finished) return <div className="rounded-2xl border border-[#d5d8c9] bg-[#fffdf5] p-6 sm:p-8 text-[#293c2f]">
    <p className="text-xs uppercase tracking-widest text-[#56735e]">{repeated ? 'Repeat practice' : 'First observation check'}</p>
    <h3 ref={heading} tabIndex={-1} className="mt-3 text-3xl font-semibold outline-none">{summary.independentCorrect} of {REVIEW_QUESTIONS.length} independently observed</h3>
    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">{summary.assisted > 0 ? `${summary.assisted} used the description hint. ` : ''}This counts your first answers without a hint. It checks these four observations, not your ability to identify every morph.</p>
    <div className="mt-6 grid gap-3 sm:grid-cols-2">{REVIEW_QUESTIONS.map(q => <div key={q.id} className="rounded-xl border border-[#e0dfd2] p-4"><p className="text-sm font-semibold">{attempts[q.id]?.skipped ? 'Skipped' : attempts[q.id]?.choice === q.correct ? (attempts[q.id]?.assisted ? 'Observed with a hint' : 'Observed independently') : 'Worth another look'}</p><p className="mt-2 text-sm text-stone-600">{q.explanation}</p></div>)}</div>
    {summary.revisit.length > 0 && <div className="mt-5"><p className="text-sm font-semibold">Revisit these studies</p><div className="mt-2 flex flex-wrap gap-2">{summary.revisit.map(id => <button type="button" key={id} onClick={() => onReviewLesson(id)} className="rounded-lg border border-[#9eac99] px-4 py-2 text-sm">{REVIEW_LESSONS.find(l => l.id === id).title}</button>)}</div></div>}
    <button type="button" onClick={() => { setAttempts({}); setHints({}); setRepeated(true); moveTo(0); }} className="mt-6 rounded-xl bg-[#284b39] px-5 py-3 text-sm font-semibold text-white">Practice these photographs again</button>
    <p className="mt-3 text-xs text-stone-500">A repeat uses the same animals, so it is practice rather than a new recognition test.</p>
  </div>;

  const question = REVIEW_QUESTIONS[index];
  const specimen = REVIEW_SPECIMENS[question.specimen];
  const attempt = attempts[question.id];
  const hasAnswer = !!attempt;
  const answer = choice => {
    if (photoState !== 'ready') return;
    setAttempts(previous => previous[question.id] ? previous : { ...previous, [question.id]: { choice, assisted: !!hints[question.id] } });
  };
  return <div>
    <p className="mb-5 max-w-3xl text-sm leading-relaxed text-stone-600">These four animals do not appear in the guided studies. Look at the photograph first; names and annotations appear after you answer. Knowing when a view is insufficient is part of the exercise.</p>
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <SpecimenFigure key={question.id} specimen={specimen} focus={question.region} blind={!hasAnswer} annotated={hasAnswer} label={hasAnswer ? specimen.name : `Specimen ${index + 1}`} onLoadState={setPhotoState} />
      <div><p className="text-xs uppercase tracking-widest text-[#56735e]">{repeated ? 'Repeat practice' : 'Recognition check'} · {index + 1} / {REVIEW_QUESTIONS.length}</p>
        <h3 ref={heading} tabIndex={-1} className="mt-3 text-2xl font-semibold leading-tight text-[#283e2e] outline-none">{question.prompt}</h3>
        <div className="mt-5 space-y-3">{question.answers.map((option, i) => <button type="button" key={option} disabled={hasAnswer || photoState !== 'ready'} aria-pressed={attempt?.choice === i} onClick={() => answer(i)} className={`block w-full rounded-xl border p-4 text-left text-sm leading-relaxed disabled:cursor-default ${hasAnswer && i === question.correct ? 'border-[#5f8063] bg-[#e7eddf] text-[#22432d]' : attempt?.choice === i ? 'border-amber-600 bg-amber-50 text-amber-950' : 'border-[#d9d6c9] bg-[#fffdf7] text-stone-700 enabled:hover:border-[#688168]'}`}>{option}</button>)}</div>
        {!hasAnswer && photoState === 'loading' && <p role="status" className="mt-3 text-xs text-stone-500">Loading the observation photograph…</p>}
        {!hasAnswer && photoState === 'error' && <button type="button" onClick={() => { setAttempts(p => ({ ...p, [question.id]: { choice: null, skipped: true, assisted: false } })); moveTo(index + 1); }} className="mt-4 rounded-lg border border-stone-400 px-4 py-2 text-sm">Skip unavailable photograph</button>}
        {!hasAnswer && <div className="mt-5"><button type="button" onClick={() => setHints(p => ({ ...p, [question.id]: true }))} disabled={!!hints[question.id]} className="text-sm text-[#365e42] underline underline-offset-4 disabled:no-underline">Describe the photograph (counts as a hint)</button>{hints[question.id] && <p role="status" className="mt-3 rounded-xl bg-white/70 p-4 text-sm leading-relaxed text-stone-700">{specimen.description}</p>}</div>}
        {hasAnswer && <div role="status" className="mt-5 rounded-xl bg-[#e9edde] p-5"><p className="font-semibold text-[#294630]">{attempt.choice === question.correct ? 'That observation fits the photograph.' : 'Follow the highlighted evidence.'}</p><p className="mt-2 text-sm leading-relaxed text-stone-700">{question.explanation}</p><p className="mt-2 text-xs text-stone-500">Your first answer is recorded{attempt.assisted ? ' with a description hint' : ''}.</p><button type="button" onClick={() => moveTo(index + 1)} className="mt-4 rounded-lg bg-[#284b39] px-5 py-3 text-sm font-semibold text-white">{index === REVIEW_QUESTIONS.length - 1 ? 'See my observations' : 'Next specimen'}</button></div>}
      </div>
    </div>
  </div>;
}
