import { Suspense, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart3, BellRing, Radio, ShoppingCart, Store, Sunrise, TrendingUp, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import SignInRequired from '@/components/shared/SignInRequired';
import Seo from '@/components/seo/Seo';
import MarketBriefPanel from '@/components/market/MarketBriefPanel';
import MarketTapePanel from '@/components/market/MarketTapePanel';
import WatchlistPanel from '@/components/market/WatchlistPanel';
import SellerPanel from '@/components/market/SellerPanel';
import DemoMarketBrief from '@/components/market/DemoMarketBrief';
import MarketPreviewGate from '@/components/subscription/MarketPreviewGate';
import { canUseFeature } from '@/components/subscription/PlanLimitChecker';
import MarketplaceBuyPage from '@/pages/MarketplaceBuy';
import MarketplaceSellPage from '@/pages/MarketplaceSell';
import { useAuth } from '@/lib/AuthContext';
import { lazy } from '@/lib/lazyWithRetry';
import { marketTabsFor, resolveMarketTab } from '@/lib/marketTabs';
import { captureEvent } from '@/lib/posthog';
import { ENTERPRISE_ON_SALE } from '@/lib/stripe-config';
import { createPageUrl } from '@/utils';

// The collection's value is the Portfolio page, shown here as a tab. Its
// chart library is large, so it loads only when the tab is opened.
const PortfolioPage = lazy(() => import('@/pages/Portfolio'));

// The embedded marketplace pages are also standalone routes, so their
// wrapper carries min-h-screen and page padding. Inside this page that
// would add a viewport of empty scroll and a second gutter.
const EMBEDDED = '[&>.min-h-screen]:min-h-0 [&>.min-h-screen]:p-0';

/**
 * Prices (called Market Intelligence until 13 Nov 2026): what the
 * member's crested geckos are worth and what geckos are listed for. My
 * collection is the Portfolio (each gecko valued from real listings),
 * In-app listings is the Geck Inspect marketplace, and Your listings holds
 * the Seller Console plus (Breeder plan) the member's MorphMarket listings
 * against the market. The old Marketplace page was folded in here on 6
 * Oct 2026.
 *
 * Today (the morning brief), Live (new listings and price cuts) and
 * Watchlist are Market Intelligence, an Enterprise feature (6 Oct 2026).
 * src/lib/marketTabs.js says who is shown them. Nothing was removed: an
 * Enterprise member has the same tabs and the same first screen.
 *
 * Member-only for now: the listing photos come from MorphMarket, and
 * whether to show them on public pages is an open decision (D20).
 */
export default function Market() {
  const { user, isGuest, isLoadingAuth } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const signedIn = !!user?.email && !isGuest;
  const view = marketTabsFor({
    hasMarketIntelligence: signedIn && canUseFeature(user, 'market_intelligence'),
    enterpriseOnSale: ENTERPRISE_ON_SALE,
  });
  const tab = resolveMarketTab(searchParams.get('tab'), view);
  const [listingsView, setListingsView] = useState('selling');

  useEffect(() => {
    if (signedIn) captureEvent('market_view', { surface: tab });
  }, [tab, signedIn]);

  const seo = (
    <Seo
      title="Prices"
      description="What your crested geckos are worth, what crested geckos are listed for, and your own listings."
      path="/Market"
      noIndex
      keywords={['crested gecko prices', 'crested gecko market', 'morph prices']}
    />
  );

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 md:p-8">
        {seo}
        <div className="max-w-5xl mx-auto space-y-4">
          {[90, 60, 320].map((h, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-slate-900" style={{ height: h }} />
          ))}
        </div>
      </div>
    );
  }

  // The guest demo gets a labelled sample: every demo gecko priced from a
  // dated snapshot of real listing data, so the landing page's "See what
  // every gecko is worth" is something a visitor can actually see.
  if (isGuest) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 md:p-8">
        {seo}
        <div className="max-w-5xl mx-auto">
          <PageHeader
            icon={TrendingUp}
            title="Prices"
            description="What crested geckos are listed for, and what that means for each gecko in a collection. This is the demo version."
          />
          <DemoMarketBrief />
        </div>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <>
        {seo}
        <SignInRequired
          icon={TrendingUp}
          title="Prices"
          description="Sign in to see what your crested geckos are worth, and to buy or sell in the app."
        />
      </>
    );
  }

  const setTab = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next === view.defaultTab) params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      {seo}
      <div className={`${tab === 'browse' ? 'max-w-7xl' : tab === 'listings' || tab === 'collection' ? 'max-w-6xl' : 'max-w-5xl'} mx-auto`}>
        <PageHeader
          icon={TrendingUp}
          title="Prices"
          description={view.showLive
            ? 'What crested geckos are listed for today, what changed, and what it means for yours. Asking prices on listings, not sale prices.'
            : 'What your crested geckos are worth, and what crested geckos are listed for. Asking prices on listings, not sale prices.'}
        >
          <Button asChild variant="outline" size="sm">
            <Link to={`${createPageUrl('MarketplaceSalesStats')}?tab=pricing`}>
              <BarChart3 className="w-4 h-4" /> Pricing analytics
            </Link>
          </Button>
        </PageHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-5 flex-wrap sm:flex-nowrap">
            <TabsTrigger value="collection"><Wallet className="w-3.5 h-3.5" /> My collection</TabsTrigger>
            {view.showLive && (
              <>
                <TabsTrigger value="today"><Sunrise className="w-3.5 h-3.5" /> Today</TabsTrigger>
                <TabsTrigger value="live"><Radio className="w-3.5 h-3.5" /> Live</TabsTrigger>
                <TabsTrigger value="watchlist"><BellRing className="w-3.5 h-3.5" /> Watchlist</TabsTrigger>
              </>
            )}
            <TabsTrigger value="browse"><ShoppingCart className="w-3.5 h-3.5" /> In-app listings</TabsTrigger>
            <TabsTrigger value="listings"><Store className="w-3.5 h-3.5" /> Your listings</TabsTrigger>
          </TabsList>
          <TabsContent value="collection" className={EMBEDDED}>
            <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-slate-900" aria-label="Loading your collection's value" />}>
              <PortfolioPage embedded />
            </Suspense>
          </TabsContent>
          {view.showLive && (
            <>
              <TabsContent value="today">
                <MarketPreviewGate user={user} surface="market_today" serverGated><MarketBriefPanel user={user} /></MarketPreviewGate>
              </TabsContent>
              <TabsContent value="live">
                <MarketPreviewGate user={user} surface="market_live" serverGated><MarketTapePanel /></MarketPreviewGate>
              </TabsContent>
              <TabsContent value="watchlist">
                <MarketPreviewGate user={user} surface="market_watchlist" serverGated><WatchlistPanel /></MarketPreviewGate>
              </TabsContent>
            </>
          )}
          <TabsContent value="browse" className={EMBEDDED}>
            <MarketplaceBuyPage embedded />
          </TabsContent>
          <TabsContent value="listings">
            <Tabs value={listingsView} onValueChange={setListingsView}>
              <TabsList className="mb-5">
                <TabsTrigger value="selling">Seller Console</TabsTrigger>
                <TabsTrigger value="compare">Against the market</TabsTrigger>
              </TabsList>
              <TabsContent value="selling" className={EMBEDDED}>
                <MarketplaceSellPage />
              </TabsContent>
              <TabsContent value="compare"><SellerPanel /></TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
