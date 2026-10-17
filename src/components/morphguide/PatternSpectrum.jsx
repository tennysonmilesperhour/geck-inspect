import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { captureEvent } from '@/lib/posthog';
import { MORPHS } from '@/data/morph-guide';
import TraitGecko, { BASE_TONES, BASE_TONE_GROUPS } from './TraitGecko';
import { fieldGuidePlate, hasIllustration } from './IllustratedGecko';
import { SpecimenPhoto, RecognitionPractice } from './SpecimenStudy';
import {
  SPECIMENS,
  STUDY_LESSONS,
  MORPH_PROGRESSION_TRACKS,
  EMPTY_STUDIO_TRAITS,
  normalizedStudioTraits,
  traitDescription,
} from './patternStudy';

// Lives in its own small file so a morph page can check it without
// downloading the studio; re-exported here for existing callers.
export { spectrumPositionFor } from './spectrumPosition';

export const STUDIO_CONTROL_GROUPS = [
  {
    id: 'dorsal-structure',
    title: 'Dorsal & Crest Structure',
    subtitle: 'Back saddle, crest ridges & Empty Back clearing',
    controls: [
      ['dorsal', 'Dorsal pattern', 'Flame, bicolor, and dorsal saddle coverage between the crest rows.'],
      ['pinstripe', 'Pinstripe continuity', 'Individual highlighted scales along the raised left and right dorsal ridges.'],
      ['emptyBack', 'Empty Back clearing', 'Clears busy dorsal flame blotching to open a smooth dorsal corridor.'],
    ],
  },
  {
    id: 'flank-banding',
    title: 'Flank, Wall & Banding',
    subtitle: 'Lateral harlequin, structural white walls & dark tiger/brindle',
    controls: [
      ['lateral', 'Flank & leg pattern', 'Irregular harlequin patches rising up the sides and wrapping the limbs.'],
      ['whitewall', 'White Wall & lateral bars', 'Thick structural cream-white lateral wall and quad-stripe flank bar.'],
      ['tiger', 'Dark band contrast', 'Transverse tiger bars and broken, branching dark brindle networks.'],
    ],
  },
  {
    id: 'spotting-modifiers',
    title: 'Spotting, White Factor & Piebald',
    subtitle: 'Dalmatian spots, Whiteout/Lilly frosting & piebald patches',
    controls: [
      ['spots', 'Dalmatian spotting', 'Discrete black, red, and olive oil spots with varied size and spacing.'],
      ['whiteFactor', 'Whiteout & Lilly frosting', 'Chalk-white and porcelain-ivory expansion across dorsal and flank pattern.'],
      ['pied', 'Piebald patches', 'Sharply bordered unpigmented white body saddles and pied distal toes.'],
    ],
  },
];

export const STUDIO_PRESET_CATEGORIES = [
  { id: 'all', label: 'All morphs' },
  { id: 'coverage', label: 'Coverage & White' },
  { id: 'pinning', label: 'Pinning & Empty Back' },
  { id: 'banding', label: 'Banding & Spots' },
  { id: 'bases', label: 'Base Colors' },
  { id: 'modifiers', label: 'Dark & Recessive' },
];

export const STUDIO_PRESETS = [
  { id: 'patternless', category: 'coverage', label: 'Patternless', tone: 'buckskin', traits: { dorsal: 0, lateral: 0, pinstripe: 0, tiger: 0, spots: 0, emptyBack: 0, whitewall: 0, whiteFactor: 0, pied: 0 } },
  { id: 'bicolor', category: 'coverage', label: 'Bicolor', tone: 'mahogany', traits: { dorsal: 0.78, lateral: 0, pinstripe: 0.08, tiger: 0, spots: 0, emptyBack: 0, whitewall: 0, whiteFactor: 0, pied: 0 } },
  { id: 'flame', category: 'coverage', label: 'Flame', tone: 'mahogany', traits: { dorsal: 0.92, lateral: 0.08, pinstripe: 0.15, tiger: 0, spots: 0, emptyBack: 0, whitewall: 0, whiteFactor: 0, pied: 0 } },
  { id: 'harlequin', category: 'coverage', label: 'Harlequin', tone: 'mahogany', traits: { dorsal: 1, lateral: 0.58, pinstripe: 0.35, tiger: 0, spots: 0, emptyBack: 0, whitewall: 0, whiteFactor: 0, pied: 0 } },
  { id: 'extreme-harlequin', category: 'coverage', label: 'Extreme Harlequin', tone: 'mahogany', traits: { dorsal: 1, lateral: 0.96, pinstripe: 0.75, tiger: 0, spots: 0, emptyBack: 0, whitewall: 0, whiteFactor: 0, pied: 0 } },
  { id: 'whiteout', category: 'coverage', label: 'Whiteout', tone: 'mahogany', traits: { dorsal: 0.92, lateral: 0.76, pinstripe: 0.7, tiger: 0, spots: 0, emptyBack: 0, whitewall: 0.4, whiteFactor: 0.58, pied: 0 } },
  { id: 'super-whiteout', category: 'coverage', label: 'Super Whiteout', tone: 'mahogany', traits: { dorsal: 1, lateral: 0.96, pinstripe: 0.95, tiger: 0, spots: 0, emptyBack: 0, whitewall: 0.85, whiteFactor: 0.92, pied: 0 } },
  { id: 'lilly-white', category: 'coverage', label: 'Lilly White', tone: 'mahogany', traits: { dorsal: 1, lateral: 1, pinstripe: 1, tiger: 0, spots: 0, emptyBack: 0, whitewall: 0.75, whiteFactor: 1, pied: 0 } },
  { id: 'pinstripe', category: 'pinning', label: 'Full Pinstripe', tone: 'mahogany', traits: { dorsal: 0.35, lateral: 0.2, pinstripe: 1, tiger: 0, spots: 0, emptyBack: 0, whitewall: 0, whiteFactor: 0, pied: 0 } },
  { id: 'quad-stripe', category: 'pinning', label: 'Quad-Stripe', tone: 'mahogany', traits: { dorsal: 0.25, lateral: 0.35, pinstripe: 1, tiger: 0, spots: 0, emptyBack: 0, whitewall: 0.78, whiteFactor: 0, pied: 0 } },
  { id: 'white-wall', category: 'pinning', label: 'White Wall', tone: 'mahogany', traits: { dorsal: 0.45, lateral: 0.65, pinstripe: 1, tiger: 0, spots: 0, emptyBack: 0, whitewall: 1, whiteFactor: 0.25, pied: 0 } },
  { id: 'empty-back', category: 'pinning', label: 'Empty Back', tone: 'buckskin', traits: { dorsal: 0.2, lateral: 0.68, pinstripe: 0.5, tiger: 0, spots: 0, emptyBack: 0.75, whitewall: 0, whiteFactor: 0, pied: 0 } },
  { id: 'super-empty-back', category: 'pinning', label: 'Super Empty Back', tone: 'mahogany', traits: { dorsal: 0, lateral: 0.82, pinstripe: 1, tiger: 0, spots: 0, emptyBack: 1, whitewall: 0.25, whiteFactor: 0, pied: 0 } },
  { id: 'super-highway', category: 'pinning', label: 'Super Highway', tone: 'mahogany', traits: { dorsal: 1, lateral: 0, pinstripe: 1, tiger: 0, spots: 0, emptyBack: 0, whitewall: 0, whiteFactor: 0.3, pied: 0 } },
  { id: 'tiger', category: 'banding', label: 'Tiger', tone: 'orange', traits: { dorsal: 0.15, lateral: 0, pinstripe: 0, tiger: 0.72, spots: 0, emptyBack: 0, whitewall: 0, whiteFactor: 0, pied: 0 } },
  { id: 'extreme-brindle', category: 'banding', label: 'Extreme Brindle', tone: 'mahogany', traits: { dorsal: 0.28, lateral: 0.25, pinstripe: 0.3, tiger: 1, spots: 0, emptyBack: 0, whitewall: 0, whiteFactor: 0, pied: 0 } },
  { id: 'dalmatian', category: 'banding', label: 'Dalmatian', tone: 'yellow', traits: { dorsal: 0, lateral: 0, pinstripe: 0, tiger: 0, spots: 0.52, emptyBack: 0, whitewall: 0, whiteFactor: 0, pied: 0 } },
  { id: 'super-dalmatian', category: 'banding', label: 'Super Dalmatian', tone: 'yellow', traits: { dorsal: 0.2, lateral: 0, pinstripe: 0, tiger: 0, spots: 1, emptyBack: 0, whitewall: 0, whiteFactor: 0, pied: 0 } },
  { id: 'mardi-gras', category: 'banding', label: 'Mardi Gras Spots', tone: 'cream', traits: { dorsal: 0.22, lateral: 0.12, pinstripe: 0.1, tiger: 0, spots: 0.88, emptyBack: 0, whitewall: 0, whiteFactor: 0, pied: 0 } },
  { id: 'red-harlequin', category: 'bases', label: 'Red Base Flame', tone: 'red', traits: { dorsal: 0.88, lateral: 0.25, pinstripe: 0.3, tiger: 0, spots: 0, emptyBack: 0, whitewall: 0, whiteFactor: 0, pied: 0 } },
  { id: 'tangerine-harl', category: 'bases', label: 'Tangerine Harlequin', tone: 'orange', traits: { dorsal: 0.95, lateral: 0.72, pinstripe: 0.55, tiger: 0, spots: 0, emptyBack: 0, whitewall: 0, whiteFactor: 0, pied: 0 } },
  { id: 'chocolate-pin', category: 'bases', label: 'Chocolate Pinstripe', tone: 'chocolate', traits: { dorsal: 0.45, lateral: 0.3, pinstripe: 1, tiger: 0, spots: 0, emptyBack: 0, whitewall: 0.2, whiteFactor: 0, pied: 0 } },
  { id: 'olive-tiger', category: 'bases', label: 'Olive Brindle', tone: 'olive', traits: { dorsal: 0.25, lateral: 0.15, pinstripe: 0.2, tiger: 0.78, spots: 0, emptyBack: 0, whitewall: 0, whiteFactor: 0, pied: 0 } },
  { id: 'lavender-harl', category: 'bases', label: 'Lavender Harlequin', tone: 'lavender', traits: { dorsal: 0.88, lateral: 0.62, pinstripe: 0.65, tiger: 0.15, spots: 0, emptyBack: 0, whitewall: 0, whiteFactor: 0.2, pied: 0 } },
  { id: 'phantom', category: 'modifiers', label: 'Phantom', tone: 'phantom', traits: { dorsal: 0.1, lateral: 0.05, pinstripe: 0.25, tiger: 0.2, spots: 0, emptyBack: 0.5, whitewall: 0, whiteFactor: 0, pied: 0 } },
  { id: 'cappuccino', category: 'modifiers', label: 'Cappuccino', tone: 'cappuccino', traits: { dorsal: 0.25, lateral: 0.1, pinstripe: 0.15, tiger: 0.35, spots: 0, emptyBack: 0, whitewall: 0, whiteFactor: 0, pied: 0 } },
  { id: 'luwak', category: 'modifiers', label: 'Luwak', tone: 'sable', traits: { dorsal: 0.42, lateral: 0.08, pinstripe: 0.55, tiger: 0.25, spots: 0, emptyBack: 0, whitewall: 0, whiteFactor: 0, pied: 0 } },
  { id: 'super-sable', category: 'modifiers', label: 'Super Sable', tone: 'melanistic', traits: { dorsal: 0.05, lateral: 0, pinstripe: 0.1, tiger: 0.15, spots: 0, emptyBack: 0.85, whitewall: 0, whiteFactor: 0, pied: 0 } },
  { id: 'frappuccino', category: 'modifiers', label: 'Frappuccino', tone: 'cappuccino', traits: { dorsal: 0.95, lateral: 0.88, pinstripe: 1, tiger: 0.2, spots: 0, emptyBack: 0, whitewall: 0.65, whiteFactor: 0.85, pied: 0 } },
  { id: 'axanthic-harl', category: 'modifiers', label: 'Axanthic Harlequin', tone: 'axanthic', traits: { dorsal: 0.95, lateral: 0.68, pinstripe: 0.6, tiger: 0.2, spots: 0, emptyBack: 0, whitewall: 0, whiteFactor: 0.35, pied: 0 } },
  { id: 'pied', category: 'modifiers', label: 'Pied (Piebald)', tone: 'mahogany', traits: { dorsal: 0.65, lateral: 0.55, pinstripe: 0.5, tiger: 0, spots: 0, emptyBack: 0, whitewall: 0, whiteFactor: 0, pied: 0.88 } },
  { id: 'albino', category: 'modifiers', label: 'Albino', tone: 'albino', traits: { dorsal: 0.88, lateral: 0.55, pinstripe: 0.65, tiger: 0, spots: 0, emptyBack: 0, whitewall: 0, whiteFactor: 0.3, pied: 0 } },
];

const LESSON_BY_SLUG = {
  bicolor: 'flame',
  flame: 'flame',
  harlequin: 'harlequin',
  'extreme-harlequin': 'harlequin',
  whiteout: 'harlequin',
  'super-whiteout': 'harlequin',
  creamsicle: 'harlequin',
  tricolor: 'harlequin',
  'white-wall': 'pinstripe',
  'white-wall-white-spot': 'pinstripe',
  pinstripe: 'pinstripe',
  'partial-pinstripe': 'pinstripe',
  'quad-stripe': 'pinstripe',
  'super-stripe': 'pinstripe',
  'empty-back': 'pinstripe',
  'super-empty-back': 'pinstripe',
  highway: 'pinstripe',
  'super-highway': 'pinstripe',
  tiger: 'tiger',
  brindle: 'tiger',
  'extreme-brindle': 'tiger',
  'tiger-brindle': 'tiger',
  halloween: 'tiger',
  dalmatian: 'dalmatian',
  'super-dalmatian': 'dalmatian',
  'mardi-gras': 'dalmatian',
  confetti: 'dalmatian',
  buckskin: 'bases',
  cream: 'bases',
  'yellow-base': 'bases',
  'orange-base': 'bases',
  'orange-tangerine': 'bases',
  'red-base': 'bases',
  chocolate: 'bases',
  olive: 'bases',
  lavender: 'bases',
  'lilly-white': 'structural',
  'super-lilly-white': 'structural',
  phantom: 'structural',
  cappuccino: 'structural',
  'super-cappuccino': 'structural',
  frappuccino: 'structural',
  sable: 'structural',
  'super-sable': 'structural',
  luwak: 'structural',
  axanthic: 'structural',
  hypo: 'structural',
  albino: 'structural',
  pied: 'structural',
  moonglow: 'structural',
};

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V'];

function smoothBlend(x) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

/**
 * Places numbered callout medallions in the clean top/bottom field-guide paper
 * margins outside the gecko silhouette, with angled 2-segment leader lines
 * connecting each outer badge to its anatomical target reticle on the gecko.
 */
function computeCalloutLayout(pins = []) {
  if (!pins.length) return [];
  if (pins.length === 1) {
    const p = pins[0];
    const isUpper = p.y <= 39;
    const by = isUpper ? 11.5 : 88.5;
    const bx = isUpper
      ? Math.min(80, Math.max(54, p.x + 14))
      : Math.min(76, Math.max(24, p.x - 10));
    return [{ ...p, index: 0, bx, by, isUpper }];
  }

  const p0 = pins[0];
  const p1 = pins[1];
  let firstIsUpper;
  if (p0.x <= 28) {
    firstIsUpper = false;
  } else if (p1.x <= 28) {
    firstIsUpper = true;
  } else {
    firstIsUpper = p0.y <= p1.y;
  }

  return pins.map((p, idx) => {
    const isUpper = idx === 0 ? firstIsUpper : idx === 1 ? !firstIsUpper : false;
    const by = isUpper ? 11.5 : 88.5;
    let bx;
    if (isUpper) {
      bx = Math.min(82, Math.max(52, p.x + (p.x < 55 ? 14 : 10)));
    } else if (p.x <= 28) {
      bx = 22;
    } else {
      bx = Math.min(76, Math.max(26, p.x - 12));
    }
    return { ...p, index: idx, bx, by, isUpper };
  });
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
  const calloutLayout = computeCalloutLayout(pins);
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

        {/* Outer margin callout medallions connected by angled leader lines to target reticles */}
        {showPins && calloutLayout.length > 0 && (
          <>
            <svg
              className="pointer-events-none absolute inset-0 w-full h-full"
              viewBox="0 0 1264 848"
              aria-hidden="true"
            >
              {calloutLayout.map((item, i) => {
                const isSelected = activePin === i;
                const tx = item.x * 12.64;
                const ty = item.y * 8.48;
                const bxSvg = item.bx * 12.64;
                const bySvg = item.by * 8.48;
                const elbowOffset = bxSvg >= tx ? 44 : -44;
                const exSvg = tx + elbowOffset;
                const eySvg = bySvg;
                const dx = exSvg - tx;
                const dy = eySvg - ty;
                const dist = Math.hypot(dx, dy) || 1;
                const rTarget = isSelected ? 13 : 11;
                const sx = tx + (dx / dist) * (rTarget + 2);
                const sy = ty + (dy / dist) * (rTarget + 2);
                const strokeMain = isSelected ? '#0f766e' : '#3d3326';
                const leaderPath = `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${exSvg.toFixed(1)} ${eySvg.toFixed(1)} L ${bxSvg.toFixed(1)} ${bySvg.toFixed(1)}`;

                return (
                  <g key={item.title} data-callout-leader={i + 1}>
                    {/* Ivory paper halo under leader line for legibility across dark/light scales */}
                    <path
                      d={leaderPath}
                      fill="none"
                      stroke="#f4efdf"
                      strokeWidth="4.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.92"
                    />
                    {/* Crisp botanical/zoological leader line */}
                    <path
                      d={leaderPath}
                      fill="none"
                      stroke={strokeMain}
                      strokeWidth={isSelected ? '2.2' : '1.6'}
                      strokeDasharray={isSelected ? undefined : '5 3'}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Small diamond joint at leader elbow */}
                    <polygon
                      points={`${exSvg},${eySvg - 3.6} ${exSvg + 3.6},${eySvg} ${exSvg},${eySvg + 3.6} ${exSvg - 3.6},${eySvg}`}
                      fill={strokeMain}
                      stroke="#f4efdf"
                      strokeWidth="1"
                    />
                    {/* Open zoological target reticle on the anatomical feature (never obscures scales) */}
                    <circle
                      cx={tx}
                      cy={ty}
                      r={rTarget}
                      fill="none"
                      stroke="#f4efdf"
                      strokeWidth="4"
                      opacity="0.9"
                    />
                    <circle
                      cx={tx}
                      cy={ty}
                      r={rTarget}
                      fill={isSelected ? 'rgba(13, 148, 136, 0.10)' : 'none'}
                      stroke={strokeMain}
                      strokeWidth={isSelected ? '2.2' : '1.6'}
                    />
                    {/* 4 compass crosshair ticks around the target ring */}
                    <line x1={tx} y1={ty - rTarget - 5} x2={tx} y2={ty - rTarget + 1} stroke={strokeMain} strokeWidth="1.6" strokeLinecap="round" />
                    <line x1={tx} y1={ty + rTarget - 1} x2={tx} y2={ty + rTarget + 5} stroke={strokeMain} strokeWidth="1.6" strokeLinecap="round" />
                    <line x1={tx - rTarget - 5} y1={ty} x2={tx - rTarget + 1} y2={ty} stroke={strokeMain} strokeWidth="1.6" strokeLinecap="round" />
                    <line x1={tx + rTarget - 1} y1={ty} x2={tx + rTarget + 5} y2={ty} stroke={strokeMain} strokeWidth="1.6" strokeLinecap="round" />
                    {/* Pinpoint center dot */}
                    <circle
                      cx={tx}
                      cy={ty}
                      r="2.8"
                      fill={strokeMain}
                      stroke="#f4efdf"
                      strokeWidth="1.2"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Outer margin callout badges (positioned off the gecko body at bx, by) */}
            {calloutLayout.map((item, i) => {
              const isSelected = activePin === i;
              const roman = ROMAN_NUMERALS[i] || String(i + 1);
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setActivePin(i)}
                  aria-label={`Diagnostic callout ${i + 1}: ${item.title}`}
                  aria-pressed={isSelected}
                  style={{ left: `${item.bx}%`, top: `${item.by}%` }}
                  className={`group absolute -translate-x-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 shadow-md transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 ${
                    isSelected
                      ? 'border-[#0f766e] bg-[#1c2421] text-[#f4efdf] ring-2 ring-[#0f766e]/35 scale-[1.03]'
                      : 'border-[#564c3d]/60 bg-[#f4efdf]/95 text-[#2d251c] hover:border-[#0f766e] hover:bg-white'
                  }`}
                >
                  {/* Engraved diamond + numeral medallion */}
                  <span
                    className={`inline-flex items-center justify-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-bold tracking-wider ${
                      isSelected
                        ? 'bg-emerald-400 text-slate-950'
                        : 'bg-[#2d251c] text-[#f4efdf]'
                    }`}
                  >
                    <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 12 12" aria-hidden="true">
                      <polygon points="6,0.8 11.2,6 6,11.2 0.8,6" fill="currentColor" />
                    </svg>
                    <span>{roman}</span>
                  </span>
                  <span className="text-[11px] font-semibold tracking-tight pr-1 max-w-[11rem] sm:max-w-[14rem] truncate">
                    {item.title}
                  </span>
                </button>
              );
            })}
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
              <span className="font-semibold">
                Callout {ROMAN_NUMERALS[activePin] || activePin + 1} ({selectedPin.title}):
              </span>{' '}
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

// Every morph with a painted field guide plate can be compared directly.
const PLATE_MORPHS = MORPHS.filter(m => hasIllustration(m.slug));

/**
 * Any-to-Any Morph Crossfade Comparator (compares any 2 of the morph plates).
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

  const recordA = PLATE_MORPHS.find(m => m.slug === morphA) || PLATE_MORPHS[0];
  const recordB = PLATE_MORPHS.find(m => m.slug === morphB) || PLATE_MORPHS[1];

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
            {PLATE_MORPHS.map(m => (
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
            {PLATE_MORPHS.map(m => (
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
    normalizedStudioTraits(
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
  const [presetCategory, setPresetCategory] = useState('all');
  const [activeControlGroup, setActiveControlGroup] = useState('all');
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
      : {
          dorsal: 1,
          lateral: 0.78,
          pinstripe: 1,
          tiger: 0.45,
          spots: 0.55,
          emptyBack: 0,
          whitewall: 0.45,
          whiteFactor: 0.35,
          pied: 0,
        };

    const tick = now => {
      const elapsed = (now - startTime) / 1000;
      if (studioAnimMode === 'firing') {
        const nextFired = Number((0.5 + 0.5 * Math.cos(elapsed * 1.8)).toFixed(3));
        setFired(nextFired);
        studioLoopRef.current = requestAnimationFrame(tick);
      } else if (studioAnimMode === 'traits') {
        const duration = 2.8;
        const p = Math.min(1, elapsed / duration);
        const stageWindow = (idx, total) => {
          const start = (idx / total) * 0.65;
          return smoothBlend((p - start) / 0.35);
        };
        const keys = Object.keys(EMPTY_STUDIO_TRAITS);
        const next = {};
        keys.forEach((k, idx) => {
          next[k] = Number(((targetTraits[k] || 0) * stageWindow(idx, keys.length)).toFixed(3));
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
    const target = normalizedStudioTraits(targetInput);
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
      for (const k of Object.keys(EMPTY_STUDIO_TRAITS)) {
        next[k] = Number(((start[k] || 0) + (target[k] - (start[k] || 0)) * ease).toFixed(3));
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

  const filteredPresets =
    presetCategory === 'all'
      ? STUDIO_PRESETS
      : STUDIO_PRESETS.filter(p => p.category === presetCategory);

  const visibleControlGroups =
    activeControlGroup === 'all'
      ? STUDIO_CONTROL_GROUPS
      : STUDIO_CONTROL_GROUPS.filter(g => g.id === activeControlGroup);

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
                  traits={normalizedStudioTraits(lesson.traits)}
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
          <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Preset categories">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">
                  Morph presets:
                </span>
                {STUDIO_PRESET_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={presetCategory === cat.id}
                    onClick={() => setPresetCategory(cat.id)}
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                      presetCategory === cat.id
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
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
              {filteredPresets.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setComparing(false);
                    animateToTraits(preset.traits, preset.tone);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/50 hover:text-emerald-200 px-3 py-1 text-xs font-medium text-slate-300 transition-colors"
                >
                  <span
                    className="w-2 h-2 rounded-full border border-white/25 shrink-0"
                    style={{ backgroundColor: BASE_TONES[preset.tone]?.swatch || '#b5834a' }}
                    aria-hidden="true"
                  />
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-[1.32fr_1.08fr] gap-6 items-start">
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

              <div className="mt-3 rounded-xl border border-slate-800/80 bg-slate-950/50 p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Base ground tones ({Object.keys(BASE_TONES).length} dermal palettes)
                  </span>
                  <span className="text-xs font-semibold text-emerald-300">
                    Active: {BASE_TONES[tone]?.label || 'Buckskin'}
                  </span>
                </div>

                {BASE_TONE_GROUPS.map(group => (
                  <div key={group.id} className="space-y-1">
                    <div className="text-[11px] font-medium text-slate-400">{group.label}</div>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label={group.label}>
                      {group.tones.map(id => {
                        const info = BASE_TONES[id];
                        if (!info) return null;
                        return (
                          <button
                            key={id}
                            type="button"
                            aria-pressed={tone === id}
                            onClick={() => setTone(id)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                              tone === id
                                ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                                : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-white/30 shrink-0"
                              style={{ backgroundColor: info.swatch }}
                              aria-hidden="true"
                            />
                            {info.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div className="pt-1 flex items-center gap-3">
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
                    animateToTraits(EMPTY_STUDIO_TRAITS);
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

            <div className="space-y-3.5">
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Slider categories">
                <button
                  type="button"
                  aria-pressed={activeControlGroup === 'all'}
                  onClick={() => setActiveControlGroup('all')}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    activeControlGroup === 'all'
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  All 3 categories (9 sliders)
                </button>
                {STUDIO_CONTROL_GROUPS.map(group => (
                  <button
                    key={group.id}
                    type="button"
                    aria-pressed={activeControlGroup === group.id}
                    onClick={() => setActiveControlGroup(group.id)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                      activeControlGroup === group.id
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    {group.title}
                  </button>
                ))}
              </div>

              {visibleControlGroups.map(group => (
                <div
                  key={group.id}
                  className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-3.5 space-y-3"
                >
                  <div className="border-b border-slate-800/80 pb-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                      {group.title}
                    </div>
                    <div className="text-[11px] text-slate-400">{group.subtitle}</div>
                  </div>
                  {group.controls.map(([key, label, hint]) => (
                    <div key={key}>
                      <label
                        htmlFor={`${uid}-${key}`}
                        className="flex justify-between gap-3 font-semibold text-sm text-slate-100"
                      >
                        <span>{label}</span>
                        <output className="text-emerald-300">
                          {traitDescription(key, activeTraits[key] || 0)}
                        </output>
                      </label>
                      <input
                        id={`${uid}-${key}`}
                        aria-label={label}
                        aria-valuetext={traitDescription(key, activeTraits[key] || 0)}
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={activeTraits[key] || 0}
                        onChange={e => {
                          if (animRef.current) cancelAnimationFrame(animRef.current);
                          if (studioAnimMode === 'traits') setStudioAnimMode(null);
                          setComparing(false);
                          setTraits({ ...activeTraits, [key]: Number(e.target.value) });
                        }}
                        className="w-full accent-emerald-400 h-7"
                      />
                      <p className="text-xs text-slate-400">{hint}</p>
                    </div>
                  ))}
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
                  <span className="font-semibold text-white">Dorsal &amp; crests:</span>{' '}
                  Dorsal coverage is {traitDescription('dorsal', activeTraits.dorsal).toLowerCase()}; pinning is {traitDescription('pinstripe', activeTraits.pinstripe).toLowerCase()}; Empty Back clearing is {traitDescription('emptyBack', activeTraits.emptyBack).toLowerCase()}.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  <span className="font-semibold text-white">Flanks &amp; banding:</span>{' '}
                  Flank pattern is {traitDescription('lateral', activeTraits.lateral).toLowerCase()}; White Wall is {traitDescription('whitewall', activeTraits.whitewall).toLowerCase()}; dark banding is {traitDescription('tiger', activeTraits.tiger).toLowerCase()}.
                </p>
                <p className="text-slate-300 leading-relaxed">
                  <span className="font-semibold text-white">Spots, white &amp; pied:</span>{' '}
                  Spotting is {traitDescription('spots', activeTraits.spots).toLowerCase()}; Whiteout/Lilly frosting is {traitDescription('whiteFactor', activeTraits.whiteFactor).toLowerCase()}; piebald is {traitDescription('pied', activeTraits.pied).toLowerCase()}.
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
    </section>
  );
}
