import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart3, BellRing, Radio, ShoppingCart, Store, Sunrise, TrendingUp } from 'lucide-react';
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
import MarketplaceBuyPage from '@/pages/MarketplaceBuy';
import MarketplaceSellPage from '@/pages/MarketplaceSell';
import { useAuth } from '@/lib/AuthContext';
import { captureEvent } from '@/lib/posthog';
import { createPageUrl } from '@/utils';

const TABS = ['today', 'live', 'watchlist', 'browse', 'listings'];
// Old links: Guess the Price left the tab strip on 6 Oct 2026.
const TAB_ALIASES = { game: 'today', buy: 'browse', sell: 'listings' };

// The embedded marketplace pages are also standalone routes, so their
// wrapper carries min-h-screen and page padding. Inside this page that
// would add a viewport of empty scroll and a second gutter.
const EMBEDDED = '[&>.min-h-screen]:min-h-0 [&>.min-h-screen]:p-0';

/**
 * Market Intelligence: the crested gecko market as a daily habit. Today is
 * the morning brief, Live is the feed of new listings and price cuts,
 * Watchlist sends a note when a matching gecko is listed, In-app listings
 * is the Geck Inspect marketplace, and Your listings holds the Seller
 * Console plus (Breeder plan) the member's MorphMarket listings against
 * the market. The old Marketplace page was folded in here on 6 Oct 2026.
 *
 * Today, Live and Watchlist are Enterprise only (6 Oct 2026): other plans
 * see a short read-only preview with an upgrade card (MarketPreviewGate).
 * In-app listings and the Seller Console stay open to every member.
 *
 * Member-only for now: the listing photos come from MorphMarket, and
 * whether to show them on public pages is an open decision (D20).
 */
export default function Market() {
  const { user, isGuest, isLoadingAuth } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const aliased = TAB_ALIASES[requested] || requested;
  const tab = TABS.includes(aliased) ? aliased : 'today';
  const [listingsView, setListingsView] = useState('selling');
  const signedIn = !!user?.email && !isGuest;

  useEffect(() => {
    if (signedIn) captureEvent('market_view', { surface: tab });
  }, [tab, signedIn]);

  const seo = (
    <Seo
      title="Crested Gecko Market Intelligence"
      description="What crested geckos are listed for today, what changed since yesterday, and what it means for your collection."
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
            title="Market Intelligence"
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
          title="Crested Gecko Market Intelligence"
          description="Sign in to see today's market, watch for morphs under your price, and buy or sell in the app."
        />
      </>
    );
  }

  const setTab = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'today') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      {seo}
      <div className={`${tab === 'browse' ? 'max-w-7xl' : tab === 'listings' ? 'max-w-6xl' : 'max-w-5xl'} mx-auto`}>
        <PageHeader
          icon={TrendingUp}
          title="Market Intelligence"
          description="What crested geckos are listed for today, what changed, and what it means for yours. Asking prices on listings, not sale prices."
        >
          <Button asChild variant="outline" size="sm">
            <Link to={`${createPageUrl('MarketplaceSalesStats')}?tab=pricing`}>
              <BarChart3 className="w-4 h-4" /> Pricing analytics
            </Link>
          </Button>
        </PageHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-5">
            <TabsTrigger value="today"><Sunrise className="w-3.5 h-3.5" /> Today</TabsTrigger>
            <TabsTrigger value="live"><Radio className="w-3.5 h-3.5" /> Live</TabsTrigger>
            <TabsTrigger value="watchlist"><BellRing className="w-3.5 h-3.5" /> Watchlist</TabsTrigger>
            <TabsTrigger value="browse"><ShoppingCart className="w-3.5 h-3.5" /> In-app listings</TabsTrigger>
            <TabsTrigger value="listings"><Store className="w-3.5 h-3.5" /> Your listings</TabsTrigger>
          </TabsList>
          <TabsContent value="today">
            <MarketPreviewGate user={user} surface="market_today"><MarketBriefPanel user={user} /></MarketPreviewGate>
          </TabsContent>
          <TabsContent value="live">
            <MarketPreviewGate user={user} surface="market_live"><MarketTapePanel /></MarketPreviewGate>
          </TabsContent>
          <TabsContent value="watchlist">
            <MarketPreviewGate user={user} surface="market_watchlist"><WatchlistPanel /></MarketPreviewGate>
          </TabsContent>
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
