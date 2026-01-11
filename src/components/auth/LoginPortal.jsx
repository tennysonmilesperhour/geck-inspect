import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { User } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, Users, GitBranch, Calendar, TrendingUp, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const MEMBERSHIP_TIERS = [
  {
    id: 'free',
    name: 'Free Member',
    price: 0,
    features: [
      'Up to 10 geckos in collection',
      'Basic breeding tracking',
      'Public profile',
      'Community forum access',
      'AI morph identification'
    ],
    color: 'from-gray-600 to-gray-700',
    icon: Users
  },
  {
    id: 'keeper',
    name: 'Keeper',
    monthlyPrice: 4,
    annualPrice: 38.40, // 20% off
    features: [
      'Up to 50 geckos in collection',
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
    monthlyPrice: 11,
    annualPrice: 105.60, // 20% off
    features: [
      'Unlimited geckos',
      'Full lineage tree access',
      'Advanced calendar system',
      'Marketplace sync (MorphMarket, Palm Street)',
      'Custom breeding analytics',
      'Priority AI training access',
      'White-label certificates'
    ],
    color: 'from-purple-600 to-indigo-600',
    icon: GitBranch
  }
];

export default function LoginPortal({ requiredFeature = null }) {
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [selectedTier, setSelectedTier] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        if (user?.membership_tier) {
          setSelectedTier(user.membership_tier);
        }
      } catch (error) {
        // Not logged in
      }
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, []);

  const handleLogin = async () => {
    try {
      const currentUrl = window.location.href;
      await base44.auth.redirectToLogin(currentUrl);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleSelectTier = async (tier) => {
    if (!currentUser) {
      // Not logged in, redirect to login
      await handleLogin();
      return;
    }

    // User is logged in, save their tier selection
    setIsSaving(true);
    try {
      await base44.auth.updateMe({
        membership_tier: tier.id,
        membership_billing_cycle: tier.price === 0 ? null : billingCycle
      });
      
      setSelectedTier(tier.id);
      toast({ 
        title: "Plan Selected!", 
        description: tier.price === 0 
          ? "You're now on the Free plan. Enjoy!" 
          : `You've selected the ${tier.name} plan. Payment integration coming soon!`
      });
      
      // Reload the page to refresh the app state
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error("Failed to save tier:", error);
      toast({ title: "Error", description: "Failed to save your selection.", variant: "destructive" });
    }
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img 
              src={window.APP_LOGO_URL || 'https://i.imgur.com/gfaW2Yg.png'} 
              alt="Geck Inspect" 
              className="h-12 w-12 rounded-lg"
            />
            <h1 className="text-4xl md:text-5xl font-bold text-white">Geck Inspect</h1>
          </div>
          <p className="text-xl text-slate-300">
            {requiredFeature 
              ? `${requiredFeature} requires an account. Choose your membership level:` 
              : 'Join the ultimate crested gecko breeding & identification platform'}
          </p>
          <div className="bg-emerald-900/30 border border-emerald-500/50 rounded-lg p-4 max-w-2xl mx-auto">
            <p className="text-emerald-300 font-semibold text-lg mb-2">
              🧪 Beta Access - All Features Free!
            </p>
            <p className="text-emerald-300">
              This app is currently in beta. All membership tiers are completely free—simply select the one you want and it will activate immediately. No credit card or payment information required.
            </p>
          </div>
        </div>

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
            
            return (
              <Card 
                key={tier.id}
                className={`relative overflow-hidden ${
                  tier.popular 
                    ? 'ring-2 ring-emerald-500 shadow-2xl shadow-emerald-500/20' 
                    : ''
                } bg-slate-900 border-slate-700 hover:border-emerald-500/50 transition-all`}
              >
                {tier.popular && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-emerald-500 text-white">Most Popular</Badge>
                  </div>
                )}
                
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${tier.color} flex items-center justify-center mb-4`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-2xl text-white">{tier.name}</CardTitle>
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
                    disabled={isSaving}
                    className={`w-full ${
                      selectedTier === tier.id
                        ? 'bg-green-600 hover:bg-green-700'
                        : tier.popular 
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700' 
                          : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : selectedTier === tier.id ? (
                      <><CheckCircle className="w-4 h-4 mr-2" /> Current Plan</>
                    ) : currentUser ? (
                      tier.price === 0 ? 'Select Free Plan' : 'Select Plan'
                    ) : (
                      tier.price === 0 ? 'Start Free' : 'Get Started'
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center">
          {currentUser ? (
            <p className="text-slate-400 text-sm">
              Logged in as <span className="text-emerald-400">{currentUser.full_name || currentUser.email}</span>
              {' • '}
              <button 
                onClick={() => window.location.reload()}
                className="text-emerald-400 hover:text-emerald-300 underline"
              >
                Continue to app
              </button>
            </p>
          ) : (
            <p className="text-slate-400 text-sm">
              Already have an account?{' '}
              <button 
                onClick={handleLogin}
                className="text-emerald-400 hover:text-emerald-300 underline"
              >
                Log in here
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}