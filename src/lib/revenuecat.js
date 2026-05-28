/**
 * RevenueCat bootstrap and helpers.
 *
 * Today this loads the Web SDK (`@revenuecat/purchases-js`). When a
 * mobile shell is added (Capacitor / React Native), swap the imported
 * SDK by platform in `loadPurchasesSDK` ,  every other call site routes
 * through the helpers below and won't need to change.
 *
 * The Web SDK doesn't expose `restorePurchases` (everything is server
 * driven on web); the mobile SDKs do. `restorePurchases()` here is a
 * no-op on web and forwards to the SDK on native.
 */
import { Purchases, LogLevel } from '@revenuecat/purchases-js';

// Public (sandbox by default) Web Billing key. Override with
// VITE_REVENUECAT_WEB_API_KEY in production.
export const REVENUECAT_WEB_API_KEY =
  import.meta.env?.VITE_REVENUECAT_WEB_API_KEY ||
  'test_OVdgRQzJmflBtKgGkRzhTzumbEo';

// Native keys for when we ship a mobile shell. Wire env vars when the
// iOS / Android apps are added in the RevenueCat dashboard.
export const REVENUECAT_IOS_API_KEY =
  import.meta.env?.VITE_REVENUECAT_IOS_API_KEY || '';
export const REVENUECAT_ANDROID_API_KEY =
  import.meta.env?.VITE_REVENUECAT_ANDROID_API_KEY || '';

// Entitlement identifier as configured in the RevenueCat dashboard.
export const PRO_ENTITLEMENT_ID = 'Geck Inspect Pro';

// Product identifiers configured for Geck Inspect Pro on Web. iOS /
// Android use store-native product ids configured separately in the
// RC dashboard, but they all attach to the same entitlement so the
// `hasActiveEntitlement` check works the same on every platform.
export const PRODUCT_IDS = {
  lifetime: 'lifetime',
  yearly: 'yearly',
  monthly: 'monthly',
};

/**
 * Detect which platform shell the app is running inside.
 * Returns 'ios' / 'android' when Capacitor reports a native runtime,
 * 'web' otherwise. Safe to call before any SDK is configured.
 */
export function detectPlatform() {
  if (typeof window === 'undefined') return 'ssr';
  const cap = /** @type {any} */ (window).Capacitor;
  if (cap?.isNativePlatform?.()) {
    const p = cap.getPlatform?.();
    if (p === 'ios' || p === 'android') return p;
  }
  return 'web';
}

export function getApiKeyForPlatform(platform = detectPlatform()) {
  if (platform === 'ios') return REVENUECAT_IOS_API_KEY;
  if (platform === 'android') return REVENUECAT_ANDROID_API_KEY;
  return REVENUECAT_WEB_API_KEY;
}

/**
 * Pull the Supabase auth uid off our normalized user object. Older
 * profile rows in the codebase keep a legacy text `id` that does NOT
 * match auth.users.id (see lib/AuthContext.jsx), so we prefer
 * auth_user_id when present.
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

  const platform = detectPlatform();
  const apiKey = getApiKeyForPlatform(platform);
  if (!apiKey) {
    console.warn(`[revenuecat] no API key configured for platform ${platform}`);
    return null;
  }

  const appUserId =
    resolveAppUserId(user) || Purchases.generateRevenueCatAnonymousAppUserId();

  if (!Purchases.isConfigured()) {
    Purchases.configure({ apiKey, appUserId });
    if (import.meta.env.DEV) {
      Purchases.setLogLevel(LogLevel.Debug);
    }
    return Purchases.getSharedInstance();
  }

  const instance = Purchases.getSharedInstance();
  if (instance.getAppUserId() !== appUserId) {
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

/**
 * Restore prior purchases. App Store guideline 3.1.1 requires a
 * "Restore Purchases" affordance on iOS; Play Store equivalent is
 * conventional but not strictly required. On Web this is a no-op
 * because Web Billing entitlements are already keyed by appUserId
 * (the Supabase auth uid), so there's nothing to restore from a
 * local receipt.
 */
export async function restorePurchases() {
  const platform = detectPlatform();
  if (platform === 'web' || platform === 'ssr') {
    return fetchCustomerInfo();
  }
  const rc = getPurchases();
  if (!rc) return null;
  if (typeof rc.restorePurchases === 'function') {
    try {
      return await rc.restorePurchases();
    } catch (err) {
      console.warn('[revenuecat] restorePurchases failed:', err);
      return null;
    }
  }
  return fetchCustomerInfo();
}

export function platformSupportsRestore() {
  const p = detectPlatform();
  return p === 'ios' || p === 'android';
}
