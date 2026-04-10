import './App.css'
import { Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UpdateNotification from '@/components/ui/UpdateNotification';
import LoginPortal from '@/components/auth/LoginPortal';
// Add page imports here
import Home from './pages/Home';
import ForumPost from './pages/ForumPost';
import PrivacyPolicy from './pages/PrivacyPolicy';
import MarketplaceSalesStats from './pages/MarketplaceSalesStats';
import Marketplace from './pages/Marketplace';
import Membership from './pages/Membership';
import AdminMigration from './pages/AdminMigration';

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
      <Route path="/ForumPost" element={
        <LayoutWrapper currentPageName="ForumPost">
          <ForumPost />
        </LayoutWrapper>
      } />
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
            <NavigationTracker />
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
