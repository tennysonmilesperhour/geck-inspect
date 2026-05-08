import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, Users, GitBranch, CheckCircle, Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const MEMBERSHIP_TIERS = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Hobbyist',
    price: 0,
    features: [
      'Up to 10 geckos in collection',
      '1 GB photo storage',
      '1 collection collaborator',
      'Basic breeding tracking',
      'Public profile',
      'Community forum access',
      'AI morph identification (coming soon)'
    ],
    color: 'from-gray-600 to-gray-700',
    icon: Users
  },
  {
    id: 'keeper',
    name: 'Keeper',
    tagline: 'Pro',
    monthlyPrice: 2.99,
    annualPrice: 30,
    features: [
      'Up to 50 geckos in collection',
      '10 GB photo storage',
      'Up to 5 collection collaborators',
      'Advanced breeding tools',
      'Calendar reminders',
      'Weight tracking & charts',
      'Priority support',
      'Export data to CSV'
    ],
    color: 'from-emerald-600 to-teal-600',
    icon: Sparkles,
    popular: true
  },
  {
    id: 'breeder',
    name: 'Breeder',
    tagline: 'Premium',
    monthlyPrice: 6.99,
    annualPrice: 70,
    features: [
      'Unlimited geckos',
      'Unlimited photo storage',
      'Unlimited collection collaborators',
      'Full lineage tree access',
      'Advanced calendar system',
      'Marketplace sync (MorphMarket, Palm Street)',
      'Custom breeding analytics',
      'Priority AI training access (coming soon)',
      'White-label certificates'
    ],
    color: 'from-purple-600 to-indigo-600',
    icon: GitBranch
  }
];

export default function SubscriptionPage() {
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        if (user?.membership_tier) {
          setSelectedTier(user.membership_tier);
        }
      } catch (error) {
        console.error("Failed to load user:", error);
      }
      setIsLoading(false);
    };
    loadUser();
  }, []);

  const handleSelectTier = async (tier) => {
    if (!currentUser) {
      toast({ title: "Login Required", description: "Please log in to manage your subscription.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      await base44.auth.updateMe({
        membership_tier: tier.id,
        membership_billing_cycle: tier.price === 0 ? null : billingCycle
      });
      
      setSelectedTier(tier.id);
      toast({ 
        title: "Plan Updated!", 
        description: tier.price === 0 
          ? "You're now on the Free plan." 
          : `You've selected the ${tier.name} plan. Payment integration coming soon!`
      });
    } catch (error) {
      console.error("Failed to save tier:", error);
      toast({ title: "Error", description: "Failed to update your subscription.", variant: "destructive" });
    }
    setIsSaving(false);
  };

  const handleCancelSubscription = async () => {
    if (!currentUser) return;
    
    if (!confirm("Are you sure you want to cancel your subscription? You'll be moved to the Free plan.")) {
      return;
    }

    setIsSaving(true);
    try {
      await base44.auth.updateMe({
        membership_tier: 'free',
        membership_billing_cycle: null
      });
      
      setSelectedTier('free');
      toast({ title: "Subscription Cancelled", description: "You've been moved to the Free plan." });
    } catch (error) {
      console.error("Failed to cancel:", error);
      toast({ title: "Error", description: "Failed to cancel subscription.", variant: "destructive" });
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-center p-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Login Required</h2>
          <p className="text-slate-400 mt-2">Please log in to manage your subscription.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl("Dashboard")}>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-white">Manage Subscription</h1>
            <p className="text-slate-400">Choose or change your membership plan</p>
          </div>
        </div>

        {/* Current Plan Badge */}
        {selectedTier && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Current Plan</p>
              <p className="text-xl font-semibold text-white capitalize">{selectedTier}</p>
            </div>
            {selectedTier !== 'free' && (
              <Button 
                variant="outline" 
                onClick={handleCancelSubscription}
                disabled={isSaving}
                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                Cancel Subscription
              </Button>
            )}
          </div>
        )}

        {/* Billing Toggle */}
        <div className="flex justify-center">
          <div className="bg-slate-800 p-1 rounded-lg inline-flex">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-md transition-all ${
                billingCycle === 'monthly' 
                  ? 'bg-emerald-600 text-white' 
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-6 py-2 rounded-md transition-all ${
                billingCycle === 'annual' 
                  ? 'bg-emerald-600 text-white' 
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Annual <span className="ml-1 text-xs">(Save 20%)</span>
            </button>
          </div>
        </div>

        {/* Membership Tiers */}
        <div className="grid md:grid-cols-3 gap-6">
          {MEMBERSHIP_TIERS.map(tier => {
            const Icon = tier.icon;
            const price = tier.price === 0 
              ? 'Free' 
              : billingCycle === 'monthly' 
                ? `$${tier.monthlyPrice}/mo` 
                : `$${tier.annualPrice}/yr`;
            const isCurrentPlan = selectedTier === tier.id;
            
            return (
              <Card 
                key={tier.id}
                className={`relative overflow-hidden ${
                  tier.popular 
                    ? 'ring-2 ring-emerald-500 shadow-2xl shadow-emerald-500/20' 
                    : ''
                } ${isCurrentPlan ? 'ring-2 ring-green-500' : ''} bg-slate-900 border-slate-700 hover:border-emerald-500/50 transition-all`}
              >
                {tier.popular && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-emerald-500 text-white">Most Popular</Badge>
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-green-500 text-white">Current</Badge>
                  </div>
                )}
                
                <CardHeader className={tier.popular || isCurrentPlan ? 'pt-12' : ''}>
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${tier.color} flex items-center justify-center mb-4`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-2xl text-white flex items-baseline gap-2">
                    {tier.name}
                    {tier.tagline && (
                      <span className="text-sm font-medium text-emerald-300/80">
                        / {tier.tagline}
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-bold text-white">{price}</span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  <ul className="space-y-3">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-slate-300">
                        <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSelectTier(tier)}
                    disabled={isSaving || isCurrentPlan}
                    className={`w-full ${
                      isCurrentPlan
                        ? 'bg-green-600 hover:bg-green-600 cursor-default'
                        : tier.popular 
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700' 
                          : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isCurrentPlan ? (
                      <><CheckCircle className="w-4 h-4 mr-2" /> Current Plan</>
                    ) : selectedTier && MEMBERSHIP_TIERS.findIndex(t => t.id === selectedTier) > MEMBERSHIP_TIERS.findIndex(t => t.id === tier.id) ? (
                      'Downgrade'
                    ) : (
                      tier.price === 0 ? 'Select Free Plan' : 'Upgrade'
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-slate-500 text-sm">
          Payment processing coming soon. Plan selection is saved to your account.
        </p>
      </div>
    </div>
  );
}