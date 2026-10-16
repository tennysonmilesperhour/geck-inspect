import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { captureEvent } from '@/lib/posthog';
import TraitGecko, { traitAsset, BASE_TONES } from './TraitGecko';
import { SpecimenPhoto, RecognitionPractice } from './SpecimenStudy';
import { SPECIMENS, STUDY_LESSONS, EMPTY_TRAITS, normalizedStudy, traitDescription } from './patternStudy';

/** Only connect detail pages to an existing, relevant specimen lesson. */
export function spectrumPositionFor(slug) {
  const coverage = ['flame', 'harlequin', 'extreme-harlequin'].indexOf(slug);
  if (coverage >= 0) return { track: 'coverage', pos: coverage + 1 };
  if (slug === 'pinstripe') return { track: 'pinning', pos: 2 };
  if (['tiger', 'brindle', 'dalmatian', 'super-dalmatian'].includes(slug)) return { track: 'features', pos: 0 };
  return null;
}

const CONTROLS = [
  ['dorsal', 'Dorsal pattern', 'The field between the crest rows.'],
  ['lateral', 'Flank & leg pattern', 'Irregular patches on the sides and limbs.'],
  ['pinstripe', 'Pinstripe continuity', 'Individual highlighted scales on the raised edges.'],
  ['tiger', 'Dark band contrast', 'Transverse pattern, with naturally irregular edges.'],
  ['spots', 'Dalmatian spotting', 'Individual spots with varied sizes and spacing.'],
];

export const STUDIO_PRESETS = [
  { id: 'patternless', label: 'Patternless', traits: { dorsal: 0, lateral: 0, pinstripe: 0, tiger: 0, spots: 0 } },
  { id: 'flame', label: 'Flame', traits: { dorsal: 0.92, lateral: 0.08, pinstripe: 0.15, tiger: 0, spots: 0 } },
  { id: 'harlequin', label: 'Harlequin', traits: { dorsal: 1, lateral: 0.58, pinstripe: 0.35, tiger: 0, spots: 0 } },
  { id: 'extreme-harlequin', label: 'Extreme Harlequin', traits: { dorsal: 1, lateral: 0.96, pinstripe: 0.75, tiger: 0, spots: 0 } },
  { id: 'pinstripe', label: 'Full Pinstripe', traits: { dorsal: 0.35, lateral: 0.2, pinstripe: 1, tiger: 0, spots: 0 } },
  { id: 'quad-stripe', label: 'Quad-Style Pin', traits: { dorsal: 0.25, lateral: 0.72, pinstripe: 1, tiger: 0, spots: 0 } },
  { id: 'tiger', label: 'Tiger', traits: { dorsal: 0.15, lateral: 0, pinstripe: 0, tiger: 0.72, spots: 0 } },
  { id: 'brindle-dal', label: 'Brindle + Spots', traits: { dorsal: 0.25, lateral: 0.2, pinstripe: 0.3, tiger: 0.95, spots: 0.55 } },
  { id: 'dalmatian', label: 'Dalmatian', traits: { dorsal: 0, lateral: 0, pinstripe: 0, tiger: 0, spots: 0.52 } },
  { id: 'super-dalmatian', label: 'Super Dalmatian', traits: { dorsal: 0.2, lateral: 0, pinstripe: 0, tiger: 0, spots: 1 } },
];

export default function PatternSpectrum({ focusSlug, initialTrack, initialPosition, className = '', showHeader = true }) {
  const initialLesson = STUDY_LESSONS.find(l => l.id === ({ 'extreme-harlequin':'harlequin', 'brindle':'tiger', 'super-dalmatian':'dalmatian' }[focusSlug] || focusSlug)) || STUDY_LESSONS[initialTrack === 'pinning' ? 2 : 0];
  const [lessonId, setLessonId] = useState(initialLesson.id);
  const [mode, setMode] = useState('learn');
  const [view, setView] = useState(initialLesson.view);
  const [traits, setTraits] = useState(() => normalizedStudy(initialPosition !== undefined && initialTrack === 'pinning' ? { pinstripe: initialPosition / 2 } : initialLesson.traits));
  const [tone, setTone] = useState('buckskin');
  const [fired, setFired] = useState(1);
  const [showRegions, setShowRegions] = useState(false);
  const [saved, setSaved] = useState(null);
  const [comparing, setComparing] = useState(false);
  const animRef = useRef(null);
  const traitsRef = useRef(traits);
  traitsRef.current = traits;
  const uid = useId().replace(/:/g, '');
  const lesson = STUDY_LESSONS.find(l => l.id === lessonId);
  const activeTraits = comparing && saved ? saved : traits;

  useEffect(() => () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
  }, []);

  const animateToTraits = targetInput => {
    const target = normalizedStudy(targetInput);
    const start = { ...traitsRef.current };
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      setTraits(target);
      return;
    }
    const startTime = performance.now();
    const duration = 300;
    const step = now => {
      const elapsed = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - elapsed, 3);
      const next = {};
      for (const k of Object.keys(EMPTY_TRAITS)) {
        next[k] = Number((start[k] + (target[k] - start[k]) * ease).toFixed(3));
      }
      setTraits(next);
      if (elapsed < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        animRef.current = null;
      }
    };
    animRef.current = requestAnimationFrame(step);
  };

  const chooseLesson = l => {
    setLessonId(l.id);
    setView(l.view);
    setComparing(false);
    animateToTraits(l.traits);
    captureEvent('morph_spectrum_scrub', { track: l.id, placement: mode });
  };

  return <section className={`rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6 ${className}`} aria-label="Pattern spectrum">
    {showHeader && <><p className="text-xs uppercase tracking-widest text-emerald-400">The field notebook</p><h3 className="text-xl sm:text-2xl font-bold text-white mt-1">Learn to see the pattern</h3><p className="mt-2 text-sm text-slate-400 max-w-2xl">Start with real specimens. Learn the identifying regions, combine common features, then test your eye on photographs.</p></>}
    <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 my-5" role="group" aria-label="Study mode">{[['learn','1 · Guided observations'],['explore','2 · Pattern studio'],['practice','3 · Test your eye']].map(([id,label]) => <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)} className={`rounded-lg px-3 py-2.5 text-sm font-semibold border ${mode === id ? 'bg-emerald-500/15 border-emerald-500/70 text-emerald-200' : 'border-slate-700 text-slate-400 hover:text-white'}`}>{label}</button>)}</div>
    {mode !== 'practice' && <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-5" role="group" aria-label="Study topics">{STUDY_LESSONS.map(l => <button key={l.id} type="button" aria-pressed={lessonId === l.id} onClick={() => chooseLesson(l)} className={`text-left rounded-lg px-3 py-2 border ${lessonId === l.id ? 'border-emerald-500/50 bg-slate-950 text-white' : 'border-slate-800 text-slate-400'}`}><span className="block text-sm font-semibold">{l.title}</span><span className="block text-[11px] mt-1">{l.subtitle}</span></button>)}</div>}
    {mode === 'learn' && <div><div className="grid lg:grid-cols-[.9fr_1.1fr] gap-6 items-start"><div><p className="text-xs uppercase tracking-widest text-emerald-300">Where to look</p><h4 className="text-2xl font-semibold text-white mt-2">{lesson.subtitle}</h4><p className="text-slate-200 mt-3 leading-relaxed">{lesson.look}</p><p className="text-sm text-slate-400 mt-3 leading-relaxed">{lesson.distinction}</p><div className="mt-5 rounded-xl overflow-hidden"><TraitGecko view={lesson.view} traits={normalizedStudy(lesson.traits)} focus={lesson.region} annotate title={`${lesson.subtitle}: anatomical region study`} /></div><p className="mt-2 text-xs text-slate-500">Illustrated region study · compare with the actual specimens.</p><Link to={`/MorphGuide/${lesson.guide}`} className="inline-block mt-4 text-sm text-emerald-300 underline">Read the {lesson.guide.replaceAll('-', ' ')} guide</Link><button type="button" onClick={() => { setMode('explore'); chooseLesson(lesson); }} className="block mt-4 rounded-lg bg-emerald-400 text-slate-950 font-semibold px-4 py-2">Explore this feature</button></div><SpecimenPhoto key={lesson.examples[0]} specimen={SPECIMENS[lesson.examples[0]]} /></div><div className="grid sm:grid-cols-2 gap-4 mt-5 items-start">{lesson.examples.slice(1).map(id => <SpecimenPhoto key={id} specimen={SPECIMENS[id]} />)}</div></div>}
    {mode === 'explore' && <>
      <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Morph combinations &amp; presets</div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Morph presets">
          {STUDIO_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setComparing(false);
                animateToTraits(preset.traits);
              }}
              className="rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/50 hover:text-emerald-200 px-3 py-1 text-xs font-medium text-slate-300 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
        <div>
          <TraitGecko view={view} traits={activeTraits} tone={tone} fired={fired} focus={lesson.region} annotate={showRegions} title={`Combined pattern study, ${view} view`} className="rounded-xl w-full" />
          <div className="flex justify-center flex-wrap gap-2 mt-3">
            {['side', 'top'].map(v => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`rounded-full border px-4 py-2 text-sm ${view === v ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200' : 'border-slate-700 text-slate-300'}`}>{v === 'side' ? 'Side view' : 'Top view'}</button>)}
            <button type="button" aria-pressed={showRegions} onClick={() => setShowRegions(!showRegions)} className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-300">{showRegions ? 'Hide' : 'Show'} regions</button>
          </div>
          <div className="mt-3 rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Base ground tone</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Base ground tone">
                {Object.entries(BASE_TONES).map(([id, info]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={tone === id}
                    onClick={() => setTone(id)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${tone === id ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200' : 'border-slate-700 text-slate-300 hover:border-slate-600'}`}
                  >
                    {info.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-3">
              <label htmlFor={`${uid}-fired`} className="text-xs font-medium text-slate-300 shrink-0">
                Firing state: <span className="text-emerald-300">{fired > 0.75 ? 'Fired up' : fired > 0.3 ? 'Mid-fire' : 'Fired down'}</span>
              </label>
              <input
                id={`${uid}-fired`}
                aria-label="Firing state"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={fired}
                onChange={e => setFired(Number(e.target.value))}
                className="w-full accent-emerald-400 h-6"
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">The two drawings show the same trait settings across side and dorsal views; they are field-guide anatomical studies rather than a photographed individual.</p>
          <div className="flex flex-wrap gap-3 mt-4">
            <button type="button" onClick={() => { setSaved({ ...traits }); setComparing(false); }} className="text-sm text-emerald-300 underline">{saved ? 'Update saved comparison' : 'Save comparison'}</button>
            {saved && <button type="button" aria-pressed={comparing} onClick={() => setComparing(!comparing)} className="text-sm text-emerald-300 underline">{comparing ? 'Show current study' : 'Show saved study'}</button>}
            <button type="button" onClick={() => { setComparing(false); animateToTraits(EMPTY_TRAITS); }} className="text-sm text-slate-300 underline">Reset all patterns</button>
          </div>
          {comparing && <p className="text-sm text-amber-200 mt-2" role="status">Showing your saved comparison. Move a control to return to the current study.</p>}
        </div>
        <div className="space-y-4">
          {CONTROLS.map(([key,label,hint]) => (
            <div key={key}>
              <label htmlFor={`${uid}-${key}`} className="flex justify-between gap-3 font-semibold text-sm text-slate-100">
                <span>{label}</span>
                <output className="text-emerald-300">{traitDescription(key, activeTraits[key])}</output>
              </label>
              <input
                id={`${uid}-${key}`}
                aria-label={label}
                aria-valuetext={traitDescription(key, activeTraits[key])}
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={activeTraits[key]}
                onChange={e => {
                  if (animRef.current) cancelAnimationFrame(animRef.current);
                  setComparing(false);
                  setTraits({ ...activeTraits, [key]: Number(e.target.value) });
                }}
                className="w-full accent-emerald-400 h-8"
              />
              <p className="text-xs text-slate-400">{hint}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 rounded-xl bg-slate-950 p-4"><p className="text-sm font-semibold text-white">Observe the features before choosing a name.</p><p className="text-sm text-slate-400 mt-2">These controls illustrate common visible features and their locations. They do not cover every phenotype or reproduce inheritance. Strong banding, pinning and lateral pattern interact on real animals; compare the specimens below when combining them.</p></div>
      <div className="grid sm:grid-cols-2 gap-4 mt-5 items-start">{lesson.examples.slice(0,2).map(id => <SpecimenPhoto key={id} specimen={SPECIMENS[id]} />)}</div>
    </>}
    {mode === 'practice' && <RecognitionPractice />}
    <details className="mt-6 border-t border-slate-800 pt-4 text-xs text-slate-400"><summary className="cursor-pointer text-slate-300">Sources, terminology &amp; evidence</summary><p className="mt-3">Photographs retain their original credits and source links. Descriptions concern visible features; proposed inheritance models require separate evidence. Names such as extreme, brindle and super Dalmatian are used differently across breeders.</p><p className="mt-2"><a href="https://www.pangeareptile.com/collections/harlequin" target="_blank" rel="noreferrer" className="text-emerald-300 underline">Pangea: lateral coverage</a> · <a href="https://www.pangeareptile.com/collections/pinstripe" target="_blank" rel="noreferrer" className="text-emerald-300 underline">Pangea: pinstripe</a> · <a href="https://lmreptiles.com/fg-pt2-1/" target="_blank" rel="noreferrer" className="text-emerald-300 underline">LIL MONSTERS: specimen library and breeder model</a></p></details>
    <div hidden>{['side','top'].flatMap(v => ['base','cream','pin','tiger','spots'].map(t => <img key={v+t} src={traitAsset(v,t)} alt="" />))}</div>
  </section>;
}

