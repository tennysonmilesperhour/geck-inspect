import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRevenueCat } from '@/lib/RevenueCatContext';
import { configureRevenueCat, fetchOfferings, purchasePackage, restorePurchases } from '@/lib/revenuecat';
import { nativePackagePlan } from '@/lib/nativeMembership';
import { resolveTier, TIER_LIMITS } from '@/lib/tierLimits';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { SUPPORT_EMAIL, SUPPORT_EMAIL_URL } from '@/lib/supportContact';
import OutcomeHeadline from '@/components/subscription/OutcomeHeadline';
import { captureEvent } from '@/lib/posthog';
import { currentOutcomeVariant } from '@/lib/outcomePromise';

// The listing names Apple's standard EULA (App Store Connect > License
// Agreement), and guideline 3.1.2 asks for a working link to it in the app.
export const APPLE_STANDARD_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

// Product identity is configured in RevenueCat; localized prices come from Apple.
export default function NativeMembership({ user, userChecked = true }) {
  const { offerings, isReady, sync, customerInfo, storeTier } = useRevenueCat();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [reloadedOfferings, setReloadedOfferings] = useState(null);
  const signedIn = Boolean(user && !user.is_guest);
  const existingTier = resolveTier(user ? { ...user, revenuecat_tier: storeTier, revenuecat_pro_active: storeTier === 'breeder' } : null);
  const hasDirectMembership = ['keeper', 'breeder', 'enterprise'].includes(user?.membership_tier);
  const ranks = ['free', 'keeper', 'breeder', 'enterprise'];
  const packages = ((reloadedOfferings || offerings)?.current?.availablePackages || [])
    .map(pkg => ({ pkg, plan: nativePackagePlan(pkg) })).filter(({ plan }) => plan);
  const act = async (operation) => {
    if (busy) return;
    if (!signedIn) { window.location.href = '/AuthPortal'; return; }
    setBusy(true);
    try {
      const configured = await configureRevenueCat(user);
      if (!configured) throw new Error('Store billing is unavailable in this build.');
      await operation();
    } catch (error) {
      if (!error?.userCancelled && error?.code !== '1') {
        toast({ title: 'Store action could not finish', description: error.message || 'Please try again.', variant: 'destructive' });
      }
    } finally { setBusy(false); }
  };
  return <section className="mx-auto max-w-xl p-6 space-y-5">
    <OutcomeHeadline
      surface="ios"
      pending={!userChecked || (signedIn && !isReady)}
      enabled={existingTier === 'free' && !hasDirectMembership}
      controlHeading="Geck Inspect membership"
      controlLead="Collection care, breeding records, morph identification, and tools that grow with your geckos."
      headingClassName="text-3xl font-semibold"
    />
    {existingTier !== 'free' && <p role="status">Your {TIER_LIMITS[existingTier].label} access is active. Manage an existing plan through its original billing provider.</p>}
    <p>Prices below are the full recurring store price. Your store will show any eligible introductory offer before you confirm.</p>
    {!signedIn && <Button onClick={() => { window.location.href = '/AuthPortal'; }}>Sign in to view store plans</Button>}
    {signedIn && !isReady && <p role="status">Loading store plans...</p>}
    {signedIn && isReady && packages.length === 0 && <p role="status">Store plans are currently unavailable. You can continue using your existing access and try again later.</p>}
    {packages.map(({ pkg, plan }) => {
      const limits = TIER_LIMITS[plan.tier];
      const alreadyCovered = ranks.indexOf(existingTier) >= ranks.indexOf(plan.tier);
      return <div key={pkg.identifier} className="rounded-xl border border-slate-700 p-4 space-y-3">
        <h2 className="font-semibold">{plan.label}</h2>
        <p>{limits.maxGeckos == null ? 'Unlimited geckos' : `Up to ${limits.maxGeckos} geckos`}, {limits.monthlyMorphIDCredits} AI Morph IDs per month, and {plan.tier === 'breeder' ? 'breeding, lineage, and export tools' : 'expanded care and collection tools'}.</p>
        <p>{pkg.product.priceString} {plan.period}</p>
        <Button disabled={busy || alreadyCovered || hasDirectMembership} onClick={() => act(async () => {
          const funnel = { tier: plan.tier, interval: plan.period === 'per year' ? 'annual' : 'monthly', paywall_outcome: currentOutcomeVariant() };
          captureEvent('native_purchase_started', funnel);
          await purchasePackage(pkg);
          // Store success is independent of the entitlement refresh.
          captureEvent('native_purchase_completed', funnel);
          const tier = await sync();
          toast({ title: tier && tier !== 'free' ? `${TIER_LIMITS[tier].label} access is active` : 'Purchase received', description: tier && tier !== 'free' ? 'Your membership features are ready.' : 'Your store may still be processing this purchase. Refresh access shortly.' });
        })}>{alreadyCovered ? 'Included in your current access' : hasDirectMembership ? 'Manage your existing membership' : `Continue for ${pkg.product.priceString} ${plan.period}`}</Button>
      </div>;
    })}
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" disabled={busy} onClick={() => act(async () => {
        const info = await restorePurchases();
        if (!info) throw new Error('Could not retrieve your purchases. Please try again.');
        const tier = await sync();
        toast({ title: tier && tier !== 'free' ? 'Purchases restored' : 'No active store membership found' });
      })}>Restore purchases</Button>
      <Button variant="outline" disabled={busy} onClick={() => act(async () => { setReloadedOfferings(await fetchOfferings()); await sync(); })}>Refresh store access</Button>
      {customerInfo?.managementURL && <a className="underline p-2" href={customerInfo.managementURL}>Manage store subscription</a>}
    </div>
    <p className="text-sm text-slate-400">Plans renew through your store unless canceled in its subscription settings. Changing or canceling a plan is handled by the store.</p>
    <p className="flex flex-wrap gap-4 text-sm"><a className="underline" href={APPLE_STANDARD_EULA_URL} target="_blank" rel="noopener noreferrer">Terms of Use (EULA)</a><Link className="underline" to="/Terms">Terms</Link><Link className="underline" to="/PrivacyPolicy">Privacy</Link></p>
    <p className="text-sm">Need help? <a className="underline break-all" href={SUPPORT_EMAIL_URL}>{SUPPORT_EMAIL}</a></p>
  </section>;
}
