import './App.css'
import { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import PostHogPageTracker from '@/lib/PostHogPageTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UpdateNotification from '@/components/ui/UpdateNotification';
import LoginPortal from '@/components/auth/LoginPortal';

// Public landing page — stays eager because it's what unauthenticated
// visitors (and crawlers) hit first.
import Home from './pages/Home';

// Lazy-loaded pages used in the unauthenticated route set.
// (The authenticated set is driven entirely by pages.config.js.)
const Breeder       = lazy(() => import('./pages/Breeder'));
const Shipping      = lazy(() => import('./pages/Shipping'));
const Giveaways     = lazy(() => import('./pages/Giveaways'));
const MorphDetail   = lazy(() => import('./pages/MorphDetail'));
const MorphGuideList = lazy(() => import('./pages/MorphGuide'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));

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
  const { isLoadingAuth, isAuthenticated } = useAuth();

  // Show loading spinner while checking auth
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // When the visitor is NOT signed in, the root URL shows the public
  // landing page (good for SEO and first impressions), and any other
  // route falls through to the login portal so protected pages stay
  // gated behind auth.
  if (!isAuthenticated) {
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
          <Route path="/PrivacyPolicy" element={<PrivacyPolicy />} />
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
            <LayoutWrapper currentPageName={path}>
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
