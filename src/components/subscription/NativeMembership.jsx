import { useState } from 'react';
import { useRevenueCat } from '@/lib/RevenueCatContext';
import { configureRevenueCat, fetchOfferings, purchasePackage, restorePurchases, hasActiveEntitlement } from '@/lib/revenuecat';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

// Native prices and billing periods come exclusively from the store offering.
export default function NativeMembership({ user }) {
  const { offerings, isReady, isProMember, refresh, customerInfo } = useRevenueCat();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [reloadedOfferings, setReloadedOfferings] = useState(null);
  const packages = (reloadedOfferings || offerings)?.current?.availablePackages || [];
  const act = async (operation) => {
    if (busy) return;
    if (!user) { window.location.href = '/AuthPortal'; return; }
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
    <h1 className="text-3xl font-semibold">Geck Inspect Pro</h1>
    <p>Breeder access for your collection, breeding records, lineage, and exports.</p>
    {isProMember ? <p role="status">Your Pro access is active.</p> : <>
      <p>Choose a store plan. Your store will show the full price, billing period, and any eligible introductory offer before you confirm.</p>
      {!isReady && <p role="status">Loading store plans...</p>}
      {isReady && packages.length === 0 && <p role="status">Store plans are currently unavailable. You can continue using your existing access and try again later.</p>}
      {packages.map(pkg => <div key={pkg.identifier} className="rounded-xl border border-slate-700 p-4 space-y-3">
        <h2 className="font-semibold">{pkg.product.title}</h2>
        <p>{pkg.product.description}</p>
        <Button disabled={busy} onClick={() => act(async () => {
          const info = await purchasePackage(pkg);
          await refresh();
          toast({ title: hasActiveEntitlement(info) ? 'Pro access is active' : 'Purchase received', description: hasActiveEntitlement(info) ? 'Your Breeder features are ready.' : 'Your store may still be processing this purchase. Refresh access shortly.' });
        })}>Continue for {pkg.product.priceString}</Button>
      </div>)}
    </>}
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" disabled={busy} onClick={() => act(async () => {
        const info = await restorePurchases();
        if (!info) throw new Error('Could not retrieve your purchases. Please try again.');
        await refresh();
        toast({ title: hasActiveEntitlement(info) ? 'Purchases restored' : 'No active Pro purchase found' });
      })}>Restore purchases</Button>
      <Button variant="outline" disabled={busy} onClick={() => act(async () => { setReloadedOfferings(await fetchOfferings()); await refresh(); })}>Refresh store access</Button>
      {customerInfo?.managementURL && <a className="underline p-2" href={customerInfo.managementURL}>Manage store subscription</a>}
    </div>
    <p className="text-sm text-slate-400">Recurring plans renew through your store unless canceled in its subscription settings. Lifetime plans are a single purchase when offered.</p>
    <p className="flex gap-4 text-sm"><a className="underline" href="https://geckinspect.com/Terms">Terms</a><a className="underline" href="https://geckinspect.com/PrivacyPolicy">Privacy</a></p>
  </section>;
}
