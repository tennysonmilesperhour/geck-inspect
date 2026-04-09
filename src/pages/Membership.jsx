import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Sparkles, Zap, Crown, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const tiers = [
  {
    name: 'FREE',
    price: '$0',
    billing: '/month',
    icon: Star,
    description: 'Perfect for getting started',
    cta: 'Get Started Free',
    ctaHref: '#signup',
    featured: false,
    comingSoon: false,
    features: [
      'Up to 10 geckos in your collection',
      'Basic breeding log (up to 3 active pairs)',
      'Weight tracking',
      'Public marketplace browsing',
      'Community forum access'
    ]
  },
  {
    name: 'KEEPER',
    price: '$4',
    billing: '/month',
    icon: Zap,
    description: 'For dedicated collectors',
    cta: 'Start Keeper',
    ctaHref: '#stripe-checkout-keeper',
    featured: false,
    comingSoon: false,
    features: [
      'Unlimited geckos',
      'Unlimited breeding pairs and egg tracking',
      'Full lineage tree visualizer',
      'Feeding groups and event logging',
      'Morph ID tool access',
      'Priority community support'
    ]
  },
  {
    name: 'BREEDER',
    price: '$9',
    billing: '/month',
    icon: Crown,
    description: 'For serious breeders',
    cta: 'Start Breeder',
    ctaHref: '#stripe-checkout-breeder',
    featured: true,
    comingSoon: false,
    features: [
      'Everything in Keeper',
      'Sales stats and cost tracking dashboard',
      'MorphMarket and Palm Street sync',
      'Advanced gecko gallery with public profile',
      'Expert verification eligibility',
      'Early access to new features'
    ]
  },
  {
    name: 'ENTERPRISE',
    price: 'Custom',
    billing: 'pricing',
    icon: Sparkles,
    description: 'For large-scale operations',
    cta: 'Join the Waitlist',
    ctaHref: 'mailto:tennysontaggart@gmail.com',
    featured: false,
    comingSoon: true,
    features: [
      'Everything in Breeder',
      'Market intelligence dashboard',
      'Pricing trends and morph demand analytics',
      'Breeding ROI projections',
      'Competitive landscape analysis',
      'Dedicated account support'
    ]
  }
];

export default function MembershipPage() {
  const [selectedTier, setSelectedTier] = useState(null);

  const handleCTA = (tier) => {
    if (tier.comingSoon) {
      window.location.href = tier.ctaHref;
    } else {
      // Placeholder for Stripe integration
      window.location.href = tier.ctaHref;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-white">Simple, Transparent Pricing</h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Choose the membership tier that's right for you. All memberships are billed monthly and can be canceled anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map((tier) => {
            const Icon = tier.icon;
            const isBreeder = tier.featured;
            const isEnterprise = tier.comingSoon;

            return (
              <div key={tier.name} className="relative">
                <Card
                  className={`h-full flex flex-col transition-all duration-300 ${
                    isBreeder
                      ? 'border-2 border-emerald-500 bg-slate-900/90 shadow-2xl shadow-emerald-500/20'
                      : isEnterprise
                      ? 'border-slate-700 bg-slate-900/50 opacity-75'
                      : 'border-slate-700 bg-slate-900/80 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10'
                  }`}
                >
                  <CardHeader className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${
                        isBreeder
                          ? 'bg-emerald-500/20'
                          : isEnterprise
                          ? 'bg-slate-700/50'
                          : 'bg-slate-800'
                      }`}>
                        <Icon className={`w-6 h-6 ${
                          isBreeder
                            ? 'text-emerald-400'
                            : isEnterprise
                            ? 'text-slate-400'
                            : 'text-slate-300'
                        }`} />
                      </div>
                        <CardTitle className={`text-2xl ${
                          isBreeder ? 'text-emerald-300' : isEnterprise ? 'text-slate-400' : 'text-white'
                        }`}>
                          {tier.name}
                        </CardTitle>
                      </div>
                      {isBreeder && (
                        <span className="text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full whitespace-nowrap">Most Popular</span>
                      )}
                      {isEnterprise && (
                        <span className="text-xs font-semibold bg-slate-700/60 text-slate-400 border border-slate-600 px-2 py-0.5 rounded-full whitespace-nowrap">Coming Soon</span>
                      )}
                    </div>

                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-4xl font-bold ${
                          isBreeder ? 'text-emerald-300' : isEnterprise ? 'text-slate-400' : 'text-white'
                        }`}>
                          {tier.price}
                        </span>
                        <span className="text-slate-400 text-sm">{tier.billing}</span>
                      </div>
                      <p className={`text-sm mt-2 ${
                        isBreeder ? 'text-emerald-200/80' : isEnterprise ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        {tier.description}
                      </p>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col gap-6">
                    {/* Features */}
                    <ul className="space-y-3 flex-1">
                      {tier.features.map((feature, idx) => (
                        <li key={idx} className="flex gap-3">
                          <Check className={`w-5 h-5 flex-shrink-0 ${
                            isBreeder ? 'text-emerald-400' : isEnterprise ? 'text-slate-500' : 'text-slate-400'
                          }`} />
                          <span className={`text-sm ${
                            isBreeder ? 'text-slate-100' : isEnterprise ? 'text-slate-500' : 'text-slate-300'
                          }`}>
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA Button */}
                    <Button
                      onClick={() => handleCTA(tier)}
                      disabled={isEnterprise}
                      className={`w-full ${
                        isBreeder
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-semibold'
                          : isEnterprise
                          ? 'bg-slate-700 hover:bg-slate-700 text-slate-500 cursor-not-allowed'
                          : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
                      }`}
                    >
                      {tier.cta}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>

        {/* FAQ or Additional Info */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-8 text-center space-y-4">
          <h2 className="text-2xl font-bold text-white">Need Help Choosing?</h2>
          <p className="text-slate-300">
            Start free with up to 10 geckos. Upgrade anytime as your collection grows. All paid plans include a 7-day free trial.
          </p>
          <p className="text-sm text-slate-500">
            Questions? Reach out to tennysontaggart@gmail.com
          </p>
        </div>
      </div>
    </div>
  );
}