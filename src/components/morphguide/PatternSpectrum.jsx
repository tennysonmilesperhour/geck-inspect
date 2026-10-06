import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { captureEvent } from '@/lib/posthog';
import TraitGecko, { traitAsset } from './TraitGecko';
import {
  COVERAGE_KEYFRAMES,
  PINNING_KEYFRAMES,
} from '@/components/morphguide/illustratedGeckoPresets';

/**
 * Pattern Spectrum: a slider that morphs one illustrated gecko from one
 * pattern morph into the next, so a visitor can SEE where the line between
 * Flame and Harlequin (or Partial and full Pinstripe) sits, and where
 * breeders argue about it.
 *
 * Usage:
 *   <PatternSpectrum />                       index page, starts at Flame
 *   <PatternSpectrum focusSlug="harlequin" /> on a morph page: opens the
 *                                             right tab at that morph
 *
 * Props: focusSlug, initialTrack ('coverage' | 'pinning'), initialPosition
 * (number along the track), className, showHeader (default true).
 */

export const SPECTRUM_TRACKS = {
  coverage: {
    id: 'coverage',
    tab: 'Pattern coverage',
    blurb: 'How far the cream pattern spreads, from none at all to nearly solid sides.',
    keyframes: COVERAGE_KEYFRAMES,
    stops: [
      {
        id: 'patternless-bicolor',
        name: 'Patternless',
        short: 'None',
        slugs: [{ slug: 'patternless', label: 'Patternless' }],
        look: 'A largely uniform base color without cream dorsal or flank pattern. The belly can naturally be lighter. Bicolor is a separate example with a contrasting back.',
      },
      {
        id: 'flame',
        name: 'Flame',
        short: 'Flame',
        slugs: [{ slug: 'flame', label: 'Flame' }],
        look: 'Cream stays on the back and head, with flame points along its edges. The flanks and legs stay clean base color.',
      },
      {
        id: 'harlequin',
        name: 'Harlequin',
        short: 'Harlequin',
        slugs: [{ slug: 'harlequin', label: 'Harlequin' }],
        look: 'Irregular cream climbs upward from the lower flanks and appears on the legs, while plenty of base color still shows between the marks.',
      },
      {
        id: 'extreme-harlequin',
        name: 'Extreme Harlequin',
        short: 'Extreme',
        slugs: [{ slug: 'extreme-harlequin', label: 'Extreme Harlequin' }],
        look: 'Heavy irregular cream extends beyond the middle of the flanks, with substantial patterned legs. Breeders do not share a universal percentage cutoff.',
      },
    ],
    zones: [
      { from: 0.3, to: 0.6, note: 'A faint, low-contrast back can be sold as Patternless or as a low-end Flame.' },
      { from: 1.35, to: 1.7, note: 'A few marks on the flanks: some breeders still call this a Flame, others a Harlequin.' },
      { from: 2.4, to: 2.75, note: 'There is no fixed cutoff between a heavy Harlequin and an Extreme Harlequin.' },
    ],
    defaultPos: 1,
  },
  pinning: {
    id: 'pinning',
    tab: 'Pinning',
    blurb: 'How much of the raised crest rows along the edges of the back turn cream.',
    keyframes: PINNING_KEYFRAMES,
    stops: [
      {
        id: 'no-pinning',
        name: 'No pinning',
        short: 'None',
        slugs: [],
        look: 'The raised scales along the edges of the back are the same color as the body. No cream line.',
      },
      {
        id: 'partial-pinstripe',
        name: 'Partial Pinstripe',
        short: 'Partial',
        slugs: [],
        look: 'Cream raised scales along part of the crest rows, usually broken up. Sellers grade it by percentage, like 50% pinning.',
      },
      {
        id: 'pinstripe',
        name: 'Pinstripe (full)',
        short: 'Full',
        slugs: [{ slug: 'pinstripe', label: 'Pinstripe' }],
        look: 'An unbroken cream line along both crest rows, from behind the eyes to the hips: 100% pinstripe.',
      },
    ],
    zones: [
      { from: 0.2, to: 0.5, note: 'A few cream crest scales do not make a Pinstripe. Many Harlequins show some.' },
      { from: 1.6, to: 1.88, note: 'Some sellers call 80% and up a full Pinstripe; others only count an unbroken line.' },
    ],
    note: {
      slug: 'phantom-pinstripe',
      name: 'Phantom Pinstripe',
      text: 'Same raised crest scales, but they stay body colored instead of cream. Look for the line in the shape of the scales, not the color.',
    },
    defaultPos: 2,
  },
};

const TRACK_IDS = Object.keys(SPECTRUM_TRACKS);

/** The track and position whose stop links to `slug`, if any. */
export function spectrumPositionFor(slug) {
  for (const id of TRACK_IDS) {
    const idx = SPECTRUM_TRACKS[id].stops.findIndex((s) => s.slugs.some((l) => l.slug === slug));
    if (idx >= 0) return { track: id, pos: idx };
  }
  if (slug === 'phantom-pinstripe') return { track: 'pinning', pos: 2 };
  return null;
}

const CONTROLS = [
  ['dorsal', 'Dorsal cream', 'Cream within the back, separate from raised crest scales.'],
  ['lateral', 'Flank & leg pattern', 'Irregular cream rises from the lower flanks; compare the side view.'],
  ['pinstripe', 'Pinstripe continuity', 'Only the raised dorsal crest rows change. Compare the top view.'],
  ['tiger', 'Dark band contrast', 'Broken transverse bands, independent of cream coverage.'],
  ['spots', 'Dalmatian spotting', 'Sparse to dense: add discrete dark pigment spots over the other pattern.'],
];

export default function PatternSpectrum({ focusSlug, initialTrack, initialPosition, className = '', showHeader = true }) {
  const focus = spectrumPositionFor(focusSlug);
  const startingTrack = initialTrack || focus?.track || 'coverage';
  const startingPos = initialPosition ?? focus?.pos ?? 1;
  const [trackId, setTrackId] = useState(startingTrack);
  const [view, setView] = useState(startingTrack === 'pinning' ? 'top' : 'side');
  const [traits, setTraits] = useState({ dorsal: startingTrack === 'coverage' && startingPos > 0 ? 1 : 0, lateral: startingTrack === 'coverage' ? Math.max(0, (startingPos - 1) / 2) : 0, pinstripe: startingTrack === 'pinning' ? startingPos / 2 : 0, tiger: 0, spots: 0 });
  const uid = useId().replace(/:/g, '');
  const coverage = traits.lateral > .75 ? 3 : traits.lateral > 0 ? 2 : traits.dorsal > 0 ? 1 : 0;
  const stop = SPECTRUM_TRACKS[trackId].stops[trackId === 'coverage' ? coverage : traits.pinstripe === 1 ? 2 : traits.pinstripe > 0 ? 1 : 0];
  const preset = (id, pos) => {
    setTrackId(id);
    if (id === 'pinning') { setTraits(t => ({ ...t, pinstripe: pos / 2 })); setView('top'); }
    else { setTraits(t => ({ ...t, dorsal: pos > 0 ? 1 : 0, lateral: Math.max(0, (pos - 1) / 2) })); setView('side'); }
    captureEvent('morph_spectrum_scrub', { track: id, stop: pos });
  };
  return <section className={`rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6 ${className}`} aria-label="Pattern spectrum">
    {showHeader && <><p className="text-xs uppercase tracking-widest text-emerald-400">Pattern spectrum</p><h3 className="text-xl font-bold text-white mt-1">Explore the traits on one gecko</h3></>}
    <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 mt-4 items-start">
      <div><TraitGecko view={view} traits={traits} title={`${stop.name}, ${view} view`} className="rounded-xl w-full" />
        <div className="flex justify-center gap-2 mt-3">{['side', 'top'].map(v => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`rounded-full border px-4 py-2 text-sm ${view === v ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200' : 'border-slate-700 text-slate-300'}`}>{v === 'side' ? 'Side view' : 'Top view'}</button>)}</div>
        <p className="mt-3 text-sm text-slate-400">Body color stays fixed. Pinstripe affects only the two raised crest rows. Top view shows both rows; side view reveals flank and leg pattern.</p>
        <div hidden>{['side', 'top'].flatMap(v => ['base', 'cream', 'pin', 'tiger', 'spots'].map(t => <img key={v+t} src={traitAsset(v, t)} alt="" />))}</div>
      </div>
      <div className="space-y-4">{CONTROLS.map(([key, label, hint]) => <div key={key}><label htmlFor={`${uid}-${key}`} className="flex justify-between font-semibold text-sm text-slate-100"><span>{label}</span><output>{Math.round(traits[key] * 100)}%</output></label><input id={`${uid}-${key}`} aria-label={label} type="range" min="0" max="1" step=".01" value={traits[key]} onChange={e => setTraits(t => ({ ...t, [key]: Number(e.target.value) }))} className="w-full accent-emerald-400 h-8" /><p className="text-xs text-slate-400">{hint}</p></div>)}
        <button type="button" onClick={() => setTraits({ dorsal: 0, lateral: 0, pinstripe: 0, tiger: 0, spots: 0 })} className="text-sm text-emerald-300 underline">Reset all patterns</button>
      </div>
    </div>
    <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Spectrum">{TRACK_IDS.map(id => <button type="button" key={id} aria-pressed={id === trackId} onClick={() => setTrackId(id)} className={`rounded-lg px-3 py-2 text-sm ${id === trackId ? 'bg-emerald-500/20 text-emerald-200' : 'text-slate-400'}`}>{SPECTRUM_TRACKS[id].tab}</button>)}</div>
    <div className="flex flex-wrap gap-2 mt-3">{SPECTRUM_TRACKS[trackId].stops.map((s,i) => <button type="button" key={s.id} onClick={() => preset(trackId,i)} className="rounded-full border border-slate-700 px-3 py-2 text-sm text-slate-200">{s.short}</button>)}</div>
    <div className="mt-4" aria-live="polite"><h4 className="text-lg font-semibold text-white">{stop.name}</h4><p className="text-sm text-slate-300 mt-1">{stop.look}</p><div className="flex gap-3 mt-2 flex-wrap">{stop.slugs.map(l => <Link key={l.slug} to={`/MorphGuide/${l.slug}`} className="text-emerald-300 text-sm">{l.label} guide</Link>)}{trackId === 'pinning' && <Link to="/MorphGuide/phantom-pinstripe" className="text-emerald-300 text-sm">Phantom Pinstripe guide</Link>}</div></div>
    <p className="mt-4 text-xs text-slate-400">Illustrated phenotype examples, not genetic predictions. Slider percentages describe this demonstration, not breeder grading. Real animals vary; morph names overlap. This study covers common pattern components, not every inherited morph. Spotting adds a subset of this specimen’s spots; banding adjusts contrast. Neither represents every possible pattern arrangement.</p>
    <p className="mt-2 text-xs text-slate-400">Pattern placement references: <a href="https://www.pangeareptile.com/collections/harlequin" className="text-emerald-300" target="_blank" rel="noreferrer">Pangea specimen descriptions</a> and <a href="https://lmreptiles.com/foundation-genetics/" className="text-emerald-300" target="_blank" rel="noreferrer">LIL MONSTERS illustrated trait research</a>.</p>
  </section>;
}
