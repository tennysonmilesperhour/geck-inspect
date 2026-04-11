import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Lock, ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Plan limits and feature flags. Source of truth for:
//   - how many geckos the user can own (geckos)
//   - how many active breeding pairs the user can track (breeding_pairs)
//   - which feature keys unlock for the tier (features)
//
// Grandfathered accounts keep `breeder` tier indefinitely — they never
// get paywalled as long as subscription_status === 'grandfathered'.
const PLAN_LIMITS = {
    free: {
        geckos: 10,
        breeding_pairs: 1,
        features: ['basic_breeding', 'public_profile', 'forum', 'ai_morph_id']
    },
    keeper: {
        geckos: 50,
        breeding_pairs: 5,
        features: [
            'basic_breeding', 'public_profile', 'forum', 'ai_morph_id',
            'advanced_breeding', 'calendar', 'weight_tracking', 'csv_export',
            'lineage_tree'
        ]
    },
    breeder: {
        geckos: Infinity,
        breeding_pairs: Infinity,
        features: [
            'basic_breeding', 'public_profile', 'forum', 'ai_morph_id',
            'advanced_breeding', 'calendar', 'weight_tracking', 'csv_export',
            'lineage_tree', 'marketplace_sync', 'breeding_analytics',
            'certificates', 'featured_breeder'
        ]
    }
};

const FEATURE_NAMES = {
    basic_breeding: 'Basic Breeding Tracking',
    public_profile: 'Public Profile',
    forum: 'Forum Access',
    ai_morph_id: 'AI Morph Identification',
    advanced_breeding: 'Advanced Breeding Tools',
    calendar: 'Calendar Reminders',
    weight_tracking: 'Weight Tracking & Charts',
    csv_export: 'Export Data to CSV',
    lineage_tree: 'Full Lineage Tree',
    marketplace_sync: 'Marketplace Sync',
    breeding_analytics: 'Breeding Analytics',
    certificates: 'White-label Certificates',
    featured_breeder: 'Featured Breeder on Dashboard',
};

// Grandfathered accounts keep Breeder privileges regardless of tier field.
function effectiveTier(user) {
    if (user?.subscription_status === 'grandfathered') return 'breeder';
    return user?.membership_tier || 'free';
}

export function checkPlanLimit(user, limitType, currentCount = 0) {
    const tier = effectiveTier(user);
    const limits = PLAN_LIMITS[tier];

    if (limitType === 'geckos') {
        return {
            allowed: currentCount < limits.geckos,
            limit: limits.geckos,
            current: currentCount,
            tier,
        };
    }
    if (limitType === 'breeding_pairs') {
        return {
            allowed: currentCount < limits.breeding_pairs,
            limit: limits.breeding_pairs,
            current: currentCount,
            tier,
        };
    }

    return {
        allowed: limits.features.includes(limitType),
        feature: limitType,
        tier,
    };
}

export function canUseFeature(user, feature) {
    const tier = effectiveTier(user);
    const limits = PLAN_LIMITS[tier];
    return limits.features.includes(feature);
}

export function getGeckoLimit(user) {
    const tier = effectiveTier(user);
    return PLAN_LIMITS[tier].geckos;
}

export function getBreedingPairLimit(user) {
    const tier = effectiveTier(user);
    return PLAN_LIMITS[tier].breeding_pairs;
}

export { PLAN_LIMITS, effectiveTier };

export default function PlanLimitModal({ isOpen, onClose, limitType, currentCount, featureName }) {
    const isGeckoLimit = limitType === 'geckos';
    const isPairLimit = limitType === 'breeding_pairs';
    
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
                <DialogHeader>
                    <div className="flex items-center justify-center mb-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                            <Lock className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    <DialogTitle className="text-2xl text-center text-white">
                        {isGeckoLimit
                            ? 'Gecko Limit Reached'
                            : isPairLimit
                                ? 'Breeding Pair Limit Reached'
                                : 'Feature Unavailable'}
                    </DialogTitle>
                    <DialogDescription className="text-center text-slate-400 mt-2">
                        {isGeckoLimit ? (
                            <>
                                You've reached the limit of <strong className="text-white">{currentCount} geckos</strong> on your current plan.
                                Upgrade to add more geckos to your collection.
                            </>
                        ) : isPairLimit ? (
                            <>
                                You've reached the limit of <strong className="text-white">{currentCount} active breeding pairs</strong> on your current plan.
                                Upgrade for more.
                            </>
                        ) : (
                            <>
                                <strong className="text-white">{featureName || FEATURE_NAMES[limitType] || limitType}</strong> is not available on your current plan.
                                Upgrade to unlock this feature.
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-5 h-5 text-emerald-400" />
                            <span className="font-semibold text-white">Upgrade Benefits</span>
                        </div>
                        <ul className="space-y-2 text-sm">
                            {isGeckoLimit || isPairLimit ? (
                                <>
                                    <li className="flex items-center gap-2 text-slate-300">
                                        <Check className="w-4 h-4 text-emerald-400" />
                                        <span>Keeper: 50 geckos &amp; 5 breeding pairs</span>
                                    </li>
                                    <li className="flex items-center gap-2 text-slate-300">
                                        <Check className="w-4 h-4 text-emerald-400" />
                                        <span>Breeder: Unlimited geckos &amp; pairs</span>
                                    </li>
                                </>
                            ) : (
                                <>
                                    <li className="flex items-center gap-2 text-slate-300">
                                        <Check className="w-4 h-4 text-emerald-400" />
                                        <span>Unlock {FEATURE_NAMES[limitType] || featureName}</span>
                                    </li>
                                    <li className="flex items-center gap-2 text-slate-300">
                                        <Check className="w-4 h-4 text-emerald-400" />
                                        <span>Access advanced tools</span>
                                    </li>
                                </>
                            )}
                            <li className="flex items-center gap-2 text-slate-300">
                                <Check className="w-4 h-4 text-emerald-400" />
                                <span>Priority support</span>
                            </li>
                        </ul>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" onClick={onClose} className="flex-1 border-slate-600">
                            Maybe Later
                        </Button>
                        <Link to={createPageUrl("Subscription")} className="flex-1">
                            <Button className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
                                View Plans
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}