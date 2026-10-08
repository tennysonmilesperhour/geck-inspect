# Release readiness, 8 October 2026

This is the current store-submission status. The September evidence record is kept at the bottom. Nothing has been submitted to the App Store or Google Play.

Store version for the first upload: **1.0** (iOS build **1**, Android versionName **1.0**, versionCode **1**). Bundle id and package name: `com.geckinspect.app`. Display name: Geck Inspect.

## What changed in code

| Area | Status |
|---|---|
| Apple privacy manifest | `ios/App/App/PrivacyInfo.xcprivacy` is in the app target. Tracking is off. Collected data matches the privacy policy (account, photos, gecko records, purchases, product analytics, support). Required-reason APIs: UserDefaults, file timestamps, disk space. |
| Export compliance | `ITSAppUsesNonExemptEncryption` is already false. Standard HTTPS only. |
| App icon and splash | iOS icon is 1024x1024, no alpha channel. Android launcher icons and branded splash screens are already in the projects. |
| Versioning | iOS `MARKETING_VERSION` 1.0 and `CURRENT_PROJECT_VERSION` 1. Android `versionName` 1.0 and `versionCode` 1 unless `GECK_VERSION_NAME` / `GECK_VERSION_CODE` are set. The next upload must raise the build number on both. |
| Android build | minSdk 24, targetSdk 36, cleartext off, release builds refuse to assemble without the four `GECK_ANDROID_*` signing variables. Exact-alarm permission from the reminder plugin is removed. Camera is optional hardware. |
| Payments | Inside the app, Keeper and Breeder are StoreKit / Play Billing through RevenueCat, with Restore purchases. The Stripe billing button is hidden in the app. The Promote trial dialog in the app only offers store plans. Website Stripe checkout is unchanged. Supplies checkout stays off (`STORE_CHECKOUT_ENABLED` is false). |
| Account deletion | Settings now deletes the signed-in account. `delete-my-account` is deployed (verify_jwt on). An anonymous call returns 401. It erases only the session user, cancels a live website subscription first, and does not cancel an App Store or Google Play subscription. `admin_erase_account` is already installed. If the function is missing, Settings still files the 30-day support request. |
| Privacy policy and terms | Updated 8 October 2026. Public deletion steps are on `/PrivacyPolicy`, which is the URL to paste into both stores. |
| Native value (Guideline 4.2) | The app bundles the product. It does not load geckinspect.com as a remote page. Morph ID, quick add, and the gecko form open the device camera or photo library. Feeding and weigh-in reminders can be scheduled on the phone. The status bar matches the app background. |

## The six gates

1. **App Store Connect paperwork.** Still the owner. The binary side (privacy manifest, encryption flag, version, restore purchases, privacy and terms URLs) is ready to attach. Sign in, accept the Paid Apps agreement, create the app and subscriptions, send Apple's server notification test to RevenueCat, and fill the privacy answers below.
2. **A real sandbox purchase and sign-in on a release build.** Still the owner, on a device or TestFlight. The code path is RevenueCat plus the existing `com.geckinspect.app://auth/callback` return. Leave `NATIVE_AUTH_REDIRECT_VERIFIED` unset until email confirmation and password recovery succeed on a device.
3. **Physical-device photo and collection checks.** Still the owner. Camera capture is wired. HEIC still goes through the existing upload converter. A two-account transfer and export still need a device pass.
4. **Deletion fulfillment.** The in-app action is no longer only a ticket. One proof is still the owner: create a disposable account, add a gecko and a photo, delete it from Settings, and confirm the login is gone, the photo is gone, and a sold animal's photo still loads for the buyer. Do not use a real member for this.
5. **Moderation operations.** Still the owner. Report, hide, and response-time need an acceptance pass. Code for forum reports and message blocking was already in place and was not treated as a finished moderation program.
6. **Store listing claims.** Screenshots and the listing text are still the owner. Do not claim remote push, a shipping checkout, a supplies checkout, mentorship, or giveaways. Safe claims: collection records, breeding and lineage, AI morph identification from a photo you take, feeding and weigh-in reminders on the phone, and memberships billed by the store.

## Privacy answers to paste

Use the same facts in App Store Connect (App Privacy) and Play Console (Data safety). The app does not track users across other companies' apps for ads. It does not sell data.

Collected, linked to the account, used for the app:

- Name and email
- Photos of geckos
- User ID
- Purchase history (store or website membership)
- Other user content (gecko records, messages, forum posts)
- Customer support messages

Collected, linked, used for analytics and the app:

- Product interaction (pages and features). Google Analytics and PostHog. No advertising cookies. No session replay.

Not collected: precise location, contacts, health, financial info beyond the purchase handled by Apple, Google, or Stripe, advertising ID.

Play Data safety extras: data is encrypted in transit. Users can request deletion. Deletion URL: `https://geckinspect.com/PrivacyPolicy`. The steps on that page are: sign in, open Settings, choose Delete my account.

## Guideline 4.2

Risk is real, and it is lower than a bare website wrapper.

Apple rejects apps that are only a website in a web view. Geck Inspect was already a full keeper product (collection, breeding, lineage, morph identification, store billing) packaged with Capacitor, not a remote frame of the marketing site. What it lacked was device capability a reviewer can point at. The binary now includes the camera, on-device reminders, and store billing. That is the smallest set that matches how keepers actually use the app.

It can still be rejected if the reviewer decides the interface is only the website. There is no native tab bar or fully native screens. If that happens, the next addition that would matter is a small native capture flow (a camera screen that does not look like the site) rather than more web pages.

## Owner checklist

Do these yourself. They cannot be done from the repo.

- [ ] Apple Developer Program ($99 a year) and a signed Paid Apps agreement, with tax and banking.
- [ ] App Store Connect app for `com.geckinspect.app`, subscriptions in one group, and Apple server notifications pointed at RevenueCat. Send the test notification.
- [ ] Privacy nutrition answers pasted from the section above. Privacy URL `https://geckinspect.com/PrivacyPolicy`. Terms URL `https://geckinspect.com/Terms`. Support email on the Contact page.
- [ ] iOS signing: open `ios/App` in Xcode, select your team, archive version 1.0 (1) with a current Xcode, upload to TestFlight. Do not submit for review until the device checks pass.
- [ ] Google Play Console ($25) and, if you want the lower fee, the Small Business Program.
- [ ] Create the Android upload keystore. Release builds read `GECK_ANDROID_KEYSTORE`, `GECK_ANDROID_STORE_PASSWORD`, `GECK_ANDROID_KEY_ALIAS`, and `GECK_ANDROID_KEY_PASSWORD`. Prefer Play App Signing so Google holds the app signing key.
- [ ] Upload an AAB to a closed test. Play requires 12 testers on a closed test for 14 days before production for new personal accounts. That clock starts when the testers are opted in.
- [ ] Play Data safety and the account-deletion URL, using the answers above.
- [ ] Screenshots: 6.7 inch iPhone, 13 inch iPad if you ship iPad, and a phone plus a 7 inch tablet for Play. Show the collection, a morph identification, and a reminder. Do not show a feature the build does not have.
- [ ] Sandbox purchase of Keeper and of Breeder, then restore on a second install. Confirm and reset a password from the app.
- [ ] On a phone: take a gecko photo (including a HEIC from the library), save a weight, and confirm another account cannot see the private collection.
- [ ] Disposable-account deletion proof described in gate 4.
- [ ] One moderation pass: file a report, hide it, confirm another account cannot see it.
- [ ] After the privacy policy change is on geckinspect.com, re-read `/PrivacyPolicy` before you paste the URL into the stores.

## September 2026 evidence (unchanged)

The RevenueCat webhook blocker was resolved on 6 September 2026. That record is not a claim that every device flow has passed.

Repaired then: RevenueCat test delivery, catalog mapping, purchase reconciliation, subscription lifecycle tests, cross-tool membership, account-change cache resets, identity trust, native auth return URLs, species-scoped image lookups, the market feed, forum reports and blocks, listing unpublish, notification dispatch, and the combo-price query. The iOS simulator compiled. Those checks do not replace a signed purchase or a physical device.

For code ownership and release procedure, read [ENGINEERING.md](ENGINEERING.md). For live identifiers and purchase diagnosis, read [BILLING.md](BILLING.md).
