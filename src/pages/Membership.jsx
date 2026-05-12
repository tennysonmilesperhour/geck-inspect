import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Check, Sparkles, Zap, Crown, Star, Loader2, Flame, Infinity as InfinityIcon } from 'lucide-react';
import { User } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
import SupportContactCard from '@/components/support/SupportContactCard';
import { getTierPricing, TIER_PRICING } from '@/lib/stripe-config';
import Seo from '@/components/seo/Seo';
import { ORG_ID, SITE_URL } from '@/lib/organization-schema';

/**
 * Membership / pricing page.
 *
 * Tier setup per April 2026 product decisions:
 *
 *   FREE        ,  10 geckos, 1 active breeding pair, community access
 *   KEEPER*     ,  50 geckos, 5 active breeding pairs, lineage tree, etc
 *                 (*marked "Most Popular" ,  hovering badge above the card)
 *   BREEDER     ,  unlimited geckos + pairs, opt-in to be featured on the
 *                 home dashboard, marketplace sync, certificates, etc
 *   ENTERPRISE  ,  hovering "Coming Soon" badge, waitlist CTA
 *
 * Three billing cadences are surfaced through a top-of-page toggle:
 *
 *   Monthly   ,  recurring, the default
 *   Annual    ,  recurring, ~20% cheaper than 12× monthly
 *   Lifetime  ,  one-time payment, never expires (Keeper + Breeder only;
 *               Enterprise is custom-quoted and shows "Lifetime not
 *               available ,  talk to us" copy when this cadence is on)
 *
 * The cadence is passed through to the (still-to-be-built)
 * `stripe-checkout` edge function as `billing_cycle` along with the
 * specific Stripe price id from src/lib/stripe-config.js.
 *
 * Grandfathered users land on this page already owning the Breeder tier
 * (see subscription_status === 'grandfathered') and see a "You already
 * have Breeder access" banner instead of the checkout buttons.
 */

const tiers = [
  {
    key: 'free',
    name: 'FREE',
    icon: Star,
    description: 'Perfect for getting started',
    featured: false,
    comingSoon: false,
    features: [
      'Up to 10 geckos in your collection',
      'Up to 5 additional reptiles tracked',
      'Basic breeding log (1 active pair)',
      'Weight tracking',
      'Public marketplace browsing',
      'Community forum access',
    ],
  },
  {
    key: 'keeper',
    name: 'KEEPER',
    icon: Zap,
    description: 'For dedicated collectors',
    featured: true, // <-- Most Popular
    comingSoon: false,
    features: [
      'Up to 50 geckos',
      'Up to 10 additional reptiles tracked',
      'Up to 5 active breeding pairs',
      'Full lineage tree visualizer',
      'Feeding groups and event logging',
      'Morph ID tool access',
      'Priority community support',
    ],
  },
  {
    key: 'breeder',
    name: 'BREEDER',
    icon: Crown,
    description: 'For serious breeders',
    featured: false,
    comingSoon: false,
    features: [
      'Everything in Keeper',
      'Unlimited geckos and breeding pairs',
      'Unlimited additional reptiles tracked',
      'Sales stats and cost tracking dashboard',
      'Option to be featured on the dashboard',
      'Zero’s Geckos shipping integration',
      'Expert verification eligibility',
      'Early access to new features',
    ],
  },
  {
    key: 'enterprise',
    name: 'ENTERPRISE',
    icon: Sparkles,
    description: 'For large-scale operations',
    featured: false,
    comingSoon: true,
    features: [
      'Everything in Breeder',
      'MorphMarket CSV sync (Palm Street pending)',
      'Market intelligence dashboard',
      'Pricing trends and morph demand analytics',
      'Breeding ROI projections',
      'Competitive landscape analysis',
      'Dedicated account support',
    ],
  },
];

const CYCLE_OPTIONS = [
  { key: 'monthly',  label: 'Monthly' },
  { key: 'annual',   label: 'Annual',   hint: 'Save 20%' },
  { key: 'lifetime', label: 'Lifetime', hint: 'Pay once' },
];

// SoftwareApplication + Offer JSON-LD for the pricing page. AI assistants
// (ChatGPT, Perplexity, Claude) parse this directly when answering "how
// much does Geck Inspect cost / what plans are available". Offers cover
// every (tier × billing cycle) combo where we have a real $ amount , 
// "Custom" enterprise rows are intentionally omitted because schema.org
// Offer.price requires a number.
const PRICED_TIERS = ['keeper', 'breeder'];
const TIER_DESCRIPTIONS = {
  keeper:
    'For dedicated collectors. Up to 50 geckos, 5 active breeding pairs, full lineage tree, feeding groups, and AI morph ID.',
  breeder:
    'For serious breeders. Unlimited geckos and breeding pairs, marketplace sync, certificates, and a featured spot on the home dashboard.',
};
function priceToNumber(p) {
  // "$4" → 4, "$38.40" → 38.4, "$0" → 0
  return Number(String(p).replace(/[^0-9.]/g, ''));
}
const MEMBERSHIP_OFFERS = PRICED_TIERS.flatMap((tier) =>
  Object.entries(TIER_PRICING[tier]).map(([cycle, p]) => ({
    '@type': 'Offer',
    name: `Geck Inspect ${tier[0].toUpperCase() + tier.slice(1)} (${cycle})`,
    price: priceToNumber(p.price).toFixed(2),
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
    url: `${SITE_URL}/Membership`,
    category: cycle === 'lifetime' ? 'one-time' : 'subscription',
    description: p.priceCaption,
  })),
);
const MEMBERSHIP_JSON_LD = [
  {
    '@type': 'SoftwareApplication',
    '@id': `${SITE_URL}/Membership#softwareapplication`,
    name: 'Geck Inspect',
    description:
      'Crested gecko collection, breeding, and community platform. Plans for hobbyists through professional breeders, with AI morph ID, lineage trees, marketplace sync, and certificates.',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Reptile breeding and collection management',
    operatingSystem: 'Web, iOS Safari, Android Chrome',
    url: `${SITE_URL}/Membership`,
    publisher: { '@id': ORG_ID },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: '0',
      highPrice: '349',
      offerCount: MEMBERSHIP_OFFERS.length + 3, // + 3 free-tier rows
      offers: MEMBERSHIP_OFFERS,
    },
    featureList: [
      'Crested gecko collection tracker',
      'Breeding pair manager with lineage tree',
      'AI-powered morph identification',
      'Weight and feeding logs',
      'MorphMarket CSV sync (Breeder tier)',
      'Genetics calculator and morph guide',
      'Community forum and marketplace',
    ],
  },
  {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Membership',
        item: `${SITE_URL}/Membership`,
      },
    ],
  },
  {
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How much does Geck Inspect cost?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Geck Inspect has a Free tier (10 geckos), a Keeper tier ($4/month, $38.40/year, or $149 lifetime), a Breeder tier ($9/month, $105.60/year, or $349 lifetime), and a custom-quoted Enterprise tier. Annual plans save 20% versus monthly; lifetime plans are a one-time purchase with no renewals.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I try a paid plan before subscribing?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes ,  every recurring (monthly or annual) Keeper and Breeder plan includes a 7-day free trial. Lifetime purchases are one-time and do not include a trial.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is included in the Free plan?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The Free plan includes up to 10 geckos, 1 active breeding pair, weight tracking, public marketplace browsing, and community forum access. It is free forever with no credit card required.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I cancel anytime?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Monthly and annual subscriptions can be cancelled at any time from your account settings. Lifetime purchases are one-time and do not require cancellation.',
        },
      },
    ],
  },
];

function HoveringBadge({ children, variant = 'popular' }) {
  const styles =
    variant === 'popular'
      ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/30'
      : variant === 'lifetime'
        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/30'
        : 'bg-slate-700 text-slate-200 border-slate-600';
  return (
    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border whitespace-nowrap ${styles}`}
      >
        {variant === 'popular' && <Flame className="w-3 h-3" />}
        {variant === 'lifetime' && <InfinityIcon className="w-3 h-3" />}
        {children}
      </span>
    </div>
  );
}

function CycleToggle({ value, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="Billing cadence"
      className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/80 p-1 shadow-inner"
    >
      {CYCLE_OPTIONS.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              active
                ? opt.key === 'lifetime'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {opt.label}
            {opt.hint && (
              <span
                className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-1.5 py-0.5 ${
                  active
                    ? opt.key === 'lifetime'
                      ? 'bg-slate-950/20 text-slate-900'
                      : 'bg-emerald-900/40 text-emerald-100'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {opt.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function MembershipPage() {
  const [user, setUser] = useState(null);
  const [loadingTier, setLoadingTier] = useState(null);
  const [cycle, setCycle] = useState('monthly');
  const { toast } = useToast();

  useEffect(() => {
    User.me().then(setUser).catch(() => setUser(null));
  }, []);

  const isGrandfathered =
    user?.subscription_status === 'grandfathered' && user?.membership_tier === 'breeder';
  const currentTier = user?.membership_tier || null;
  const currentCycle = user?.membership_billing_cycle || null;

  const handleCTA = async (tier, pricing) => {
    if (tier.comingSoon) {
      toast({
        title: 'Enterprise waitlist',
        description: 'Tell us about your operation using the support form below.',
      });
      requestAnimationFrame(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      });
      return;
    }
    if (tier.key === 'free') {
      window.location.href = user ? '/Dashboard' : '/AuthPortal';
      return;
    }
    if (!user) {
      window.location.href = '/AuthPortal';
      return;
    }
    if (isGrandfathered) {
      toast({
        title: 'You already have Breeder access',
        description: 'As a grandfathered member, you keep the Breeder tier for free.',
      });
      return;
    }

    setLoadingTier(tier.key);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          tier: tier.key,
          billing_cycle: cycle,
          price_id: pricing?.price_id || null,
          mode: pricing?.mode || null,
          returnUrl: `${window.location.origin}/Membership`,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data?.error || 'Checkout did not return a session URL');
      }
    } catch (err) {
      console.error('Checkout failed:', err);
      toast({
        title: 'Checkout unavailable',
        description:
          err.message || 'Stripe is not set up yet. Reach out if you want early access.',
        variant: 'destructive',
      });
    }
    setLoadingTier(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6">
      <Seo
        title="Pricing & Plans"
        description="Geck Inspect plans for crested gecko keepers and breeders. Free (10 geckos), Keeper ($4/mo, $38.40/yr, $149 lifetime), Breeder ($9/mo, $105.60/yr, $349 lifetime), and custom Enterprise. 7-day free trial on recurring plans. Cancel anytime."
        path="/Membership"
        type="website"
        imageAlt="Geck Inspect membership plans ,  Free, Keeper, Breeder, and Enterprise tiers"
        keywords={[
          'crested gecko app pricing',
          'gecko breeding software cost',
          'geckOS plans',
          'crested gecko subscription',
          'breeder software pricing',
          'lifetime membership',
        ]}
        jsonLd={MEMBERSHIP_JSON_LD}
      />
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Choose the tier that fits your collection. Cancel anytime ,  recurring plans
            include a 7-day free trial. Lifetime is a one-time purchase.
          </p>

          <div className="flex justify-center pt-2">
            <CycleToggle value={cycle} onChange={setCycle} />
          </div>

          {isGrandfathered && (
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
              <Crown className="w-4 h-4" />
              You're grandfathered into the Breeder tier ,  thank you for being an
              early supporter.
            </div>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
          {tiers.map((tier) => {
            const Icon = tier.icon;
            const isFeatured = tier.featured;
            const isEnterprise = tier.comingSoon;
            const pricing = getTierPricing(tier.key, cycle);
            // Enterprise has no `lifetime` row in the pricing config , 
            // surface a friendly "Not available" instead of crashing or
            // showing stale monthly numbers.
            const enterpriseLifetimeUnavailable = isEnterprise && cycle === 'lifetime' && !pricing;

            const isCurrent =
              currentTier === tier.key &&
              !isEnterprise &&
              (currentCycle === cycle || (tier.key === 'free' && !currentCycle));
            const busy = loadingTier === tier.key;

            // Lifetime tab gets an amber accent so it visually reads as
            // a different commercial proposition from the recurring tabs.
            const lifetimeAccent = cycle === 'lifetime' && !isEnterprise && tier.key !== 'free';

            return (
              <div key={tier.key} className="relative">
                {isFeatured && cycle !== 'lifetime' && (
                  <HoveringBadge variant="popular">Most Popular</HoveringBadge>
                )}
                {isFeatured && cycle === 'lifetime' && (
                  <HoveringBadge variant="lifetime">Best Value</HoveringBadge>
                )}
                {isEnterprise && (
                  <HoveringBadge variant="coming">Coming Soon</HoveringBadge>
                )}
                <Card
                  className={`h-full flex flex-col transition-all duration-300 ${
                    lifetimeAccent && isFeatured
                      ? 'border-2 border-amber-500 bg-slate-900/95 shadow-2xl shadow-amber-500/20'
                      : lifetimeAccent
                        ? 'border-amber-500/40 bg-slate-900/85 hover:border-amber-400/60 hover:shadow-lg hover:shadow-amber-500/10'
                        : isFeatured
                          ? 'border-2 border-emerald-500 bg-slate-900/95 shadow-2xl shadow-emerald-500/20'
                          : isEnterprise
                            ? 'border-slate-700 bg-slate-900/50 opacity-80'
                            : 'border-slate-700 bg-slate-900/80 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10'
                  }`}
                >
                  <CardHeader className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-3 rounded-lg ${
                          lifetimeAccent
                            ? 'bg-amber-500/20'
                            : isFeatured
                              ? 'bg-emerald-500/20'
                              : isEnterprise
                                ? 'bg-slate-700/50'
                                : 'bg-slate-800'
                        }`}
                      >
                        <Icon
                          className={`w-6 h-6 ${
                            lifetimeAccent
                              ? 'text-amber-300'
                              : isFeatured
                                ? 'text-emerald-400'
                                : isEnterprise
                                  ? 'text-slate-400'
                                  : 'text-slate-300'
                          }`}
                        />
                      </div>
                      <CardTitle
                        className={`text-2xl ${
                          lifetimeAccent
                            ? 'text-amber-200'
                            : isFeatured
                              ? 'text-emerald-300'
                              : isEnterprise
                                ? 'text-slate-400'
                                : 'text-white'
                        }`}
                      >
                        {tier.name}
                      </CardTitle>
                    </div>

                    <div>
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`text-4xl font-bold ${
                            lifetimeAccent
                              ? 'text-amber-200'
                              : isFeatured
                                ? 'text-emerald-300'
                                : isEnterprise
                                  ? 'text-slate-400'
                                  : 'text-white'
                          }`}
                        >
                          {enterpriseLifetimeUnavailable ? '—' : (pricing?.price ?? 'Custom')}
                        </span>
                        {!enterpriseLifetimeUnavailable && pricing?.billing && (
                          <span className="text-slate-400 text-sm">{pricing.billing}</span>
                        )}
                      </div>
                      <p
                        className={`text-sm mt-2 ${
                          lifetimeAccent
                            ? 'text-amber-200/80'
                            : isFeatured
                              ? 'text-emerald-200/80'
                              : isEnterprise
                                ? 'text-slate-500'
                                : 'text-slate-400'
                        }`}
                      >
                        {tier.description}
                      </p>
                      {(pricing?.priceCaption || enterpriseLifetimeUnavailable) && (
                        <p className="text-xs mt-1.5 text-slate-500 italic">
                          {enterpriseLifetimeUnavailable
                            ? 'Lifetime not available for Enterprise ,  message support for a custom quote.'
                            : pricing.priceCaption}
                        </p>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col gap-6">
                    <ul className="space-y-3 flex-1">
                      {tier.features.map((feature, idx) => (
                        <li key={idx} className="flex gap-3">
                          <Check
                            className={`w-5 h-5 flex-shrink-0 ${
                              lifetimeAccent
                                ? 'text-amber-400'
                                : isFeatured
                                  ? 'text-emerald-400'
                                  : isEnterprise
                                    ? 'text-slate-500'
                                    : 'text-slate-400'
                            }`}
                          />
                          <span
                            className={`text-sm ${
                              isFeatured
                                ? 'text-slate-100'
                                : isEnterprise
                                  ? 'text-slate-500'
                                  : 'text-slate-300'
                            }`}
                          >
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      onClick={() => handleCTA(tier, pricing)}
                      disabled={isEnterprise || busy || isCurrent || enterpriseLifetimeUnavailable}
                      className={`w-full font-semibold ${
                        lifetimeAccent && isFeatured
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          : lifetimeAccent
                            ? 'bg-amber-600/90 hover:bg-amber-500 text-slate-950'
                            : isFeatured
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              : isEnterprise
                                ? 'bg-slate-700 hover:bg-slate-700 text-slate-500 cursor-not-allowed'
                                : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
                      }`}
                    >
                      {busy ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Redirecting...
                        </>
                      ) : isCurrent ? (
                        'Current plan'
                      ) : enterpriseLifetimeUnavailable ? (
                        'Not available'
                      ) : (
                        pricing?.cta || 'Choose plan'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>

        {/* Support contact ,  in-app ticket instead of mailto */}
        <div className="max-w-2xl mx-auto w-full">
          <SupportContactCard title="Questions about a plan? Message support." />
        </div>
      </div>
    </div>
  );
}
