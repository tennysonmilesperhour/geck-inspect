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
// The web SDK (about 660 KB of JavaScript) is loaded on demand, and only
// for signed-in members. Anonymous visitors on the landing page never
// download it. `_web` holds the module once it arrives.
let _webModulePromise = null;
let _web = null;
function loadWebRC() {
  _webModulePromise ||= import('@revenuecat/purchases-js').then((m) => {
    _web = { Purchases: m.Purchases, LogLevel: m.LogLevel };
    return _web;
  });
  return _webModulePromise;
}

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

// Public SDK key. The sandbox fallback exists only in development; production
// configuration is checked at build time. Never put a secret key in VITE_.
export const REVENUECAT_WEB_API_KEY =
  import.meta.env?.VITE_REVENUECAT_WEB_API_KEY ||
  (import.meta.env.DEV ? 'test_OVdgRQzJmflBtKgGkRzhTzumbEo' : '');

if (import.meta.env?.DEV && !import.meta.env?.VITE_REVENUECAT_WEB_API_KEY) {
  console.warn(
    '[revenuecat] VITE_REVENUECAT_WEB_API_KEY not set; using the sandbox ' +
      'test key. Web Billing purchases will not process against production.',
  );
}

export const REVENUECAT_IOS_API_KEY =
  import.meta.env?.VITE_REVENUECAT_IOS_API_KEY || '';
export const REVENUECAT_ANDROID_API_KEY =
  import.meta.env?.VITE_REVENUECAT_ANDROID_API_KEY || '';

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
  if (!user || user.is_guest) return null;
  const id = user.auth_user_id || user.id;
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
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
    return PurchasesNative;
  }
  const current = await PurchasesNative.getAppUserID();
  if (current?.appUserID !== appUserId) {
    await PurchasesNative.logIn({ appUserID: appUserId });
  }
  return PurchasesNative;
}

async function configureWeb(apiKey, appUserId) {
  const { Purchases, LogLevel } = await loadWebRC();
  if (!Purchases.isConfigured()) {
    Purchases.configure({ apiKey, appUserId });
    if (import.meta.env.DEV) Purchases.setLogLevel(LogLevel.Debug);
    return Purchases.getSharedInstance();
  }
  const instance = Purchases.getSharedInstance();
  if (instance.getAppUserId() !== appUserId) {
    await instance.identifyUser(appUserId);
  }
  return instance;
}

/**
 * Configure the SDK for the current platform. Always returns a Promise:
 * null when there is nothing to configure (server render, no API key,
 * or no signed-in user), otherwise the configured web instance or native plugin.
 *
 * Anonymous visitors get nothing on purpose. Loading the SDK for them
 * cost every landing-page visit two thirds of a megabyte and gave them
 * an anonymous RevenueCat identity they will never use.
 */
async function configureForUser(user) {
  if (typeof window === 'undefined') return null;
  const appUserId = resolveAppUserId(user);
  if (!appUserId) return null;
  const platform = detectPlatform();
  const apiKey = getApiKeyForPlatform(platform);
  if (!apiKey) {
    console.warn(`[revenuecat] no API key configured for platform ${platform}`);
    return null;
  }
  if (isNativePlatform()) {
    return configureNative(apiKey, appUserId);
  }
  return configureWeb(apiKey, appUserId);
}

// Serialize account changes so a slow prior login cannot replace the latest user.
let configurationQueue = Promise.resolve();
export function configureRevenueCat(user) {
  const next = configurationQueue.catch(() => {}).then(() => configureForUser(user));
  configurationQueue = next;
  return next;
}

export function getPurchasesWeb() {
  if (typeof window === 'undefined') return null;
  if (!_web || !_web.Purchases.isConfigured()) return null;
  return _web.Purchases.getSharedInstance();
}

/** SDK metadata for store management. Verified feature access uses the DB mirror. */
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
