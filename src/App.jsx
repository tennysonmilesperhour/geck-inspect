import './App.css'
import { Suspense, useState, useEffect } from 'react';
// Retry-wrapped drop-in for React.lazy: recovers from transient chunk
// fetch failures and stale-deploy hash mismatches. See lazyWithRetry.js.
import { lazy } from '@/lib/lazyWithRetry';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { queryClientInstance } from '@/lib/query-client'
// Base44-era visual editor bridge. Only mounted in dev: it registers a
// window message handler and there is no editor left to talk to in
// production. The build drops the import entirely when DEV is false.
const VisualEditAgent = import.meta.env.DEV ? lazy(() => import('@/lib/VisualEditAgent')) : null;
import NavigationTracker from '@/lib/NavigationTracker'
import PostHogPageTracker from '@/lib/PostHogPageTracker'
import GA4PageTracker from '@/lib/GA4PageTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { redirectFromSearch, takePostAuthRedirect } from '@/lib/postAuthRedirect';
import PageNotFound from './lib/PageNotFound';
import { isGuestMode } from '@/lib/guestMode';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { RevenueCatProvider } from '@/lib/RevenueCatContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import UpdateNotification from '@/components/ui/UpdateNotification';
import OfflineSyncStatus from '@/components/shared/OfflineSyncStatus';
// Sign-in, password reset and the public page shell are lazy: a visitor
// reading the Morph Guide never needs them up front.
const LoginPortal = lazy(() => import('@/components/auth/LoginPortal'));
const SetNewPassword = lazy(() => import('@/components/auth/SetNewPassword'));
const PublicPageShell = lazy(() => import('@/components/public/PublicPageShell'));
// Signed-out visitors who open a members-only page get a short "what this
// is, sign in or create an account" page; unknown addresses get a real
// page not found (both used to show a bare sign-in form).
const SignedOutFallback = lazy(() => import('@/components/public/SignedOutFallback'));
import ScrollToTop from '@/components/shared/ScrollToTop';
import { api } from '@/api/appClient';
import { captureReferralFromUrl } from '@/lib/referral';
import { captureFirstTouch } from '@/lib/attribution';
import { captureSignupGrantFromUrl } from '@/lib/store/signupGrant';
import { RETIRED_PAGES } from '@/lib/retiredPages';

// First-touch attribution (referrer host, UTM tags, landing path) is
// recorded once per browser. It has to run before the two helpers below
// strip ?ref and ?grant from the address bar.
captureFirstTouch();
// Pull ?ref=<code> off the URL into localStorage as early as possible,
// before any router renders, so the param is captured even on the very
// first navigation away from the landing page. applyPendingReferral
// (called from AuthContext on sign-in) consumes it later.
captureReferralFromUrl();
// Same idea for ?grant=<token> from the email receipt link, capture
// before any redirect / OAuth round-trip clobbers the URL, then
// applyPendingSignupGrant redeems it on first authenticated session.
captureSignupGrantFromUrl();

// Public landing page. Lazy like every other page since October 2026, so
// a visitor landing on the Morph Guide or Care Guide does not download
// the landing page code. The prerendered "/" document carries a
// modulepreload for this chunk (scripts/prerender.mjs), and the line
// below starts the fetch right away on other builds, so the landing
// page does not wait an extra round trip.
const loadHome = () => import('./pages/Home');
const Home = lazy(loadHome);

// Start downloading the code the first screen needs while the auth check
// runs, instead of after it. Signed-in members and demo guests land in
// the app shell (Layout + Dashboard); signed-out visitors on "/" land on
// the landing page.
function warmFirstScreen() {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  let hasSession = false;
  try {
    hasSession = isGuestMode() || Object.keys(window.localStorage).some(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
    );
  } catch { /* storage blocked: fall through to the signed-out guess */ }
  if (hasSession) {
    import('./Layout.jsx').catch(() => {});
    if (path === '/' || path === '/Dashboard') import('./pages/Dashboard').catch(() => {});
  } else if (path === '/' || path === '/Home') {
    loadHome().catch(() => {});
  }
}
warmFirstScreen();

// Lazy-loaded pages used in the unauthenticated route set.
// (The authenticated set is driven entirely by pages.config.js.)
//
// Every entry here is a page we *want* search engines + AI crawlers to
// index. Auth-gating any of these would hand a blank login form to
// crawlers and erase the SEO investment in that page's content +
// structured data, so move pages OUT of this list carefully.
const Breeder              = lazy(() => import('./pages/Breeder'));
const MorphDetail          = lazy(() => import('./pages/MorphDetail'));
const ProjectLineDetail    = lazy(() => import('./pages/ProjectLineDetail'));
const VisualDesignPreview = import.meta.env.DEV ? lazy(() => import('./components/preview/VisualDesignPreview')) : null;
const MorphGuideList       = lazy(() => import('./pages/MorphGuide'));
// Programmatic taxonomy hubs: /MorphGuide/category/<id> and
// /MorphGuide/inheritance/<id>. Two routes, one module, the module
// exports named components per variant so each route resolves its
// expected param shape via useParams() directly.
const MorphCategoryHub     = lazy(() =>
  import('./pages/MorphTaxonomyHub').then((m) => ({ default: m.MorphCategoryHub })),
);
const MorphInheritanceHub  = lazy(() =>
  import('./pages/MorphTaxonomyHub').then((m) => ({ default: m.MorphInheritanceHub })),
);
const PrivacyPolicy        = lazy(() => import('./pages/PrivacyPolicy'));
// Content pages that were previously auth-gated despite being in the
// sitemap, moved public so crawlers (and humans without an account) can
// actually read them. The pages render their own public header/footer
// and link through to sign-up CTAs where relevant.
const CareGuide             = lazy(() => import('./pages/CareGuide'));
const CareGuideTopic        = lazy(() => import('./pages/CareGuideTopic'));
const CareGuideSeries       = lazy(() => import('./pages/CareGuideSeries'));
const GeneticsGuide         = lazy(() => import('./pages/GeneticsGuide'));
const GeneticCalculatorTool = lazy(() => import('./pages/GeneticCalculatorTool'));
const CalculatorMorph       = lazy(() => import('./pages/CalculatorMorph'));
const CalculatorPairing     = lazy(() => import('./pages/CalculatorPairing'));
const ReverseCalculator     = lazy(() => import('./pages/ReverseCalculator'));
const ClutchLab             = lazy(() => import('./pages/ClutchLab'));
// Programmatic-SEO static content pages (About / Contact / Terms).
// These render a public header + footer so unauthenticated visitors
// (and non-JS crawlers after prerender) see full chrome, not a blank
// page.
const About                 = lazy(() => import('./pages/About'));
const Contact               = lazy(() => import('./pages/Contact'));
// Signed-out unsubscribe from notification emails (link in every email).
const Unsubscribe           = lazy(() => import('./pages/Unsubscribe'));
const Terms                 = lazy(() => import('./pages/Terms'));
const MarketplaceVerification = lazy(() => import('./pages/MarketplaceVerification'));
const StorePage             = lazy(() => import('./pages/StorePage'));
// P11 Quality Scale: public rubric for grading a crested gecko on
// structure, head, pattern, and color. Spec: docs/specs/P11-quality-rubric.md.
const QualityScale          = lazy(() => import('./pages/QualityScale'));
// Pricing must be readable before anyone creates an account. Rendered in
// the public shell for visitors; signed-in users get it inside Layout via
// the PAGES map as before.
const MembershipPublic      = lazy(() => import('./pages/Membership'));
const RecognitionPublic     = lazy(() => import('./pages/Recognition'));

// Public feature landing pages. Crawlable front doors for the auth-gated
// pedigree/lineage and breeding tools, targeting "crested gecko pedigree
// tracker" and "gecko breeding records" search intent.
const PedigreeTracker       = lazy(() => import('./pages/PedigreeTracker'));
const BreedingRecords       = lazy(() => import('./pages/BreedingRecords'));
const CrestedGeckoPrice     = lazy(() => import('./pages/CrestedGeckoPrice'));
const OpenData              = lazy(() => import('./pages/OpenData'));

// P1, Animal Passport (public pages, no auth required)
const AnimalPassport        = lazy(() => import('./pages/AnimalPassport'));
const PassportQR            = lazy(() => import('./pages/PassportQR'));
const ClaimAnimal           = lazy(() => import('./pages/ClaimAnimal'));
const CollectionInvite      = lazy(() => import('./pages/CollectionInvite'));
const Waitlist              = lazy(() => import('./pages/Waitlist'));
// Editorial blog, long-form genetics, breeding, and care articles. Lives
// under /blog/<slug>, indexable, prerendered, and JSON-LD wired through
// the same pipeline as MorphGuide / CareGuide topic pages.
const BlogIndex             = lazy(() => import('./pages/BlogIndex'));
const BlogPost              = lazy(() => import('./pages/BlogPost'));
const BlogCategoryPage      = lazy(() => import('./pages/BlogCategoryPage'));
const BlogTagPage           = lazy(() => import('./pages/BlogTagPage'));
// Store, Supplies tab. Public for guests (gift SEO), works for auth too.
// Self-contained chrome; mounted at /Store/* so internal sub-routes
// (cart, gifts, PDPs) resolve without colliding with the auto-router.
const Store                 = lazy(() => import('./pages/Store'));

const { Pages, Layout, mainPage } = pagesConfig;

// Redirects for retired pages, shared by the signed-out and signed-in
// route sets so an old link never ends on "Page not found".
const retiredRoutes = RETIRED_PAGES.map(({ page, to }) => (
  <Route key={`retired-${page}`} path={`/${page}`} element={<Navigate to={to} replace />} />
));
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

// Spinner used for the in-Layout Suspense boundary, fills whatever
// space the page slot has rather than the whole viewport, so the
// sidebar + header stay visible while a lazy page chunk loads.
const PageSuspenseFallback = (
  <div className="flex-1 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
  </div>
);

// Parent-route element that wraps authenticated pages in a single
// Layout instance and renders the matched child via <Outlet/>. This
// keeps the Layout (sidebar, header, hover state) mounted across
// navigation, previously each Route.element created its own
// LayoutWrapper, so React unmounted + remounted the entire Layout
// (and reset the sidebar collapse state) on every link click.
//
// The inner Suspense is critical: lazy page chunks throw a promise
// while loading, and the nearest Suspense boundary renders its
// fallback in place of everything below it. Without this boundary,
// the outer Suspense at Routes level would catch it and replace the
// Layout with the global spinner, which is why first-time
// navigations (uncached chunks) appeared to reload the menu while
// repeat navigations (cached chunks) preserved state.
const LayoutOutlet = () => Layout ? (
  <Layout>
    <Suspense fallback={PageSuspenseFallback}>
      <Outlet />
    </Suspense>
  </Layout>
) : <Outlet />;

const LazyFallback = (
  <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
    <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
  </div>
);

// A signed-in user on /AuthPortal normally just bounces to the dashboard,
// or back to the claim link or invite that sent them to sign in
// (?redirect= or ?next=, see src/lib/postAuthRedirect.js). The one
// exception is the password reset link, which lands here as
// /AuthPortal?mode=reset with a recovery session and needs the
// choose-a-new-password form.
const AuthPortalAuthed = () => {
  const location = useLocation();
  const mode = new URLSearchParams(location.search).get('mode');
  if (mode === 'reset') return <SetNewPassword />;
  const target = redirectFromSearch(location.search);
  return <Navigate to={target || '/'} replace />;
};

// After an email confirmation or Google sign-in the app opens on
// /MyGeckos; if the person came from a claim link or invite, go there.
const PostAuthRedirect = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (!isAuthenticated) return;
    const target = takePostAuthRedirect();
    if (target && target !== location.pathname + location.search) navigate(target, { replace: true });
  }, [isAuthenticated]);
  return null;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated, isGuest } = useAuth();
  const [disabledPages, setDisabledPages] = useState(new Set());

  // Load page configs to enforce is_enabled at the router level.
  // Deactivated pages redirect to / instead of rendering.
  //
  // Refreshes both on auth change AND whenever PageManagement fires
  // `page_configs_changed` (after the admin toggles a page), so a
  // deactivation takes effect immediately instead of requiring a
  // browser reload to invalidate the in-memory disabledPages set.
  useEffect(() => {
    if (!isAuthenticated && !isGuest) return;
    const loadDisabled = () => {
      api.entities.PageConfig.list().then((configs) => {
        if (!Array.isArray(configs)) return;
        // Group by page_name so duplicate rows don't disable a page when
        // the admin has already re-enabled one of the copies. A page is
        // only considered disabled if NO row for that page_name is enabled.
        const byName = new Map();
        for (const c of configs) {
          if (!c?.page_name) continue;
          if (!byName.has(c.page_name)) byName.set(c.page_name, []);
          byName.get(c.page_name).push(c);
        }
        const disabled = new Set();
        for (const [name, rows] of byName.entries()) {
          if (rows.every(r => r.is_enabled === false)) disabled.add(name);
        }
        // Never disable essential navigation targets, or pages that live
        // screens link to: hiding FieldMode, Gallery or Training in the
        // admin Pages tool is meant to take them out of the sidebar, but
        // the passport quick log opens Field Mode, the Dashboard opens the
        // Gallery, and admins send expert reviewers to Training.
        ['Membership', 'Settings', 'AuthPortal', 'Notifications', 'Messages', 'FieldMode', 'Gallery', 'Training'].forEach(
          p => disabled.delete(p)
        );
        setDisabledPages(disabled);
      }).catch((err) => console.error('Failed to load page configs:', err));
    };
    loadDisabled();
    window.addEventListener('page_configs_changed', loadDisabled);
    return () => window.removeEventListener('page_configs_changed', loadDisabled);
  }, [isAuthenticated, isGuest]);

  // Offline logging: fetch the Field Mode and My Geckos code once the app is
  // idle, so the service worker has it cached before the member is out of
  // signal. Without this a page never opened online could not open offline.
  useEffect(() => {
    if (!isAuthenticated || typeof window === 'undefined') return undefined;
    const prefetch = () => {
      import('./pages/FieldMode').catch(() => {});
      import('./pages/MyGeckos').catch(() => {});
    };
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(prefetch, { timeout: 10000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = setTimeout(prefetch, 5000);
    return () => clearTimeout(t);
  }, [isAuthenticated]);

  // PWA launch redirect: existing home-screen icons may have been saved
  // when start_url was "/" (or while the user was on /Messages), and iOS
  // caches the manifest aggressively, so a manifest-only fix doesn't
  // reach already-installed icons. Once per session, if the app was
  // launched as a standalone PWA and lands on / or /Messages, bounce to
  // /MyGeckos. The sessionStorage flag means subsequent in-app
  // navigation to Messages still works normally.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('pwa_launch_handled')) return;
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (!isStandalone) return;
    sessionStorage.setItem('pwa_launch_handled', '1');
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    if (path === '/' || path === '/Messages') {
      window.location.replace('/MyGeckos');
    }
  }, []);

  // Show loading spinner while checking auth
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // When the visitor is NOT signed in and NOT in guest mode, the root
  // URL shows the public landing page (good for SEO and first
  // impressions), and any other route falls through to the login portal
  // so protected pages stay gated behind auth.
  if (!isAuthenticated && !isGuest) {
    return (
      <Suspense fallback={LazyFallback}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/Home" element={<Home />} />
          <Route path="/Breeder" element={<Breeder />} />
          {/* Retired pages (src/lib/retiredPages.js). vercel.json 301s
              these at the edge; this covers client-side navigation from
              stale links. */}
          {retiredRoutes}
          {import.meta.env.DEV && <Route path="/DesignPreview" element={<VisualDesignPreview />} />}
          <Route path="/MorphGuide" element={<MorphGuideList />} />
          <Route path="/MorphGuide/category/:categoryId" element={<MorphCategoryHub />} />
          <Route path="/MorphGuide/inheritance/:inheritanceId" element={<MorphInheritanceHub />} />
          {/* Legacy self-serve subscription page, removed 2026-07 (it let
            users set membership_tier without paying). Old links land on
            the real pricing/checkout page. */}
        <Route path="/Subscription" element={<Navigate to="/Membership" replace />} />
        <Route path="/MorphGuide/lines/:slug" element={<ProjectLineDetail />} />
          <Route path="/MorphGuide/:slug" element={<MorphDetail />} />
          <Route path="/CareGuide" element={<CareGuide />} />
          <Route path="/CareGuide/series" element={<CareGuideSeries />} />
          <Route path="/CareGuide/series/:guideId" element={<CareGuideSeries />} />
          <Route path="/CareGuide/:topic" element={<CareGuideTopic />} />
          <Route path="/GeneticsGuide" element={<GeneticsGuide />} />
          <Route path="/GeneticCalculatorTool" element={<GeneticCalculatorTool />} />
          {/* Cleaner, marketable URL alias for the genetics calculator,
              the legacy path is kept above so existing links and the
              authenticated PAGES table keep working. */}
          <Route path="/calculator" element={<GeneticCalculatorTool />} />
          <Route path="/calculator/reverse" element={<ReverseCalculator />} />
          <Route path="/calculator/learn" element={<ClutchLab />} />
          <Route path="/calculator/pairing/:pairing" element={<CalculatorPairing />} />
          <Route path="/calculator/:morph" element={<CalculatorMorph />} />
          <Route path="/About" element={<About />} />
          <Route path="/Contact" element={<Contact />} />
          <Route path="/Unsubscribe" element={<Unsubscribe />} />
          <Route path="/Terms" element={<Terms />} />
          <Route path="/MarketplaceVerification" element={<MarketplaceVerification />} />
          {/* caseSensitive: React Router matches case-insensitively by
              default, so without it /Store/cart and /Store/stickers would
              land on a breeder storefront named "cart" instead of the
              supplies store. */}
          <Route path="/store/:slug" caseSensitive element={<StorePage />} />
          <Route path="/QualityScale" element={<QualityScale />} />
          <Route path="/Membership" element={<PublicPageShell><MembershipPublic /></PublicPageShell>} />
          {/* Signed-out Morph ID had no header or footer, so there was no way
              back to the site. Same shell as Membership. */}
          <Route path="/Recognition" element={<PublicPageShell><RecognitionPublic /></PublicPageShell>} />
          <Route path="/pedigree-tracker" element={<PedigreeTracker />} />
          <Route path="/breeding-records" element={<BreedingRecords />} />
          <Route path="/crested-gecko-price" element={<CrestedGeckoPrice />} />
          <Route path="/data" element={<OpenData />} />
          <Route path="/PrivacyPolicy" element={<PrivacyPolicy />} />
          {/* Breeder is indexable under both /Breeder?slug= (legacy) and
              /Breeder/<slug> (clean, preferred); the page itself reads
              whichever the router hands it. */}
          <Route path="/Breeder/:slug" element={<Breeder />} />
          {/* P1, Public passport pages (no auth needed) */}
          <Route path="/passport/:passportCode" element={<AnimalPassport />} />
          <Route path="/passport/:passportCode/qr" element={<PassportQR />} />
          <Route path="/claim/:token" element={<ClaimAnimal />} />
          <Route path="/collection-invite/:token" element={<CollectionInvite />} />
          <Route path="/waitlist/:slug" element={<Waitlist />} />
          {/* Geck Answers was folded into the Forum on 29 Sep 2026 (its
              starter questions are the Forum's Questions and Answers). */}
          <Route path="/GeckAnswers" element={<Navigate to="/Forum" replace />} />
          {/* Editorial blog */}
          <Route path="/blog" element={<BlogIndex />} />
          <Route path="/blog/category/:slug" element={<BlogCategoryPage />} />
          <Route path="/blog/tag/:slug" element={<BlogTagPage />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          {/* Store, public so guests can shop and check out. */}
          <Route path="/Store/*" element={<Store />} />
          {/* Sign-in and sign-up are real routes; every other address a
              signed-out visitor opens goes to SignedOutFallback, which
              explains members-only pages (with sign-in and sign-up) and
              shows "page not found" for anything else. */}
          <Route path="/AuthPortal" element={<LoginPortal />} />
          <Route path="*" element={<SignedOutFallback />} />
        </Routes>
      </Suspense>
    );
  }

  // Render the main app.
  //
  // All pages that share the authenticated chrome (sidebar / header)
  // live under one parent <Route element={<LayoutOutlet/>}> so the
  // Layout instance is mounted ONCE and reused across navigation.
  // Pages that render their own public chrome (blog, public passport,
  // claim) stay as sibling routes without the Layout.
  return (
    <Suspense fallback={LazyFallback}>
    <Routes>
      <Route
        path="/AuthPortal"
        element={isGuest ? <LoginPortal /> : <AuthPortalAuthed />}
      />
      <Route element={<LayoutOutlet />}>
        <Route path="/" element={<MainPage />} />
        {Object.entries(Pages).map(([path, Page]) => {
          // AuthPortal is handled outside the authenticated layout. Guests
          // need the real sign-in form; authenticated users are sent home.
          if (path === 'AuthPortal') {
            return null;
          }
          return (
            <Route
              key={path}
              path={`/${path}`}
              element={
                disabledPages.has(path)
                  ? <div className="max-w-xl mx-auto p-8 space-y-4"><h1 className="text-2xl font-semibold">This feature is currently unavailable</h1><p>We are working on this part of Geck Inspect. Your collection remains available.</p><a className="underline" href="/MyGeckos">Return to My Geckos</a></div>
                  : <Page />
              }
            />
          );
        })}
        <Route path="/MorphGuide/lines/:slug" element={<ProjectLineDetail />} />
        <Route path="/MorphGuide/:slug" element={<MorphDetail />} />
        {/* Public guide and marketing pages with a path the page registry
            can't express. Without these, signed-in and demo visitors got
            "Page not found" from every Care Guide topic, the Morph Guide
            hubs, breeder pages and About. Public pages drop their own
            chrome inside the app shell (useInAppShell). */}
        <Route path="/MorphGuide/category/:categoryId" element={<MorphCategoryHub />} />
        <Route path="/MorphGuide/inheritance/:inheritanceId" element={<MorphInheritanceHub />} />
        <Route path="/CareGuide/series" element={<CareGuideSeries />} />
        <Route path="/CareGuide/series/:guideId" element={<CareGuideSeries />} />
        <Route path="/CareGuide/:topic" element={<CareGuideTopic />} />
        <Route path="/Breeder/:slug" element={<Breeder />} />
        <Route path="/About" element={<About />} />
        <Route path="/Unsubscribe" element={<Unsubscribe />} />
        <Route path="/MarketplaceVerification" element={<MarketplaceVerification />} />
        <Route path="/pedigree-tracker" element={<PedigreeTracker />} />
        <Route path="/breeding-records" element={<BreedingRecords />} />
        <Route path="/crested-gecko-price" element={<CrestedGeckoPrice />} />
        <Route path="/data" element={<OpenData />} />
        <Route path="/Subscription" element={<Navigate to="/Membership" replace />} />
        <Route path="/GeckAnswers" element={<Navigate to="/Forum" replace />} />
        {retiredRoutes}
        <Route path="/passport/:passportCode/qr" element={<PassportQR />} />
        {/* /calculator alias inside the authenticated layout so signed-in
            users hitting the cleaner URL keep their app chrome. */}
        <Route path="/calculator" element={<GeneticCalculatorTool />} />
        <Route path="/calculator/reverse" element={<ReverseCalculator />} />
        <Route path="/calculator/learn" element={<ClutchLab />} />
        <Route path="/calculator/pairing/:pairing" element={<CalculatorPairing />} />
        <Route path="/calculator/:morph" element={<CalculatorMorph />} />
        {/* Store, nested inside Layout so the sidebar persists. The
            StoreLayout component skips its standalone header when an
            authenticated user is detected (i.e. when the parent Layout
            is mounted) so the brand chrome doesn't double up. */}
        <Route path="/Store/*" element={<Store />} />
        {/* BreederStorefront was merged into MyStore (one editor for the
            public breeder page + mini-site settings). Keep the old path
            working for anyone who bookmarked it. */}
        <Route path="/BreederStorefront" element={<Navigate to="/MyStore" replace />} />
      </Route>

      {/* Breeder storefront, rendered chrome-free for both guests and
          authenticated users so it reads as the breeder's own site, not
          a section of the Geck Inspect app. A small "Geck Inspect" pill
          inside StorePage is the only nav back. caseSensitive keeps this
          from swallowing single-segment /Store/* supplies routes. */}
      <Route path="/store/:slug" caseSensitive element={<StorePage />} />

      {/* Support and purchase terms remain reachable after sign-in and in guest mode. */}
      <Route path="/Contact" element={<Contact />} />
      <Route path="/Terms" element={<Terms />} />

      {/* Editorial blog, accessible to authenticated users too */}
      <Route path="/blog" element={<BlogIndex />} />
      <Route path="/blog/category/:slug" element={<BlogCategoryPage />} />
      <Route path="/blog/tag/:slug" element={<BlogTagPage />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
      {/* P1, Public passport pages (also available when authenticated) */}
      <Route path="/passport/:passportCode" element={<AnimalPassport />} />
      <Route path="/claim/:token" element={<ClaimAnimal />} />
      <Route path="/collection-invite/:token" element={<CollectionInvite />} />
      <Route path="/waitlist/:slug" element={<Waitlist />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <HelmetProvider>
      <ThemeProvider>
        <AuthProvider>
          <RevenueCatProvider>
            <QueryClientProvider client={queryClientInstance}>
              <Router>
                <ScrollToTop />
                <NavigationTracker />
                <PostHogPageTracker />
                <GA4PageTracker />
                <PostAuthRedirect />
                <AuthenticatedApp />
              </Router>
              <Toaster />
              {VisualEditAgent && (
                <Suspense fallback={null}>
                  <VisualEditAgent />
                </Suspense>
              )}
              <UpdateNotification />
              <OfflineSyncStatus />
            </QueryClientProvider>
          </RevenueCatProvider>
        </AuthProvider>
      </ThemeProvider>
    </HelmetProvider>
  )
}

export default App
