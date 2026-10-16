import { useEffect, useState } from 'react';
import NativeMembership from '@/components/subscription/NativeMembership';
import { isNativePlatform } from '@/lib/revenuecat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { reportError } from '@/lib/telemetry';
import { Check, CheckCircle2, ChevronDown, Sparkles, Zap, Crown, Star, Loader2, Infinity as InfinityIcon, CreditCard } from 'lucide-react';
import { User, PageConfig } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
import SupportContactCard from '@/components/support/SupportContactCard';
import ReferralLinkCard from '@/components/shared/ReferralLinkCard';
import {
  ENTERPRISE_ON_SALE,
  getTierPricing,
  TIER_PRICING,
  TRIAL_DAYS,
  KEEPER_PROMO_TRIAL_DAYS,
  maxAnnualSavingsPercent,
} from '@/lib/stripe-config';
import Seo from '@/components/seo/Seo';
import {
  MEMBERSHIP_FAQS,
  MEMBERSHIP_JSON_LD,
  membershipMetaDescription,
  membershipShellCopy,
} from '@/lib/membershipSeo';
import { captureEvent } from '@/lib/posthog';
import { openBillingPortal } from '@/lib/billingPortal';
import { resolveTier } from '@/lib/tierLimits';
import { featuresWithConsultant, pageIsLive, planNumbers } from '@/lib/membershipFeatures';
import { lastUpgradePrompt } from '@/lib/activation';
import { isGuestMode } from '@/lib/guestMode';

/**
 * Membership / pricing page.
 *
 * Layout since October 2026 (comprehensive review B4, adversarial review
 * "The pricing page argues against itself"): three columns, each with who
 * it is for and the four numbers that decide it, and no "best for" badge,
 * since Free is what suits most keepers:
 *
 *   FREE      10 geckos, 1 active breeding pair; its long list is
 *             collapsed to six lines with "Show all"
 *   KEEPER    50 geckos, 5 active breeding pairs, more Morph IDs
 *   BREEDER   unlimited geckos and pairs, marketplace sync, waitlists
 *   ENTERPRISE a row below the three, a waitlist while off sale
 *
 * Three billing cadences are surfaced through a top-of-page toggle:
 *
 *   Monthly  , recurring, the default
 *   Annual   , recurring, ~17% cheaper than 12x monthly (computed from
 *               stripe-config, never hardcoded)
 *   Lifetime, one-time payment, never expires. The Lifetime toggle only
 *               renders when at least one tier has a live lifetime
 *               price_id in stripe-config; with none configured the
 *               cadence is hidden instead of showing dead buy buttons.
 *
 * The cadence is passed through to the (still-to-be-built)
 * `stripe-checkout` edge function as `billing_cycle` along with the
 * specific Stripe price id from src/lib/stripe-config.js.
 *
 * Grandfathered users land on this page already owning the Breeder tier
 * (see subscription_status === 'grandfathered') and see a "You already
 * have Breeder access" banner instead of the checkout buttons.
 *
 * Every line in the plan lists below must be true today (decision D11,
 * 29 Sep 2026): no promises of features that do not exist yet, and
 * nothing listed as paid that free members already use. Lineage, feeding
 * groups and sales records are free on every plan, so they sit under
 * Free. Limits match src/lib/tierLimits.js and PlanLimitChecker.
 *
 * AI Consultant monthly message allowances are added to each card only
 * while the AI Consultant page is switched on (src/lib/membershipFeatures.js).
 */

// Each plan says who it is for and leads with the numbers that decide it
// (the comprehensive review, B4 and the adversarial review's pricing
// finding, October 2026). The feature lists are unchanged; Free's is
// ordered so its six most useful lines show before "Show all".
const tiers = [
  {
    key: 'free',
    name: 'FREE',
    icon: Star,
    description: 'For keepers with up to 10 geckos. Free for good.',
    comingSoon: false,
    // Lines shown before "Show all" on the Free card.
    collapsedCount: 6,
    features: [
      'Weight tracking, feeding groups, and event logging',
      'Lineage tree for your geckos',
      'Automatic value estimates from real listings',
      'Sales records and cost tracking',
      'Morph Guide, genetics calculator, and care guides',
      'One free AI Morph ID every month',
      'Up to 10 geckos in your collection',
      'Basic breeding log (1 active pair)',
      'Up to 5 additional reptiles tracked',
      '1 GB of photo storage',
      'Public marketplace browsing',
      'Community forum access',
    ],
  },
  {
    key: 'keeper',
    name: 'KEEPER',
    icon: Zap,
    description: 'For keepers whose collection has grown past 10 geckos.',
    comingSoon: false,
    features: [
      'Everything in Free',
      'Up to 50 geckos',
      'Up to 10 additional reptiles tracked',
      'Up to 5 active breeding pairs',
      '3 AI Morph IDs per month',
      'Estimated-value add-on for Morph ID (opt in)',
      '10 GB of photo storage',
    ],
  },
  {
    key: 'breeder',
    name: 'BREEDER',
    icon: Crown,
    description: 'For breeders who pair every season and sell what hatches.',
    comingSoon: false,
    features: [
      'Everything in Keeper',
      'Unlimited geckos and breeding pairs',
      'Unlimited additional reptiles tracked',
      '6 AI Morph IDs per month',
      'Unlimited photo storage',
      'MorphMarket CSV sync',
      'Pairing waitlists with deposit terms and tracking',
      'Option to be featured on the dashboard',
    ],
  },
  {
    key: 'enterprise',
    name: 'ENTERPRISE',
    icon: Sparkles,
    description: 'For breeders who price by the market.',
    // Off sale while ENTERPRISE_ON_SALE is false (see stripe-config.js):
    // the row shows a waitlist button instead of checkout.
    comingSoon: !ENTERPRISE_ON_SALE,
    features: [
      'Everything in Breeder',
      '15 AI Morph IDs per month',
      'Market Intelligence: the daily market brief and the live feed of new listings and price cuts',
      'Watchlist alerts when a matching gecko is listed',
      'Pricing analytics: asking prices by trait, supply and sellers',
    ],
  },
];

const PLAN_COLUMNS = ['free', 'keeper', 'breeder'];

// Lifetime is only offered when a tier actually has a live Stripe price
// for it; otherwise the toggle would lead to dead purchase buttons.
const LIFETIME_AVAILABLE = Object.values(TIER_PRICING).some(
  (t) => t.lifetime?.price_id,
);
const CYCLE_OPTIONS = [
  { key: 'monthly',  label: 'Monthly' },
  { key: 'annual',   label: 'Annual',   hint: `Save up to ${maxAnnualSavingsPercent()}%` },
  ...(LIFETIME_AVAILABLE ? [{ key: 'lifetime', label: 'Lifetime', hint: 'Pay once' }] : []),
];

// Badge text sits on a solid colour dark enough for white text (the old
// emerald-500 badge measured 3.72 to 1; WCAG AA needs 4.5).
function HoveringBadge({ children, variant = 'current' }) {
  const styles =
    variant === 'current'
      ? 'bg-emerald-700 text-white border-emerald-600'
      : variant === 'lifetime'
        ? 'bg-amber-400 text-slate-950 border-amber-300'
        : 'bg-slate-700 text-slate-100 border-slate-600';
  return (
    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border whitespace-nowrap ${styles}`}
      >
        {variant === 'lifetime' && <InfinityIcon className="w-3 h-3" aria-hidden="true" />}
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
            className={`touch:min-h-11 flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              active
                ? opt.key === 'lifetime'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-emerald-700 text-white'
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

function ctaLabel(p) {
  if (p.isCurrent) return 'Current plan';
  if (p.enterpriseLifetimeUnavailable) return 'Not available';
  if (p.isLocked) return 'Join the waitlist';
  if (p.tier.key === 'free' && p.signedOut) return 'Create free account';
  return p.pricing?.cta || 'Choose plan';
}

function PlanButton({ plan: p, onChoose }) {
  return (
    <Button
      onClick={() => onChoose(p.tier, p.pricing)}
      disabled={p.busy || p.isCurrent || p.enterpriseLifetimeUnavailable}
      className={`w-full min-h-11 font-semibold ${
        p.isCurrent
          ? 'bg-slate-800 hover:bg-slate-800 text-slate-100 border border-slate-600 cursor-default disabled:opacity-100'
          : p.lifetimeAccent
            ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
            : 'bg-emerald-700 hover:bg-emerald-800 text-white'
      }`}
    >
      {p.busy ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Redirecting...
        </>
      ) : ctaLabel(p)}
    </Button>
  );
}

function TrialLink({ plan: p, onChoose }) {
  if (!p.canStartTrial) return null;
  return (
    <div className="text-center">
      <button
        type="button"
        onClick={() => onChoose(p.tier, p.pricing, p.trialIntent)}
        disabled={p.anyBusy}
        className="touch:min-h-11 text-sm text-slate-100 underline underline-offset-4 decoration-emerald-400 hover:decoration-white disabled:opacity-50"
      >
        {p.trialBusy ? 'Starting your trial...' : `or start a ${p.trialLength}-day free trial first`}
      </button>
      <p className="text-xs text-slate-400 mt-1.5">
        No charge for {p.trialLength} days. Cancel before it ends and you pay nothing.
      </p>
    </div>
  );
}

/**
 * One plan column: name, price, who it is for, the four numbers that
 * decide it, the feature list (Free's collapsed to its first lines with
 * "Show all"), the buy button and the optional trial link.
 */
function PlanCard({ plan: p, expanded, onToggle, onChoose }) {
  const { tier, pricing, features } = p;
  const Icon = tier.icon;
  const collapsible = Boolean(tier.collapsedCount) && features.length > tier.collapsedCount;
  const shown = collapsible && !expanded ? features.slice(0, tier.collapsedCount) : features;
  const listId = `plan-features-${tier.key}`;
  const planName = tier.name.charAt(0) + tier.name.slice(1).toLowerCase();
  return (
    <div className="relative">
      {p.isCurrent && <HoveringBadge variant="current">Current plan</HoveringBadge>}
      {!p.isCurrent && p.lifetimeAccent && <HoveringBadge variant="lifetime">Pay once</HoveringBadge>}
      <Card
        className={`h-full flex flex-col ${
          p.isCurrent
            ? 'border-2 border-emerald-600 bg-slate-900/95'
            : p.lifetimeAccent
              ? 'border-amber-400/50 bg-slate-900/90'
              : 'border-slate-700 bg-slate-900/85'
        }`}
      >
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-slate-800">
              <Icon className={`w-5 h-5 ${p.lifetimeAccent ? 'text-amber-300' : 'text-emerald-300'}`} aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl text-white">{tier.name}</CardTitle>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white">{pricing?.price ?? 'Custom'}</span>
              {pricing?.billing && <span className="text-slate-300 text-sm">{pricing.billing}</span>}
            </div>
            {/* Who the plan is for, in one line. */}
            <p className="text-base mt-2 text-slate-100 font-medium">{tier.description}</p>
            {pricing?.priceCaption && <p className="text-xs mt-1.5 text-slate-400">{pricing.priceCaption}</p>}
          </div>
          <dl className="grid grid-cols-2 gap-2" aria-label={`${planName} plan limits`}>
            {planNumbers(tier.key).map((n) => (
              <div key={n.label} className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2">
                <dt className="text-[11px] uppercase tracking-wide text-slate-300">{n.label}</dt>
                <dd className="text-lg font-bold text-white">{n.value}</dd>
              </div>
            ))}
          </dl>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col gap-5">
          <ul id={listId} className="space-y-2.5 flex-1">
            {shown.map((feature) => (
              <li key={feature} className="flex gap-3">
                <Check className={`w-5 h-5 flex-shrink-0 ${p.lifetimeAccent ? 'text-amber-300' : 'text-emerald-400'}`} aria-hidden="true" />
                <span className="text-sm text-slate-200">{feature}</span>
              </li>
            ))}
          </ul>
          {collapsible && (
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={listId}
              onClick={onToggle}
              className="-mt-2 inline-flex items-center gap-1 self-start touch:min-h-11 text-sm text-slate-100 underline underline-offset-4 decoration-slate-500 hover:decoration-white"
            >
              {expanded ? 'Show fewer' : `Show all ${features.length} ${planName} features`}
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          )}
          <PlanButton plan={p} onChoose={onChoose} />
          <TrialLink plan={p} onChoose={onChoose} />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Enterprise sits below the three plans as one row: it is for a different
 * customer (commercial operations), and while it is off sale its button
 * joins the waitlist.
 */
function EnterpriseRow({ plan: p, onChoose }) {
  const { tier, pricing, features } = p;
  const Icon = tier.icon;
  return (
    <section aria-labelledby="enterprise-plan-heading" className="max-w-6xl mx-auto w-full rounded-2xl border border-slate-700 bg-slate-900/80 p-5 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center gap-5">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Icon className="w-5 h-5 text-emerald-300" aria-hidden="true" />
            <h2 id="enterprise-plan-heading" className="text-xl font-bold text-white">{tier.name}</h2>
            {p.isCurrent && (
              <span className="rounded-full bg-emerald-700 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">Current plan</span>
            )}
            {p.isLocked && (
              <span className="rounded-full border border-slate-600 bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-100">Waitlist</span>
            )}
          </div>
          <p className="text-base text-slate-100 font-medium">{tier.description}</p>
          <ul className="text-sm text-slate-200 space-y-1">
            {features.map((feature) => (
              <li key={feature} className="flex gap-2">
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-400" aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="md:w-64 shrink-0 space-y-2">
          {p.isLocked ? (
            <p className="text-sm text-slate-200">Not on sale right now. Join the waitlist and we will tell you first.</p>
          ) : p.enterpriseLifetimeUnavailable ? (
            <p className="text-sm text-slate-200">Lifetime is not available for Enterprise. Message support for a custom quote.</p>
          ) : (
            <div>
              <span className="text-3xl font-bold text-white">{pricing?.price ?? 'Custom'}</span>
              {pricing?.billing && <span className="text-slate-300 text-sm"> {pricing.billing}</span>}
              {pricing?.priceCaption && <p className="text-xs mt-1 text-slate-400">{pricing.priceCaption}</p>}
            </div>
          )}
          <PlanButton plan={p} onChoose={onChoose} />
          <TrialLink plan={p} onChoose={onChoose} />
        </div>
      </div>
    </section>
  );
}

export default function MembershipPage() {
  const [user, setUser] = useState(null);
  // Keyed `${tier}:${intent}` so the buy button and the trial button on the
  // same card spin independently.
  const [loadingAction, setLoadingAction] = useState(null);
  const [cycle, setCycle] = useState('monthly');
  // Plans whose full feature list is open ("Show all" on Free).
  const [expandedPlans, setExpandedPlans] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    User.me().then(setUser).catch(() => setUser(null));
  }, []);

  // Only list AI Consultant allowances while members can open the page.
  const [consultantLive, setConsultantLive] = useState(false);
  useEffect(() => {
    let cancelled = false;
    PageConfig.filter({ page_name: 'BreederConsultant' })
      .then((rows) => { if (!cancelled) setConsultantLive(pageIsLive(rows)); })
      .catch(() => { if (!cancelled) setConsultantLive(false); });
    return () => { cancelled = true; };
  }, []);

  // Stripe sends the member back to /Membership?checkout=success (or
  // =cancelled). Read it once, then drop it from the address bar so a
  // refresh or a bookmark does not show the confirmation again.
  const [checkoutReturn] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const value = params.get('checkout');
      if (value !== 'success' && value !== 'cancelled') return null;
      params.delete('checkout');
      const rest = params.toString();
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`,
      );
      return value;
    } catch {
      return null;
    }
  });

  // Funnel: the pricing page was viewed, and, on return from Stripe, whether
  // checkout completed or was cancelled.
  useEffect(() => {
    captureEvent('membership_viewed');
    if (checkoutReturn === 'success') captureEvent('checkout_returned', { claimed_status: 'success' });
    else if (checkoutReturn === 'cancelled') captureEvent('checkout_cancelled');
  }, [checkoutReturn]);

  // After a successful checkout the Stripe webhook updates the plan a few
  // seconds later. Re-read the member a few times so the confirmation can
  // name the new plan instead of the old one.
  const [planConfirmed, setPlanConfirmed] = useState(false);
  useEffect(() => {
    if (checkoutReturn !== 'success') return undefined;
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const fresh = await User.me();
        if (cancelled) return;
        if (fresh) setUser(fresh);
        if (fresh && resolveTier(fresh) !== 'free') {
          setPlanConfirmed(true);
          // The paid plan is confirmed on the account, not just claimed
          // by the return URL. Stripe's webhook log stays the source of
          // truth for revenue; this is the in-app funnel step.
          captureEvent('checkout_completed', {
            tier: resolveTier(fresh),
            from_prompt: lastUpgradePrompt(),
            attempts,
          });
          return;
        }
      } catch {
        // keep trying a few times
      }
      if (!cancelled && attempts < 6) setTimeout(poll, 2500);
    };
    poll();
    return () => { cancelled = true; };
  }, [checkoutReturn]);

  // The Promote page links here as ?intent=keeper_trial to offer the
  // one-time 30-day Keeper promo. Read it once on mount; the page never
  // rewrites the query string.
  const [urlIntent] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('intent') || null;
    } catch {
      return null;
    }
  });

  // One plan resolver for the whole app (src/lib/tierLimits.js). Reading
  // the raw membership_tier column showed an app store subscriber as Free,
  // with a buy button for the plan they already pay for.
  const isGrandfathered = user?.subscription_status === 'grandfathered';
  const currentTier = user ? resolveTier(user) : null;
  // The plan came from the app store rather than Stripe: Stripe checkout
  // and the Stripe billing portal do not apply.
  const isAppStorePlan = Boolean(
    user && currentTier !== 'free' && !isGrandfathered && !user.stripe_subscription_id &&
    (user.membership_tier || 'free') === 'free' && ['keeper', 'breeder'].includes(user.revenuecat_tier),
  );
  const currentCycle = user?.membership_billing_cycle || null;
  const currentTierMeta = currentTier
    ? tiers.find((t) => t.key === currentTier) || null
    : null;
  const isLifetimeGrant = currentCycle === 'lifetime';
  // One free trial per account. The checkout function is the enforcer
  // (profiles.free_trial_used); this only decides whether to show the offer.
  const trialUsed = Boolean(user?.free_trial_used);
  const hasPaidPlan = Boolean(currentTier && currentTier !== 'free');
  const keeperPromoAvailable =
    urlIntent === 'keeper_trial' && !user?.keeper_trial_used && !hasPaidPlan;
  // Stripe-backed subscriptions are the only ones with anything to manage.
  // Grandfathered, lifetime, app store, referral and comped plans have no
  // Stripe subscription.
  const canManageBilling = Boolean(
    user && currentTier && currentTier !== 'free' && !isGrandfathered && !isLifetimeGrant &&
    user.stripe_subscription_id,
  );
  const [portalBusy, setPortalBusy] = useState(false);

  const handleManageBilling = async () => {
    captureEvent('billing_portal_opened', { tier: currentTier });
    setPortalBusy(true);
    try {
      await openBillingPortal({ returnPath: '/Membership' });
    } catch (err) {
      reportError(err, { component: 'Membership', extra: { op: 'stripe-billing-portal', code: err?.code } });
      toast({
        title: 'Billing portal unavailable',
        description: err?.message || 'Stripe could not open the billing portal. Email support and we will sort it out by hand.',
        variant: 'destructive',
      });
      setPortalBusy(false);
    }
  };

  const handleCTA = async (tier, pricing, intent = 'purchase') => {
    if (isGuestMode()) {
      toast({
        title: 'Guest demo is view-only',
        description: 'Sign in or create an account before starting membership checkout.',
      });
      return;
    }
    if (tier.comingSoon) {
      toast({
        title: 'Enterprise waitlist',
        description: 'Tell us about your operation using the support form below.',
      });
      // window.scrollTo did nothing here: public pages scroll inside #root,
      // not the document. Scrolling the support card itself works in any
      // scroll container.
      requestAnimationFrame(() => {
        document.getElementById('membership-support')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      });
      return;
    }
    // Signed-out visitors picking a plan are new, so open the sign-up
    // form, not sign-in (it used to open on Sign In and lose them).
    if (tier.key === 'free') {
      window.location.href = user ? '/Dashboard' : '/AuthPortal?mode=signup';
      return;
    }
    if (!user) {
      window.location.href = '/AuthPortal?mode=signup';
      return;
    }
    if (isGrandfathered) {
      toast({
        title: 'You already have Breeder access',
        description: 'As a grandfathered member, you keep the Breeder tier for free.',
      });
      return;
    }
    if (isAppStorePlan) {
      // A Stripe checkout here would bill them a second time.
      toast({
        title: 'Your plan is billed through the App Store',
        description: 'Change or cancel it from the Geck Inspect app or your device subscription settings, so you are never charged twice.',
      });
      return;
    }

    const fromPrompt = lastUpgradePrompt();
    captureEvent('plan_selected', { tier: tier.key, interval: cycle, intent, from_prompt: fromPrompt });
    captureEvent('checkout_started', { tier: tier.key, interval: cycle, intent, from_prompt: fromPrompt });
    setLoadingAction(`${tier.key}:${intent}`);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          tier: tier.key,
          billing_cycle: cycle,
          price_id: pricing?.price_id || null,
          mode: pricing?.mode || null,
          intent,
          returnUrl: `${window.location.origin}/Membership`,
        },
      });
      // FunctionsHttpError hides the JSON body behind error.context, so a
      // 400 like "you have already used your free trial" would otherwise
      // reach the member as "non-2xx status code".
      if (error) {
        let detail = error.message;
        const ctx = error.context;
        if (ctx && typeof ctx.text === 'function') {
          try {
            detail = (await ctx.text()) || detail;
          } catch {
            // keep the generic message
          }
        }
        let parsed = null;
        try {
          parsed = JSON.parse(detail);
        } catch {
          // not JSON
        }
        // Checkout would start a second subscription for a member who
        // already pays, so plan and billing cycle changes happen in the
        // billing portal, which switches the existing one.
        if (parsed?.code === 'already_subscribed') {
          setLoadingAction(null);
          toast({
            title: 'Change plans in the billing portal',
            description: 'You already have a membership, so the switch happens there and you are never charged twice.',
          });
          await handleManageBilling();
          return;
        }
        if (parsed?.code === 'already_lifetime') {
          setLoadingAction(null);
          toast({
            title: 'You already have lifetime access',
            description: 'Lifetime is paid once and does not need to be bought again.',
          });
          return;
        }
        throw new Error(parsed?.error || parsed?.message || detail);
      }
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data?.error || 'Checkout did not return a session URL');
      }
    } catch (err) {
      console.error('Checkout failed:', err);
      reportError(err, { component: 'Membership', extra: { op: 'stripe-checkout' } });
      toast({
        title: 'Checkout unavailable',
        description:
          err.message || 'Stripe is not set up yet. Reach out if you want early access.',
        variant: 'destructive',
      });
    }
    setLoadingAction(null);
  };

  if (isNativePlatform()) return <NativeMembership user={user} />;

  // Everything a plan's card or row needs to know, worked out once.
  const planState = (tier) => {
    const isEnterprise = tier.key === 'enterprise';
    const pricing = getTierPricing(tier.key, cycle);
    // Enterprise has no lifetime price: say so instead of showing a stale
    // monthly number.
    const enterpriseLifetimeUnavailable = isEnterprise && cycle === 'lifetime' && !pricing;
    // A plan with no billing cycle on file (Free, grandfathered, app
    // store, referral month, comped) is current on every tab; Enterprise
    // grants are always comped.
    const isCurrent =
      currentTier === tier.key &&
      (isEnterprise ? true : !currentCycle || currentCycle === cycle);
    // Off sale (Enterprise since 15 Oct 2026, ENTERPRISE_ON_SALE in
    // stripe-config.js): a waitlist instead of checkout, except for members
    // who already hold it.
    const isLocked = tier.comingSoon && !isCurrent;
    const isKeeperPromoCard = keeperPromoAvailable && tier.key === 'keeper';
    // The trial is opt-in on its own link, so a member who just wants to
    // pay is never pushed through one. Recurring paid plans only, one per
    // account, and never for a member who already pays.
    const canStartTrial =
      !isCurrent &&
      !isLocked &&
      tier.key !== 'free' &&
      cycle !== 'lifetime' &&
      Boolean(pricing?.price_id) &&
      !isGrandfathered &&
      !hasPaidPlan &&
      (isKeeperPromoCard || !trialUsed);
    return {
      tier,
      pricing,
      features: featuresWithConsultant(tier.key, tier.features, consultantLive),
      enterpriseLifetimeUnavailable,
      isCurrent,
      isLocked,
      trialIntent: isKeeperPromoCard ? 'keeper_trial' : 'trial',
      trialLength: isKeeperPromoCard ? KEEPER_PROMO_TRIAL_DAYS : TRIAL_DAYS,
      canStartTrial,
      lifetimeAccent: cycle === 'lifetime' && !isEnterprise && tier.key !== 'free',
      signedOut: !user,
      busy: loadingAction === `${tier.key}:purchase`,
      trialBusy: loadingAction === `${tier.key}:trial` || loadingAction === `${tier.key}:keeper_trial`,
      anyBusy: Boolean(loadingAction),
    };
  };
  const togglePlan = (key) =>
    setExpandedPlans((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));

  const planCopy = membershipShellCopy();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-4 md:p-8">
      <Seo
        title="Pricing & Plans"
        description={membershipMetaDescription()}
        path="/Membership"
        type="website"
        imageAlt="Geck Inspect membership plans, Free, Keeper, Breeder, and Enterprise tiers"
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
          <h1 className="text-2xl md:text-4xl font-bold text-slate-100">
            {planCopy.heading}
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto">
            {planCopy.lead}
          </p>
          {planCopy.paragraphs.map((text) => (
            <p key={text} className="text-sm text-slate-400 max-w-xl mx-auto">
              {text}
            </p>
          ))}

          <div className="flex justify-center pt-2">
            <CycleToggle value={cycle} onChange={setCycle} />
          </div>

          {checkoutReturn === 'success' && (
            <div
              role="status"
              className="mx-auto max-w-xl flex items-start gap-3 rounded-2xl border border-emerald-400/50 bg-emerald-500/10 px-5 py-4 text-left text-sm text-emerald-100"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-200">
                  {planConfirmed && currentTierMeta
                    ? `Thank you. Your ${currentTierMeta.name.charAt(0)}${currentTierMeta.name.slice(1).toLowerCase()} plan is active.`
                    : 'Thank you. Your payment went through.'}
                </p>
                <p className="mt-1 text-emerald-100/80">
                  {planConfirmed
                    ? 'Everything in your plan is unlocked now.'
                    : 'Your plan switches on within a minute. If this page still shows Free after that, refresh it, or message support below and we will sort it out.'}
                </p>
              </div>
            </div>
          )}

          {checkoutReturn === 'cancelled' && (
            <p className="text-sm text-slate-400">
              Checkout was cancelled, so nothing was charged. Pick a plan whenever you are ready.
            </p>
          )}

          {isGrandfathered && (
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
              <Crown className="w-4 h-4" />
              You're grandfathered into the Breeder tier, thank you for being an
              early supporter.
            </div>
          )}

          {!isGrandfathered && currentTierMeta && currentTier !== 'free' && (
            <div
              className={`mx-auto inline-flex items-center gap-3 rounded-2xl px-5 py-3 text-sm font-semibold border ${
                currentTier === 'enterprise'
                  ? 'tier-ring--enterprise border-transparent text-amber-100'
                  : currentTier === 'breeder'
                    ? 'border-purple-400/50 bg-purple-500/10 text-purple-200'
                    : 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200'
              }`}
            >
              {(() => {
                const CurrentIcon = currentTierMeta.icon;
                return <CurrentIcon className="w-5 h-5" />;
              })()}
              <span>
                You're on the{' '}
                <span className="font-bold tracking-wide">{currentTierMeta.name}</span>{' '}
                plan
                {isLifetimeGrant ? ', lifetime access, no renewals.' : isAppStorePlan ? ', billed through the App Store.' : '.'}
              </span>
            </div>
          )}

          {canManageBilling && (
            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleManageBilling}
                disabled={portalBusy}
                className="border-slate-600 bg-slate-900/60 text-slate-200 hover:bg-slate-800 hover:text-white"
              >
                {portalBusy ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                Manage billing
              </Button>
              <p className="text-xs text-slate-500 mt-2">
                Change plans, update your card, download invoices, or cancel. Opens your secure Stripe portal.
              </p>
            </div>
          )}
        </div>

        {/* Plans: three columns (Free, Keeper, Breeder), each saying who
            it is for with the numbers that decide it, and Enterprise as a
            row underneath. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto w-full">
          {PLAN_COLUMNS.map((key) => (
            <PlanCard
              key={key}
              plan={planState(tiers.find((t) => t.key === key))}
              expanded={expandedPlans.includes(key)}
              onToggle={() => togglePlan(key)}
              onChoose={handleCTA}
            />
          ))}
        </div>

        <EnterpriseRow plan={planState(tiers.find((t) => t.key === 'enterprise'))} onChoose={handleCTA} />

        {/* Visible FAQ, the same list as the FAQPage structured data. */}
        <section aria-labelledby="membership-faq-heading" className="max-w-3xl mx-auto w-full">
          <h2 id="membership-faq-heading" className="text-2xl font-bold text-slate-100 text-center mb-6">
            Questions about plans
          </h2>
          <div className="space-y-3">
            {MEMBERSHIP_FAQS.map((item) => (
              <details key={item.q} className="group rounded-xl border border-slate-700 bg-slate-900/70">
                <summary className="cursor-pointer list-none p-4 flex items-center justify-between gap-4 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
                  <span className="font-semibold text-slate-100">{item.q}</span>
                  <span className="text-emerald-400 text-2xl leading-none flex-shrink-0 group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
                </summary>
                <p className="px-4 pb-4 text-sm text-slate-300 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Referral offer. Sits next to the plans so the reward and the
            price it applies to are read together. */}
        <div className="max-w-3xl mx-auto w-full">
          <ReferralLinkCard />
        </div>

        {/* Support contact, in-app ticket instead of mailto */}
        <div id="membership-support" className="max-w-2xl mx-auto w-full scroll-mt-6">
          <SupportContactCard title="Questions about a plan? Message support." />
        </div>
      </div>
    </div>
  );
}
