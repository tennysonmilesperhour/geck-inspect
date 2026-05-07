# Geck Inspect — native iOS / Android shell plan

Status: planning. No code yet — this doc exists so the next session
can execute against a decided path rather than rehashing trade-offs.

## Goal

Ship a native iOS + Android app that closes the credibility gap with
Reptidex (which has a real iOS app today) and lets us push
notifications, deep-link from email/marketing surfaces, and surface
on the App Store / Play Store.

## Context

- The web app at geckinspect.com is a working responsive PWA — React
  18 + Vite + Supabase, Tailwind, ~104 prerendered SEO pages.
- Existing PWA hooks: `<link rel="manifest">` in `index.html`,
  apple-touch-icon, theme-color. There's already a standalone-launch
  redirect in `src/App.jsx` (~line 169–181), so the app behaves
  correctly when installed as a PWA.
- Auth is Supabase email + password; tokens persist in localStorage.
- ~10 surfaces use the camera via `<input type="file">`, all funneled
  through `src/lib/uploadFile.js`. The upload path enforces a
  per-user quota via the `get_user_storage_bytes` RPC (added in
  the 2026-05-07 migrations).
- Three URL shapes need universal-link / app-link handling:
  `/passport/:passportCode`, `/claim/:token`,
  `/collection-invite/:token`. Plus deep links to
  `/Breeder/:slug` and `/MorphGuide/:slug` for content shares.

## Path comparison

| Path | Effort | Code reuse | App Store presence | Push notifications | Risk |
|---|---|---|---|---|---|
| **Capacitor wrap** (recommended) | ~1 week | 100% — same React tree runs in WebView | Yes | Yes (FCM + APNs via plugin) | Low. Apple has occasionally cracked down on "wrappers", but Capacitor apps with real native plugins (camera, push, share) are routinely approved. |
| Expo / React Native rewrite | ~2–3 months | ~30% — share business logic, rebuild every screen with native components | Yes | Yes (native) | High. Throws away the prerendering work and the SEO-shared component tree. |
| PWA-plus (no native shell) | ~1 week | 100% | **No** | Web push only (no iOS Safari support) | Low. But concedes the App Store credibility goal indefinitely. |

**Recommendation: Capacitor wrap.** Closes the credibility gap fast,
reuses the entire app, leaves the door open for an Expo rewrite
later if specific surfaces need real native components.

## Phased rollout (Capacitor)

### Phase 0 — prerequisites (you / the user)
- Apple Developer account ($99/yr) + Play Console ($25 one-time)
- Bundle identifiers picked (e.g. `com.geckinspect.app`)
- Decide: do we want anonymous browse (guest mode) on native? App
  Store guideline 5.1.1(v) is fine with optional sign-in for
  app-using-public-data; we read public morph guides without auth so
  we should be safe.

### Phase 1 — bootstrap (~1 day)
- `pnpm add @capacitor/core @capacitor/ios @capacitor/android`
- `npx cap init "Geck Inspect" com.geckinspect.app --web-dir=dist`
- `npx cap add ios && npx cap add android`
- Wire `pnpm build && npx cap sync` into a `build:native` script.
- First successful boot in iOS Simulator + Android Emulator.

### Phase 2 — universal / app links (~1 day)
- iOS: ship `apple-app-site-association` at `geckinspect.com/.well-known/apple-app-site-association`.
  Currently `vercel.json` rewrites everything; need an exception for `.well-known/*`.
- Android: ship `assetlinks.json` at the same prefix.
- Test that `/passport/<code>`, `/claim/<token>`, `/collection-invite/<token>`,
  `/Breeder/<slug>`, `/MorphGuide/<slug>` all open the app instead of the
  browser.
- The signup-grant capture in `src/App.jsx` and referral capture
  already run before any router renders, so the deep-link shape
  works as-is; just need to make sure the links don't bounce out to
  Safari on iOS.

### Phase 3 — camera (~½ day)
- `<input type="file" accept="image/*" capture="environment">` works
  inside Capacitor's WebView on both platforms. Verify and decide
  whether to bother with `@capacitor/camera`.
- If we adopt the plugin: change `uploadFile.js` callers to detect
  `Capacitor.isNativePlatform()` and switch to the plugin for the
  picker, while keeping the Blob upload path intact.

### Phase 4 — push notifications (~2–3 days)
- `pnpm add @capacitor/push-notifications`
- iOS: APNs cert in Apple Developer portal, capability enabled in
  Xcode, `aps-environment` entitlement.
- Android: FCM project, `google-services.json` in
  `android/app/`.
- Server side: a Supabase edge function `send-push` that takes a
  user ID + payload and dispatches via FCM (Android) and APNs
  HTTP/2 (iOS). Token registration: store device tokens in a new
  `push_tokens` table keyed by user email + platform + token.
- Initial event sources: collaboration invite accepted, collection
  invite received, breeding pair clutch laid, weight check overdue.
  Out of scope for v1: forum activity, marketplace activity (those
  belong on web push if anything).

### Phase 5 — auth session (~½ day)
- Supabase JS persists sessions in localStorage by default; that
  works inside the WebView. Confirm refresh-token rotation works
  across app suspend/resume.
- Consider `@capacitor/preferences` for slightly more durable token
  storage on iOS (Safari's ITP doesn't apply inside Capacitor, but
  WKWebView storage can still be reset by iCloud restore).

### Phase 6 — store metadata (~2 days)
- Screenshots (6.7" iPhone, 12.9" iPad, 6" Android phone, 10" tablet)
- App Store privacy nutrition labels — disclose Supabase data
  collection: email, profile data, photos, gecko data,
  device identifier (push tokens).
- Play Store data-safety form — same disclosure plus location-not-
  collected affirmation.
- Promotional copy reusing the landing-page hero rewrite from
  earlier this session.

### Phase 7 — CI build (~1 day)
- GitHub Actions workflow that runs `pnpm build && npx cap sync` on
  push to main, then triggers a Fastlane lane to build + upload to
  TestFlight / Play Console internal track.
- Manual promotion to public release (not auto).

## Open questions to confirm before any code

1. **Bundle ID + display name** — `com.geckinspect.app` and
   "Geck Inspect" sound right but lock these in early. Renaming
   later is painful.
2. **Push notification scope** — confirm the v1 trigger list above.
3. **Web-only-forever surfaces** — admin panel and store/checkout
   probably stay web-only. Worth deciding vs. building shells.
4. **Existing PWA install nudge in `src/pages/Home.jsx`** flips to
   "Download on the App Store" / "Get it on Google Play" once
   shipped. That's a one-line edit when the time comes.
5. **Tier-limit messaging** — `src/pages/Subscription.jsx` should
   call out that all features are available on every platform.
   Today it doesn't differentiate.

## Time estimate

- Phases 0–1: 1 day (mostly waiting for store account approvals)
- Phase 2: 1 day
- Phase 3: ½ day
- Phase 4: 2–3 days
- Phase 5: ½ day
- Phase 6: 2 days
- Phase 7: 1 day

**~7–9 days of Claude-time** plus 1–2 weeks of store review for the
first build of each app. Realistic ship-to-store-shelf: 3 weeks.

## What's NOT in scope here

- Apple Watch / iPad split-view affordances
- iMessage app for sharing morph genotypes
- iOS-specific haptics or live activities
- Background sync for offline gecko entry
- Native widgets
- Tablet-optimized layouts beyond what the responsive web already does

Each of those is a follow-up after the wrapper is on shelves.
