import './App.css'
import { Suspense, lazy, useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import PostHogPageTracker from '@/lib/PostHogPageTracker'
import GA4PageTracker from '@/lib/GA4PageTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, Outlet } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import UpdateNotification from '@/components/ui/UpdateNotification';
import LoginPortal from '@/components/auth/LoginPortal';
import ScrollToTop from '@/components/shared/ScrollToTop';
import { base44 } from '@/api/base44Client';
import { captureReferralFromUrl } from '@/lib/referral';
import { captureSignupGrantFromUrl } from '@/lib/store/signupGrant';

// Pull ?ref=<code> off the URL into localStorage as early as possible,
// before any router renders, so the param is captured even on the very
// first navigation away from the landing page. applyPendingReferral
// (called from AuthContext on sign-in) consumes it later.
captureReferralFromUrl();
// Same idea for ?grant=<token> from the email receipt link ,  capture
// before any redirect / OAuth round-trip clobbers the URL, then
// applyPendingSignupGrant redeems it on first authenticated session.
captureSignupGrantFromUrl();

// Public landing page ,  stays eager because it's what unauthenticated
// visitors (and crawlers) hit first.
import Home from './pages/Home';

// Lazy-loaded pages used in the unauthenticated route set.
// (The authenticated set is driven entirely by pages.config.js.)
//
// Every entry here is a page we *want* search engines + AI crawlers to
// index. Auth-gating any of these would hand a blank login form to
// crawlers and erase the SEO investment in that page's content +
// structured data, so move pages OUT of this list carefully.
const Breeder              = lazy(() => import('./pages/Breeder'));
const Shipping             = lazy(() => import('./pages/Shipping'));
const Giveaways            = lazy(() => import('./pages/Giveaways'));
const MorphDetail          = lazy(() => import('./pages/MorphDetail'));
const ProjectLineDetail    = lazy(() => import('./pages/ProjectLineDetail'));
const MorphGuideList       = lazy(() => import('./pages/MorphGuide'));
// Programmatic taxonomy hubs: /MorphGuide/category/<id> and
// /MorphGuide/inheritance/<id>. Two routes, one module ,  the module
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
// sitemap ,  moved public so crawlers (and humans without an account) can
// actually read them. The pages render their own public header/footer
// and link through to sign-up CTAs where relevant.
const CareGuide             = lazy(() => import('./pages/CareGuide'));
const CareGuideTopic        = lazy(() => import('./pages/CareGuideTopic'));
const CareGuideSeries       = lazy(() => import('./pages/CareGuideSeries'));
const GeneticsGuide         = lazy(() => import('./pages/GeneticsGuide'));
const GeneticCalculatorTool = lazy(() => import('./pages/GeneticCalculatorTool'));
const CalculatorMorph       = lazy(() => import('./pages/CalculatorMorph'));
// Programmatic-SEO static content pages (About / Contact / Terms).
// These render a public header + footer so unauthenticated visitors
// (and non-JS crawlers after prerender) see full chrome, not a blank
// page.
const About                 = lazy(() => import('./pages/About'));
const Contact               = lazy(() => import('./pages/Contact'));
const Terms                 = lazy(() => import('./pages/Terms'));
const MarketplaceVerification = lazy(() => import('./pages/MarketplaceVerification'));
const StorePage             = lazy(() => import('./pages/StorePage'));
// P11 Quality Scale: public rubric for grading a crested gecko on
// structure, head, pattern, and color. Spec: docs/specs/P11-quality-rubric.md.
const QualityScale          = lazy(() => import('./pages/QualityScale'));

// P1 ,  Animal Passport (public pages, no auth required)
const AnimalPassport        = lazy(() => import('./pages/AnimalPassport'));
const PassportQR            = lazy(() => import('./pages/PassportQR'));
const ClaimAnimal           = lazy(() => import('./pages/ClaimAnimal'));
const CollectionInvite      = lazy(() => import('./pages/CollectionInvite'));
const Waitlist              = lazy(() => import('./pages/Waitlist'));
// P5 ,  Geck Answers (public read, auth to post)
const GeckAnswersPublic     = lazy(() => import('./pages/GeckAnswers'));
// Editorial blog ,  long-form genetics, breeding, and care articles. Lives
// under /blog/<slug>, indexable, prerendered, and JSON-LD wired through
// the same pipeline as MorphGuide / CareGuide topic pages.
const BlogIndex             = lazy(() => import('./pages/BlogIndex'));
const BlogPost              = lazy(() => import('./pages/BlogPost'));
const BlogCategoryPage      = lazy(() => import('./pages/BlogCategoryPage'));
const BlogTagPage           = lazy(() => import('./pages/BlogTagPage'));
// Store ,  Supplies tab. Public for guests (gift SEO), works for auth too.
// Self-contained chrome; mounted at /Store/* so internal sub-routes
// (cart, gifts, PDPs) resolve without colliding with the auto-router.
const Store                 = lazy(() => import('./pages/Store'));

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

// Spinner used for the in-Layout Suspense boundary ,  fills whatever
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
// navigation ,  previously each Route.element created its own
// LayoutWrapper, so React unmounted + remounted the entire Layout
// (and reset the sidebar collapse state) on every link click.
//
// The inner Suspense is critical: lazy page chunks throw a promise
// while loading, and the nearest Suspense boundary renders its
// fallback in place of everything below it. Without this boundary,
// the outer Suspense at Routes level would catch it and replace the
// Layout with the global spinner ,  which is why first-time
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
    if (!isAuthenticated) return;
    const loadDisabled = () => {
      base44.entities.PageConfig.list().then((configs) => {
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
        // Never disable essential navigation targets
        ['Membership', 'Settings', 'AuthPortal', 'Notifications', 'Messages'].forEach(
          p => disabled.delete(p)
        );
        setDisabledPages(disabled);
      }).catch((err) => console.error('Failed to load page configs:', err));
    };
    loadDisabled();
    window.addEventListener('page_configs_changed', loadDisabled);
    return () => window.removeEventListener('page_configs_changed', loadDisabled);
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
          <Route path="/Shipping" element={<Shipping />} />
          <Route path="/Giveaways" element={<Giveaways />} />
          <Route path="/MorphGuide" element={<MorphGuideList />} />
          <Route path="/MorphGuide/category/:categoryId" element={<MorphCategoryHub />} />
          <Route path="/MorphGuide/inheritance/:inheritanceId" element={<MorphInheritanceHub />} />
          <Route path="/MorphGuide/lines/:slug" element={<ProjectLineDetail />} />
          <Route path="/MorphGuide/:slug" element={<MorphDetail />} />
          <Route path="/CareGuide" element={<CareGuide />} />
          <Route path="/CareGuide/series" element={<CareGuideSeries />} />
          <Route path="/CareGuide/series/:guideId" element={<CareGuideSeries />} />
          <Route path="/CareGuide/:topic" element={<CareGuideTopic />} />
          <Route path="/GeneticsGuide" element={<GeneticsGuide />} />
          <Route path="/GeneticCalculatorTool" element={<GeneticCalculatorTool />} />
          {/* Cleaner, marketable URL alias for the genetics calculator , 
              the legacy path is kept above so existing links and the
              authenticated PAGES table keep working. */}
          <Route path="/calculator" element={<GeneticCalculatorTool />} />
          <Route path="/calculator/:morph" element={<CalculatorMorph />} />
          <Route path="/About" element={<About />} />
          <Route path="/Contact" element={<Contact />} />
          <Route path="/Terms" element={<Terms />} />
          <Route path="/MarketplaceVerification" element={<MarketplaceVerification />} />
          <Route path="/store/:slug" element={<StorePage />} />
          <Route path="/QualityScale" element={<QualityScale />} />
          <Route path="/PrivacyPolicy" element={<PrivacyPolicy />} />
          {/* Breeder is indexable under both /Breeder?slug= (legacy) and
              /Breeder/<slug> (clean, preferred); the page itself reads
              whichever the router hands it. */}
          <Route path="/Breeder/:slug" element={<Breeder />} />
          {/* P1 ,  Public passport pages (no auth needed) */}
          <Route path="/passport/:passportCode" element={<AnimalPassport />} />
          <Route path="/passport/:passportCode/qr" element={<PassportQR />} />
          <Route path="/claim/:token" element={<ClaimAnimal />} />
          <Route path="/collection-invite/:token" element={<CollectionInvite />} />
          <Route path="/waitlist/:slug" element={<Waitlist />} />
          {/* P5 ,  Geck Answers (public read) */}
          <Route path="/GeckAnswers" element={<GeckAnswersPublic />} />
          {/* Editorial blog */}
          <Route path="/blog" element={<BlogIndex />} />
          <Route path="/blog/category/:slug" element={<BlogCategoryPage />} />
          <Route path="/blog/tag/:slug" element={<BlogTagPage />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          {/* Store ,  public so guests can shop and check out. */}
          <Route path="/Store/*" element={<Store />} />
          <Route path="*" element={<LoginPortal />} />
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
      <Route element={<LayoutOutlet />}>
        <Route path="/" element={<MainPage />} />
        {Object.entries(Pages).map(([path, Page]) => {
          // Authenticated users on /AuthPortal mean they just signed in
          // (the URL hasn't moved yet). Bounce them to the dashboard so
          // they actually see the app instead of an empty login form.
          if (path === 'AuthPortal') {
            return (
              <Route
                key={path}
                path={`/${path}`}
                element={<Navigate to="/" replace />}
              />
            );
          }
          return (
            <Route
              key={path}
              path={`/${path}`}
              element={
                disabledPages.has(path)
                  ? <Navigate to="/" replace />
                  : <Page />
              }
            />
          );
        })}
        <Route path="/MorphGuide/lines/:slug" element={<ProjectLineDetail />} />
        <Route path="/MorphGuide/:slug" element={<MorphDetail />} />
        <Route path="/passport/:passportCode/qr" element={<PassportQR />} />
        {/* /calculator alias inside the authenticated layout so signed-in
            users hitting the cleaner URL keep their app chrome. */}
        <Route path="/calculator" element={<GeneticCalculatorTool />} />
        <Route path="/calculator/:morph" element={<CalculatorMorph />} />
        {/* Store ,  nested inside Layout so the sidebar persists. The
            StoreLayout component skips its standalone header when an
            authenticated user is detected (i.e. when the parent Layout
            is mounted) so the brand chrome doesn't double up. */}
        <Route path="/Store/*" element={<Store />} />
      </Route>

      {/* Editorial blog ,  accessible to authenticated users too */}
      <Route path="/blog" element={<BlogIndex />} />
      <Route path="/blog/category/:slug" element={<BlogCategoryPage />} />
      <Route path="/blog/tag/:slug" element={<BlogTagPage />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
      {/* P1 ,  Public passport pages (also available when authenticated) */}
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
          <QueryClientProvider client={queryClientInstance}>
            <Router>
              <ScrollToTop />
              <NavigationTracker />
              <PostHogPageTracker />
              <GA4PageTracker />
              <AuthenticatedApp />
            </Router>
            <Toaster />
            <VisualEditAgent />
            <UpdateNotification />
          </QueryClientProvider>
        </AuthProvider>
      </ThemeProvider>
    </HelmetProvider>
  )
}

export default App