import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RotateCcw, Shuffle } from 'lucide-react';
import { getMorph } from '@/data/morph-guide';
import { calculatorHref, trackMorphCta } from './morphCta';

const OUTCOME_STYLE = {
  visual: { fill: 'fill-emerald-400', swatch: 'bg-emerald-400', short: 'Visual' },
  het: { fill: 'fill-amber-400', swatch: 'bg-amber-400', short: 'Het' },
  normal: { fill: 'fill-neutral-500', swatch: 'bg-neutral-500', short: 'Normal' },
};
// Unhatched egg color, before the outcome shows.
const SHELL = 'fill-stone-200';

function firstSentenceWith(text, re) {
  if (!text) return null;
  const sentences = String(text).split(/(?<=\.)\s+/);
  return sentences.find((s) => re.test(s)) || null;
}

/**
 * The one pairing worth showing for a morph, built only from standard
 * Mendelian ratios and the entry's own text. Returns null for morphs a
 * simple pairing does not describe (polygenic, line-bred, combos, and the
 * super forms themselves).
 */
export function geneticsDemoFor(morph) {
  if (!morph || morph.category === 'combo' || morph.slug.startsWith('super-')) return null;
  const name = morph.name;
  const allText = [morph.description, morph.history, ...(morph.keyFeatures || [])].join(' ');

  if (morph.inheritance === 'recessive') {
    return {
      kind: 'recessive',
      parents: [`Het ${name}`, `Het ${name}`],
      parentNote: 'Both parents carry one hidden copy and look normal.',
      eggs: ['visual', 'het', 'het', 'normal'],
      legend: [
        { key: 'visual', label: `Visual ${name}`, pct: 25 },
        { key: 'het', label: `Het ${name}, looks normal but carries it`, pct: 50 },
        { key: 'normal', label: 'Normal, no copy', pct: 25 },
      ],
      unproven: /not yet proven/i.test(allText),
    };
  }

  if (morph.inheritance === 'incomplete-dominant') {
    const superSentence = firstSentenceWith(morph.description, /\bsuper\b/i);
    const superMorph = getMorph(`super-${morph.slug}`);
    return {
      kind: 'incomplete-dominant',
      parents: [name, 'Normal'],
      parentNote: `One copy of the gene is enough to see it, so one ${name} parent is all it takes.`,
      eggs: ['visual', 'normal', 'visual', 'normal'],
      legend: [
        { key: 'visual', label: `Visual ${name}`, pct: 50 },
        { key: 'normal', label: 'Normal, no copy', pct: 50 },
      ],
      superNote: superSentence,
      superLethal: /lethal/i.test(superSentence || ''),
      superSlug: superMorph?.slug || null,
      superName: superMorph?.name || null,
    };
  }
  return null;
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function Egg({ outcome, index, phase, reduced }) {
  const style = OUTCOME_STYLE[outcome];
  const popped = phase >= 1;
  const colored = phase >= 2;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg
        viewBox="0 0 40 52"
        className="h-14 w-11 sm:h-16 sm:w-12 drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]"
        style={{
          transform: popped ? 'scale(1)' : 'scale(0.2)',
          opacity: popped ? 1 : 0,
          transition: reduced
            ? 'none'
            : `transform 520ms cubic-bezier(.34,1.56,.64,1) ${index * 130}ms, opacity 300ms ease ${index * 130}ms`,
        }}
        aria-hidden="true"
      >
        <path
          d="M20 2C31 2 38 20 38 32C38 43 30 50 20 50C10 50 2 43 2 32C2 20 9 2 20 2Z"
          className={colored ? style.fill : SHELL}
          style={{
            transition: reduced ? 'none' : `fill 450ms ease ${index * 160}ms`,
          }}
        />
        <ellipse cx="13" cy="20" rx="4" ry="7" fill="white" opacity="0.35" transform="rotate(18 13 20)" />
      </svg>
      <span
        className="text-[11px] font-medium text-neutral-400"
        style={{
          opacity: colored ? 1 : 0,
          transition: reduced ? 'none' : `opacity 300ms ease ${200 + index * 160}ms`,
        }}
      >
        {style.short}
      </span>
    </div>
  );
}

/**
 * A tiny pairing demo for single-gene morphs: four eggs pop in when the
 * box scrolls into view, then take the color of what they hatch as.
 * Visitors who ask for reduced motion see the finished result at once.
 */
export default function MorphGeneticsDemo({ morph }) {
  const demo = geneticsDemoFor(morph);
  const ref = useRef(null);
  const [reduced] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState(() => (reduced ? 2 : 0));
  const timer = useRef(0);

  const play = () => {
    window.clearTimeout(timer.current);
    setPhase(1);
    timer.current = window.setTimeout(() => setPhase(2), 750);
  };

  useEffect(() => {
    if (reduced || !demo) return undefined;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setPhase(2);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          play();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer.current);
    };
    // Re-run per morph; `demo` is rebuilt from the same entry each render.
  }, [morph?.slug, reduced]);

  if (!demo) return null;

  const replay = () => {
    setPhase(0);
    window.requestAnimationFrame(() => window.requestAnimationFrame(play));
  };
  const href = calculatorHref(morph.slug);

  return (
    <div ref={ref} className="mt-4 overflow-hidden rounded-xl border border-neutral-800 bg-gradient-to-br from-emerald-500/[0.07] via-neutral-900/70 to-neutral-900/70 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white leading-snug">One pairing, four eggs</h3>
          <p className="mt-0.5 text-sm text-neutral-400">
            <span className="font-medium text-neutral-200">{demo.parents[0]}</span>
            <span className="mx-1.5 text-neutral-500" aria-label="crossed with">×</span>
            <span className="font-medium text-neutral-200">{demo.parents[1]}</span>
            <span className="text-neutral-500">. {demo.parentNote}</span>
          </p>
        </div>
        {!reduced && (
          <button
            type="button"
            onClick={replay}
            className="shrink-0 inline-flex h-9 w-9 touch:h-11 touch:w-11 items-center justify-center rounded-full border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
            aria-label="Play the eggs again"
            title="Play again"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div
        className="mt-5 flex items-end justify-center gap-4 sm:gap-6"
        role="img"
        aria-label={`Four example eggs: ${demo.legend.map((l) => `${l.pct}% ${l.label}`).join(', ')}`}
      >
        {demo.eggs.map((outcome, i) => (
          <Egg key={i} outcome={outcome} index={i} phase={phase} reduced={reduced} />
        ))}
      </div>

      <ul className="mt-5 grid gap-1.5 text-sm">
        {demo.legend.map((l) => (
          <li key={l.key} className="flex items-center gap-2.5">
            <span className={`h-3 w-3 shrink-0 rounded-full ${OUTCOME_STYLE[l.key].swatch}`} aria-hidden="true" />
            <span className="w-10 shrink-0 font-semibold tabular-nums text-white">{l.pct}%</span>
            <span className="text-neutral-300">{l.label}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-neutral-500 leading-relaxed">
        These are the odds for every egg, not a promise for every clutch. Crested geckos lay two eggs at a
        time, so four eggs is about two clutches, and real clutches often land differently.
      </p>

      {demo.unproven && (
        <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-200 leading-relaxed">
          Expected, not yet proven. {morph.name} is expected to be recessive like it is in other reptiles, but
          no one has confirmed it by breeding yet, so treat these odds as a forecast.
        </p>
      )}

      {demo.superNote && (
        <p
          className={`mt-3 flex gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed ${
            demo.superLethal
              ? 'border-rose-500/30 bg-rose-500/5 text-rose-200'
              : 'border-neutral-700 bg-neutral-900/60 text-neutral-300'
          }`}
        >
          {demo.superLethal && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          <span>
            <span className="font-semibold">Two copies: </span>
            {demo.superNote}
            {demo.superSlug && (
              <>
                {' '}
                <Link to={`/MorphGuide/${demo.superSlug}`} className="underline underline-offset-2 hover:text-white">
                  Read about {demo.superName}
                </Link>
              </>
            )}
          </span>
        </p>
      )}

      <Link
        to={href}
        onClick={() => trackMorphCta(morph.slug, href, 'genetics_demo')}
        className="mt-4 inline-flex min-h-10 touch:min-h-11 items-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
      >
        <Shuffle className="h-4 w-4" aria-hidden="true" />
        Run your own pairing
      </Link>
    </div>
  );
}
