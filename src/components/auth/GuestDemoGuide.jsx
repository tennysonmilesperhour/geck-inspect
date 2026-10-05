import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, ChevronUp, Compass, UserPlus, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { captureEvent } from '@/lib/posthog';
import { useToast } from '@/components/ui/use-toast';
import { GUEST_WRITE_BLOCKED_EVENT } from '@/lib/guestMode';
import {
  TOUR_SIGNUP_URL,
  TOUR_STEPS,
  advanceTour,
  closeTour,
  getTourState,
  isOnStep,
  startTour,
} from '@/lib/guestTour';
import GuestMockDisclaimer from './GuestMockDisclaimer';

// The guided demo (P6): while a guest is offered or taking the three-stop
// tour, this card stands in for the guest notice; once the tour is closed
// the usual notice comes back. See src/lib/guestTour.js.
//
// On phones the card is one slim line (stop, title, Next, close) so it
// does not sit on top of what it describes; the full text is one tap away.
// It lives in the shared floating-notice stack (Layout), so it no longer
// overlaps the feeding reminders in the same corner.

const cardClass =
  'w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-emerald-500/40 bg-slate-900/95 backdrop-blur-md shadow-lg shadow-black/40 text-slate-100';
const primaryClass =
  'inline-flex items-center gap-1.5 min-h-10 touch:min-h-11 rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 text-sm font-semibold text-white';

export default function GuestDemoGuide() {
  const { isGuest } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [tour, setTour] = useState(getTourState);
  // Phones only: the slim bar opens to the full card.
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  // The "view-only" toast lives here rather than in GuestMockDisclaimer,
  // which only mounts after the tour is closed, so a guest who tapped
  // Save during the tour used to get no reply at all.
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
  if (tour.status === 'closed') return <GuestMockDisclaimer />;
  if (location.pathname.toLowerCase().startsWith('/authportal')) return null;

  const step = TOUR_STEPS[tour.step];
  const here = isOnStep(step, location.pathname, location.search);

  const close = (reason) => {
    captureEvent('guest_tour', { action: reason, step: step?.id });
    setTour(closeTour());
  };
  const begin = () => {
    captureEvent('guest_tour', { action: 'start' });
    setTour(startTour());
    navigate(TOUR_STEPS[0].path);
  };
  const next = () => {
    const state = advanceTour();
    setTour(state);
    captureEvent('guest_tour', { action: state.status === 'finished' ? 'complete' : 'step', step: TOUR_STEPS[state.step]?.id });
    if (state.status === 'active') navigate(TOUR_STEPS[state.step].path);
  };

  let label;
  let title;
  let body;
  let actions;
  // The one action the slim phone bar shows.
  let compact;
  if (tour.status === 'offer') {
    label = 'Guest demo, sample data';
    title = 'Take the one-minute tour';
    body = "Three stops: a breeder's collection, one gecko's full record, and the genetics calculator.";
    actions = (
      <>
        <button type="button" onClick={begin} className="inline-flex items-center gap-1.5 min-h-10 touch:min-h-11 rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 text-sm font-semibold text-white">
          Start the tour <ArrowRight className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => close('skip')} className="min-h-10 touch:min-h-11 rounded-md px-3 text-sm text-slate-300 hover:text-white">
          Explore on my own
        </button>
      </>
    );
    compact = (
      <button type="button" onClick={begin} className={primaryClass}>
        Start <ArrowRight className="w-4 h-4" />
      </button>
    );
  } else if (tour.status === 'finished') {
    label = 'Guest demo';
    title = 'Make it yours';
    body = 'Create a free account and add your first gecko in under a minute. Your records export to CSV or PDF any time.';
    actions = (
      <>
        <Link
          to={TOUR_SIGNUP_URL}
          onClick={() => captureEvent('guest_tour', { action: 'signup' })}
          className="inline-flex items-center gap-1.5 min-h-10 touch:min-h-11 rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 text-sm font-semibold text-white"
        >
          <UserPlus className="w-4 h-4" /> Create free account
        </Link>
        <button type="button" onClick={() => close('keep_exploring')} className="min-h-10 touch:min-h-11 rounded-md px-3 text-sm text-slate-300 hover:text-white">
          Keep exploring
        </button>
      </>
    );
    compact = (
      <Link to={TOUR_SIGNUP_URL} onClick={() => captureEvent('guest_tour', { action: 'signup' })} className={primaryClass}>
        <UserPlus className="w-4 h-4" /> Sign up
      </Link>
    );
  } else {
    label = `Tour, stop ${tour.step + 1} of ${TOUR_STEPS.length}`;
    title = step.title;
    compact = (
      <button type="button" onClick={here ? next : () => navigate(step.path)} className={primaryClass}>
        {here ? (tour.step + 1 >= TOUR_STEPS.length ? 'Finish' : 'Next') : 'Resume'} <ArrowRight className="w-4 h-4" />
      </button>
    );
    body = here ? step.body : 'Pick up where you left off.';
    actions = here ? (
      <button type="button" onClick={next} className="inline-flex items-center gap-1.5 min-h-10 touch:min-h-11 rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 text-sm font-semibold text-white">
        {step.next} <ArrowRight className="w-4 h-4" />
      </button>
    ) : (
      <button type="button" onClick={() => navigate(step.path)} className="inline-flex items-center gap-1.5 min-h-10 touch:min-h-11 rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 text-sm font-semibold text-white">
        Continue the tour <ArrowRight className="w-4 h-4" />
      </button>
    );
  }

  const stopTag = tour.status === 'active' ? `${tour.step + 1}/${TOUR_STEPS.length} ` : '';

  return (
    <div role="dialog" aria-label="Guided demo" className={cardClass} data-floating-notice data-guest-tour>
      <div className="p-2 md:p-3">
        <div className="flex items-center md:items-start gap-2">
          <Compass className="w-4 h-4 md:mt-0.5 shrink-0 text-emerald-400" />
          <div className="flex-1 min-w-0">
            <p className={`${expanded ? 'block' : 'hidden md:block'} text-[11px] uppercase tracking-wider font-semibold text-emerald-300`}>{label}</p>
            <p className={`text-sm font-semibold text-slate-100 md:mt-0.5 ${expanded ? '' : 'truncate md:whitespace-normal'}`}>
              {!expanded && <span className="md:hidden text-emerald-300 font-bold">{stopTag}</span>}
              {title}
            </p>
            <p className={`${expanded ? 'block' : 'hidden md:block'} text-xs leading-snug text-slate-300 mt-1`}>{body}</p>
          </div>
          {!expanded && <div className="md:hidden shrink-0">{compact}</div>}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="md:hidden shrink-0 inline-flex items-center justify-center min-h-9 min-w-9 touch:min-h-11 touch:min-w-9 rounded text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label={expanded ? 'Show less' : 'Show the tour text'}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => close('close')}
            className="shrink-0 inline-flex items-center justify-center min-h-9 min-w-9 touch:min-h-11 touch:min-w-9 rounded text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="End the tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className={`${expanded ? 'flex' : 'hidden md:flex'} mt-2.5 flex-wrap items-center gap-1.5 pl-6`}>{actions}</div>
      </div>
    </div>
  );
}
