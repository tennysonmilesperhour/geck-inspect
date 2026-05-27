import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  PRO_ENTITLEMENT_ID,
  configureRevenueCat,
  fetchCustomerInfo,
  fetchOfferings,
  hasActiveEntitlement,
} from '@/lib/revenuecat';

const RevenueCatContext = createContext(null);

export function RevenueCatProvider({ children }) {
  const { user } = useAuth();

  const [customerInfo, setCustomerInfo] = useState(null);
  const [offerings, setOfferings] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track the last appUserId we configured for so we know when to
  // re-fetch CustomerInfo after a sign-in / account switch.
  const lastAppUserIdRef = useRef(null);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    const [ci, offs] = await Promise.all([fetchCustomerInfo(), fetchOfferings()]);
    setCustomerInfo(ci);
    setOfferings(offs);
    setIsRefreshing(false);
    setIsReady(true);
    return ci;
  }, []);

  useEffect(() => {
    const instance = configureRevenueCat(user);
    if (!instance) return;
    const nextId = instance.getAppUserId();
    if (lastAppUserIdRef.current === nextId && isReady) return;
    lastAppUserIdRef.current = nextId;
    refresh();
  }, [user, refresh, isReady]);

  const isProMember = useMemo(
    () => hasActiveEntitlement(customerInfo, PRO_ENTITLEMENT_ID),
    [customerInfo],
  );

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
