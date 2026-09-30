# App-store billing readiness (RevenueCat)

Moved from the appendix of ROADMAP.md on 30 September 2026. It was written before the iOS and Android projects existed, and some of it has since been built (native purchases with restore are in the code), so check it against step 9 of docs/planning/feature-completeness-audit-2026-09-29.md before following it.

Read this before starting an iOS or Android build. Today the web app uses `@revenuecat/purchases-js` with the public sandbox key. The mobile path requires platform-specific SDKs, platform-specific product catalogs, and store-side configuration that has to be done in a specific order.

## Step 0. Pick the runtime shell

- **Capacitor wrap (recommended for a solo team):** Keep the existing React/Vite codebase, package it with Capacitor, use `@revenuecat/purchases-capacitor`. Fastest path to both stores. Single codebase.
- **React Native rewrite:** Use `react-native-purchases` + `react-native-purchases-ui`. More work, better long-term native feel.
- **Native Swift / Kotlin:** Use `purchases-ios` and `purchases-android` directly. Only if going fully native.

Whichever path is chosen, the RevenueCat dashboard work below is identical.

## Step 1. RevenueCat dashboard

- [ ] Add an **iOS app** to the existing project. Bundle ID must match the one registered in App Store Connect.
- [ ] Add an **Android app** to the existing project. Package name must match the one in Play Console.
- [ ] Generate the **iOS public key** (`appl_…`) and **Android public key** (`goog_…`). Web key (`pub_…` / `test_…`) stays as-is.
- [ ] Confirm the `Geck Inspect Pro` entitlement is shared across all three apps (Web, iOS, Android).
- [ ] Create platform-specific products mapping to the same entitlement:
  - iOS: 3 products in App Store Connect (e.g. `com.geckinspect.pro.monthly`, `…yearly`, `…lifetime`).
  - Android: 1 non-consumable in-app product for lifetime + 1 subscription with two base plans (monthly, yearly).
  - Web: existing `monthly` / `yearly` / `lifetime`.
- [ ] Attach all of those products to the same `Geck Inspect Pro` entitlement.
- [ ] Create a single offering whose packages are duplicated across the three stores so the same `presentPaywall` call works on any platform.

## Step 2. Apple side (App Store Connect)

- [ ] Accept the Paid Apps agreement, fill in tax + banking. Apps cannot ship IAP until this is signed.
- [ ] Create the App ID + bundle ID in Apple Developer.
- [ ] Create the 3 IAP products. Lifetime = non-consumable. Monthly + yearly = auto-renewing subscriptions in a single Subscription Group (so users can upgrade/downgrade between them).
- [ ] Configure **App Store Server Notifications V2** pointing at RevenueCat's webhook URL (the dashboard prints the URL). This is what keeps RC and Apple in sync.
- [ ] Add 4+ **sandbox testers** for QA.
- [ ] Add the required URLs: privacy policy, terms of service. Apple rejects subscription apps without both.
- [ ] In the app: add a **Restore Purchases** button (App Store guideline 3.1.1, mandatory). Calls `Purchases.restorePurchases()`.
- [ ] Decide on Family Sharing per product (lifetime probably yes; subscriptions optional).

## Step 3. Google side (Play Console)

- [ ] Pay the one-time $25 developer fee, complete merchant account setup.
- [ ] Create the app, set package name, upload a signed AAB to the internal track at least once before products will save.
- [ ] Create the IAP products: 1 one-time product for lifetime, 1 subscription with two base plans for monthly/yearly.
- [ ] Enable **Real-time Developer Notifications** wired to RevenueCat's Pub/Sub topic.
- [ ] Verify Play Billing Library 7+ is bundled (RevenueCat's SDK handles this; just don't pin an older version).
- [ ] Add license testers for QA.

## Step 4. App code changes

- [ ] Replace the API-key bootstrap so the right key loads per platform:
  - Capacitor: detect via `Capacitor.getPlatform()` (`'ios'` / `'android'` / `'web'`).
  - React Native: detect via `Platform.OS`.
- [ ] Switch `src/lib/revenuecat.js` to import from `@revenuecat/purchases-capacitor` (or RN equivalent) when running on a native shell. Keep the web import as the fallback.
- [ ] Replace `<CustomerCenterButton>`'s `managementURL` redirect with the native Customer Center on mobile (`RevenueCatUI.presentCustomerCenter()` on RN / Capacitor). The web behavior we have today stays the fallback.
- [ ] Add the **Restore Purchases** button on mobile settings (`await Purchases.restorePurchases()` then `refresh()` from the provider).
- [ ] On mobile, hide every "subscribe on web" link inside the app shell. Linking to an external paywall from inside an iOS app violates 3.1.3 unless using the new "External Link Account" entitlement, which has its own paperwork and a still-takes-Apple-a-cut commission.
- [ ] Make sure the appUserId is the Supabase `auth_user_id` on every platform so a Pro purchase made on iOS unlocks the entitlement on web and Android automatically.

## Step 5. Backend (Supabase)

- [ ] Add a Supabase Edge Function that receives **RevenueCat webhooks** (INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, BILLING_ISSUE, PRODUCT_CHANGE, NON_RENEWING_PURCHASE for lifetime).
- [ ] On every event, upsert into a `revenuecat_entitlements` table keyed by `auth_user_id` so the server can authoritatively check Pro status without a round-trip to RC.
- [ ] Migrate the `effectiveTier(user)` logic in `src/components/subscription/PlanLimitChecker.jsx` to read from the RC entitlement (or the cached server copy) instead of `membership_tier`. Keep the old field readable for grandfathered Stripe-direct users.
- [ ] Decide the grandfathering rule: existing Stripe-direct subscribers either get migrated into RC (RC supports importing historical Stripe subs) or kept on a parallel "legacy" entitlement check.

## Step 6. Pre-launch QA

- [ ] Sandbox purchase on iOS (TestFlight + sandbox tester) unlocks Pro on web within seconds.
- [ ] License test purchase on Android unlocks Pro on web within seconds.
- [ ] Cancel on iOS, confirm entitlement expires at period end, confirm web shows the correct state.
- [ ] Restore Purchases button on a fresh device install recovers Pro for the signed-in user.
- [ ] Family Sharing on iOS (if enabled) propagates the entitlement to the secondary account.

## Step 7. Production switchover

- [ ] Swap the Web SDK key from `test_…` to the production `pub_…` key (env var, not hardcoded).
- [ ] Submit iOS for review with the IAP products attached to the same submission.
- [ ] Roll out Android closed beta first, then production.
- [ ] Monitor RevenueCat dashboard charts for the first week: conversion, refunds, billing issue rate.

## The thing that will bite you

App Store and Play Store keep **15-30%** of every subscription purchased through their billing. Web Billing keeps about **5%**. Once mobile is live, the web upgrade path becomes a real margin question: keep promoting it (within store rules) for users who came through the web, and let in-app purchases be the natural path for users who installed from the App Store / Play Store. Do not try to route in-app users to the web paywall, that path is the fastest way to a rejection.
