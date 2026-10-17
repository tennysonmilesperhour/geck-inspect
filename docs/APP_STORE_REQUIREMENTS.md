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
| 4.8 authentication | Google sign-in is hidden on iOS; email/password remains available. | Confirm registration, email callback, normal login and password recovery on the device. |
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
