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
import ScrollToTop from '@/components/shared/ScrollToTop';

// Public landing page — stays eager because it's what unauthenticated
// visitors (and crawlers) hit first.
import Home from './pages/Home';

// Everything else below is lazy-loaded for bundle-size wins.
const Breeder               = lazy(() => import('./pages/Breeder'));
const Shipping              = lazy(() => import('./pages/Shipping'));
const Giveaways             = lazy(() => import('./pages/Giveaways'));
const MorphDetail           = lazy(() => import('./pages/MorphDetail'));
const MorphGuideList        = lazy(() => import('./pages/MorphGuide'));
const Pedigree              = lazy(() => import('./pages/Pedigree'));
// ForumPost is in pages.config.js — no separate import needed here.
const PrivacyPolicy         = lazy(() => import('./pages/PrivacyPolicy'));
const MarketplaceSalesStats = lazy(() => import('./pages/MarketplaceSalesStats'));
const Marketplace           = lazy(() => import('./pages/Marketplace'));
const Membership            = lazy(() => import('./pages/Membership'));
const AdminMigration        = lazy(() => import('./pages/AdminMigration'));

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
      {/* ForumPost is already in the Pages map above — no manual route needed. */}
      <Route path="/MarketplaceSalesStats" element={
        <LayoutWrapper currentPageName="MarketplaceSalesStats">
          <MarketplaceSalesStats />
        </LayoutWrapper>
      } />
      <Route path="/Marketplace" element={
        <LayoutWrapper currentPageName="Marketplace">
          <Marketplace />
        </LayoutWrapper>
      } />
      <Route path="/PrivacyPolicy" element={
        <LayoutWrapper currentPageName="PrivacyPolicy">
          <PrivacyPolicy />
        </LayoutWrapper>
      } />
      <Route path="/Membership" element={
        <LayoutWrapper currentPageName="Membership">
          <Membership />
        </LayoutWrapper>
      } />
      <Route path="/Breeder" element={
        <LayoutWrapper currentPageName="Breeder">
          <Breeder />
        </LayoutWrapper>
      } />
      <Route path="/Shipping" element={
        <LayoutWrapper currentPageName="Shipping">
          <Shipping />
        </LayoutWrapper>
      } />
      <Route path="/Giveaways" element={
        <LayoutWrapper currentPageName="Giveaways">
          <Giveaways />
        </LayoutWrapper>
      } />
      <Route path="/MorphGuide/:slug" element={
        <LayoutWrapper currentPageName="MorphGuide">
          <MorphDetail />
        </LayoutWrapper>
      } />
      <Route path="/Pedigree" element={
        <LayoutWrapper currentPageName="Pedigree">
          <Pedigree />
        </LayoutWrapper>
      } />
      <Route path="/AdminMigration" element={<AdminMigration />} />
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
