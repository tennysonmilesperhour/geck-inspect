import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Camera, RotateCcw, X } from 'lucide-react';
import { captureEvent } from '@/lib/posthog';
import { QUIZ_STEPS, scoreMorphs } from '@/lib/morphQuiz';
import RotatingMorphImage from '@/components/morphguide/RotatingMorphImage';
import { MorphIndexArt, morphImages } from '@/components/morphguide/MorphIndexCard';
import MorphQuizGlyph, { QUIZ_GLYPHS } from '@/components/morphguide/MorphQuizGlyph';

/**
 * "Which morph is my gecko?" A compact teaser card on the Morph Guide index
 * that opens, in place, into a four step picture quiz. The scoring lives in
 * src/lib/morphQuiz.js; this file is only the screens.
 */

const STEP_COUNT = QUIZ_STEPS.length;

function ProgressDots({ step }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label={`Step ${Math.min(step + 1, STEP_COUNT)} of ${STEP_COUNT}`}>
      {QUIZ_STEPS.map((s, i) => (
        <li
          key={s.id}
          aria-hidden="true"
          className={`h-2 rounded-full transition-all duration-300 ${
            i < step ? 'w-2 bg-emerald-400' : i === step ? 'w-6 bg-emerald-300' : 'w-2 bg-slate-700'
          }`}
        />
      ))}
    </ol>
  );
}

function OptionCard({ stepId, option, selected, onPick }) {
  const glyph = QUIZ_GLYPHS[stepId]?.[option.id] || {};
  return (
    <button
      type="button"
      onClick={() => onPick(option.id)}
      aria-pressed={selected}
      className={`group flex flex-col items-center text-center rounded-xl border p-2.5 sm:p-3 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-[0.97] ${
        selected
          ? 'border-emerald-400 bg-emerald-500/15 shadow-[0_0_0_1px_rgba(52,211,153,0.4)]'
          : 'border-slate-700 bg-slate-950/60 hover:border-emerald-500/50 hover:bg-slate-900'
      }`}
    >
      <span className="block w-full rounded-lg bg-gradient-to-b from-slate-800/70 to-slate-900/40">
        <MorphQuizGlyph {...glyph} className="mx-auto w-full h-auto max-h-28 py-1.5 transition-transform duration-200 group-hover:scale-105" />
      </span>
      <span className="mt-2 text-sm font-bold text-white leading-tight">{option.label}</span>
      <span className="mt-0.5 text-xs text-slate-400 leading-snug">{option.hint}</span>
    </button>
  );
}

function ResultCard({ result, morph, rank }) {
  const images = morphImages(morph);
  return (
    <Link
      to={`/MorphGuide/${result.slug}`}
      onClick={() => captureEvent('morph_guide_cta_clicked', { target: result.slug, placement: 'quiz' })}
      className="group flex gap-3 rounded-xl border border-slate-700 bg-slate-950/60 hover:border-emerald-500/50 hover:bg-slate-900 p-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
    >
      <div className="relative w-20 h-20 shrink-0 overflow-hidden rounded-lg bg-slate-800">
        <MorphIndexArt morph={morph} />
        {images.length > 0 && (
          <RotatingMorphImage images={images} alt={`${morph.name} crested gecko`} className="w-full h-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300/90">
          {rank === 0 ? 'Best match' : 'Also likely'}
        </div>
        <div className="text-base font-bold text-white leading-snug group-hover:text-emerald-300 transition-colors">
          {result.name}
        </div>
        {result.reason && <p className="text-xs sm:text-sm text-slate-400 leading-snug mt-0.5">{result.reason}</p>}
        <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-300">
          Open the {result.name} guide
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </Link>
  );
}

export default function MorphQuiz({ morphs = [] }) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [dir, setDir] = useState(1);
  const headingRef = useRef(null);
  const advanceTimer = useRef(null);
  const sectionRef = useRef(null);

  const bySlug = useMemo(() => new Map(morphs.map((m) => [m.slug, m])), [morphs]);
  const done = step >= STEP_COUNT;
  const results = useMemo(() => (done ? scoreMorphs(answers) : []), [done, answers]);

  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  useEffect(() => {
    if (done && results.length) {
      captureEvent('morph_quiz_result', { slugs: results.map((r) => r.slug) });
    }
  }, [done, results]);

  // Move keyboard and screen reader focus to the new question.
  useEffect(() => {
    if (open) headingRef.current?.focus({ preventScroll: true });
  }, [open, step]);

  const start = () => {
    setOpen(true);
    setStep(0);
    setAnswers({});
    setDir(1);
    captureEvent('morph_quiz_step', { step: 'start' });
  };

  const pick = (optionId) => {
    const current = QUIZ_STEPS[step];
    if (!current) return;
    setAnswers((a) => ({ ...a, [current.id]: optionId }));
    captureEvent('morph_quiz_step', { step: current.id, answer: optionId, index: step + 1 });
    clearTimeout(advanceTimer.current);
    // A short pause so the tap visibly registers before the slide.
    advanceTimer.current = setTimeout(() => {
      setDir(1);
      setStep((s) => s + 1);
    }, reduceMotion ? 0 : 220);
  };

  const back = () => {
    clearTimeout(advanceTimer.current);
    setDir(-1);
    setStep((s) => Math.max(0, s - 1));
  };

  const close = () => {
    clearTimeout(advanceTimer.current);
    setOpen(false);
  };

  const restart = () => {
    setDir(-1);
    setAnswers({});
    setStep(0);
    captureEvent('morph_quiz_step', { step: 'restart' });
  };

  const slide = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, x: 28 * dir },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -28 * dir },
      };

  if (!open) {
    return (
      <section
        aria-labelledby="morph-quiz-teaser"
        className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-950/50 via-slate-900/80 to-slate-900/60 p-3 sm:p-4"
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative shrink-0 w-14 h-16 sm:w-16 sm:h-20 rounded-xl bg-slate-950/60 border border-slate-700/80 flex items-center justify-center">
            <MorphQuizGlyph cream="sides" lines="full" spots="some" className="w-28 sm:w-36 h-auto" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="morph-quiz-teaser" className="text-base sm:text-lg font-bold text-white leading-snug">
              Which morph is my gecko?
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-snug">
              Four picture questions, about 30 seconds. Tap what your gecko looks like.
            </p>
          </div>
          <button
            type="button"
            onClick={start}
            aria-label="Start the quiz"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm px-3 sm:px-4 h-10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
          >
            <span className="hidden sm:inline">Start the quiz</span>
            <span className="sm:hidden">Start</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    );
  }

  const current = QUIZ_STEPS[step];

  return (
    <motion.section
      ref={sectionRef}
      aria-label="Which morph is my gecko? quiz"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/40 via-slate-900/90 to-slate-900/70 p-3 sm:p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={back}
          disabled={step === 0}
          aria-label="Previous question"
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 flex items-center justify-center gap-3">
          <ProgressDots step={step} />
          <span className="text-xs text-slate-400 tabular-nums">
            {done ? 'Result' : `${step + 1} of ${STEP_COUNT}`}
          </span>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close the quiz"
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="relative overflow-hidden" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {!done ? (
            <motion.div key={current.id} {...slide} transition={{ duration: 0.22, ease: 'easeOut' }}>
              <h3
                ref={headingRef}
                tabIndex={-1}
                className="text-lg sm:text-xl font-bold text-white text-center leading-snug outline-none"
              >
                {current.question}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 text-center mt-1 mb-3 max-w-xl mx-auto">{current.help}</p>
              <div
                role="group"
                aria-label={current.question}
                className={`grid gap-2 sm:gap-3 ${
                  current.options.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'
                }`}
              >
                {current.options.map((o) => (
                  <OptionCard
                    key={o.id}
                    stepId={current.id}
                    option={o}
                    selected={answers[current.id] === o.id}
                    onPick={pick}
                  />
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div key="result" {...slide} transition={{ duration: 0.22, ease: 'easeOut' }}>
              <h3
                ref={headingRef}
                tabIndex={-1}
                className="text-lg sm:text-xl font-bold text-white text-center leading-snug outline-none"
              >
                {results.length > 1 ? 'Your gecko is most likely one of these' : 'Your gecko is most likely'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 text-center mt-1 mb-3 max-w-xl mx-auto">
                A first guess from four answers. Many geckos carry more than one trait, so read each guide and compare.
              </p>
              <div className={`grid gap-2 sm:gap-3 ${results.length > 1 ? 'md:grid-cols-2 lg:grid-cols-3' : 'max-w-md mx-auto'}`}>
                {results.map((r, i) => {
                  const morph = bySlug.get(r.slug) || { slug: r.slug, name: r.name };
                  return <ResultCard key={r.slug} result={r} morph={morph} rank={i} />;
                })}
              </div>
              <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
                <Link
                  to="/Recognition"
                  onClick={() => captureEvent('morph_guide_cta_clicked', { target: 'recognition', placement: 'quiz' })}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm px-4 h-11 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                >
                  <Camera className="w-4 h-4" />
                  Not sure? Get a confident answer from a photo
                </Link>
                <button
                  type="button"
                  onClick={restart}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 text-slate-200 hover:text-white hover:border-slate-400 font-semibold text-sm px-4 h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <RotateCcw className="w-4 h-4" />
                  Start over
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
