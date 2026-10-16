import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { captureEvent } from '@/lib/posthog';
import { MORPHS } from '@/data/morph-guide';
import TraitGecko, { traitAsset, BASE_TONES } from './TraitGecko';
import { fieldGuidePlate } from './IllustratedGecko';
import { SpecimenPhoto, RecognitionPractice } from './SpecimenStudy';
import {
  SPECIMENS,
  STUDY_LESSONS,
  MORPH_PROGRESSION_TRACKS,
  EMPTY_TRAITS,
  normalizedStudy,
  traitDescription,
} from './patternStudy';

/** Connect detail pages to an existing, relevant specimen and progression lesson. */
export function spectrumPositionFor(slug) {
  const coverage = ['flame', 'harlequin', 'extreme-harlequin'].indexOf(slug);
  if (coverage >= 0) return { track: 'coverage', pos: coverage + 1 };
  if (['bicolor', 'lilly-white', 'white-wall', 'creamsicle', 'tricolor'].includes(slug)) {
    return { track: 'coverage', pos: 2 };
  }
  if (slug === 'pinstripe') return { track: 'pinning', pos: 2 };
  if (['partial-pinstripe', 'quad-stripe', 'super-stripe'].includes(slug)) {
    return { track: 'pinning', pos: 1 };
  }
  if (
    [
      'tiger',
      'brindle',
      'extreme-brindle',
      'tiger-brindle',
      'dalmatian',
      'super-dalmatian',
      'mardi-gras',
      'confetti',
      'halloween',
    ].includes(slug)
  ) {
    return { track: 'features', pos: 0 };
  }
  if (['cappuccino', 'frappuccino', 'sable', 'axanthic', 'hypo', 'albino', 'moonglow', 'lavender'].includes(slug)) {
    return { track: 'pigment', pos: 0 };
  }
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
  { id: 'patternless', label: 'Patternless', tone: 'buckskin', traits: { dorsal: 0, lateral: 0, pinstripe: 0, tiger: 0, spots: 0 } },
  { id: 'bicolor', label: 'Bicolor', tone: 'mahogany', traits: { dorsal: 0.78, lateral: 0, pinstripe: 0.08, tiger: 0, spots: 0 } },
  { id: 'flame', label: 'Flame', tone: 'mahogany', traits: { dorsal: 0.92, lateral: 0.08, pinstripe: 0.15, tiger: 0, spots: 0 } },
  { id: 'harlequin', label: 'Harlequin', tone: 'mahogany', traits: { dorsal: 1, lateral: 0.58, pinstripe: 0.35, tiger: 0, spots: 0 } },
  { id: 'extreme-harlequin', label: 'Extreme Harlequin', tone: 'mahogany', traits: { dorsal: 1, lateral: 0.96, pinstripe: 0.75, tiger: 0, spots: 0 } },
  { id: 'pinstripe', label: 'Full Pinstripe', tone: 'mahogany', traits: { dorsal: 0.35, lateral: 0.2, pinstripe: 1, tiger: 0, spots: 0 } },
  { id: 'quad-stripe', label: 'Quad-Style Pin', tone: 'mahogany', traits: { dorsal: 0.25, lateral: 0.72, pinstripe: 1, tiger: 0, spots: 0 } },
  { id: 'tiger', label: 'Tiger', tone: 'orange', traits: { dorsal: 0.15, lateral: 0, pinstripe: 0, tiger: 0.72, spots: 0 } },
  { id: 'brindle-dal', label: 'Brindle + Spots', tone: 'buckskin', traits: { dorsal: 0.25, lateral: 0.2, pinstripe: 0.3, tiger: 0.95, spots: 0.55 } },
  { id: 'dalmatian', label: 'Dalmatian', tone: 'yellow', traits: { dorsal: 0, lateral: 0, pinstripe: 0, tiger: 0, spots: 0.52 } },
  { id: 'super-dalmatian', label: 'Super Dalmatian', tone: 'yellow', traits: { dorsal: 0.2, lateral: 0, pinstripe: 0, tiger: 0, spots: 1 } },
  { id: 'axanthic-harl', label: 'Axanthic Harlequin', tone: 'axanthic', traits: { dorsal: 0.95, lateral: 0.68, pinstripe: 0.6, tiger: 0.2, spots: 0 } },
];

const LESSON_BY_SLUG = {
  bicolor: 'flame',
  flame: 'flame',
  harlequin: 'harlequin',
  'extreme-harlequin': 'harlequin',
  creamsicle: 'harlequin',
  tricolor: 'harlequin',
  'white-wall': 'harlequin',
  pinstripe: 'pinstripe',
  'partial-pinstripe': 'pinstripe',
  'quad-stripe': 'pinstripe',
  'super-stripe': 'pinstripe',
  tiger: 'tiger',
  brindle: 'tiger',
  'extreme-brindle': 'tiger',
  'tiger-brindle': 'tiger',
  halloween: 'tiger',
  dalmatian: 'dalmatian',
  'super-dalmatian': 'dalmatian',
  'mardi-gras': 'dalmatian',
  confetti: 'dalmatian',
  'lilly-white': 'structural',
  cappuccino: 'structural',
  frappuccino: 'structural',
  sable: 'structural',
  axanthic: 'structural',
  hypo: 'structural',
  albino: 'structural',
  moonglow: 'structural',
  lavender: 'structural',
};

function smoothBlend(x) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

/**
 * Interactive Pixel-Registered Field Guide Progression & Crossfade Player.
 * Animates smoothly across our naturalist field-guide plates, keeping the
 * 3/4 dorsal-lateral gecko anatomy locked while patterns & pigments transition.
 */
export function MorphProgressionPlayer({
  trackId = 'coverage',
  initialStep = 0,
  onSelectTrack,
  showTrackPicker = false,
  onLoadInStudio,
}) {
  const track = MORPH_PROGRESSION_TRACKS.find(t => t.id === trackId) || MORPH_PROGRESSION_TRACKS[0];
  const maxIndex = Math.max(0, track.steps.length - 1);
  const [progress, setProgress] = useState(() => Math.max(0, Math.min(maxIndex, initialStep)));
  const [playing, setPlaying] = useState(false);
  const [activePin, setActivePin] = useState(0);
  const [showPins, setShowPins] = useState(true);
  const rafRef = useRef(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const uid = useId().replace(/:/g, '');

  useEffect(() => {
    const clamped = Math.max(0, Math.min(track.steps.length - 1, initialStep));
    setProgress(clamped);
    setPlaying(false);
    setActivePin(0);
  }, [track.id, initialStep, track.steps.length]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return undefined;
    }
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      return undefined;
    }
    let lastTime = performance.now();
    const speedPerSec = 0.52; // ~1.9 seconds per morph stage transition
    const tick = now => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      const next = progressRef.current + dt * speedPerSec;
      if (next >= maxIndex) {
        setProgress(0);
        progressRef.current = 0;
      } else {
        setProgress(Number(next.toFixed(3)));
        progressRef.current = next;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, maxIndex]);

  const animateProgressTo = targetIndex => {
    setPlaying(false);
    setActivePin(0);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      setProgress(targetIndex);
      return;
    }
    const start = progressRef.current;
    const dist = Math.abs(targetIndex - start);
    if (dist < 0.005) {
      setProgress(targetIndex);
      return;
    }
    const duration = Math.min(650, Math.max(260, dist * 280));
    const startTime = performance.now();
    const step = now => {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      const val = Number((start + (targetIndex - start) * ease).toFixed(3));
      setProgress(val);
      progressRef.current = val;
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const lowerIdx = Math.min(maxIndex, Math.max(0, Math.floor(progress)));
  const upperIdx = Math.min(maxIndex, lowerIdx + 1);
  const blend = smoothBlend(progress - lowerIdx);
  const activeIdx = Math.round(progress);
  const currentStep = track.steps[activeIdx] || track.steps[0];
  const lowerStep = track.steps[lowerIdx] || track.steps[0];
  const upperStep = track.steps[upperIdx] || lowerStep;
  const pins = currentStep.pins || [];
  const selectedPin = pins[activePin] || pins[0];

  return (
    <div className="rounded-xl border border-slate-700/90 bg-slate-950 overflow-hidden">
      {showTrackPicker && (
        <div className="border-b border-slate-800 bg-slate-900/70 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300 mb-2">
            Select a morph progression sequence
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Progression sequences">
            {MORPH_PROGRESSION_TRACKS.map(item => (
              <button
                key={item.id}
                type="button"
                aria-pressed={track.id === item.id}
                onClick={() => onSelectTrack?.(item.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  track.id === item.id
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                    : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                }`}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 sm:p-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
            Field guide progression · {track.title}
          </span>
          <h5 className="text-base sm:text-lg font-bold text-white leading-snug">
            {currentStep.label}{' '}
            <span className="text-xs font-normal text-slate-400">({currentStep.stage})</span>
          </h5>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={playing}
            onClick={() => setPlaying(p => !p)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              playing
                ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                : 'border-emerald-400 bg-emerald-400 text-slate-950 hover:bg-emerald-300'
            }`}
          >
            {playing ? 'Pause transition' : 'Animate transition'}
          </button>
          <button
            type="button"
            aria-pressed={showPins}
            onClick={() => setShowPins(s => !s)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white"
          >
            {showPins ? 'Hide callouts' : 'Show callouts'}
          </button>
        </div>
      </div>

      {/* Pixel-aligned cross-dissolve viewport */}
      <div className="relative bg-[#f4efdf]" style={{ aspectRatio: '3/2' }}>
        <img
          src={fieldGuidePlate(lowerStep.slug)}
          alt={`${lowerStep.label} field guide plate`}
          width="1264"
          height="848"
          className="block w-full h-full object-contain select-none"
        />
        {upperIdx !== lowerIdx && blend > 0.001 && (
          <img
            src={fieldGuidePlate(upperStep.slug)}
            alt=""
            aria-hidden="true"
            width="1264"
            height="848"
            style={{ opacity: blend }}
            className="pointer-events-none absolute inset-0 block w-full h-full object-contain select-none"
          />
        )}

        {/* Transition blend badge */}
        <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-[#564c3d]/25 bg-[#f4efdf]/90 px-2.5 py-1 text-[11px] font-semibold text-[#3f362a] shadow-sm">
          {upperIdx !== lowerIdx && blend > 0.08 && blend < 0.92
            ? `Transitioning: ${lowerStep.label} to ${upperStep.label} (${Math.round(blend * 100)}%)`
            : `Plate: ${currentStep.label}`}
        </div>

        {/* Anatomical callout pins */}
        {showPins && pins.length > 0 && (
          <>
            <svg
              className="pointer-events-none absolute inset-0 w-full h-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {pins.map((p, i) => (
                <g key={p.title}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={activePin === i ? '3.2' : '2.2'}
                    fill={activePin === i ? 'rgba(16, 185, 129, 0.25)' : 'rgba(15, 23, 42, 0.15)'}
                    stroke={activePin === i ? '#059669' : '#334155'}
                    strokeWidth="0.6"
                  />
                </g>
              ))}
            </svg>
            {pins.map((p, i) => (
              <button
                key={p.title}
                type="button"
                onClick={() => setActivePin(i)}
                aria-label={`Diagnostic callout ${i + 1}: ${p.title}`}
                aria-pressed={activePin === i}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full grid place-items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500"
              >
                <span
                  className={`grid place-items-center w-6 h-6 rounded-full border-2 border-white text-xs font-bold shadow-md transition-transform ${
                    activePin === i
                      ? 'bg-emerald-500 text-slate-950 scale-110'
                      : 'bg-slate-950/85 text-white hover:scale-105'
                  }`}
                >
                  {i + 1}
                </span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* Stage pills & continuous scrub bar */}
      <div className="p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${track.title} stages`}>
          {track.steps.map((stepItem, idx) => (
            <button
              key={stepItem.slug}
              type="button"
              aria-pressed={activeIdx === idx}
              onClick={() => animateProgressTo(idx)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                activeIdx === idx
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                  : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
              }`}
            >
              {idx + 1}. {stepItem.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor={`${uid}-scrub`} className="text-xs font-medium text-slate-400 shrink-0">
            Scrub transition
          </label>
          <input
            id={`${uid}-scrub`}
            aria-label="Scrub morph progression transition"
            type="range"
            min="0"
            max={maxIndex}
            step="0.01"
            value={progress}
            onChange={e => {
              setPlaying(false);
              const val = Number(e.target.value);
              setProgress(val);
              progressRef.current = val;
            }}
            className="w-full accent-emerald-400 h-6 cursor-pointer"
          />
        </div>

        <div className="rounded-lg border border-slate-800/90 bg-slate-900/70 p-3">
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{currentStep.note}</p>
          {showPins && selectedPin && (
            <p className="mt-2 text-xs text-emerald-300 leading-relaxed">
              <span className="font-semibold">Callout {activePin + 1} ({selectedPin.title}):</span>{' '}
              {selectedPin.detail}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs">
            <Link
              to={`/MorphGuide/${currentStep.slug}`}
              className="font-semibold text-emerald-300 underline underline-offset-2"
            >
              Read the {currentStep.label} guide
            </Link>
            {onLoadInStudio && (
              <button
                type="button"
                onClick={() => onLoadInStudio(currentStep)}
                className="font-semibold text-slate-300 hover:text-white underline underline-offset-2"
              >
                Open {currentStep.label} in Pattern Studio
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Any-to-Any Morph Crossfade Comparator (compares any 2 of all 36 morph plates).
 */
export function CustomMorphComparator({ initialA = 'flame', initialB = 'extreme-harlequin' }) {
  const [morphA, setMorphA] = useState(initialA);
  const [morphB, setMorphB] = useState(initialB);
  const [mix, setMix] = useState(0.5);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef(null);
  const mixRef = useRef(mix);
  mixRef.current = mix;
  const uid = useId().replace(/:/g, '');

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return undefined;
    }
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      return undefined;
    }
    const startTime = performance.now();
    const tick = now => {
      const elapsed = (now - startTime) / 1000;
      const next = Number((0.5 - 0.5 * Math.cos(elapsed * 1.6)).toFixed(3));
      setMix(next);
      mixRef.current = next;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  const recordA = MORPHS.find(m => m.slug === morphA) || MORPHS[0];
  const recordB = MORPHS.find(m => m.slug === morphB) || MORPHS[1];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
            Direct A / B plate comparator
          </p>
          <h5 className="text-lg font-bold text-white mt-0.5">
            Crossfade any two morphs in the field guide
          </h5>
        </div>
        <button
          type="button"
          aria-pressed={playing}
          onClick={() => setPlaying(p => !p)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            playing
              ? 'border-amber-400 bg-amber-500/20 text-amber-200'
              : 'border-emerald-400 bg-emerald-400 text-slate-950 hover:bg-emerald-300'
          }`}
        >
          {playing ? 'Pause crossfade' : 'Auto-crossfade A and B'}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${uid}-morph-a`} className="block text-xs font-semibold text-slate-300 mb-1">
            Morph A (0%)
          </label>
          <select
            id={`${uid}-morph-a`}
            value={morphA}
            onChange={e => setMorphA(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            {MORPHS.map(m => (
              <option key={m.slug} value={m.slug}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${uid}-morph-b`} className="block text-xs font-semibold text-slate-300 mb-1">
            Morph B (100%)
          </label>
          <select
            id={`${uid}-morph-b`}
            value={morphB}
            onChange={e => setMorphB(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            {MORPHS.map(m => (
              <option key={m.slug} value={m.slug}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-[#f4efdf]" style={{ aspectRatio: '3/2' }}>
        <img
          src={fieldGuidePlate(recordA.slug)}
          alt={`${recordA.name} field guide plate`}
          width="1264"
          height="848"
          className="block w-full h-full object-contain select-none"
        />
        <img
          src={fieldGuidePlate(recordB.slug)}
          alt={`${recordB.name} field guide plate`}
          width="1264"
          height="848"
          style={{ opacity: mix }}
          className="pointer-events-none absolute inset-0 block w-full h-full object-contain select-none"
        />
        <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-[#564c3d]/25 bg-[#f4efdf]/90 px-3 py-1 text-xs font-semibold text-[#3f362a]">
          {recordA.name} ({Math.round((1 - mix) * 100)}%) / {recordB.name} ({Math.round(mix * 100)}%)
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setMix(0);
          }}
          className="text-xs font-semibold text-slate-300 hover:text-white shrink-0"
        >
          100% {recordA.name}
        </button>
        <input
          aria-label={`Crossfade between ${recordA.name} and ${recordB.name}`}
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={mix}
          onChange={e => {
            setPlaying(false);
            setMix(Number(e.target.value));
          }}
          className="w-full accent-emerald-400 h-6 cursor-pointer"
        />
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setMix(1);
          }}
          className="text-xs font-semibold text-slate-300 hover:text-white shrink-0"
        >
          100% {recordB.name}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
          <div className="font-bold text-white text-sm">{recordA.name}</div>
          <p className="text-slate-300 mt-1 leading-relaxed">{recordA.summary || recordA.description}</p>
          <Link to={`/MorphGuide/${recordA.slug}`} className="inline-block mt-2 text-emerald-300 underline">
            Open {recordA.name} guide
          </Link>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
          <div className="font-bold text-white text-sm">{recordB.name}</div>
          <p className="text-slate-300 mt-1 leading-relaxed">{recordB.summary || recordB.description}</p>
          <Link to={`/MorphGuide/${recordB.slug}`} className="inline-block mt-2 text-emerald-300 underline">
            Open {recordB.name} guide
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PatternSpectrum({ focusSlug, initialTrack, initialPosition, className = '', showHeader = true }) {
  const mappedLessonId = LESSON_BY_SLUG[focusSlug] || focusSlug;
  const initialLesson =
    STUDY_LESSONS.find(l => l.id === mappedLessonId) ||
    STUDY_LESSONS[initialTrack === 'pinning' ? 2 : 0];

  const [lessonId, setLessonId] = useState(initialLesson.id);
  const [mode, setMode] = useState('learn');
  const [view, setView] = useState(initialLesson.view);
  const [traits, setTraits] = useState(() =>
    normalizedStudy(
      initialPosition !== undefined && initialTrack === 'pinning'
        ? { pinstripe: initialPosition / 2 }
        : initialLesson.traits
    )
  );
  const [tone, setTone] = useState('buckskin');
  const [fired, setFired] = useState(1);
  const [showRegions, setShowRegions] = useState(false);
  const [saved, setSaved] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [transitionTrackId, setTransitionTrackId] = useState(initialLesson.trackId || 'coverage');
  const [studioAnimMode, setStudioAnimMode] = useState(null); // 'traits' | 'firing' | null
  const animRef = useRef(null);
  const studioLoopRef = useRef(null);
  const traitsRef = useRef(traits);
  traitsRef.current = traits;
  const uid = useId().replace(/:/g, '');
  const lesson = STUDY_LESSONS.find(l => l.id === lessonId) || STUDY_LESSONS[0];
  const activeTraits = comparing && saved ? saved : traits;

  useEffect(() => () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (studioLoopRef.current) cancelAnimationFrame(studioLoopRef.current);
  }, []);

  // Studio auto-animation for firing cycle or sequential trait build
  useEffect(() => {
    if (!studioAnimMode) {
      if (studioLoopRef.current) cancelAnimationFrame(studioLoopRef.current);
      return undefined;
    }
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      return undefined;
    }
    const startTime = performance.now();
    const startTraits = { ...traitsRef.current };
    const hasAnyTrait = Object.values(startTraits).some(v => v > 0.1);
    const targetTraits = hasAnyTrait
      ? startTraits
      : { dorsal: 1, lateral: 0.78, pinstripe: 1, tiger: 0.45, spots: 0.55 };

    const tick = now => {
      const elapsed = (now - startTime) / 1000;
      if (studioAnimMode === 'firing') {
        const nextFired = Number((0.5 + 0.5 * Math.cos(elapsed * 1.8)).toFixed(3));
        setFired(nextFired);
        studioLoopRef.current = requestAnimationFrame(tick);
      } else if (studioAnimMode === 'traits') {
        const duration = 2.6;
        const p = Math.min(1, elapsed / duration);
        const stageWindow = (idx, total) => {
          const start = (idx / total) * 0.65;
          return smoothBlend((p - start) / 0.35);
        };
        const keys = ['dorsal', 'lateral', 'pinstripe', 'tiger', 'spots'];
        const next = {};
        keys.forEach((k, idx) => {
          next[k] = Number((targetTraits[k] * stageWindow(idx, keys.length)).toFixed(3));
        });
        setTraits(next);
        traitsRef.current = next;
        if (p < 1) {
          studioLoopRef.current = requestAnimationFrame(tick);
        } else {
          setStudioAnimMode(null);
        }
      }
    };
    studioLoopRef.current = requestAnimationFrame(tick);
    return () => {
      if (studioLoopRef.current) cancelAnimationFrame(studioLoopRef.current);
    };
  }, [studioAnimMode]);

  const animateToTraits = (targetInput, nextTone) => {
    setStudioAnimMode(null);
    if (nextTone && BASE_TONES[nextTone]) setTone(nextTone);
    const target = normalizedStudy(targetInput);
    const start = { ...traitsRef.current };
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      setTraits(target);
      return;
    }
    const startTime = performance.now();
    const duration = 340;
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
    if (l.trackId) setTransitionTrackId(l.trackId);
    setComparing(false);
    animateToTraits(l.traits);
    captureEvent('morph_spectrum_scrub', { track: l.id, placement: mode });
  };

  return (
    <section
      className={`rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6 ${className}`}
      aria-label="Pattern spectrum"
    >
      {showHeader && (
        <>
          <p className="text-xs uppercase tracking-widest text-emerald-400">The field notebook</p>
          <h3 className="text-xl sm:text-2xl font-bold text-white mt-1">Learn to see the pattern</h3>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl">
            Start with real specimens and naturalist field-guide plates. Animate how traits progress across the body, combine features in the pattern studio, then test your eye.
          </p>
        </>
      )}

      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 my-5" role="group" aria-label="Study mode">
        {[
          ['learn', '1 · Guided observations'],
          ['explore', '2 · Pattern studio'],
          ['practice', '3 · Test your eye'],
          ['transitions', '4 · Animated transitions'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={mode === id}
            onClick={() => {
              setStudioAnimMode(null);
              setMode(id);
            }}
            className={`rounded-lg px-3 py-2.5 text-sm font-semibold border transition-colors ${
              mode === id
                ? 'bg-emerald-500/15 border-emerald-500/70 text-emerald-200'
                : 'border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {(mode === 'learn' || mode === 'explore') && (
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-5" role="group" aria-label="Study topics">
          {STUDY_LESSONS.map(l => (
            <button
              key={l.id}
              type="button"
              aria-pressed={lessonId === l.id}
              onClick={() => chooseLesson(l)}
              className={`text-left rounded-lg px-3 py-2 border transition-colors ${
                lessonId === l.id
                  ? 'border-emerald-500/50 bg-slate-950 text-white'
                  : 'border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <span className="block text-sm font-semibold">{l.title}</span>
              <span className="block text-[11px] mt-1">{l.subtitle}</span>
            </button>
          ))}
        </div>
      )}

      {mode === 'learn' && (
        <div>
          <div className="grid lg:grid-cols-[.9fr_1.1fr] gap-6 items-start">
            <div>
              <p className="text-xs uppercase tracking-widest text-emerald-300">Where to look</p>
              <h4 className="text-2xl font-semibold text-white mt-2">{lesson.subtitle}</h4>
              <p className="text-slate-200 mt-3 leading-relaxed">{lesson.look}</p>
              <p className="text-sm text-slate-400 mt-3 leading-relaxed">{lesson.distinction}</p>
              <div className="mt-5 rounded-xl overflow-hidden border border-slate-800">
                <TraitGecko
                  view={lesson.view}
                  traits={normalizedStudy(lesson.traits)}
                  focus={lesson.region}
                  annotate
                  title={`${lesson.subtitle}: anatomical region study`}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Illustrated region study · compare with the animated field-guide progression and actual specimens.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMode('explore');
                    chooseLesson(lesson);
                  }}
                  className="rounded-lg bg-emerald-400 text-slate-950 font-semibold px-4 py-2 text-sm"
                >
                  Explore this feature in studio
                </button>
                <Link to={`/MorphGuide/${lesson.guide}`} className="text-sm text-emerald-300 underline">
                  Read the {lesson.guide.replaceAll('-', ' ')} guide
                </Link>
              </div>
            </div>

            <div className="space-y-5">
              <MorphProgressionPlayer
                key={`${lesson.id}-prog`}
                trackId={lesson.trackId || 'coverage'}
                initialStep={lesson.defaultStep || 0}
                onLoadInStudio={stepObj => {
                  setMode('explore');
                  animateToTraits(stepObj.traits, stepObj.tone);
                }}
              />
              <SpecimenPhoto key={lesson.examples[0]} specimen={SPECIMENS[lesson.examples[0]]} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-5 items-start">
            {lesson.examples.slice(1).map(id => (
              <SpecimenPhoto key={id} specimen={SPECIMENS[id]} />
            ))}
          </div>
        </div>
      )}

      {mode === 'explore' && (
        <>
          <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Morph combinations &amp; presets
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={studioAnimMode === 'traits'}
                  onClick={() => setStudioAnimMode(m => (m === 'traits' ? null : 'traits'))}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    studioAnimMode === 'traits'
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                  }`}
                >
                  {studioAnimMode === 'traits' ? 'Stop layer animation' : 'Animate layer build'}
                </button>
                <button
                  type="button"
                  aria-pressed={studioAnimMode === 'firing'}
                  onClick={() => setStudioAnimMode(m => (m === 'firing' ? null : 'firing'))}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    studioAnimMode === 'firing'
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-200'
                  }`}
                >
                  {studioAnimMode === 'firing' ? 'Stop firing cycle' : 'Animate firing cycle'}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Morph presets">
              {STUDIO_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setComparing(false);
                    animateToTraits(preset.traits, preset.tone);
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
              <TraitGecko
                view={view}
                traits={activeTraits}
                tone={tone}
                fired={fired}
                focus={lesson.region}
                annotate={showRegions}
                title={`Combined pattern study, ${view} view`}
                className="rounded-xl w-full border border-slate-800"
              />
              <div className="flex justify-center flex-wrap gap-2 mt-3">
                {['side', 'top'].map(v => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                    className={`rounded-full border px-4 py-2 text-sm ${
                      view === v
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                        : 'border-slate-700 text-slate-300'
                    }`}
                  >
                    {v === 'side' ? 'Side view (3/4 field plate)' : 'Top view (dorsal saddle)'}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={showRegions}
                  onClick={() => setShowRegions(!showRegions)}
                  className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-300"
                >
                  {showRegions ? 'Hide' : 'Show'} regions
                </button>
              </div>

              <div className="mt-3 rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Base ground tone
                  </span>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Base ground tone">
                    {Object.entries(BASE_TONES).map(([id, info]) => (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={tone === id}
                        onClick={() => setTone(id)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          tone === id
                            ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                            : 'border-slate-700 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        {info.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-3">
                  <label htmlFor={`${uid}-fired`} className="text-xs font-medium text-slate-300 shrink-0">
                    Firing state:{' '}
                    <span className="text-emerald-300">
                      {fired > 0.75 ? 'Fired up' : fired > 0.3 ? 'Mid-fire' : 'Fired down'}
                    </span>
                  </label>
                  <input
                    id={`${uid}-fired`}
                    aria-label="Firing state"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={fired}
                    onChange={e => {
                      if (studioAnimMode === 'firing') setStudioAnimMode(null);
                      setFired(Number(e.target.value));
                    }}
                    className="w-full accent-emerald-400 h-6"
                  />
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                The two drawings show the same trait settings across elevated 3/4 side and dorsal views; they are field-guide anatomical studies rather than a photographed individual.
              </p>
              <div className="flex flex-wrap gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setSaved({ ...traits });
                    setComparing(false);
                  }}
                  className="text-sm text-emerald-300 underline"
                >
                  {saved ? 'Update saved comparison' : 'Save comparison'}
                </button>
                {saved && (
                  <button
                    type="button"
                    aria-pressed={comparing}
                    onClick={() => setComparing(!comparing)}
                    className="text-sm text-emerald-300 underline"
                  >
                    {comparing ? 'Show current study' : 'Show saved study'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setComparing(false);
                    animateToTraits(EMPTY_TRAITS);
                  }}
                  className="text-sm text-slate-300 underline"
                >
                  Reset all patterns
                </button>
              </div>
              {comparing && (
                <p className="text-sm text-amber-200 mt-2" role="status">
                  Showing your saved comparison. Move a control to return to the current study.
                </p>
              )}
            </div>

            <div className="space-y-4">
              {CONTROLS.map(([key, label, hint]) => (
                <div key={key}>
                  <label
                    htmlFor={`${uid}-${key}`}
                    className="flex justify-between gap-3 font-semibold text-sm text-slate-100"
                  >
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
                      if (studioAnimMode === 'traits') setStudioAnimMode(null);
                      setComparing(false);
                      setTraits({ ...activeTraits, [key]: Number(e.target.value) });
                    }}
                    className="w-full accent-emerald-400 h-8"
                  />
                  <p className="text-xs text-slate-400">{hint}</p>
                </div>
              ))}

              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 text-xs space-y-1.5">
                <div className="font-semibold uppercase tracking-wider text-emerald-300">
                  Live field-note readout
                </div>
                <p className="text-slate-300 leading-relaxed">
                  <span className="font-semibold text-white">Base &amp; state:</span>{' '}
                  {BASE_TONES[tone]?.label || 'Buckskin'} ground ({fired > 0.75 ? 'fired up' : fired > 0.3 ? 'mid-fire' : 'fired down'}).
                </p>
                <p className="text-slate-300 leading-relaxed">
                  <span className="font-semibold text-white">Dorsal &amp; flank:</span>{' '}
                  Dorsal coverage is {traitDescription('dorsal', activeTraits.dorsal).toLowerCase()}; lateral and limb coverage is {traitDescription('lateral', activeTraits.lateral).toLowerCase()}.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  <span className="font-semibold text-white">Crests, bands &amp; spots:</span>{' '}
                  Pinning is {traitDescription('pinstripe', activeTraits.pinstripe).toLowerCase()}; dark banding is {traitDescription('tiger', activeTraits.tiger).toLowerCase()}; spotting is {traitDescription('spots', activeTraits.spots).toLowerCase()}.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl bg-slate-950 p-4">
            <p className="text-sm font-semibold text-white">Observe the features before choosing a name.</p>
            <p className="text-sm text-slate-400 mt-2">
              These controls illustrate common visible features and their locations. They do not cover every phenotype or reproduce inheritance. Strong banding, pinning and lateral pattern interact on real animals; compare the specimens below when combining them.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mt-5 items-start">
            {lesson.examples.slice(0, 2).map(id => (
              <SpecimenPhoto key={id} specimen={SPECIMENS[id]} />
            ))}
          </div>
        </>
      )}

      {mode === 'practice' && <RecognitionPractice />}

      {mode === 'transitions' && (
        <div className="space-y-6">
          <MorphProgressionPlayer
            trackId={transitionTrackId}
            initialStep={0}
            showTrackPicker
            onSelectTrack={setTransitionTrackId}
            onLoadInStudio={stepObj => {
              setMode('explore');
              animateToTraits(stepObj.traits, stepObj.tone);
            }}
          />
          <CustomMorphComparator />
        </div>
      )}

      <details className="mt-6 border-t border-slate-800 pt-4 text-xs text-slate-400">
        <summary className="cursor-pointer text-slate-300">Sources, terminology &amp; evidence</summary>
        <p className="mt-3">
          Photographs retain their original credits and source links. Descriptions concern visible features; proposed inheritance models require separate evidence. Names such as extreme, brindle and super Dalmatian are used differently across breeders.
        </p>
        <p className="mt-2">
          <a href="https://www.pangeareptile.com/collections/harlequin" target="_blank" rel="noreferrer" className="text-emerald-300 underline">
            Pangea: lateral coverage
          </a>{' '}
          ·{' '}
          <a href="https://www.pangeareptile.com/collections/pinstripe" target="_blank" rel="noreferrer" className="text-emerald-300 underline">
            Pangea: pinstripe
          </a>{' '}
          ·{' '}
          <a href="https://lmreptiles.com/fg-pt2-1/" target="_blank" rel="noreferrer" className="text-emerald-300 underline">
            LIL MONSTERS: specimen library and breeder model
          </a>
        </p>
      </details>
      <div hidden>
        {['side', 'top'].flatMap(v =>
          ['base', 'cream', 'pin', 'tiger', 'spots'].map(t => <img key={v + t} src={traitAsset(v, t)} alt="" />)
        )}
      </div>
    </section>
  );
}
