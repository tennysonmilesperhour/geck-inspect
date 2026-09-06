import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { mirroredMembershipTier } from '@/lib/nativeMembership';
import {
  configureRevenueCat,
  isNativePlatform,
  fetchCustomerInfo,
  fetchOfferings,
  resolveAppUserId,
} from '@/lib/revenuecat';

const RevenueCatContext = createContext(null);

/** Only the server-written mirror grants access, across web and native clients. */
async function fetchMirroredTier(appUserId) {
  if (!appUserId) return 'free';
  const { data, error } = await supabase.from('revenuecat_entitlements')
    .select('entitlement_identifier, is_active, expires_at').eq('app_user_id', appUserId);
  if (error) {
    console.warn('[revenuecat] mirror read failed:', error.message);
    return 'free';
  }
  return mirroredMembershipTier(data);
}

export function RevenueCatProvider({ children }) {
  const { user, mergeUserExtras } = useAuth();

  const [customerInfo, setCustomerInfo] = useState(null);
  const [offerings, setOfferings] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mirrorTier, setMirrorTier] = useState('free');
  const [mirrorOwner, setMirrorOwner] = useState(null);

  const appUserId = resolveAppUserId(user);
  const generationRef = useRef(0);
  const refresh = useCallback(async () => {
    const generation = generationRef.current;
    setIsRefreshing(true);
    const [ci, offs, mirror] = await Promise.all([fetchCustomerInfo(), fetchOfferings(), fetchMirroredTier(appUserId)]);
    if (generation !== generationRef.current) return null;
    setCustomerInfo(ci);
    setOfferings(offs);
    setMirrorTier(mirror);
    setMirrorOwner(appUserId);
    setIsRefreshing(false);
    setIsReady(true);
    return ci;
  }, [appUserId]);

  useEffect(() => {
    const generation = ++generationRef.current;
    setCustomerInfo(null);
    setOfferings(null);
    setIsReady(false);
    setIsRefreshing(false);
    // Web membership checkout uses Stripe. Only native clients need store SDK
    // metadata; both platforms read the same verified database mirror below.
    if (!isNativePlatform()) { setIsReady(true); return; }
    (async () => {
      const instance = await configureRevenueCat(appUserId ? { id: appUserId } : null);
      if (generation !== generationRef.current) return;
      if (!instance) { setIsReady(true); return; }
      await refresh();
    })().catch((err) => {
      if (generation !== generationRef.current) return;
      console.warn('[revenuecat] configuration failed:', err);
      setIsReady(true);
    });
    return () => { generationRef.current++; };
  }, [appUserId, refresh]);

  // Pull the mirrored entitlement on auth change. This is what catches
  // purchases made on mobile or via a refunded/expired event from RC
  // while the user was offline.
  useEffect(() => {
    let cancelled = false;
    setMirrorTier('free');
    fetchMirroredTier(appUserId).then((tier) => {
      if (!cancelled) { setMirrorTier(tier); setMirrorOwner(appUserId); }
    });
    return () => {
      cancelled = true;
    };
  }, [appUserId]);

  // UI and paid server tools use the same verified snapshot. SDK CustomerInfo
  // alone can include Test Store purchases or stale refunded access.
  const storeTier = appUserId && mirrorOwner === appUserId ? mirrorTier : 'free';
  const isProMember = storeTier === 'breeder';

  const sync = useCallback(async () => {
    if (!appUserId) throw new Error('Sign in to refresh store access.');
    const generation = generationRef.current;
    const { data, error } = await supabase.functions.invoke('revenuecat-sync', { body: {} });
    if (generation !== generationRef.current) return null;
    if (error) throw new Error('Your purchase is saved by the store. Access could not refresh yet; use Refresh store access in a few seconds.');
    await refresh();
    return data?.tier || 'free';
  }, [appUserId, refresh]);

  // Refunds, renewals and purchases on another device are reflected when the
  // app returns to the foreground. No paid upstream call or background poll.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && appUserId) void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [appUserId, refresh]);

  // Push the verified store tier onto the user object so synchronous
  // checks like `effectiveTier(user)` in PlanLimitChecker can see it
  // without taking a dependency on this provider.
  useEffect(() => {
    if (!user) return;
    if (user.revenuecat_pro_active === isProMember && user.revenuecat_tier === storeTier) return;
    mergeUserExtras?.({ revenuecat_pro_active: isProMember, revenuecat_tier: storeTier }, appUserId);
  }, [isProMember, storeTier, user, mergeUserExtras, appUserId]);

  const value = useMemo(
    () => ({
      customerInfo,
      offerings,
      isReady,
      isRefreshing,
      isProMember,
      storeTier,
      refresh,
      sync,
    }),
    [customerInfo, offerings, isReady, isRefreshing, isProMember, storeTier, refresh, sync],
  );

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
}

export function useRevenueCat() {
  const ctx = useContext(RevenueCatContext);
  if (!ctx) {
    throw new Error('useRevenueCat must be used inside <RevenueCatProvider>.');
  }
  return ctx;
}

export function useProEntitlement() {
  const { isProMember, isReady, customerInfo } = useRevenueCat();
  return { isProMember, isReady, customerInfo };
}
