import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, LayoutGrid, Sparkles, UserPlus, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { captureEvent } from '@/lib/posthog';
import { useToast } from '@/components/ui/use-toast';
import { GUEST_WRITE_BLOCKED_EVENT } from '@/lib/guestMode';
import {
  TOUR_BY_ID,
  TOUR_SIGNUP_URL,
  advanceTour,
  backTour,
  closeHub,
  closeTour,
  getTour,
  getTourState,
  isOnStep,
  openHub,
  setRole,
  startTour,
  suggestedTour,
} from '@/lib/guestTour';
import GuestMockDisclaimer from './GuestMockDisclaimer';
import GuestTourHub from './GuestTourHub';
import { TOUR_LOOK } from './guestTourLook';

// The guided demo: a welcome card, a hub of tours (a quick general one
// and topic tours that go deeper), the card for each stop, and a card
// after each tour that suggests the next one. Once the guest closes it,
// the usual guest notice comes back with a way to reopen the tours.
// See src/lib/guestTour.js.
//
// On phones the stop card is one slim line (progress, title, Next, close)
// so it does not sit on top of what it describes; the full text is one
// tap away. It lives in the shared floating-notice stack (Layout), so it
// does not overlap the feeding reminders in the same corner.

const cardClass =
  'relative w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-emerald-500/35 bg-slate-900/95 backdrop-blur-md shadow-xl shadow-black/50 text-slate-100';
const primaryClass =
  'inline-flex items-center gap-1.5 min-h-10 touch:min-h-11 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] px-3.5 text-sm font-semibold text-white shadow-sm shadow-emerald-900/50 transition';
const secondaryClass =
  'inline-flex items-center gap-1.5 min-h-10 touch:min-h-11 rounded-lg border border-slate-700 hover:border-slate-500 hover:bg-slate-800 px-3 text-sm font-medium text-slate-200 transition';
const ghostClass = 'min-h-10 touch:min-h-11 rounded-lg px-2.5 text-sm text-slate-400 hover:text-white transition-colors';
const iconButtonClass =
  'shrink-0 inline-flex items-center justify-center h-8 w-8 touch:h-11 touch:w-10 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors';

// Bring the page back to the top after the tour moves to a new stop, so
// the guest lands on what the card describes.
const scrollMainToTop = (reduce) => {
  requestAnimationFrame(() => {
    const main = document.querySelector('.app-main-scroll');
    if (main) main.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  });
};

function Progress({ total, current }) {
  return (
    <div className="flex gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="relative h-1 flex-1 overflow-hidden rounded-full bg-slate-700/70">
          <motion.span
            className="absolute inset-y-0 left-0 rounded-full bg-emerald-400"
            initial={false}
            animate={{ width: i <= current ? '100%' : '0%' }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </span>
      ))}
    </div>
  );
}

export default function GuestDemoGuide() {
  const { isGuest } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [tour, setTour] = useState(getTourState);
  // Phones only: the slim bar opens to the full card.
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  // The "view-only" toast lives here rather than in GuestMockDisclaimer,
  // which only mounts after the tour is closed, so a guest who tapped
  // Save during the tour still gets a reply.
  useEffect(() => {
    if (!isGuest) return undefined;
    const onBlocked = (event) => {
      const action = event?.detail?.action || 'save changes';
      toast({
        title: 'Guest mode is view-only',
        description: `Create a free account to ${action}. Nothing gets saved while you're browsing as a guest.`,
      });
    };
    window.addEventListener(GUEST_WRITE_BLOCKED_EVENT, onBlocked);
    return () => window.removeEventListener(GUEST_WRITE_BLOCKED_EVENT, onBlocked);
  }, [isGuest, toast]);

  if (!isGuest) return null;

  const current = getTour(tour);
  const step = current.steps[tour.step];

  const go = (path) => {
    navigate(path);
    scrollMainToTop(reduce);
  };
  const close = (reason) => {
    captureEvent('guest_tour', { action: reason, tour: current.id, step: step?.id });
    setTour(closeTour());
  };
  const hub = (from) => {
    captureEvent('guest_tour', { action: 'hub', from });
    setTour(openHub());
  };
  const begin = (tourId) => {
    captureEvent('guest_tour', { action: 'start', tour: tourId });
    const state = startTour(tourId);
    setTour(state);
    setExpanded(false);
    go(TOUR_BY_ID[state.tour].steps[0].path);
  };
  const next = () => {
    const state = advanceTour();
    setTour(state);
    const t = getTour(state);
    captureEvent('guest_tour', {
      action: state.status === 'finished' ? 'complete' : 'step',
      tour: t.id,
      step: t.steps[state.step]?.id,
    });
    if (state.status === 'active') go(t.steps[state.step].path);
  };
  const back = () => {
    const state = backTour();
    setTour(state);
    captureEvent('guest_tour', { action: 'back', tour: current.id, step: current.steps[state.step]?.id });
    go(current.steps[state.step].path);
  };

  if (tour.status === 'closed') return <GuestMockDisclaimer onOpenTours={() => hub('notice')} />;
  if (location.pathname.toLowerCase().startsWith('/authportal')) return null;

  if (tour.status === 'hub') {
    return (
      <AnimatePresence>
        <GuestTourHub
          key="hub"
          state={tour}
          onStart={begin}
          onClose={() => {
            captureEvent('guest_tour', { action: 'hub_close' });
            setTour(closeHub());
          }}
          onExplore={() => close('skip')}
          onRole={(role) => {
            captureEvent('guest_tour', { action: 'role', role });
            setTour(setRole(role));
          }}
        />
      </AnimatePresence>
    );
  }

  const look = TOUR_LOOK[current.id] || TOUR_LOOK.quick;
  const here = isOnStep(step, location.pathname, location.search);
  const suggestion = suggestedTour(tour);

  let label;
  let title;
  let body;
  let actions;
  // The one action the slim phone bar shows.
  let compact;
  let headIcon = <look.Icon className="w-4 h-4" />;
  let stopTag = '';

  if (tour.status === 'offer') {
    label = 'Guest demo, sample data';
    title = 'Want a quick look around?';
    body = 'Take the one-minute tour of the highlights, or pick a topic like breeding, morphs or prices.';
    actions = (
      <>
        <button type="button" onClick={() => begin('quick')} className={primaryClass}>
          Start the quick tour <ArrowRight className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => hub('offer')} className={secondaryClass}>
          <LayoutGrid className="w-4 h-4" /> Pick a topic
        </button>
      </>
    );
    compact = (
      <button type="button" onClick={() => hub('offer')} className={primaryClass}>
        Tours <ArrowRight className="w-4 h-4" />
      </button>
    );
  } else if (tour.status === 'finished') {
    headIcon = <Check className="w-4 h-4" />;
    label = `${current.short} tour done`;
    if (suggestion) {
      title = `Up next: ${suggestion.title}`;
      body = suggestion.blurb;
      actions = (
        <>
          <button type="button" onClick={() => begin(suggestion.id)} className={primaryClass}>
            Start it <ArrowRight className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => hub('finished')} className={secondaryClass}>
            <LayoutGrid className="w-4 h-4" /> All tours
          </button>
          <Link
            to={TOUR_SIGNUP_URL}
            onClick={() => captureEvent('guest_tour', { action: 'signup', tour: current.id })}
            className="inline-flex items-center gap-1 min-h-10 touch:min-h-11 px-1 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
          >
            <UserPlus className="w-4 h-4" /> Sign up free
          </Link>
        </>
      );
      compact = (
        <button type="button" onClick={() => begin(suggestion.id)} className={primaryClass}>
          Next <ArrowRight className="w-4 h-4" />
        </button>
      );
    } else {
      title = 'You have seen every tour';
      body = 'Create a free account and add your first gecko in under a minute. Your records export to CSV or PDF any time.';
      actions = (
        <>
          <Link
            to={TOUR_SIGNUP_URL}
            onClick={() => captureEvent('guest_tour', { action: 'signup', tour: current.id })}
            className={primaryClass}
          >
            <UserPlus className="w-4 h-4" /> Create free account
          </Link>
          <button type="button" onClick={() => close('keep_exploring')} className={ghostClass}>
            Keep exploring
          </button>
        </>
      );
      compact = (
        <Link to={TOUR_SIGNUP_URL} onClick={() => captureEvent('guest_tour', { action: 'signup', tour: current.id })} className={primaryClass}>
          <UserPlus className="w-4 h-4" /> Sign up
        </Link>
      );
    }
  } else {
    const last = tour.step + 1 >= current.steps.length;
    label = `${current.short} tour, ${tour.step + 1} of ${current.steps.length}`;
    stopTag = `${tour.step + 1}/${current.steps.length} `;
    title = step.title;
    body = here ? step.body : 'Pick up where you left off.';
    compact = (
      <button type="button" onClick={here ? next : () => go(step.path)} className={primaryClass}>
        {here ? (last ? 'Finish' : 'Next') : 'Resume'} <ArrowRight className="w-4 h-4" />
      </button>
    );
    actions = here ? (
      <>
        <button type="button" onClick={next} className={primaryClass}>
          {step.next} <ArrowRight className="w-4 h-4" />
        </button>
        {tour.step > 0 && (
          <button type="button" onClick={back} className={ghostClass} aria-label="Previous stop">
            <span className="inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Back</span>
          </button>
        )}
      </>
    ) : (
      <button type="button" onClick={() => go(step.path)} className={primaryClass}>
        Continue the tour <ArrowRight className="w-4 h-4" />
      </button>
    );
  }

  const showProgress = tour.status === 'active';
  // Re-animate the text whenever the stop or card changes.
  const contentKey = `${tour.status}-${current.id}-${tour.step}`;

  return (
    <motion.div
      role="dialog"
      aria-label="Guided demo"
      className={cardClass}
      data-floating-notice
      data-guest-tour
      initial={reduce ? false : { opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-emerald-500/10 to-transparent" />
      <div className="relative p-2 md:p-3.5">
        <div className="flex items-center md:items-start gap-2">
          <span className={`shrink-0 inline-flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-lg ring-1 ${tour.status === 'finished' ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/40' : look.chip}`}>
            {tour.status === 'offer' ? <Sparkles className="w-4 h-4" /> : headIcon}
          </span>
          <div className="flex-1 min-w-0" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={contentKey}
                initial={reduce ? false : { opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -10 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <p className={`${expanded ? 'block' : 'hidden md:block'} text-[11px] uppercase tracking-[0.12em] font-semibold text-emerald-300`}>{label}</p>
                <p className={`text-sm md:text-[15px] font-semibold text-white md:mt-0.5 ${expanded ? '' : 'truncate md:whitespace-normal'}`}>
                  {!expanded && <span className="md:hidden text-emerald-300 font-bold">{stopTag}</span>}
                  {title}
                </p>
                <p className={`${expanded ? 'block' : 'hidden md:block'} text-[13px] leading-snug text-slate-300 mt-1`}>{body}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          {!expanded && <div className="md:hidden shrink-0">{compact}</div>}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={`md:hidden ${iconButtonClass}`}
            aria-label={expanded ? 'Show less' : 'Show the tour text'}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          {tour.status === 'active' && (
            <button type="button" onClick={() => hub('card')} className={`hidden md:inline-flex ${iconButtonClass}`} aria-label="All tours" title="All tours">
              <LayoutGrid className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => close(tour.status === 'offer' ? 'skip' : 'close')}
            className={iconButtonClass}
            aria-label={tour.status === 'offer' ? 'Explore on my own' : 'End the tour'}
            title={tour.status === 'offer' ? 'Explore on my own' : 'End the tour'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className={`${expanded ? 'flex' : 'hidden md:flex'} mt-3 flex-wrap items-center gap-1.5 md:pl-10`}>
          {actions}
          {tour.status === 'active' && (
            <button type="button" onClick={() => hub('card')} className={`md:hidden ${ghostClass}`}>
              All tours
            </button>
          )}
        </div>
        {showProgress && (
          <div className="mt-2 md:mt-3 md:pl-10">
            <Progress total={current.steps.length} current={tour.step} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
