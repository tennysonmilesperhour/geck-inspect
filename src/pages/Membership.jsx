import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Check, Sparkles, Zap, Crown, Star, Loader2, Flame } from 'lucide-react';
import { User } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
import SupportContactCard from '@/components/support/SupportContactCard';

/**
 * Membership / pricing page.
 *
 * Tier setup per April 2026 product decisions:
 *
 *   FREE        — 10 geckos, 1 active breeding pair, community access
 *   KEEPER*     — 50 geckos, 5 active breeding pairs, lineage tree, etc
 *                 (*marked "Most Popular" — hovering badge above the card)
 *   BREEDER     — unlimited geckos + pairs, opt-in to be featured on the
 *                 home dashboard, marketplace sync, certificates, etc
 *   ENTERPRISE  — hovering "Coming Soon" badge, waitlist CTA
 *
 * Grandfathered users land on this page already owning the Breeder tier
 * (see subscription_status === 'grandfathered') and see a "You already
 * have Breeder access" banner instead of the checkout buttons.
 */

const tiers = [
  {
    key: 'free',
    name: 'FREE',
    price: '$0',
    billing: '/month',
    icon: Star,
    description: 'Perfect for getting started',
    cta: 'Get Started Free',
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
    price: '$4',
    billing: '/month',
    icon: Zap,
    description: 'For dedicated collectors',
    cta: 'Start Keeper',
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
    price: '$9',
    billing: '/month',
    icon: Crown,
    description: 'For serious breeders',
    cta: 'Start Breeder',
    featured: false,
    comingSoon: false,
    features: [
      'Everything in Keeper',
      'Unlimited geckos and breeding pairs',
      'Unlimited additional reptiles tracked',
      'Sales stats and cost tracking dashboard',
      'Option to be featured on the dashboard',
      'Expert verification eligibility',
      'Early access to new features',
    ],
  },
  {
    key: 'enterprise',
    name: 'ENTERPRISE',
    price: 'Custom',
    billing: 'pricing',
    icon: Sparkles,
    description: 'For large-scale operations',
    cta: 'Join the Waitlist',
    featured: false,
    comingSoon: true,
    features: [
      'Everything in Breeder',
      'MorphMarket and Palm Street sync',
      'Market intelligence dashboard',
      'Pricing trends and morph demand analytics',
      'Breeding ROI projections',
      'Competitive landscape analysis',
      'Dedicated account support',
    ],
  },
];

function HoveringBadge({ children, variant = 'popular' }) {
  const styles =
    variant === 'popular'
      ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/30'
      : 'bg-slate-700 text-slate-200 border-slate-600';
  return (
    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border whitespace-nowrap ${styles}`}
      >
        {variant === 'popular' && <Flame className="w-3 h-3" />}
        {children}
      </span>
    </div>
  );
}

export default function MembershipPage() {
  const [user, setUser] = useState(null);
  const [loadingTier, setLoadingTier] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    User.me().then(setUser).catch(() => setUser(null));
  }, []);

  const isGrandfathered =
    user?.subscription_status === 'grandfathered' && user?.membership_tier === 'breeder';
  const currentTier = user?.membership_tier || null;

  const handleCTA = async (tier) => {
    if (tier.comingSoon) {
      // Enterprise waitlist now routes into our in-app support inbox
      // instead of a personal mailto. Scroll down to the support card.
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
      if (user) {
        window.location.href = '/Dashboard';
      } else {
        window.location.href = '/AuthPortal';
      }
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
        body: { tier: tier.key, returnUrl: `${window.location.origin}/Membership` },
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
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Choose the tier that fits your collection. Cancel anytime — all paid plans
            include a 7-day free trial.
          </p>
          {isGrandfathered && (
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
              <Crown className="w-4 h-4" />
              You're grandfathered into the Breeder tier — thank you for being an
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
            const isCurrent = currentTier === tier.key && !isEnterprise;
            const busy = loadingTier === tier.key;

            return (
              <div key={tier.key} className="relative">
                {isFeatured && <HoveringBadge variant="popular">Most Popular</HoveringBadge>}
                {isEnterprise && (
                  <HoveringBadge variant="coming">Coming Soon</HoveringBadge>
                )}
                <Card
                  className={`h-full flex flex-col transition-all duration-300 ${
                    isFeatured
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
                          isFeatured
                            ? 'bg-emerald-500/20'
                            : isEnterprise
                              ? 'bg-slate-700/50'
                              : 'bg-slate-800'
                        }`}
                      >
                        <Icon
                          className={`w-6 h-6 ${
                            isFeatured
                              ? 'text-emerald-400'
                              : isEnterprise
                                ? 'text-slate-400'
                                : 'text-slate-300'
                          }`}
                        />
                      </div>
                      <CardTitle
                        className={`text-2xl ${
                          isFeatured
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
                            isFeatured
                              ? 'text-emerald-300'
                              : isEnterprise
                                ? 'text-slate-400'
                                : 'text-white'
                          }`}
                        >
                          {tier.price}
                        </span>
                        <span className="text-slate-400 text-sm">{tier.billing}</span>
                      </div>
                      <p
                        className={`text-sm mt-2 ${
                          isFeatured
                            ? 'text-emerald-200/80'
                            : isEnterprise
                              ? 'text-slate-500'
                              : 'text-slate-400'
                        }`}
                      >
                        {tier.description}
                      </p>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col gap-6">
                    <ul className="space-y-3 flex-1">
                      {tier.features.map((feature, idx) => (
                        <li key={idx} className="flex gap-3">
                          <Check
                            className={`w-5 h-5 flex-shrink-0 ${
                              isFeatured
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
                      onClick={() => handleCTA(tier)}
                      disabled={isEnterprise || busy || isCurrent}
                      className={`w-full font-semibold ${
                        isFeatured
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
                      ) : (
                        tier.cta
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>

        {/* Support contact — in-app ticket instead of mailto */}
        <div className="max-w-2xl mx-auto w-full">
          <SupportContactCard title="Questions about a plan? Message support." />
        </div>
      </div>
    </div>
  );
}
