# Homepage business assistant A/B test

Status: RUNNING since 16 October 2026 at 06:21:23 UTC (00:21 MDT). Production allocation is enabled, with 50% control and 50% business. The PostHog link below is the authority for subsequent running/paused status.

- Experiment: https://us.posthog.com/project/376510/experiments/487198
- Flag: https://us.posthog.com/project/376510/feature_flags/965230
- Flag key: `homepage-business-assistant-v1`
- Project: 376510, named **Kiwi Pop**, in the **Geck Inspect** organization. This project receives several websites. Exact host filters are intentional.

## What changes

`control` is the existing public homepage, preserved in `src/pages/HomeControl.jsx`. `business` is the approved forest/glass business assistant concept, now a React page with the real product screenshots, animal photos, accessible manual product tour, sample pricing, single-gene pairing, expense ledger and buyer packet. Same app, signup route, pricing and backend. Sample interactions never create member records.

`src/pages/Home.jsx` selects the page. CSS and native event handlers are scoped to the business page. Handlers and timers are removed on unmount. All sample dialog content is React markup; there is no HTML injection or embedded standalone document. Existing media is reused from `public/`.

## Allocation and exclusions

- 50% `control`, 50% `business`, across eligible logged-out homepage visitors.
- Device-ID bucketing in PostHog. A browser retains its allocation through login. Clearing storage or visiting on another device can change it. Do not change the split or bucketing during a run.
- Only production `geckinspect.com` and `www.geckinspect.com`, routes `/` and `/Home`.
- Signed-in users, guest mode, known bots, browser automation, DNT and analytics opt-outs do not enroll. No bot detector is perfect; review PostHog's bot classifications before interpretation.
- Both arms share an allocation gate and preload the business module. A fresh flag response and assets must arrive within 1.5 seconds. Otherwise control renders without experimental exposure, and a late response cannot swap the page. This avoids excluding slow business-arm downloads asymmetrically. The gate is absent while the build switch is off.
- An exposure is emitted after the chosen page commits, using `$experiment_exposure`, `$feature_flag`, `$feature_flag_response`, `$feature/<key>` and `homepage_rendered: true`. The experiment filters that event to the exact host, path, flag and rendered marker. Merely fetching a flag does not count.
- Custom events carry the first rendered variant for 30 days. The existing signup/first-gecko events and PostHog anonymous-to-identified merge connect outcomes. The anonymous ID is no longer reset on every signed-out `INITIAL_SESSION`; real account sign-out still resets identity.

## Metrics already configured

| Role | Metric | Window from exposure |
| --- | --- | --- |
| Primary | Unique exposed people completing `signup_completed` | 7 days |
| Secondary | `signup_completed` followed by `first_gecko_added` | 14 days |
| Diagnostic | `landing_cta_clicked` where `target = signup` | 1 day |

All metric steps filter the exact production hostname. PostHog's existing Bayesian project setting is retained, test-account filtering is on, and people observed in multiple variants are excluded. The activation funnel's denominator is exposed visitors, so it measures acquisition of activated users, not just the percentage of signups who activate.

The business page additionally records `homepage_demo_interacted` with a bounded action/selection label. These interactions explain interest; they are not the winning metric. Watch JavaScript errors, signup failures, and mobile LCP/INP alongside the conversion result. Do not sacrifice a usable signup flow for a higher click rate.

## Traffic and interpretation

Read-only PostHog query on 16 October UTC, covering 15 September through 15 October in America/Denver: **97 anonymous homepage people, 1 matched signup within seven days (1.03%)**. This is directional, not a dependable planning baseline: the anonymous-ID reset inflated fragmentation, recent users have incomplete conversion windows, and older signup instrumentation may be incomplete. No justified sample-size target or promised finish date can be derived from one conversion.

After launch, first validate that exposures split plausibly, identities merge, signup conversions arrive, and no one sees both variants in a normal same-browser journey. Use at least complete weekly cycles and allow the entire conversion window to mature; elapsed weeks alone do not make a result conclusive. If volume remains this low, expect an inconclusive quantitative result and supplement it with observed user sessions and breeder feedback. Do not stop at the first apparent lead or repeatedly edit either design mid-run.

Known measurement limits: the existing `signup_completed` implementation only records the first authenticated session within 24 hours of account creation. A later confirmation can be missed. Cross-device confirmation and ad blockers can also break attribution. These apply to both variants; they are not fixed by this homepage change.

## Preview without counting yourself

- Alternative: `https://geckinspect.com/?homepage_preview=business`
- Control: `https://geckinspect.com/?homepage_preview=control`

These overrides work while the experiment is off. The browser tab remains a preview for analytics after following its signup link; PostHog and custom mirrored product events are suppressed for that tab session. Close the preview tab and use a fresh tab/browser session for a real measurement check. Do not post these preview URLs as acquisition links. Preview query parameters do not grant account access or change backend authorization.

## Launch

1. Verify the deployed commit and both preview URLs, including mobile signup navigation.
2. Set `VITE_HOMEPAGE_EXPERIMENT_ENABLED=1` for the production Vercel build, then redeploy. The remote flag remains inactive, so visitors still receive control.
   The build-ignore rule allows rebuilding the currently deployed commit so environment changes take effect. Documentation-only pushes still skip the build.
3. Launch experiment 487198 in PostHog. This activates its already-configured 50/50 flag. Do not separately randomize in React or create another flag.
4. Check real rendered exposure events for both variants and a completed signup/first-gecko journey. Preview mode intentionally cannot validate ingestion. Use a disposable test identity marked internal, then verify internal traffic is excluded from the result.
5. Confirm the current traffic rate and agree a minimum meaningful effect/sample target before interpreting a winner. Do not promise a fixed statistical deadline from the historical 1.03% figure.

## Rollback / cleanup

Deactivate flag 965230 in PostHog. The next homepage navigation or reload gets a fresh disabled response and returns control; an already open page is intentionally not replaced mid-read. Set the build variable back to `0` and redeploy to remove the allocation wait entirely. Neither step affects member data, authentication, or paid plans.

Once the decision is made, remove the losing page, wrapper, special analytics context and build variable in a separate change. Keep the experiment and results for the record. Do not leave an unowned permanent experiment branch in the homepage.

## Changes made while the test runs

**18 October 2026, business-page symbols:** Tennyson explicitly requested replacing all homepage emojis with original symbols. The business page's text-glyph icons (including arrows, checks, feature marks and dialog controls) now use a custom inline SVG set. The mobile checklist marks use the same set. Copy, product screenshots, interactions, control page, allocation and metrics stay the same. Treat this deployment as a visual revision of the business arm when reporting results; the experiment was not restarted.

Round 3 of the review fixes (`docs/planning/comprehensive-review-2026-10-14.md`, E3) shipped while this test was running. It was integrated on top of the test so that neither design changes mid-run. What reached the homepage, and what did not:

- **One factual correction, control only.** The control FAQ answer "Does Geck Inspect support other reptiles?" promised basic records for other reptiles, and Other Reptiles was retired the same day (`docs/planning/retired-features-2026-10.md`). It now says records are for crested geckos only. The business page never mentioned other reptiles.
- **Theme changes held back from the homepage.** Round 3 makes Emerald the default theme, turns body text to neutral greys and underlines links inside sentences. A signed-out visit that opens on `/` or `/Home` is marked `data-landing-hold` by the theme script in `index.html` and keeps the launch look (the Blizzard defaults, the old text colours, no added underlines) until the page reloads. A visitor who opens another public page first (a Morph Guide page, say) and then taps the logo reaches the homepage without a page load, so the homepage itself applies the same hold as it draws (`src/lib/useLandingThemeHold.js`, called in `src/pages/Home.jsx`) and lifts it when they leave, sign in or start the demo. Nothing is saved, so members and visits that stay on other pages get the new look.
- **Site-wide changes that reach both arms equally:**
  - Fonts are self-hosted instead of loaded from Google Fonts (same families). The self-hosted files are variable fonts, so weights between the standard steps (the business page uses 550, 650 and 750) now render exactly instead of rounding to the nearest step. The difference is slight. Montserrat is preloaded on `/` for signed-out visits.
  - The Supabase client loads on first use, so the homepage's live numbers and email capture card fetch it when they need it.
  - **Analytics consent:** visitors in the EEA and UK (by Vercel's country, or a European browser time zone) get Google Analytics and PostHog only after accepting on the consent banner, and browsers sending Global Privacy Control get neither. Without PostHog the arm cannot be read, so these visitors see control with no exposure and are not enrolled. The audience narrows from the release onward; compare exposure counts before and after with that in mind.
  - Google Analytics now starts from the app instead of an inline script, the Robauto pixel is gone, and inline scripts are allowed by hash in the Content Security Policy.
  - PostHog identifies members by account id instead of email. A browser that still carries an email as its PostHog id starts afresh when PostHog loads, so a returning member who was identified by email before gets a new PostHog person; signed-out homepage visitors are unaffected.

**28 October 2026, first gecko by photo and the Morph ID permission step:** after signup only, nothing on the homepage. A member who picks "Add by photo" in the guided first gecko now gets "Add this gecko" straight under their Morph ID result, a short add form (a name and "Save and continue"), and no "used this month's free Morph ID" card on top of the result. Morph ID asks for permission on the page instead of in a browser pop-up, and the day 0 and day 1 getting-started emails for members with no gecko open the first gecko step (`/MyGeckos?add=1`). These changes reach both arms equally, but they are meant to raise first geckos, so they may move the secondary metric (`signup_completed` followed by `first_gecko_added`) for both arms from this date. Compare the arms with each other, not with the weeks before.

## Queued until the test ends

Apply these in one change after the decision, to whichever page wins:

1. Remove the landing hold: the `hold` lines in the theme script in `index.html`; `defaultFor`, `LANDING_HOLD_DEFAULT` and the `defaultFor(...)` calls in `src/lib/ThemeContext.jsx` (put back the plain defaults); `src/lib/useLandingThemeHold.js`, its line in `src/pages/Home.jsx` and its test `src/lib/__tests__/landingThemeHold.test.jsx`; and the two `:not([data-landing-hold])` selectors in `src/index.css`. Then run `node scripts/build-vercel-json.mjs` (the inline script hash changes).
2. Hero buttons (review item UX2): one solid primary button, "Start free, no card needed", and a quieter text link, "Or see a sample gecko record", instead of two glass buttons that look like the same choice. The demo link opens one gecko's record (`startDemoAtRecord()` in `src/lib/guestTour.js`, already in the code and tested in `src/lib/__tests__/landingHero.test.js`) instead of the Dashboard. Add its tests back to `src/lib/__tests__/landingHero.test.js`: the demo handler calls `startDemoAtRecord()` and not the Dashboard; both demo entries (hero and bottom) are underlined text buttons without `home-glass-button`; both signup buttons are solid, without `home-glass-button`, and read "Start free, no card needed".
3. A visible link on the homepage to the genetics guide, "Crested gecko genetics guide" to `/GeneticsGuide` (SEO).
4. The hero image preload for `/` (`HERO_PRELOADS` in `scripts/prerender.mjs`): limit it to large screens (`media="(min-width: 1024px)"`) or drop it, if the winning page's phone layout does not show that image first. The performance pass measured the phone LCP at 2.60 s with it and 2.25 s without.

## Verification

- Launch: production deployment `dpl_EfeerdkHAgr6ouri2FHCXUcF2H9m`, commit `1e1fe78ab3306d81c9843b3055c1718b60d75c34`, is ready on both production domains with `VITE_HOMEPAGE_EXPERIMENT_ENABLED=1`. GitHub CI run `38860596404` passed. PostHog confirms experiment `running` and flag `active` with the original 50/50 split.
- The live browser-facing flags endpoint returns both `control` and `business` for synthetic device IDs, with no evaluation errors. These dry runs do not send exposure/conversion events. The admin test-evaluation tool returned `flag_not_found` for this client-runtime flag, so the actual client endpoint was checked instead.
- The production homepage rendered control consistently across reloads, with no browser errors. Both forced-preview designs were verified before launch. Real exposure ingestion and a full conversion journey remain to be confirmed from eligible traffic; a running configuration is not evidence of collected results.
- Automated tests cover audience exclusions, fresh/disabled/error flag results, timeout and late responses, unmount, preview suppression, identity reset, and conversion attribution.
- Full test suite, lint, typecheck, genetics consistency, production build, prerender and SEO audit.
- Browser checks cover current-page isolation after visiting the alternative, same-tab signup routing, screenshot dialogs, keyboard-capable tabs, sample ledger/pairing behavior and responsive layouts.

PostHog references: https://posthog.com/docs/experiments/exposures and https://posthog.com/docs/libraries/js/usage#feature-flags.
