import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { captureEvent } from '@/lib/posthog';
import MorphQuizGlyph from '@/components/morphguide/MorphQuizGlyph';
import MorphQuizPanel, { STILL_MOTION } from '@/components/morphguide/MorphQuizPanel';

/**
 * "Which features can you see?" A compact teaser card on the Morph Guide index
 * that opens, in place, into a four step picture quiz (MorphQuizPanel.jsx).
 *
 * The open quiz slides between questions with framer-motion (about 38 kB
 * compressed), which nothing else on the Morph Guide uses. It downloads
 * when a visitor points at, focuses or presses Start, not with the page.
 * The teaser stays on screen (and keeps keyboard focus) until it is here,
 * then the quiz replaces it exactly as before. If the download fails, the
 * quiz opens without the slide animation instead of not opening.
 */

let loadedKit = null;
let pendingKit = null;

/** Resolves with framer-motion's parts for the quiz; rejects if the download fails. */
export function loadQuizMotion() {
  if (loadedKit) return Promise.resolve(loadedKit);
  if (!pendingKit) {
    pendingKit = import('./quizMotion').then(
      (mod) => {
        loadedKit = mod;
        return mod;
      },
      (err) => {
        // Let the next press try again.
        pendingKit = null;
        throw err;
      },
    );
  }
  return pendingKit;
}

// Warms the download on the first sign of interest. A failure here is
// ignored: pressing Start tries again.
function preloadQuizMotion() {
  loadQuizMotion().catch(() => {});
}

function QuizTeaser({ onStart }) {
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
            Which features can you see?
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-snug">
            Four observations to find useful guides. Several names may apply to one gecko.
          </p>
        </div>
        <button
          type="button"
          onClick={onStart}
          onPointerEnter={preloadQuizMotion}
          onFocus={preloadQuizMotion}
          onTouchStart={preloadQuizMotion}
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

export default function MorphQuiz({ morphs = [] }) {
  // The motion parts the open quiz uses; null while the teaser shows.
  const [kit, setKit] = useState(null);
  const starting = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const start = () => {
    if (kit || starting.current) return;
    starting.current = true;
    captureEvent('morph_quiz_step', { step: 'start' });
    loadQuizMotion()
      .catch(() => STILL_MOTION)
      .then((loaded) => {
        starting.current = false;
        if (mounted.current) setKit(loaded);
      });
  };

  if (!kit) return <QuizTeaser onStart={start} />;
  return <MorphQuizPanel morphs={morphs} kit={kit} onClose={() => setKit(null)} />;
}
