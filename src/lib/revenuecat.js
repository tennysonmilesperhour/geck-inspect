/**
 * RevenueCat bootstrap and helpers.
 *
 * Geck Inspect ships against two RevenueCat SDKs:
 *   - `@revenuecat/purchases-js` for the browser and the PWA. Uses
 *     Web Billing (Stripe under the hood).
 *   - `@revenuecat/purchases-capacitor` for the iOS / Android shells.
 *     Uses Apple StoreKit / Google Play Billing under the hood so
 *     the apps pass store review.
 *
 * The two SDKs have slightly different shapes (the native plugin
 * returns object-wrapped Promises and uses `appUserID`, the web SDK
 * is sync and uses `appUserId`). This module flattens both behind
 * one interface so call sites don't have to know which is loaded.
 */
import { Purchases as PurchasesWeb, LogLevel as LogLevelWeb } from '@revenuecat/purchases-js';

// The native Capacitor SDK is loaded lazily (dynamic import) so it is
// code-split out of the web/PWA bundle, which never uses it. Every
// native call site below is already async, so awaiting the import costs
// nothing on the platforms that actually need it (iOS/Android), and web
// users never download it.
let _nativeModulePromise = null;
function loadNativeRC() {
  _nativeModulePromise ||= import('@revenuecat/purchases-capacitor');
  return _nativeModulePromise;
}

// Public (sandbox by default) Web Billing key. Override with
// VITE_REVENUECAT_WEB_API_KEY in production.
export const REVENUECAT_WEB_API_KEY =
  import.meta.env?.VITE_REVENUECAT_WEB_API_KEY ||
  'test_OVdgRQzJmflBtKgGkRzhTzumbEo';

export const REVENUECAT_IOS_API_KEY =
  import.meta.env?.VITE_REVENUECAT_IOS_API_KEY || '';
export const REVENUECAT_ANDROID_API_KEY =
  import.meta.env?.VITE_REVENUECAT_ANDROID_API_KEY || '';

export const PRO_ENTITLEMENT_ID = 'Geck Inspect Pro';

// Product identifiers configured for Geck Inspect Pro on Web. iOS /
// Android use store-native product ids (`com.geckinspect.pro.monthly`,
// etc) configured separately in the RC dashboard. They all attach to
// the same entitlement so the `hasActiveEntitlement` check works the
// same on every platform.
export const PRODUCT_IDS = {
  lifetime: 'lifetime',
  yearly: 'yearly',
  monthly: 'monthly',
};

export function detectPlatform() {
  if (typeof window === 'undefined') return 'ssr';
  const cap = /** @type {any} */ (window).Capacitor;
  if (cap?.isNativePlatform?.()) {
    const p = cap.getPlatform?.();
    if (p === 'ios' || p === 'android') return p;
  }
  return 'web';
}

export function isNativePlatform() {
  const p = detectPlatform();
  return p === 'ios' || p === 'android';
}

export function getApiKeyForPlatform(platform = detectPlatform()) {
  if (platform === 'ios') return REVENUECAT_IOS_API_KEY;
  if (platform === 'android') return REVENUECAT_ANDROID_API_KEY;
  return REVENUECAT_WEB_API_KEY;
}

export function resolveAppUserId(user) {
  if (!user) return null;
  return user.auth_user_id || user.id || null;
}

// Cache the native-configured flag locally because the native plugin's
// isConfigured() is async and we want a sync check in some call sites.
let nativeConfigured = false;

async function configureNative(apiKey, appUserId) {
  const { Purchases: PurchasesNative, LOG_LEVEL: LogLevelNative } = await loadNativeRC();
  if (!nativeConfigured) {
    PurchasesNative.setLogLevel({ level: LogLevelNative.WARN });
    await PurchasesNative.configure({ apiKey, appUserID: appUserId });
    nativeConfigured = true;
    return;
  }
  const current = await PurchasesNative.getAppUserID();
  if (current?.appUserID !== appUserId) {
    await PurchasesNative.logIn({ appUserID: appUserId });
  }
}

function configureWeb(apiKey, appUserId) {
  if (!PurchasesWeb.isConfigured()) {
    PurchasesWeb.configure({ apiKey, appUserId });
    if (import.meta.env.DEV) PurchasesWeb.setLogLevel(LogLevelWeb.Debug);
    return PurchasesWeb.getSharedInstance();
  }
  const instance = PurchasesWeb.getSharedInstance();
  if (instance.getAppUserId() !== appUserId) {
    instance.identifyUser(appUserId).catch((err) => {
      console.warn('[revenuecat] identifyUser failed:', err);
    });
  }
  return instance;
}

/**
 * Configure the SDK for the current platform. Returns a Promise on
 * native (the plugin is async) and the shared web instance synchronously
 * on web. Call sites that just want to fire-and-forget can ignore the
 * return value.
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
    resolveAppUserId(user) || PurchasesWeb.generateRevenueCatAnonymousAppUserId();

  if (isNativePlatform()) {
    return configureNative(apiKey, appUserId);
  }
  return configureWeb(apiKey, appUserId);
}

export function getPurchasesWeb() {
  if (typeof window === 'undefined') return null;
  if (!PurchasesWeb.isConfigured()) return null;
  return PurchasesWeb.getSharedInstance();
}

/**
 * Normalize the entitlement bag from both SDKs into the same shape so
 * `hasActiveEntitlement` works regardless of platform.
 *
 * Web SDK CustomerInfo.entitlements.active is keyed by entitlement id.
 * Native CustomerInfo uses the same shape. Both return an
 * EntitlementInfo with an `isActive` boolean. The only meaningful
 * difference is the wrapping: the native plugin returns
 * `{ customerInfo: CustomerInfo }`, the web SDK returns CustomerInfo.
 */
export async function fetchCustomerInfo() {
  if (typeof window === 'undefined') return null;
  try {
    if (isNativePlatform()) {
      const { Purchases: PurchasesNative } = await loadNativeRC();
      const { customerInfo } = await PurchasesNative.getCustomerInfo();
      return customerInfo || null;
    }
    const rc = getPurchasesWeb();
    if (!rc) return null;
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
  const info = await fetchCustomerInfo();
  return hasActiveEntitlement(info);
}

export async function fetchOfferings() {
  if (typeof window === 'undefined') return null;
  try {
    if (isNativePlatform()) {
      // Native returns the same Offerings shape directly.
      const { Purchases: PurchasesNative } = await loadNativeRC();
      return await PurchasesNative.getOfferings();
    }
    const rc = getPurchasesWeb();
    if (!rc) return null;
    return await rc.getOfferings();
  } catch (err) {
    console.warn('[revenuecat] getOfferings failed:', err);
    return null;
  }
}

/**
 * Restore prior purchases. App Store guideline 3.1.1 requires this
 * affordance on iOS; Play Store equivalent is conventional. On Web
 * this is a no-op (Web Billing entitlements are already keyed by
 * appUserId), so we fall back to refreshing CustomerInfo so callers
 * still get fresh state.
 */
export async function restorePurchases() {
  if (isNativePlatform()) {
    try {
      const { Purchases: PurchasesNative } = await loadNativeRC();
      const result = await PurchasesNative.restorePurchases();
      return result?.customerInfo || null;
    } catch (err) {
      console.warn('[revenuecat] restorePurchases failed:', err);
      return null;
    }
  }
  return fetchCustomerInfo();
}

export function platformSupportsRestore() {
  return isNativePlatform();
}

/**
 * Trigger a purchase for a package. On web, this opens the Web Billing
 * checkout modal. On native, it routes through StoreKit / Play Billing
 * and returns the resolved CustomerInfo. Both throw on user cancel.
 */
export async function purchasePackage(rcPackage, { customerEmail } = {}) {
  if (isNativePlatform()) {
    const { Purchases: PurchasesNative } = await loadNativeRC();
    const result = await PurchasesNative.purchasePackage({ aPackage: rcPackage });
    return result?.customerInfo || null;
  }
  const rc = getPurchasesWeb();
  if (!rc) throw new Error('RevenueCat web SDK is not configured.');
  const result = await rc.purchase({ rcPackage, customerEmail });
  return result?.customerInfo || null;
}
