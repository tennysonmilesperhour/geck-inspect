import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart3, BellRing, Crown, Radio, Store, Sunrise, Target, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import SignInRequired from '@/components/shared/SignInRequired';
import Seo from '@/components/seo/Seo';
import MarketBriefPanel from '@/components/market/MarketBriefPanel';
import MarketTapePanel from '@/components/market/MarketTapePanel';
import WatchlistPanel from '@/components/market/WatchlistPanel';
import PriceGamePanel from '@/components/market/PriceGamePanel';
import SellerPanel from '@/components/market/SellerPanel';
import DemoMarketBrief from '@/components/market/DemoMarketBrief';
import { canUseFeature } from '@/components/subscription/PlanLimitChecker';
import { useAuth } from '@/lib/AuthContext';
import { captureEvent } from '@/lib/posthog';
import { createPageUrl } from '@/utils';

const TABS = ['today', 'live', 'watchlist', 'game', 'listings'];

/**
 * The Market page: the crested gecko market as a daily habit. Today is
 * the morning brief, Live is the feed of new listings and price cuts,
 * Watchlist sends a note when a matching gecko is listed, Guess the Price
 * is five real listings a day, and Your listings (Breeder plan) puts the
 * member's own MorphMarket listings against the market.
 *
 * Member-only for now: the listing photos come from MorphMarket, and
 * whether to show them on public pages is an open decision (D20).
 */
export default function Market() {
  const { user, isGuest, isLoadingAuth } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const tab = TABS.includes(requested) ? requested : 'today';
  const signedIn = !!user?.email && !isGuest;

  useEffect(() => {
    if (signedIn) captureEvent('market_view', { surface: tab });
  }, [tab, signedIn]);

  const seo = (
    <Seo
      title="Crested Gecko Market"
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
            title="Market"
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
          title="Crested Gecko Market"
          description="Sign in to see today's market, watch for morphs under your price, and play Guess the Price."
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
      <div className="max-w-5xl mx-auto">
        <PageHeader
          icon={TrendingUp}
          title="Market"
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
            <TabsTrigger value="game"><Target className="w-3.5 h-3.5" /> Guess the Price</TabsTrigger>
            <TabsTrigger value="listings">
              {canUseFeature(user, 'seller_market')
                ? <Store className="w-3.5 h-3.5" />
                : <Crown className="w-3.5 h-3.5 text-amber-300" />}
              Your listings
            </TabsTrigger>
          </TabsList>
          <TabsContent value="today"><MarketBriefPanel user={user} /></TabsContent>
          <TabsContent value="live"><MarketTapePanel /></TabsContent>
          <TabsContent value="watchlist"><WatchlistPanel /></TabsContent>
          <TabsContent value="game"><PriceGamePanel /></TabsContent>
          <TabsContent value="listings"><SellerPanel /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
