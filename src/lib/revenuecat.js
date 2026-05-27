/**
 * RevenueCat Web SDK bootstrap and helpers.
 *
 * The Web SDK is a singleton ,  Purchases.configure(...) must run exactly
 * once per page load. We funnel every call site through this module so
 * the singleton, the API key, and the entitlement / product identifiers
 * are not duplicated around the codebase.
 *
 * Anonymous visitors get a generated RevenueCat anonymous ID so the SDK
 * can still fetch offerings and present paywalls before sign-in. When
 * the user authenticates, RevenueCatProvider calls identifyUser to
 * alias the anonymous purchases (if any) onto the real Supabase auth id.
 */
import { Purchases, LogLevel } from '@revenuecat/purchases-js';

// Public (sandbox) Web Billing key. Safe to ship in client code.
export const REVENUECAT_PUBLIC_API_KEY = 'test_OVdgRQzJmflBtKgGkRzhTzumbEo';

// Entitlement identifier as configured in the RevenueCat dashboard.
export const PRO_ENTITLEMENT_ID = 'Geck Inspect Pro';

// Product identifiers configured for Geck Inspect Pro.
export const PRODUCT_IDS = {
  lifetime: 'lifetime',
  yearly: 'yearly',
  monthly: 'monthly',
};

/**
 * Pull the Supabase auth uid off our normalized user object. Older
 * profile rows in the codebase keep a legacy text `id` that does NOT
 * match auth.users.id (see lib/AuthContext.jsx for the full story), so
 * we prefer auth_user_id when present.
 */
export function resolveAppUserId(user) {
  if (!user) return null;
  return user.auth_user_id || user.id || null;
}

/**
 * Configure the SDK on first call. On subsequent calls, swap the active
 * app user id if it changed (sign-in, account switch). When the caller
 * has no authenticated user, fall back to a stable RevenueCat anonymous
 * id so getOfferings / presentPaywall still work pre-auth.
 *
 * Returns the shared Purchases instance, or null if configuration was
 * not possible (e.g. server-side rendering).
 */
export function configureRevenueCat(user) {
  if (typeof window === 'undefined') return null;

  const appUserId =
    resolveAppUserId(user) || Purchases.generateRevenueCatAnonymousAppUserId();

  if (!Purchases.isConfigured()) {
    Purchases.configure({ apiKey: REVENUECAT_PUBLIC_API_KEY, appUserId });
    if (import.meta.env.DEV) {
      Purchases.setLogLevel(LogLevel.Debug);
    }
    return Purchases.getSharedInstance();
  }

  const instance = Purchases.getSharedInstance();
  if (instance.getAppUserId() !== appUserId) {
    // identifyUser aliases an anonymous id onto the real user id so any
    // purchases made before sign-in carry over. For non-anonymous
    // previous ids (account switch) it falls back to a plain user
    // change. Both cases return the resolved CustomerInfo, which the
    // provider re-reads to refresh entitlement state.
    instance.identifyUser(appUserId).catch((err) => {
      console.warn('[revenuecat] identifyUser failed:', err);
    });
  }
  return instance;
}

export function getPurchases() {
  if (typeof window === 'undefined') return null;
  if (!Purchases.isConfigured()) return null;
  return Purchases.getSharedInstance();
}

/**
 * Fetch the latest CustomerInfo. Returns null on failure so callers can
 * treat a network blip as "no entitlement" rather than crashing the
 * surrounding UI.
 */
export async function fetchCustomerInfo() {
  const rc = getPurchases();
  if (!rc) return null;
  try {
    return await rc.getCustomerInfo();
  } catch (err) {
    console.warn('[revenuecat] getCustomerInfo failed:', err);
    return null;
  }
}

export function hasActiveEntitlement(customerInfo, entitlementId = PRO_ENTITLEMENT_ID) {
  if (!customerInfo) return false;
  const ent = customerInfo.entitlements?.active?.[entitlementId];
  return Boolean(ent?.isActive);
}

/**
 * Lightweight entitlement check that hits the SDK helper. Prefer using
 * the cached value from useRevenueCat() in render paths; this is for
 * imperative checks (e.g. inside an onClick).
 */
export async function isEntitledToPro() {
  const rc = getPurchases();
  if (!rc) return false;
  try {
    return await rc.isEntitledTo(PRO_ENTITLEMENT_ID);
  } catch (err) {
    console.warn('[revenuecat] isEntitledTo failed:', err);
    return false;
  }
}

export async function fetchOfferings() {
  const rc = getPurchases();
  if (!rc) return null;
  try {
    return await rc.getOfferings();
  } catch (err) {
    console.warn('[revenuecat] getOfferings failed:', err);
    return null;
  }
}
