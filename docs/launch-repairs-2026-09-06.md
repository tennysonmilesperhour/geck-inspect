# Launch repair ledger, September 6, 2026

Source: fresh clone of GitHub main at d1b517c22a64036c2c1bce417ddfab5ed091fe28. The older checkout at the user's home directory was not modified. This ledger supersedes launch assumptions in the older roadmap, not historical product decisions.

## Changes implemented

| Audit | Repair | Remaining evidence or limitation |
|---|---|---|
| A01 | Explicit publication fields, private creation default, API visibility policy for public animals, owners, collection members, and admins | Existing explicit publication choices preserved. Legacy public authorship fields still use emails. |
| A02 | Public profile projection with explicit safe fields; owner/admin access to private account rows; public clients moved to projection | Authenticated messaging still uses email identities. Anonymous callers who already supply an address may retrieve its public profile. This is not a complete migration away from email-based identities. |
| A03, A04 | Native store offering screen, restore, native subscription management, SDK initialization/identity fixes; native entitlements checked by Morph ID and health screening servers; atomic ordered webhook application | Configure and test real store products, the Pro entitlement, and store-specific keys. A simulator compile is not a purchase test. |
| A05 | Signed-in deletion creates a support ticket; request reference/status visible; false deletion success removed | Support completion remains manual. Establish a completion SLA, verify actual data erasure on a disposable account, and supply store deletion information before submission. |
| A06 | Added iOS project, native app/browser plugins, constrained callback handler, PKCE, Android URL registration, iOS URL and photo permission declarations | Allowlist native callback in Supabase, verify confirmation/recovery/OAuth on device, configure signing and distribution. |
| A07 | Native shell no longer advertises browser push support; explanatory settings copy | Native push delivery remains unimplemented; use in-app/email notifications until APNs/FCM is configured and verified. |
| A08 | Contextual reports for conversations, forum posts, questions/answers; support moderation inbox receives records; server blocks new messages in both directions; unblock controls in Settings | Full content moderation coverage, filtering of community content by blocked authors, reviewer staffing and response times still need completion. |
| A09, A10 | Animal/weight save transaction, stable request UUID, no phantom weight on ordinary edits, optional activity failures cannot fail the main save; explicit errors and native form validation | Dedicated weigh-in remains the place to log another measurement of the same numerical weight. |
| A11 | Passport CTA opens a seller conversation to request a legitimate transfer invitation | Actual two-account seller/buyer acceptance journey remains a release test. |
| A12 | Atomic vote toggles and question-owner answer acceptance; server guards counters; submit errors preserve drafts | Cross-account browser workflow and broader Q&A moderation need testing. Historical view counts are no longer presented as current measurements. |
| A13 | Paginated export, more record types, versioned manifest, honest scope, partial-export warning | JSON is a collection archive, not a full restorable account/media backup. Shared/transferred history authored by another user can be absent. |
| A14 | Formula-neutralized MorphMarket CSV text | Verify a real MorphMarket import on a disposable listing before claiming importer certification. |
| A15 | Removed unsupported automatic MorphMarket/Palm Street publishing and complete-backup claims from Home | Re-audit broader marketing and store screenshots against enabled features. |
| A16 | Guest page configuration uses live flags; unavailable routes explain the state instead of silently redirecting | Public landing feature references and each public-route availability still need a complete release inventory. |
| A17, A18 | Photo advice collapses; care actions precede the welcome shelf; modal focus/validation/mobile layout; feedback tab hidden during dialogs; native brand assets | Full accessibility, contrast, reduced-motion and device matrix remain release work. |
| A19 | Added regression tests plus rollback-only database scripts | Test counts are not proof that all features or store flows work. |
| A20 | Production configuration failures stop builds; native release checks require platform key and callback verification; Android release signing guard | No native release key, signing credentials, or callback verification was invented. |
| A21 | New duplicate owner/animal codes rejected with a useful error | Existing duplicate IDs intentionally preserved pending owner review. |
| A22 | URL success is labeled checkout return, not verified payment; signed live Stripe paid invoices produce deduplicated payment records | Reconcile historical revenue, lifetime receipts, refunds, fees and store proceeds. This is not a net-income report. |
| A23 | Successful persisted animal creation/edit milestones recorded; daily care actions moved earlier | Prove repeat use and conversion with real cohorts. No income guarantee or paid-user forecast is implied. |
| A24 | Current stack and stale competitor deadline assumptions corrected; this ledger separates completed code from unverified launch gates | Morph ID holdout evaluation and updated market/customer research remain open. |

## Verification

- Full web pipeline: ESLint, Vitest, Vite build, public prerendering and SEO audit.
- `supabase/tests/launch_repair_regressions.sql`: animal retries, unchanged weight, rollback, votes, acceptance, blocked messages, anonymous visibility and directory projection. All test records roll back.
- `supabase/tests/billing_repair_regressions.sql`: duplicate events, out-of-order expiration/renewal, rollback on invalid entitlement data.
- Browser fixture: 390 x 844 animal form, private switches, initial focus, required-name rejection, Escape, no horizontal overflow. Fixture files are outside the committed application.
- iOS: Xcode simulator build succeeds. Android debug compilation succeeds with JDK 21. The iOS app installs and launches in the simulator. Neither result certifies signed store distribution or purchases.
- Production deployment and final commit evidence recorded in the completion note.

## Native release setup

`com.geckinspect.app://auth/callback` and `com.geckinspect.app://auth/callback?mode=reset` must be allowed redirects for the production Supabase project. Set `NATIVE_AUTH_REDIRECT_VERIFIED=true` only after verifying these flows on a device. Use `VITE_REVENUECAT_IOS_API_KEY` or `VITE_REVENUECAT_ANDROID_API_KEY` for the target platform. An unauthenticated probe of the live RevenueCat webhook returned `server_misconfigured`: `REVENUECAT_WEBHOOK_AUTHORIZATION` is absent. Configure the same authorization secret in Supabase and the RevenueCat webhook, then validate a signed sandbox event before setting `NATIVE_BILLING_WEBHOOK_VERIFIED=true`. Never place that secret in a VITE variable or source control.

Native iOS uses email/password sign-in for this release. Google remains on web and Android; Apple social sign-in is not configured.

Store offerings must grant `Geck Inspect Pro`, which maps to Breeder access. Store pricing comes from the offering, never the web Stripe price table.

Use `pnpm ios:release` or `pnpm android:release`. Apple signing and App Store Connect metadata still need the owner's account. Android signing uses `GECK_ANDROID_KEYSTORE`, `GECK_ANDROID_STORE_PASSWORD`, `GECK_ANDROID_KEY_ALIAS`, `GECK_ANDROID_KEY_PASSWORD`; versions can be set with `GECK_VERSION_CODE` and `GECK_VERSION_NAME`.

Do not submit based solely on green builds. Complete confirmation/recovery, camera upload, private record isolation, purchase/restore/cancellation/refund, care logging, transfer, export and deletion on the actual release binary with ordinary accounts. Verify notification behavior described in the listing, privacy declarations, subscription terms and moderation operations. Revenue sufficiency requires a target take-home amount, real paid conversion, renewal retention and net proceeds, not membership labels.

Technical references: [Capacitor native app callbacks](https://capacitorjs.com/docs/apis/app), [Capacitor browser](https://capacitorjs.com/docs/apis/browser), [Supabase native auth](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), [native asset generation](https://github.com/ionic-team/capacitor-assets).
