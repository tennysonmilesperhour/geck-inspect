import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { captureEvent } from '@/lib/posthog';
import { rememberSignupCta } from '@/lib/attribution';

/**
 * A quiet, in-page sign-up prompt for the public guides (Morph Guide,
 * Care Guide, Genetics Guide, the calculator and the older article pages).
 *
 * Why it exists: those pages bring most of the signed-out traffic, but
 * 78 to 94% of visitors leave after one page and about 0.2% sign up,
 * while /pedigree-tracker, which says plainly what the app does for your
 * own geckos, converts about 27% (docs/planning/growth-funnel-2026-10.md).
 * So each guide page says, in its own words, what the free account would
 * do with the gecko the visitor is reading about.
 *
 * Rules it keeps:
 *   - In the page flow, never a pop-up, never sticky, never repeated.
 *   - Hidden for signed-in members. Demo guests still see it.
 *   - Every claim is something the free plan does today.
 *   - Analytics: `content_cta_viewed` once when half of it is on screen,
 *     `content_cta_clicked` on the button, and the click is remembered
 *     (rememberSignupCta) so signup_completed can credit this page.
 *
 * variant "card" is the compact mid-page version; "panel" is the larger
 * end-of-page version.
 */
const FREE_FACTS = ['Free for up to 10 geckos', 'No card needed'];

export default function ContentSignupPrompt({
  pageType,
  ctaId,
  eyebrow = 'Free for keepers and breeders',
  headline,
  body,
  buttonLabel = 'Create a free account',
  secondary = { label: 'See how the pedigree tracker works', to: '/pedigree-tracker' },
  variant = 'card',
  className = '',
}) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const ref = useRef(null);
  const seen = useRef(false);
  const cta = ctaId || pageType;

  useEffect(() => {
    if (isAuthenticated || !ref.current || typeof IntersectionObserver === 'undefined') return undefined;
    seen.current = false;
    const node = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (seen.current || !entries.some((e) => e.isIntersecting)) return;
        seen.current = true;
        captureEvent('content_cta_viewed', { cta, page_type: pageType, page: location.pathname, variant });
        observer.disconnect();
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isAuthenticated, cta, pageType, location.pathname, variant]);

  if (isAuthenticated) return null;

  const onClick = (target) => {
    captureEvent('content_cta_clicked', { cta, page_type: pageType, page: location.pathname, variant, target });
    if (target === 'signup') rememberSignupCta({ cta, page: location.pathname, pageType });
  };

  const isPanel = variant === 'panel';

  return (
    <aside
      ref={ref}
      aria-label="Create a free Geck Inspect account"
      className={
        (isPanel
          ? 'rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900/70 to-slate-900/40 p-6 md:p-8'
          : 'rounded-xl border border-emerald-500/25 bg-slate-900/80 p-5 md:p-6 border-l-4 border-l-emerald-500/70') +
        ' text-left ' +
        className
      }
    >
      {eyebrow && (
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90 mb-1.5">{eyebrow}</p>
      )}
      <h2 className={isPanel ? 'text-xl md:text-2xl font-bold text-white mb-2 leading-snug' : 'text-lg md:text-xl font-semibold text-white mb-1.5 leading-snug'}>
        {headline}
      </h2>
      {body && <p className="text-sm md:text-base text-slate-300 leading-relaxed mb-4 max-w-2xl">{body}</p>}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
        <Link
          to="/AuthPortal?mode=signup"
          onClick={() => onClick('signup')}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-4 min-h-11 text-sm transition-colors self-start"
        >
          {buttonLabel}
          <ArrowRight className="w-4 h-4" />
        </Link>
        {secondary?.to && (
          <Link
            to={secondary.to}
            onClick={() => onClick('secondary')}
            className="inline-flex items-center min-h-11 text-sm text-emerald-200 hover:text-emerald-100 underline underline-offset-4 decoration-emerald-500/40"
          >
            {secondary.label}
          </Link>
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        {FREE_FACTS.map((f) => (
          <li key={f} className="inline-flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            {f}
          </li>
        ))}
      </ul>
    </aside>
  );
}

/**
 * Care Guide prompt copy by care category (src/data/care-guide.js ids).
 * Each line names something the free account does for that kind of
 * care, so the prompt reads as the next step of the article.
 */
const CARE_COPY = {
  feeding: {
    headline: 'Log feedings and weights for each of your geckos, free',
    body: 'Group geckos by feeding schedule, see who is due, and keep a weight history that shows whether a picky eater is holding steady.',
  },
  health: {
    headline: 'Spot weight loss early with a weight history for every gecko',
    body: 'Log a weigh-in in a few taps (Field Mode is made for doing it at the rack). Each gecko\'s record shows the trend, with sheds and notes beside it.',
  },
  'life-stages': {
    headline: 'See whether your hatchling is on track for its age, free',
    body: 'Log weigh-ins as it grows. Its record compares each weight with typical crested gecko growth for that age.',
  },
  breeding: {
    headline: 'Plan your pairing and follow every egg to hatch day, free',
    body: 'Record the pairing, egg drops and incubation, get a heads-up when a clutch is due to hatch, and each hatchling starts life with its parents already linked.',
  },
};
const CARE_DEFAULT = {
  headline: 'Keep each gecko\'s care record in one place, free',
  body: 'Weights, feedings, sheds and photos on one record per gecko, next to its morph and parents. Add your first one with a photo and a name.',
};

export function careSignupCopy(categoryId) {
  return CARE_COPY[categoryId] || CARE_DEFAULT;
}

/** "Lilly White's", "Axanthic's"; names ending in s take a bare apostrophe. */
export function possessive(name) {
  const n = String(name || '').trim();
  if (!n) return '';
  return /s$/i.test(n) ? `${n}'` : `${n}'s`;
}
