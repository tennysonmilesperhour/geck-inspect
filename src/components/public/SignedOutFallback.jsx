import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import Seo from '@/components/seo/Seo';
import PublicPageShell from '@/components/public/PublicPageShell';
import PageNotFound from '@/lib/PageNotFound';
import { PAGES } from '@/pages.config';
import { useAuth } from '@/lib/AuthContext';
import { captureEvent } from '@/lib/posthog';
import { rememberSignupCta } from '@/lib/attribution';
import { createPageUrl } from '@/utils';

/**
 * What a signed-out visitor sees on any address the public route list
 * does not cover.
 *
 * Until October 2026 every such address rendered the bare sign-in form:
 * "Community Gallery" on the Care Guide and Morph Guide, a typo like
 * /MorphGuid, or an old bookmark all showed a login box with no word
 * about where the visitor was. Now:
 *   - a members-only page (any page in the app's registry) explains what
 *     that page is, with Create account, Sign in (both come back here
 *     afterwards) and Look around the demo;
 *   - anything else is a real "page not found" (noindex).
 */

// Short, true descriptions for the members-only pages public pages link
// to most. Every other registered page falls back to the generic line.
const MEMBER_PAGES = {
  gallery: {
    title: 'Community Gallery',
    body: 'Photos of crested geckos shared by Geck Inspect members, filterable by morph, so you can see Lilly Whites, Harlequins and Axanthics in real animals rather than one example photo. The gallery is for signed-in members.',
  },
  mygeckos: {
    title: 'My Geckos',
    body: 'Your collection: one record per gecko with its morph, parents, weights and photos.',
  },
  dashboard: {
    title: 'Dashboard',
    body: 'Your collection at a glance: what is due, recent weigh-ins and your breeding season.',
  },
  breeding: {
    title: 'Breeding',
    body: 'Pairings, egg drops and incubation for your crested geckos, with each hatchling linked to its parents.',
  },
  lineage: {
    title: 'Lineage',
    body: 'Family trees for the geckos in your collection, built from the parents you record.',
  },
  market: {
    title: 'Market',
    body: 'Crested gecko prices from real listings and how your own geckos compare.',
  },
  forum: {
    title: 'Forum',
    body: 'Questions and answers from crested gecko keepers and breeders.',
  },
  forumpost: {
    title: 'Forum',
    body: 'Questions and answers from crested gecko keepers and breeders.',
  },
  portfolio: {
    title: 'Collection value',
    body: 'Estimated value of each gecko in your collection, from real crested gecko listings.',
  },
};

const PAGE_KEYS = new Map(Object.keys(PAGES).map((k) => [k.toLowerCase(), k]));

/** The registered member page an address points at, or null. Exported for tests. */
export function memberPageFor(pathname) {
  const first = String(pathname || '').split('/').filter(Boolean)[0] || '';
  const key = first.toLowerCase();
  if (!key || key === 'home' || key === 'authportal') return null;
  const name = PAGE_KEYS.get(key);
  if (!name) return null;
  const known = MEMBER_PAGES[key];
  return {
    name,
    title: known?.title || name.replace(/([a-z])([A-Z])/g, '$1 $2'),
    body: known?.body || 'This part of Geck Inspect is for members.',
  };
}

export default function SignedOutFallback() {
  const location = useLocation();
  const page = memberPageFor(location.pathname);
  if (!page) return <PageNotFound />;
  return <MembersOnly page={page} />;
}

function MembersOnly({ page }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { enterGuestMode } = useAuth();
  const here = location.pathname + location.search;
  const back = encodeURIComponent(here);

  const track = (target) => {
    captureEvent('content_cta_clicked', {
      cta: 'members_only',
      page_type: 'members_only',
      page: location.pathname,
      target,
    });
    if (target === 'signup') rememberSignupCta({ cta: 'members_only', page: location.pathname, pageType: 'members_only' });
  };

  const tryDemo = () => {
    track('demo');
    enterGuestMode();
    navigate(createPageUrl('Dashboard'));
  };

  return (
    <PublicPageShell>
      <Seo
        title={`${page.title}, for members`}
        description={`${page.title} is part of the Geck Inspect app for crested gecko keepers and breeders.`}
        path={location.pathname}
        noIndex
      />
      <section className="max-w-xl mx-auto px-6 py-12 md:py-20">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300 mb-4">
          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          For members
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">{page.title}</h1>
        <p className="text-slate-300 leading-relaxed mb-6">{page.body}</p>
        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          Sign in to open it. New here? A free account takes a minute, covers up to 10 geckos and needs no card.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to={`/AuthPortal?mode=signup&redirect=${back}`}
            onClick={() => track('signup')}
            className="inline-flex items-center justify-center rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-5 min-h-11 text-sm"
          >
            Create a free account
          </Link>
          <Link
            to={`/AuthPortal?redirect=${back}`}
            onClick={() => track('signin')}
            className="inline-flex items-center justify-center rounded-md border border-slate-600 hover:border-slate-400 text-slate-100 font-semibold px-5 min-h-11 text-sm"
          >
            Sign in
          </Link>
        </div>
        <button
          type="button"
          onClick={tryDemo}
          className="mt-4 inline-flex items-center min-h-11 text-sm text-emerald-200 hover:text-emerald-100 underline underline-offset-4 decoration-emerald-500/40"
        >
          Or look around the demo collection first
        </button>
        <div className="mt-10 border-t border-slate-800 pt-6 text-sm text-slate-400">
          Free without an account:{' '}
          <Link to="/MorphGuide" className="text-emerald-300 hover:underline">Morph Guide</Link>,{' '}
          <Link to="/CareGuide" className="text-emerald-300 hover:underline">Care Guide</Link>,{' '}
          <Link to="/calculator" className="text-emerald-300 hover:underline">genetics calculator</Link>.
        </div>
      </section>
    </PublicPageShell>
  );
}
