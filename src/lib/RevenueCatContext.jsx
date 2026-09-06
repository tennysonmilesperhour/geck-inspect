import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import {
  PRO_ENTITLEMENT_ID,
  configureRevenueCat,
  fetchCustomerInfo,
  fetchOfferings,
  hasActiveEntitlement,
  resolveAppUserId,
} from '@/lib/revenuecat';

const RevenueCatContext = createContext(null);

/**
 * Read the persisted Pro state from the `revenuecat_entitlements`
 * mirror written by the webhook. Returns true if there's an active row
 * for this user + entitlement. The mirror is the source of truth for
 * mobile purchases (since the Web SDK never sees those), so we read
 * from it on mount and on every auth change.
 */
async function fetchMirroredPro(appUserId) {
  if (!appUserId) return false;
  try {
    const { data, error } = await supabase
      .from('revenuecat_entitlements')
      .select('is_active, expires_at')
      .eq('app_user_id', appUserId)
      .eq('entitlement_identifier', PRO_ENTITLEMENT_ID)
      .maybeSingle();
    if (error || !data) return false;
    if (!data.is_active) return false;
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return false;
    return true;
  } catch (err) {
    console.warn('[revenuecat] mirror read failed:', err);
    return false;
  }
}

export function RevenueCatProvider({ children }) {
  const { user, mergeUserExtras } = useAuth();

  const [customerInfo, setCustomerInfo] = useState(null);
  const [offerings, setOfferings] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mirrorProActive, setMirrorProActive] = useState(false);
  const [mirrorOwner, setMirrorOwner] = useState(null);

  const appUserId = resolveAppUserId(user);
  const generationRef = useRef(0);
  const [infoOwner, setInfoOwner] = useState(null);
  const refresh = useCallback(async () => {
    const generation = generationRef.current;
    setIsRefreshing(true);
    const [ci, offs, mirror] = await Promise.all([fetchCustomerInfo(), fetchOfferings(), fetchMirroredPro(appUserId)]);
    if (generation !== generationRef.current) return null;
    setCustomerInfo(ci);
    setOfferings(offs);
    setInfoOwner(appUserId);
    setMirrorProActive(mirror);
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
    setMirrorProActive(false);
    fetchMirroredPro(appUserId).then((isPro) => {
      if (!cancelled) { setMirrorProActive(isPro); setMirrorOwner(appUserId); }
    });
    return () => {
      cancelled = true;
    };
  }, [appUserId]);

  const liveProActive = useMemo(
    () => infoOwner === appUserId && hasActiveEntitlement(customerInfo, PRO_ENTITLEMENT_ID),
    [customerInfo, infoOwner, appUserId],
  );
  const isProMember = liveProActive || (mirrorOwner === appUserId && mirrorProActive);

  // Push the resolved Pro state onto the user object so synchronous
  // checks like `effectiveTier(user)` in PlanLimitChecker can see it
  // without taking a dependency on this provider.
  useEffect(() => {
    if (!user) return;
    if (user.revenuecat_pro_active === isProMember) return;
    mergeUserExtras?.({ revenuecat_pro_active: isProMember });
  }, [isProMember, user, mergeUserExtras]);

  const value = useMemo(
    () => ({
      customerInfo,
      offerings,
      isReady,
      isRefreshing,
      isProMember,
      refresh,
    }),
    [customerInfo, offerings, isReady, isRefreshing, isProMember, refresh],
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
