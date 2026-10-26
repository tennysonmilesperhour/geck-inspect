# App Store requirement audit, 17 October 2026

**Not ready to resubmit.** This is an evidence checklist, not a claim that Apple will approve the app. The source changes below must be included in a new signed binary; the selected build 6 does not contain them.

## Live account facts

- App ID `6801304123`, bundle `com.geckinspect.app`, version 1.0, selected build 6.
- Rejected under 2.1 on 7 September. Apple requests a physical-device launch-to-feature recording and fuller review information.
- Paid Apps Agreement is Active, effective 17 October 2026 through 14 May 2027. Banking and W-9 Active.
- Keeper monthly/annual and Breeder monthly/annual subscriptions are attached and Ready for Review. No native lifetime product.
- RevenueCat's Apple purchase key reports Valid credentials. Both Apple production and sandbox server notification URLs now point to the receiver shown in this app's RevenueCat settings. Delivery has not yet been observed; do not confuse configuration with a successful event.
- Store privacy declares 16 linked data types, with no tracking category. Privacy URL and support URL are populated.
- Category Lifestyle / Reference. The displayed rating is 13+ in most regions, with regional exceptions; older OS versions show a different rating. The questionnaire itself still needs final comparison with the new binary.
- The account asserts third-party content rights and uses Apple's standard license. The assertion does not prove licenses for individual reference photos.
- Release remains manual. No new review reply, binary upload or resubmission was performed.

## Requirement-by-requirement evidence

| Area | Evidence and status | Still required |
|---|---|---|
| 2.1 completeness and review access | App builds; sign-in credentials are populated in App Store Connect; response draft exists. | Verify dedicated credentials; run final build on physical device, record Apple's requested flows, finish the notes and attach footage. |
| 2.3 truthful listing and screenshots | Listing describes collection, care, breeding, genetics, AI, community and deletion. | Compare every claim and screenshot against final binary, including iPad. Remove unsupported/retired claims. |
| 1.2 member content | Report UI, moderator hide/remove controls, blocked-author filtering and database messaging blocks are implemented. | Pre-publication filtering is not established by the inspected implementation. Choose and implement moderation before public posts/photos go live, assign a reviewer and response target, and test two-account reports/blocks. Existing hide-after-report controls alone are not proof of filtering. |
| 3.1 subscriptions | Store-provided prices and periods, feature descriptions, restore, management and Terms/Privacy links exist. iOS Membership uses native purchases. | Sandbox purchase each tier, restore after reinstall, confirm upgrades/cancellation/expiry and cross-platform entitlements. Observe Apple-to-RevenueCat delivery. |
| 4.2 useful native product | Bundled app includes camera/photo picker, local reminders, StoreKit, collection and breeding workflows. | Demonstrate actual device use and responsive layouts. Compilation does not establish usability or Apple's assessment. |
| 4.8 authentication | Sign in with Apple is built (native, off until `APPLE_SIGNIN_ENABLED`); Google and Facebook show on iOS only with it; email/password remains available. | Confirm registration, email callback, normal login and password recovery on the device. |
| 5.1 privacy and AI sharing | Added explicit per-request data/provider confirmation to all seven direct AI-call sites, covering six services. Cancel stops the AI call. Updated privacy copy and native manifest. | Test the prompt on the actual WebView and verify the installed binary's traffic and App Privacy purposes. The website and old build differ until deployed/rebuilt. |
| 5.1.1 account deletion | Settings has a confirmed self-delete flow, subscription warning and fallback support request. Backend scopes deletion to caller. | Delete only a disposable test account, prove login and private files are removed, and verify retained shared records are anonymized. |
| 5.2 content rights | Store declaration exists. | Verify licenses/permission for third-party reference images and service data; retain supporting documentation for Apple. No new rights claim was made during this audit. |
| Native packaging | Privacy manifest included, export flag false, camera/photo usage descriptions, stable bundle ID, iPhone/iPad target. Updated manifest passes plutil and is present in compiled app. | Signed archive with a build number greater than the highest uploaded (currently 6); signing/upload validation; final iPhone and iPad checks. |
| Production configuration | Public PostHog key recovered from the official production assets into ignored local env. Supabase and native RevenueCat variables present. | `NATIVE_AUTH_REDIRECT_VERIFIED` remains unset until real callbacks pass. No bypass was applied. |

The manifest now also declares optional phone/address/contact details, messages, coarse location, device identifiers and diagnostics, matching features and analytics seen in source. The app does not request GPS permission. Analytics and account-functionality purposes were expanded where the account identifier/email or purchase records support both.

## Changes made

- `src/lib/aiConsent.js`: provider/data disclosures; explicit permission per request; fail closed if no confirmation UI is available. No persistent approval or new dependency.
- Covered morph recognition, health screening, text generation/consultant, social generation, image import and visual embeddings. Morph cancellation gets a specific message and does not imply that a credit was consumed.
- Updated `PrivacyPolicy.jsx` and `PrivacyInfo.xcprivacy`; corrected stale release/billing guidance that incorrectly said the app had never been submitted and still recommended the old Pro catalog.
- Configured both Apple server notification receivers using the URL read from the existing RevenueCat app, without changing keys or adding a new recipient.

## Verification

- Full suite after incorporating the latest main and fixing privacy-date metadata: 267 files, 3,021 tests passed.
- Lint: zero errors, 75 pre-existing warnings. Typecheck passed.
- Full production build and Capacitor iOS sync passed. SEO audit: 172 routes, zero errors or warnings.
- Xcode Release build for generic iOS passed with `CODE_SIGNING_ALLOWED=NO`. This is an unsigned compilation, not a release archive or TestFlight upload.
- `plutil` validates the manifest; copied manifest verified in the built `.app`.
- Native release preflight still correctly fails the unverified native-auth gate.
- Paired iPhone 14 is unavailable to Xcode. No physical-device test, sandbox transaction, destructive account test or recording is claimed.

## Next completion steps

1. Connect and unlock the iPhone. Complete auth callbacks and device checks before setting the verification flag.
2. Choose the pre-publication moderation approach, implement it and test reporting/blocking and operational handling.
3. Verify reference-content rights and final privacy/rating answers.
4. Build/sign/upload a new binary with a unique build number. Test purchase/restore/expiry and notification delivery using that binary.
5. Record the physical-device walkthrough, validate iPad screenshots if shipping iPad, finish the source-backed review response, and update both correspondence and review notes.
6. Resubmit with all four subscriptions only after those checks pass. Release remains manual.

## Apple references

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), checked 17 October 2026: 1.2, 2.1, 2.3, 3.1, 4.2, 4.8, 5.1 and 5.2.
- [Account deletion](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion).
- [Privacy manifest data types](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacycollecteddatatypes/nsprivacycollecteddatatype).

## Native callback fix, 17 October 2026

Simulator testing found a blank-screen loop after email confirmation. Capacitor retains the last launch URL across webview reloads, while the app reloaded after both callback success and failure. Native callback completion now replaces the router location without reloading, preserving the in-memory duplicate guard.

- Added router-level regression tests for warm and cold callbacks, duplicate delivery, signup/recovery/invite token links, failures and web isolation.
- Full build: 268 test files, 3,030 passing tests; lint has zero errors and 75 existing warnings; typecheck passes.
- Rebuilt and installed on iPhone 17 simulator, iOS 26.5. A fresh QA recovery email opened the native reset form immediately, without a relaunch. No password was changed.
- Physical-device auth verification remains pending, so the native release verification flag remains unset. This fix still needs a new signed App Store binary.

## Physical iPhone checks, 18 October 2026

- Signed development build from snapshot `4b4f0361` installed on iPhone 11, iOS 18.5. Today, sign out and a fresh email recovery callback passed. The callback opens the native reset form without a reload loop; no password was changed. A subsequent cold launch returns to Today with the session intact.
- All four native subscription products load with prices and periods. Renewal wording, Restore purchases, Terms, Privacy and support contact are visible. No transaction or restore is claimed.
- Physical testing found that the camera plugin rejected photo selection because `NSPhotoLibraryAddUsageDescription` was absent. Added the required purpose string. The plugin checks all three photo/camera descriptions even though capture uses `saveToGallery: false`.
- Rebuilt, signed and installed the corrected package. Both the source and compiled Info.plist contain all three descriptions. The native source dialog now opens and selecting the library reaches the iOS permission prompt. Granting photo/camera access and actual capture remain pending.
- This phone's iOS 18.5 does not fulfill Apple's requested latest-OS recording. No App Store upload or resubmission is claimed.

## Release preparation and additional checks, 18 October 2026

- The owner confirmed in this chat that they have the rights to the app's reference photos. This is the owner's attestation; separate license documents have not been independently reviewed.
- The owner selected manual approval before new public posts/photos appear. That approval queue is not yet implemented or verified; do not describe it as live.
- Limited access to two gecko photos was approved. Both top and side photos load into Morph ID with previews. Location and captions were excluded in the system picker.
- The native AI disclosure names Anthropic and Replicate and identifies the shared data. Cancel returns the cancellation message and states no scan was used. No identification request was run in this test.
- A Release archive for version 1.0 (7) compiled and signed successfully. Its bundle identifier, build number, three camera/photo usage descriptions, privacy manifest and code signature were verified. The full build passed 287 files / 3,419 tests, with zero lint errors (75 existing warnings) and a clean 172-route SEO audit.
- The native callback verification flag was supplied to this build after the fresh recovery callback passed on the physical phone. Archive creation alone does not verify purchase delivery or constitute App Review submission.

## Rejection for missing Terms of Use link, 19 October 2026

Apple's automated check stopped the submission because the App Store product page had no working link to the Terms of Use (EULA), which every app selling auto-renewable subscriptions needs. This is a metadata fix in App Store Connect. No new binary is needed for it.

Fix (done by hand in App Store Connect, App Information and the version page):

1. Append these lines to the end of the App Description, in every localization the listing has:

   ```
   Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel in your Apple Account settings.
   Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
   Privacy Policy: https://geckinspect.com/PrivacyPolicy
   ```

2. Leave App Information > License Agreement on Apple's standard license. Our own Terms page does not yet cover renewals, trials or refunds (that text is still a draft in docs/legal/terms-additions-draft.md), so Apple's standard EULA is the safer one to name.
3. Confirm App Information > Privacy Policy URL is `https://geckinspect.com/PrivacyPolicy` and opens.

The binary already shows Terms and Privacy links, Restore purchases, store price and period, and renewal wording on the native Membership screen, which covers the in-app half of guideline 3.1.2.

### Pre-submit checklist for simple metadata rejections

Check each item in App Store Connect before pressing Submit:

- Description has the Terms of Use (EULA) link and Privacy link, in every localization.
- Privacy Policy URL and Support URL are filled in and load on a phone.
- All four subscriptions are attached to this version's submission, each with a display name, description, price and review screenshot, and the subscription group has a localized display name.
- App Review Information has a working demo account (email and password) that reaches the paid screens, a contact name, phone and email, and notes explaining where Membership, Restore purchases and account deletion are.
- Screenshots are from the current build, show no retired features, and include iPad sizes if the app ships on iPad.
- Description, keywords and screenshots do not mention Android, Google Play or other platforms, and do not quote prices that differ from the store.
- Age rating questionnaire, App Privacy answers and the encryption question match the build.
- The build selected is the newest upload (build 14 or later as of 26 October), not an older one.

## Member content filtering, 19 October 2026

Guideline 1.2 asks for a way to filter objectionable material before it is posted, a way to report it, a way to block users, and a way to contact the developer. Filtering is now automatic in the database (`20261019230000_public_content_auto_approval.sql`): held words, photos and links from new members, and anything from members with rejected or hidden content wait in Admin Panel > Reports > Publication approvals; everything else is published at once. Reporting, blocking and the support address were already in place. For the review notes: "New posts and photos are screened automatically against a list of objectionable terms; photos and links from new members, and all content from members with prior removals, are held for manual approval. Members can report any post, comment or photo and block other members. Reports are reviewed within 24 hours."

## Status, 26 October 2026

- Apple-to-RevenueCat delivery is now observed: a sandbox Breeder annual purchase on 18 October and 8 renewals since, with the `breeder` entitlement active. `NATIVE_BILLING_WEBHOOK_VERIFIED=true` can be set for the store build.
- Content filtering migrations are applied in production with 48 held terms; the approval queue is empty.
- The Xcode project build number is now 14. The last submission used build 13 (builds 8 to 13 were numbered by hand and not recorded in this file). Build 13 predates the native purchase-completion fix of 24 October and other changes merged since, so it should not be resubmitted.
- The Sign in with Apple entitlement is in the project, so the app ID needs that capability before build 14 will sign.
- Remaining steps and paste-ready review notes, reply and description footer: [app-store-resubmission-2026-10-26.md](planning/app-store-resubmission-2026-10-26.md).
- 26 October: Apple's automated check stopped the build 13 submission again for the missing Terms of Use (EULA) link, so the listing text from 19 October was not in place on every localization. The step-by-step fix is step 0 of the resubmission kit. The iPhone Membership screen now also links Apple's standard EULA (ships in build 14).
