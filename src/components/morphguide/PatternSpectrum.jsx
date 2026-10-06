import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { captureEvent } from '@/lib/posthog';
import IllustratedGecko from '@/components/morphguide/IllustratedGecko';
import {
  COVERAGE_KEYFRAMES,
  PINNING_KEYFRAMES,
  phenotypeAlong,
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
        name: 'Patternless / Bicolor',
        short: 'None',
        slugs: [{ slug: 'patternless', label: 'Patternless' }, { slug: 'bicolor', label: 'Bicolor' }],
        look: 'One solid color, or a back that is a second solid color with a clean edge. No cream points or flank marks.',
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
        look: 'Pattern climbs down the flanks and onto the legs, while plenty of base color still shows between the marks.',
      },
      {
        id: 'extreme-harlequin',
        name: 'Extreme Harlequin',
        short: 'Extreme',
        slugs: [{ slug: 'extreme-harlequin', label: 'Extreme Harlequin' }],
        look: 'Near-solid cream panels cover most of the flanks and legs, roughly 60 to 70% or more.',
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

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function trackCta(target, track) {
  captureEvent('morph_guide_cta_clicked', { target, placement: 'spectrum', track });
}

export default function PatternSpectrum({
  focusSlug,
  initialTrack,
  initialPosition,
  className = '',
  showHeader = true,
}) {
  const focus = focusSlug ? spectrumPositionFor(focusSlug) : null;
  const startTrack = SPECTRUM_TRACKS[initialTrack] ? initialTrack : focus?.track || 'coverage';
  const startPos = Number.isFinite(initialPosition)
    ? initialPosition
    : focus && focus.track === startTrack ? focus.pos : SPECTRUM_TRACKS[startTrack].defaultPos;

  const [trackId, setTrackId] = useState(startTrack);
  const [pos, setPos] = useState(startPos);
  const track = SPECTRUM_TRACKS[trackId];
  const max = track.stops.length - 1;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

  // ---- Smooth glide to a stop when a stop is tapped.
  const animRef = useRef(null);
  const posRef = useRef(pos);
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);
  const stopAnim = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = null;
  };
  useEffect(() => stopAnim, []);

  const glideTo = useCallback((target) => {
    stopAnim();
    const from = posRef.current;
    if (prefersReducedMotion() || Math.abs(target - from) < 0.001) {
      setPos(target);
      return;
    }
    const dur = 380 + 160 * Math.abs(target - from);
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      setPos(from + (target - from) * easeInOut(t));
      animRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    animRef.current = requestAnimationFrame(step);
  }, []);

  // ---- Analytics: one event per pause in scrubbing, not one per pixel.
  const stopIdx = Math.round(pos);
  const stop = track.stops[stopIdx];
  const touched = useRef(false);
  useEffect(() => {
    if (!touched.current) return undefined;
    const t = setTimeout(() => {
      captureEvent('morph_spectrum_scrub', { track: trackId, stop: stop.id });
    }, 700);
    return () => clearTimeout(t);
  }, [trackId, stop.id]);

  const onSlider = (e) => {
    touched.current = true;
    stopAnim();
    setPos(Number(e.target.value));
  };
  // Native range steps are 0.01 (smooth dragging), which is far too fine
  // for the keyboard, so arrows move a quarter stop and Page keys a stop.
  const onSliderKey = (e) => {
    const cur = posRef.current;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(max, Math.round((cur + 0.25) * 4) / 4);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(0, Math.round((cur - 0.25) * 4) / 4);
    if (e.key === 'PageUp') next = Math.min(max, Math.floor(cur + 1.001));
    if (e.key === 'PageDown') next = Math.max(0, Math.ceil(cur - 1.001));
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = max;
    if (next === null) return;
    e.preventDefault();
    touched.current = true;
    stopAnim();
    setPos(next);
  };
  const onStop = (i) => {
    touched.current = true;
    glideTo(i);
  };
  const onTab = (id) => {
    if (id === trackId) return;
    touched.current = true;
    stopAnim();
    setTrackId(id);
    setPos(SPECTRUM_TRACKS[id].defaultPos);
  };
  const onTabKey = (e) => {
    const i = TRACK_IDS.indexOf(trackId);
    let next = null;
    if (e.key === 'ArrowRight') next = TRACK_IDS[(i + 1) % TRACK_IDS.length];
    if (e.key === 'ArrowLeft') next = TRACK_IDS[(i - 1 + TRACK_IDS.length) % TRACK_IDS.length];
    if (next) {
      e.preventDefault();
      onTab(next);
      document.getElementById(`${uid}-tab-${next}`)?.focus();
    }
  };

  const phenotype = useMemo(() => phenotypeAlong(track.keyframes, pos), [track, pos]);
  const zone = track.zones.find((z) => pos >= z.from && pos <= z.to);
  const pct = (v) => `${(v / max) * 100}%`;

  return (
    <section
      className={`rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden ${className}`}
      aria-labelledby={showHeader ? `${uid}-title` : undefined}
      aria-label={showHeader ? undefined : 'Pattern spectrum'}
    >
      {showHeader && (
        <div className="px-4 sm:px-6 pt-4 sm:pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-400">Pattern spectrum</p>
          <h3 id={`${uid}-title`} className="mt-1 text-lg sm:text-xl font-bold text-white">
            Slide from one morph to the next
          </h3>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 sm:px-6 pt-3">
        <div role="tablist" aria-label="Spectrum" className="inline-flex rounded-lg bg-slate-950/60 border border-slate-800 p-1" onKeyDown={onTabKey}>
          {TRACK_IDS.map((id) => {
            const active = id === trackId;
            return (
              <button
                key={id}
                id={`${uid}-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`${uid}-panel`}
                tabIndex={active ? 0 : -1}
                onClick={() => onTab(id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                  active ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                {SPECTRUM_TRACKS[id].tab}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-sm text-slate-400">{track.blurb}</p>
      </div>

      <div
        id={`${uid}-panel`}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-${trackId}`}
        className="grid gap-4 sm:gap-6 px-4 sm:px-6 pb-5 pt-4 sm:grid-cols-[minmax(180px,240px)_1fr] sm:items-center"
      >
        {/* The gecko */}
        <div className="relative flex justify-center items-center rounded-xl bg-[radial-gradient(ellipse_at_center,rgba(52,211,153,0.10),transparent_65%)] py-2">
          <IllustratedGecko
            phenotype={phenotype}
            className="w-[150px] sm:w-[200px] h-auto"
            title={`Illustration: ${stop.name}`}
          />
        </div>

        <div className="min-w-0">
          {/* Caption */}
          <div aria-live="polite" className="min-h-[176px] sm:min-h-[150px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Stop {stopIdx + 1} of {track.stops.length}
            </p>
            <h4 className="mt-0.5 text-xl sm:text-2xl font-bold text-white">{stop.name}</h4>
            <p className="mt-1.5 text-sm sm:text-[15px] leading-relaxed text-slate-300">
              <span className="font-semibold text-emerald-300">Where to look: </span>
              {stop.look}
            </p>
            {zone && (
              <p className="mt-2 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] leading-snug text-amber-200">
                <AlertTriangle className="h-4 w-4 flex-none mt-0.5" aria-hidden="true" />
                <span><span className="font-semibold">Breeders disagree near here. </span>{zone.note}</span>
              </p>
            )}
            {stop.slugs.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {stop.slugs.map((l) => (
                    <Link
                      key={l.slug}
                      to={`/MorphGuide/${l.slug}`}
                      onClick={() => trackCta(`/MorphGuide/${l.slug}`, trackId)}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      {l.label} guide <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
            )}
          </div>

          {/* Slider */}
          <div className="mt-4 select-none">
            <div className="relative h-11">
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-slate-800 overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-600/70 to-emerald-400/80" style={{ width: pct(pos) }} />
                {track.zones.map((z) => (
                  <div
                    key={z.from}
                    className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,rgba(251,191,36,0.55)_0_3px,transparent_3px_6px)]"
                    style={{ left: pct(z.from), width: `calc(${pct(z.to)} - ${pct(z.from)})` }}
                  />
                ))}
              </div>
              {track.stops.map((s, i) => (
                <span
                  key={s.id}
                  aria-hidden="true"
                  className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
                    i <= pos + 0.001 ? 'border-emerald-300 bg-emerald-400' : 'border-slate-600 bg-slate-900'
                  }`}
                  style={{ left: pct(i) }}
                />
              ))}
              <input
                type="range"
                min={0}
                max={max}
                step={0.01}
                value={pos}
                onChange={onSlider}
                onKeyDown={onSliderKey}
                aria-label={`${track.tab} spectrum`}
                aria-valuetext={zone ? `${stop.name}, near a disputed boundary` : stop.name}
                className="peer absolute inset-0 w-full h-full opacity-0 cursor-pointer touch-pan-y"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-400 shadow-[0_2px_10px_rgba(0,0,0,0.5)] peer-focus-visible:ring-4 peer-focus-visible:ring-emerald-400/40"
                style={{ left: pct(pos) }}
              />
            </div>

            {/* Tappable stops */}
            <div className="relative h-9 -mx-1">
              {track.stops.map((s, i) => {
                const active = i === stopIdx;
                const edge = i === 0 ? 'translate-x-0 text-left' : i === max ? '-translate-x-full text-right' : '-translate-x-1/2 text-center';
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onStop(i)}
                    aria-label={`Go to ${s.name}`}
                    aria-pressed={active}
                    className={`absolute top-0 ${edge} whitespace-nowrap px-1 py-1.5 text-xs sm:text-sm font-medium leading-tight rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      active ? 'text-emerald-300' : 'text-slate-400 hover:text-white'
                    }`}
                    style={{ left: `calc(${pct(i)} + ${i === 0 ? '4px' : i === max ? '-4px' : '0px'})` }}
                  >
                    <span className="sm:hidden">{s.short}</span>
                    <span className="hidden sm:inline">{s.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Side note (Phantom Pinstripe) */}
          {track.note && (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <IllustratedGecko morph={track.note.slug} decorative className="w-9 h-auto flex-none" />
              <p className="text-[13px] leading-snug text-slate-400">
                <span className="font-semibold text-slate-200">Side note, {track.note.name}: </span>
                {track.note.text}{' '}
                <Link
                  to={`/MorphGuide/${track.note.slug}`}
                  onClick={() => trackCta(`/MorphGuide/${track.note.slug}`, trackId)}
                  className="font-medium text-emerald-300 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded"
                >
                  Read the guide
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
