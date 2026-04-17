import './App.css'
import { Suspense, lazy, useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import PostHogPageTracker from '@/lib/PostHogPageTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UpdateNotification from '@/components/ui/UpdateNotification';
import LoginPortal from '@/components/auth/LoginPortal';
import ScrollToTop from '@/components/shared/ScrollToTop';
import { base44 } from '@/api/base44Client';

// Public landing page — stays eager because it's what unauthenticated
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
const MorphGuideList       = lazy(() => import('./pages/MorphGuide'));
const PrivacyPolicy        = lazy(() => import('./pages/PrivacyPolicy'));
// Content pages that were previously auth-gated despite being in the
// sitemap — moved public so crawlers (and humans without an account) can
// actually read them. The pages render their own public header/footer
// and link through to sign-up CTAs where relevant.
const CareGuide             = lazy(() => import('./pages/CareGuide'));
const GeneticsGuide         = lazy(() => import('./pages/GeneticsGuide'));
const GeneticCalculatorTool = lazy(() => import('./pages/GeneticCalculatorTool'));
// Programmatic-SEO static content pages (About / Contact / Terms).
// These render a public header + footer so unauthenticated visitors
// (and non-JS crawlers after prerender) see full chrome, not a blank
// page.
const About                 = lazy(() => import('./pages/About'));
const Contact               = lazy(() => import('./pages/Contact'));
const Terms                 = lazy(() => import('./pages/Terms'));

// Special-case pages that need unique routing (no layout, param routes, etc.)
const AdminMigration = lazy(() => import('./pages/AdminMigration'));

// P1 — Animal Passport (public pages, no auth required)
const AnimalPassport        = lazy(() => import('./pages/AnimalPassport'));
const PassportQR            = lazy(() => import('./pages/PassportQR'));
const ClaimAnimal           = lazy(() => import('./pages/ClaimAnimal'));
// P5 — Geck Answers (public read, auth to post)
const GeckAnswersPublic     = lazy(() => import('./pages/GeckAnswers'));

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

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
  useEffect(() => {
    if (!isAuthenticated) return;
    base44.entities.PageConfig.list().then((configs) => {
      if (!Array.isArray(configs)) return;
      const disabled = new Set(
        configs.filter(c => c.is_enabled === false).map(c => c.page_name)
      );
      // Never disable essential navigation targets
      ['Membership', 'Settings', 'AuthPortal', 'Notifications', 'Messages'].forEach(
        p => disabled.delete(p)
      );
      setDisabledPages(disabled);
    }).catch((err) => console.error('Failed to load page configs:', err));
  }, [isAuthenticated]);

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
          <Route path="/MorphGuide/:slug" element={<MorphDetail />} />
          <Route path="/CareGuide" element={<CareGuide />} />
          <Route path="/GeneticsGuide" element={<GeneticsGuide />} />
          <Route path="/GeneticCalculatorTool" element={<GeneticCalculatorTool />} />
          <Route path="/About" element={<About />} />
          <Route path="/Contact" element={<Contact />} />
          <Route path="/Terms" element={<Terms />} />
          <Route path="/PrivacyPolicy" element={<PrivacyPolicy />} />
          {/* Breeder is indexable under both /Breeder?slug= (legacy) and
              /Breeder/<slug> (clean, preferred); the page itself reads
              whichever the router hands it. */}
          <Route path="/Breeder/:slug" element={<Breeder />} />
          {/* P1 — Public passport pages (no auth needed) */}
          <Route path="/passport/:passportCode" element={<AnimalPassport />} />
          <Route path="/passport/:passportCode/qr" element={<PassportQR />} />
          <Route path="/claim/:token" element={<ClaimAnimal />} />
          {/* P5 — Geck Answers (public read) */}
          <Route path="/GeckAnswers" element={<GeckAnswersPublic />} />
          <Route path="*" element={<LoginPortal />} />
        </Routes>
      </Suspense>
    );
  }

  // Render the main app
  return (
    <Suspense fallback={LazyFallback}>
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            disabledPages.has(path)
              ? <Navigate to="/" replace />
              : <LayoutWrapper currentPageName={path}>
                  <Page />
                </LayoutWrapper>
          }
        />
      ))}

      <Route path="/MorphGuide/:slug" element={
        <LayoutWrapper currentPageName="MorphGuide">
          <MorphDetail />
        </LayoutWrapper>
      } />
      <Route path="/AdminMigration" element={<AdminMigration />} />
      {/* P1 — Public passport pages (also available when authenticated) */}
      <Route path="/passport/:passportCode" element={<AnimalPassport />} />
      <Route path="/passport/:passportCode/qr" element={
        <LayoutWrapper currentPageName="PassportQR"><PassportQR /></LayoutWrapper>
      } />
      <Route path="/claim/:token" element={<ClaimAnimal />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <HelmetProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <NavigationTracker />
            <PostHogPageTracker />
            <AuthenticatedApp />
          </Router>
          <Toaster />
          <VisualEditAgent />
          <UpdateNotification />
        </QueryClientProvider>
      </AuthProvider>
    </HelmetProvider>
  )
}

export default App
