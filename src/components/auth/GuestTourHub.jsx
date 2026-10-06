import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Clock, Sparkles, UserPlus, X } from 'lucide-react';
import { ROLES, TOUR_SIGNUP_URL, orderedTours } from '@/lib/guestTour';
import { captureEvent } from '@/lib/posthog';
import { TOUR_LOOK, tourMinutes } from './guestTourLook';

// The tour picker: the quick tour up top as "Start here", then the topic
// tours in the order suggested for this guest (keeper or breeder), with
// the next one to take marked and finished ones ticked. A bottom sheet on
// phones, a centered panel from md up.

export default function GuestTourHub({ state, onStart, onClose, onExplore, onRole }) {
  const reduce = useReducedMotion();
  const panelRef = useRef(null);
  const tours = orderedTours(state);
  const quick = tours.find((t) => t.id === 'quick');
  const topics = tours.filter((t) => t.id !== 'quick');
  // The topic tour to point at: the first in this guest's order not seen yet.
  const nextTopic = topics.find((t) => !state.done.includes(t.id));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    panelRef.current?.querySelector('[data-autofocus]')?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const quickDone = state.done.includes('quick');
  const QuickIcon = TOUR_LOOK.quick.Icon;

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end md:items-center justify-center md:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.2 }}
    >
      <button
        type="button"
        aria-label="Close the tour picker"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm cursor-default"
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-tour-hub-title"
        data-guest-tour-hub
        className="relative w-full md:max-w-2xl max-h-[88vh] overflow-y-auto overscroll-contain rounded-t-2xl md:rounded-2xl border border-emerald-500/30 bg-slate-900 text-slate-100 shadow-2xl shadow-black/60 pb-[env(safe-area-inset-bottom)]"
        initial={reduce ? false : { y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { y: 30, opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      >
        {/* Soft glow behind the header */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-emerald-500/15 via-emerald-500/5 to-transparent" />

        <div className="relative p-5 md:p-7">
          <div className="md:hidden mx-auto -mt-2 mb-3 h-1 w-10 rounded-full bg-slate-700" aria-hidden />
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-emerald-300">Guest demo, sample data</p>
              <h2 id="guest-tour-hub-title" className="mt-1 text-xl md:text-2xl font-bold text-white">
                Take a look around
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Nothing to set up. Start with the quick tour, then dive into whatever you care about most.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 inline-flex items-center justify-center h-9 w-9 touch:h-11 touch:w-11 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Keeper or breeder: sets the suggested order */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="What do you do?" className="inline-flex rounded-full border border-slate-700 bg-slate-950/60 p-1">
              {ROLES.map((r) => {
                const on = state.role === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onRole(r.id)}
                    className={`relative rounded-full px-3.5 min-h-8 touch:min-h-10 text-xs font-semibold transition-colors ${on ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    {on && (
                      <motion.span
                        layoutId="guest-tour-role"
                        className="absolute inset-0 rounded-full bg-emerald-600"
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      />
                    )}
                    <span className="relative">{r.label}</span>
                  </button>
                );
              })}
            </div>
            <span className="text-xs text-slate-400">We will suggest what to see first.</span>
          </div>

          {/* Start here */}
          <button
            type="button"
            data-autofocus
            onClick={() => onStart('quick')}
            className="group mt-5 w-full text-left rounded-xl border border-emerald-400/50 bg-gradient-to-br from-emerald-600/30 via-emerald-700/15 to-slate-900 p-4 md:p-5 transition hover:border-emerald-300 hover:from-emerald-600/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <div className="flex items-center gap-3.5">
              <span className="shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/40">
                <QuickIcon className="w-5 h-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold text-white">{quick.title}</span>
                  {quickDone ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                      <Check className="w-3 h-3" /> Seen
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-950">
                      <Sparkles className="w-3 h-3" /> Start here
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-slate-300">{quick.blurb}</p>
                <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-emerald-200/80">
                  <Clock className="w-3 h-3" /> {quick.steps.length} stops, about {tourMinutes(quick)} min
                </p>
              </div>
              <ArrowRight className="hidden sm:block w-5 h-5 shrink-0 text-emerald-300 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          <h3 className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Dive deeper</h3>
          <ul className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {topics.map((t, i) => {
              const look = TOUR_LOOK[t.id];
              const done = state.done.includes(t.id);
              const suggested = nextTopic?.id === t.id;
              return (
                <motion.li
                  key={t.id}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduce ? 0 : 0.04 * i, type: 'spring', stiffness: 400, damping: 34 }}
                >
                  <button
                    type="button"
                    onClick={() => onStart(t.id)}
                    className={`group h-full w-full text-left rounded-xl border p-3.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                      suggested
                        ? 'border-emerald-500/60 bg-emerald-500/10 hover:bg-emerald-500/15'
                        : 'border-slate-700/80 bg-slate-800/40 hover:border-slate-500 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${look.chip}`}>
                        <look.Icon className="w-4 h-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-white">{t.title}</span>
                          {suggested && (
                            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                              {quickDone ? 'Suggested next' : 'Then this'}
                            </span>
                          )}
                          {done && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              <Check className="w-3 h-3" /> Seen
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs leading-snug text-slate-400">{t.blurb}</p>
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          {t.steps.length} stops, about {tourMinutes(t)} min
                        </p>
                      </div>
                    </div>
                  </button>
                </motion.li>
              );
            })}
          </ul>

          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onExplore}
              className="min-h-10 touch:min-h-11 rounded-md px-3 text-sm text-slate-300 hover:text-white transition-colors"
            >
              Explore on my own
            </button>
            <Link
              to={TOUR_SIGNUP_URL}
              onClick={() => captureEvent('guest_tour', { action: 'signup', from: 'hub' })}
              className="inline-flex items-center justify-center gap-1.5 min-h-10 touch:min-h-11 rounded-md bg-slate-100 hover:bg-white px-4 text-sm font-semibold text-slate-900 transition-colors"
            >
              <UserPlus className="w-4 h-4" /> Create free account
            </Link>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
