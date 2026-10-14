import { useId, useRef, useState } from 'react';
import TraitGecko from '@/components/morphguide/TraitGecko';
import PatternDrawing from './PatternDrawing';
import SpecimenFigure from './SpecimenFigure';
import RecognitionCheck from './RecognitionCheck';
import { EMPTY_STAGES, STUDY_CONTROLS, normalizeStages } from './patternIslands';
import { RAINDROP_RIGHT, REVIEW_LESSONS, REVIEW_SPECIMENS } from './reviewStudyData';

const MODES = [
  ['learn', '01', 'Guided studies'], ['animal', '02', 'One animal, two sides'],
  ['studio', '03', 'Pattern studio'], ['practice', '04', 'Recognition check'],
];
const button = 'min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700';
const selected = 'border-[#32533c] bg-[#32533c] text-white';
const unselected = 'border-[#d3d3c3] bg-white/50 text-[#52604d] hover:border-[#7c9077]';

function PatternStudio({ initialLesson }) {
  const [stages, setStages] = useState(() => normalizeStages(initialLesson.stages));
  const [view, setView] = useState(initialLesson.view);
  const [annotate, setAnnotate] = useState(false);
  const [focus, setFocus] = useState(initialLesson.region);
  const [previous, setPrevious] = useState(false);
  const uid = useId();
  const oldTraits = { dorsal: stages.dorsal / 4, lateral: stages.lateral / 4, pinstripe: stages.pinstripe / 5, spots: stages.spots / 4, tiger: stages.tiger };
  return <div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-2xl font-semibold text-[#2c422e]">Explore one feature at a time.</h3><p className="mt-2 text-sm text-stone-600">Named steps select whole markings. They are drawing settings, not morph percentages.</p></div><button type="button" onClick={() => { setStages({ ...EMPTY_STAGES }); setPrevious(false); }} className={`${button} ${unselected}`}>Clear the patterns</button></div>
    <div className="grid items-start gap-7 lg:grid-cols-[1.4fr_1fr]">
      <div className="min-w-0"><div className="overflow-hidden rounded-2xl border border-[#d9d3c0] bg-[#f4efdf]">
        <div className="flex justify-between gap-3 px-4 pt-4 text-[10px] uppercase tracking-widest text-[#63755d]"><span>{previous ? 'Previous rendering' : 'Whole-patch study'}</span><span>Illustration · {view} view</span></div>
        {previous ? <TraitGecko view={view} traits={oldTraits} annotate={annotate} focus={focus} /> : <PatternDrawing view={view} stages={stages} annotate={annotate} focus={focus} />}
      </div>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Drawing viewpoint">{['side', 'top'].map(v => <button type="button" key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`${button} ${view === v ? selected : unselected}`}>{v === 'side' ? 'Side view' : 'Top view'}</button>)}<button type="button" onClick={() => setAnnotate(!annotate)} aria-pressed={annotate} className={`${button} ${unselected}`}>{annotate ? 'Hide region map' : 'Show region map'}</button></div>
      <p className="mt-4 text-xs leading-relaxed text-stone-500">The base drawing stays fixed. These are separate anatomical studies, not a rotation of one animal. Use “One animal, two sides” to compare actual markings across views.</p>
      <button type="button" onClick={() => setPrevious(!previous)} aria-pressed={previous} className="mt-4 min-h-10 text-xs font-semibold text-[#3e6345] underline underline-offset-4">{previous ? 'Return to revised rendering' : 'Compare previous rendering'}</button>
      </div>
      <div className="space-y-5 rounded-2xl border border-[#dcd9cb] bg-[#fffdf5] p-5">{STUDY_CONTROLS.map(control => <div key={control.key}>
        <label htmlFor={`${uid}-${control.key}`} className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-semibold text-[#293d2c]"><span>{control.label}</span><output className="text-xs font-normal text-[#5c6b50]">{control.steps[stages[control.key]]}</output></label>
        <input id={`${uid}-${control.key}`} type="range" min="0" max={control.steps.length - 1} step="1" value={stages[control.key]} aria-valuetext={control.steps[stages[control.key]]} onChange={event => { setStages(s => ({ ...s, [control.key]: Number(event.target.value) })); setFocus(control.key === 'tiger' ? 'dorsal' : control.key); }} className="my-1 h-9 w-full cursor-pointer accent-[#416945]" />
        <p className="text-xs leading-relaxed text-stone-500">{control.hint}</p>
      </div>)}</div>
    </div>
    <div className="mt-6 rounded-xl border border-[#d9d8c6] bg-[#edf0e3] p-4 text-sm leading-relaxed text-[#48533e]">Use the drawing to locate and separate features, then compare with specimens. Combining layers is not a validated model of every possible phenotype or of inheritance.</div>
  </div>;
}

export default function MorphLearningReview() {
  const [mode, setMode] = useState('learn');
  const [lessonId, setLessonId] = useState('harlequin');
  const [specimenIndex, setSpecimenIndex] = useState(0);
  const [annotated, setAnnotated] = useState(true);
  const [animalFocus, setAnimalFocus] = useState('lateral');
  const heading = useRef(null);
  const lesson = REVIEW_LESSONS.find(l => l.id === lessonId);
  const specimen = REVIEW_SPECIMENS[lesson.examples[specimenIndex]];
  const chooseLesson = id => { setLessonId(id); setSpecimenIndex(0); };
  return <section aria-label="Specimen learning review" className="overflow-hidden rounded-[24px] border border-[#c6c7ad] bg-[#f3f0e4] text-[#2d412f] shadow-xl">
    <header className="border-b border-[#d7d7c6] px-5 pb-6 pt-7 sm:px-8">
      <div className="flex flex-wrap justify-between gap-3 text-[10px] font-semibold uppercase tracking-[.2em] text-[#67745a]"><span>Geck Inspect · Field notebook</span><span>Study edition / 14 October 2026</span></div>
      <h2 className="mt-4 text-3xl leading-tight sm:text-4xl" style={{ fontFamily: 'Georgia, serif' }}>Read the pattern, region by region.</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#69715d]">Observe real animals, learn where the identifying features sit, and test what you can recognize in a different specimen.</p>
      <div className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4" role="group" aria-label="Notebook mode">{MODES.map(([id, n, label]) => <button type="button" key={id} aria-pressed={mode === id} onClick={() => setMode(id)} className={`${button} flex items-center gap-3 text-left ${mode === id ? selected : unselected}`}><span className={`text-[10px] ${mode === id ? 'text-[#cad6b9]' : 'text-[#87907a]'}`}>{n}</span><span>{label}</span></button>)}</div>
    </header>
    <div className="p-5 sm:p-8">
      {mode === 'learn' && <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2" role="group" aria-label="Guided study">{REVIEW_LESSONS.map(l => <button type="button" key={l.id} ref={lessonId === l.id ? heading : undefined} aria-pressed={lessonId === l.id} onClick={() => chooseLesson(l.id)} className={`${button} ${lessonId === l.id ? selected : unselected}`}>{l.title}</button>)}</div><button type="button" aria-pressed={annotated} onClick={() => setAnnotated(!annotated)} className="min-h-11 text-xs font-semibold text-[#587050] underline underline-offset-4">{annotated ? 'Hide identifying marks' : 'Show identifying marks'}</button></div>
        <div className="mb-5 lg:hidden"><h3 className="text-2xl font-semibold leading-tight">{lesson.subtitle}</h3><p className="mt-3 text-sm leading-relaxed text-[#59644f]">{lesson.observation}</p></div>
        <div className="grid items-start gap-7 lg:grid-cols-[.9fr_1.1fr]">
          <div><div className="hidden lg:block"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#718064]">Where to look / {lesson.title}</p><h3 className="mt-3 text-2xl font-semibold leading-tight">{lesson.subtitle}</h3><p className="mt-4 text-sm leading-relaxed text-[#59644f]">{lesson.observation}</p></div>
            <div className="mt-5 overflow-hidden rounded-xl border border-[#ded8c6]"><PatternDrawing stages={lesson.stages} view={lesson.view} focus={lesson.region} annotate={annotated} /></div><p className="mt-2 text-[11px] text-[#7b816b]">Illustrated region map. Use the photographs to judge real pattern shapes.</p>
            <div className="mt-5 border-l-2 border-[#9aa881] pl-4"><p className="text-xs font-semibold uppercase tracking-wider text-[#61714d]">Compare the animals</p><p className="mt-2 text-sm leading-relaxed text-[#59644f]">{lesson.comparison}</p></div>
            <p className="mt-4 text-sm leading-relaxed text-[#59644f]">{lesson.boundary}</p>
            <button type="button" onClick={() => setMode('studio')} className="mt-5 rounded-xl bg-[#32533c] px-5 py-3 text-sm font-semibold text-white">Explore the drawing →</button>
          </div>
          <div className="order-first min-w-0 lg:order-none"><SpecimenFigure key={`${specimen.id}-${lesson.id}`} specimen={specimen} focus={lesson.region} annotated={annotated} label={`${specimen.name} · example ${specimenIndex + 1} of ${lesson.examples.length}`} />
            <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Compare real specimens">{lesson.examples.map((id, index) => { const photo = REVIEW_SPECIMENS[id]; return <button type="button" key={id} onClick={() => setSpecimenIndex(index)} aria-pressed={specimenIndex === index} className={`min-w-0 overflow-hidden rounded-xl border p-2 text-left ${specimenIndex === index ? 'border-[#4b7049] bg-[#e6ebdc]' : 'border-[#d9d8ca] bg-white/50'}`}><img src={photo.src} alt="" className="h-20 w-full rounded-lg object-cover" /><span className="mt-2 block text-xs font-semibold">{photo.name}</span></button>; })}</div>
          </div>
        </div>
        <p className="mt-6 border-t border-[#d8d8c6] pt-4 text-xs leading-relaxed text-[#738064]">Terminology reference: <a href={lesson.source} target="_blank" rel="noreferrer" className="underline underline-offset-2">{lesson.sourceLabel} ↗</a>. Photographs: Tennyson’s public collection records. The observations describe visible features.</p>
      </div>}
      {mode === 'animal' && <div><div className="mb-6 max-w-3xl"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#718064]">Same individual / Raindrop</p><h3 className="mt-3 text-2xl font-semibold">Two sides. One animal.</h3><p className="mt-3 text-sm leading-relaxed text-[#59644f]">Follow the raised edge, then look below it at the flank patches. These are photographs of opposite sides of Raindrop. The regions correspond; the individual markings are not mirror images.</p></div>
        <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Feature to follow">{[['lateral', 'Flank patches'], ['pinstripe', 'Crest rows'], ['spots', 'Discrete spots']].map(([id, label]) => <button type="button" key={id} aria-pressed={animalFocus === id} onClick={() => setAnimalFocus(id)} className={`${button} ${animalFocus === id ? selected : unselected}`}>{label}</button>)}</div>
        <div className="grid items-start gap-5 sm:grid-cols-2"><SpecimenFigure key={`a-${animalFocus}`} specimen={REVIEW_SPECIMENS.raindrop} focus={animalFocus} label="View A · facing left" /><SpecimenFigure key={`b-${animalFocus}`} specimen={RAINDROP_RIGHT} focus={animalFocus} label="View B · facing right" /></div>
        <p className="mt-5 rounded-xl border border-[#d9d8c6] bg-[#edf0e3] p-4 text-sm leading-relaxed text-[#48533e]">The tail base is cropped, and neither photo shows the full back from above. These angles help compare regions; they cannot establish a complete pinstripe grade. Differences in lighting also change the apparent color.</p>
      </div>}
      <div hidden={mode !== 'studio'}><PatternStudio key={lessonId} initialLesson={lesson} /></div>
      <div hidden={mode !== 'practice'}><RecognitionCheck onReviewLesson={id => { chooseLesson(id); setMode('learn'); requestAnimationFrame(() => heading.current?.focus({ preventScroll: true })); }} /></div>
      <details className="mt-7 border-t border-[#d5d6c3] pt-4 text-xs leading-relaxed text-[#6a755e]"><summary className="cursor-pointer font-semibold text-[#526446]">What this study covers</summary><p className="mt-3">Three focused studies cover lateral pattern, crest rows and spotting. They introduce observations that can coexist on an animal. Flame, tiger, brindle and specialist traits still need their own broader specimen sets before this becomes a comprehensive identification resource.</p><p className="mt-2">The original AI-assisted ink drawings remain explanatory illustrations. Their combined settings and the relationship between the top and side drawings have not been validated as biological reconstructions. The recognition check uses four different collection animals, not an independently validated benchmark.</p></details>
    </div>
  </section>;
}
