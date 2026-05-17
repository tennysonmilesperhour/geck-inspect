import { Zap, Crown, Sparkles, Star } from 'lucide-react';
import { effectiveTier } from '@/components/subscription/PlanLimitChecker';

/**
 * Visual membership-tier indicator. Used in the sidebar profile block so
 * a paying (or sponsored) member can see at a glance what plan they're
 * on, and so beta-comped accounts (Enterprise grants) actually have a
 * way to confirm their access without opening the Membership page.
 *
 * Tier resolution flows through PlanLimitChecker.effectiveTier so admins
 * read as Enterprise and grandfathered accounts read as Breeder, matching
 * their actual entitlements rather than the raw `membership_tier` column.
 */

const TIER_STYLES = {
  free: {
    label: 'Free',
    icon: Star,
    pillClass:
      'bg-slate-700/60 text-slate-200 border-slate-500/60',
    ringClass: '',
  },
  keeper: {
    label: 'Keeper',
    icon: Zap,
    pillClass:
      'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-300/60 shadow-md shadow-emerald-500/30',
    ringClass: 'tier-ring tier-ring--keeper',
  },
  breeder: {
    label: 'Breeder',
    icon: Crown,
    pillClass:
      'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-300/60 shadow-md shadow-purple-500/30',
    ringClass: 'tier-ring tier-ring--breeder',
  },
  enterprise: {
    label: 'Enterprise',
    icon: Sparkles,
    pillClass: 'tier-pill--enterprise',
    ringClass: 'tier-ring tier-ring--enterprise',
  },
};

export function tierKeyFor(user) {
  const t = effectiveTier(user);
  return TIER_STYLES[t] ? t : 'free';
}

export function tierRingClass(user) {
  return TIER_STYLES[tierKeyFor(user)].ringClass;
}

export default function TierBadge({ user, size = 'sm', hideFree = false, className = '' }) {
  const tier = tierKeyFor(user);
  if (tier === 'free' && hideFree) return null;
  const style = TIER_STYLES[tier];
  const Icon = style.icon;
  const sizeClass =
    size === 'xs'
      ? 'text-[10px] px-2 py-[1px] gap-1'
      : 'text-[11px] px-2.5 py-0.5 gap-1';
  const iconSize = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  return (
    <span
      className={`inline-flex items-center font-bold uppercase tracking-wider rounded-full border whitespace-nowrap ${sizeClass} ${style.pillClass} ${className}`}
      title={`${style.label} member`}
    >
      <Icon className={iconSize} />
      {style.label}
    </span>
  );
}
