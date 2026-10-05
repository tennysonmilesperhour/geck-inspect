# Landing screenshots, speed and content-page conversion, October 2026

Written 5 October 2026. Builds on [first-impression-2026-10.md](first-impression-2026-10.md), [qa-2026-10-05.md](qa-2026-10-05.md) (items 7, 8 and 10) and [growth-funnel-2026-10.md](growth-funnel-2026-10.md) (leak 3 and change 5). Screenshots are in [landing-speed-2026-10/](landing-speed-2026-10/).

Three jobs: give the landing page real pictures of the app, make the public pages load faster on a phone, and give the Morph Guide, Care Guide and calculator readers a reason to sign up.

## 1. Results in one table

| | Before | After |
|---|---|---|
| Main script (every visitor downloads it first) | 1,232 KB (367 KB compressed) | 657 KB (201 KB compressed), 47% smaller |
| JavaScript a phone needs before the landing page can draw | 1,203 KB (358 KB compressed) | 715 KB (220 KB compressed) |
| Same, Lilly White morph page | 1,550 KB (462 KB) | 802 KB (256 KB) |
| Same, Care Guide | 1,814 KB (553 KB) | 830 KB (268 KB) |
| Same, a Care Guide topic | 1,573 KB (473 KB) | 702 KB (221 KB) |
| Same, calculator | 1,454 KB (437 KB) | 1,010 KB (318 KB) |
| Landing page product screenshots | none (the slideshow never appeared) | 5 slides, laptop and phone versions, plus a product shot beside the headline on laptops |
| Sign-up prompt on Morph Guide, Care Guide, Genetics Guide, calculator, article pages | a generic box at the very bottom of some pages, which opened the Sign In form | one prompt per page, worded for that page, opening Create Account, with tracking |
| "Community Gallery" and mistyped addresses, signed out | a bare sign-in form | a "for members" page that says what the Gallery is, or a real "page not found" |

### Load time on a throttled phone

Production build with the prerendered pages, served like Vercel serves them (each route's own HTML, compressed). Chromium at 390 x 844 with the processor slowed 4 times and the network at 1.6 Mbit/s with 150 ms latency, the same profile as the 5 October QA pass. Median of 3 loads each. The number is the moment the page first draws, which on these pages is also the largest paint (LCP), because nothing visible draws until the script runs.

| Page | Before | After | Saved |
|---|---|---|---|
| Landing `/` | 3.05 s | 2.78 s | 0.27 s |
| Morph Guide | 3.02 s | 2.48 s | 0.54 s |
| Lilly White morph page | 2.88 s | 2.31 s | 0.57 s |
| Care Guide | 2.76 s | 2.66 s | 0.10 s |
| Care Guide topic (weight tracking) | 2.94 s | 2.21 s | 0.73 s |
| Calculator | 2.90 s | 2.72 s | 0.18 s |
| `/pedigree-tracker` | 2.88 s | 1.94 s | 0.94 s |
| Sign in (`/AuthPortal`, not prerendered) | 2.56 s | 2.01 s | 0.55 s |

Google's "good" line is 2.5 s. Five of the eight pages are now under it on this slow profile; before, none were. The landing page, Care Guide and calculator are still above it (section 5 says what is left).

Caveats: the sandbox cannot reach Supabase, Google Fonts or image hosts, so database calls were answered instantly in the browser and the font stylesheet failed fast. On production both add time to every row, before and after alike. Treat the savings as the part this change controls, and re-measure on a real phone against geckinspect.com.

## 2. Speed: what changed and why

The main script is the file every visitor waits for before anything appears. It carried the whole signed-in app shell even for someone reading about Lilly Whites.

1. **The signed-in shell is lazy** (`src/pages.config.js`). The sidebar and header (`Layout.jsx`), Dashboard and My Profile were bundled into the main script "so signed-in members do not see a flash". Together with the items below, that was about 575 KB of code every public visitor downloaded and never ran. They are now separate files. To keep the signed-in first screen quick, `App.jsx` starts downloading Layout and Dashboard the moment it sees a saved session or demo flag in the browser, in parallel with the sign-in check (`warmFirstScreen`).
2. **The landing page is lazy too**, so Morph Guide and Care Guide visitors (most of the traffic) do not download it. To stop that from adding a round trip on `/`, `scripts/prerender.mjs` now writes `<link rel="modulepreload">` tags into each prerendered page for exactly the code that page needs (read from Vite's build manifest, `build.manifest` in `vite.config.js`). The browser fetches the page's code at the same time as the main script instead of after it. This helps every prerendered page, not just the landing page.
3. **The 327 KB of old article text no longer loads on guide pages** (`src/lib/editorial.js`). The byline helper ("Published ... Reviewed by ...") imported every blog post just to look up dates, so every Morph Guide page, Care Guide page and the Genetics Guide downloaded all the articles. The blog pages now register their own dates (`src/lib/editorialBlogDates.js`). No blog content or pipeline changed.
4. **Demo data loads only in the demo** (`src/api/supabaseEntities.js`). The sample collection (and the growth curves it uses) was in the main script for everyone; it now loads on the first guest read.
5. **The Markdown reader on the Care Guide loads only when a community section arrives** (`src/pages/CareGuide.jsx`), about 115 KB the page no longer needs up front.
6. **A date helper on the offline-sync path** used the full date-formatting library for one `yyyy-MM-dd` string (`src/lib/dateUtils.js`); it now builds the string directly.
7. **Sign-in form, password reset and the public page frame** are lazy (`App.jsx`).

On `vite.config.js` manualChunks: left off on purpose. The existing comment explains why (an earlier vendor split made every page preload chart and PDF code), and the route-level splitting above gets the benefit without that trap. One side effect to know about: shared icons become many tiny files (about 20 on the landing page, each under 1 KB). The modulepreload tags fetch them in parallel, so this is cheap over HTTP/2.

## 3. Product screenshots

**What was captured.** Five slides from the guest demo collection, each as a 1600 x 1000 laptop image and a 780 x 976 phone image, all WebP and all under 50 KB (the whole set is 365 KB):

| Slide | What it shows |
|---|---|
| One record per gecko | Nimbus (Lilly White, Harlequin): an estimated value of $350 with the typical range, and weigh-ins against the healthy range for his age |
| Genetics calculator | Spud x Harley: every outcome with its odds and a guide price |
| Multi-generation lineage | Nimbus's tree back to grandparents, with known ancestors and COI |
| Breeding plans | Pairings with days since the last egg and clutch counts |
| Collection value | The demo collection's estimated total and top value-driving morphs |

**How, and what is real.** Playwright against the dev server on port 5184 with the public Supabase URL and key in an uncommitted `.env.local`. The sandbox cannot reach Supabase or any image host, so the browser's requests were answered locally: the demo's own sample geckos (already in the app) for collection data, and the **real** Geck Data trait value table (`trait_value_table()`, read once with a SELECT, market data only, no member data) for every price. So "$350, median across 104 Lilly White listings" is a real number from production. The landing counts used the real totals (56 keepers, 349 geckos, 27 pairings). The demo tour card, toasts and feedback tab were closed for the captures.

**What is not real, and is said so.** The demo geckos are sample animals; the slideshow footer now says "The demo collection: sample geckos, value estimates from real listings", and the hero caption says the same. The demo's photos are hosted on Wikimedia, which the sandbox cannot reach, so photo slots show the app's own no-photo placeholder rather than any invented picture.

**How the tour uses them.** `src/data/product-tour.js` marks the five as `shipped: true` with a new `mobileFile`. `ProductTour.jsx` now shows the phone capture in a 4:5 frame below 640 px wide (a laptop screenshot shrunk to a phone is unreadable) and the laptop capture in the 16:10 frame above it. "Hover to pause" is hidden on phones. The five photo-dependent slides (dashboard, morph guide, AI morph ID, storefront, photo timeline) stay unshipped and are listed in `public/screenshots/README.md` as "capture on production".

**Hero product shot.** On laptops (1024 px and wider) the hero is now split: headline and buttons on the left, the gecko record's value and weight panels on the right ([01](landing-speed-2026-10/01-landing-hero-desktop.jpg)). Phones keep the centred single column ([02](landing-speed-2026-10/02-landing-hero-phone.jpg)) and never download the picture (a `<picture>` source swaps in an empty pixel below 1024 px). The headline drops to 3 rem at that width so it stays on two lines.

## 4. Content-page conversion

**The problem** (growth funnel, section 8): Morph Guide 539 landing sessions since 1 September, Care Guide 260, calculator 151, older article pages 561, losing 78 to 94% after one page and converting about 0.2%. `/pedigree-tracker`, which says plainly what the app does for your own geckos, converts about 27%. Several guide pages did end with a "Create a free account" box, but it sat at the very bottom, said the same generic thing everywhere, and **opened the Sign In form**, not Create Account. The Care Guide topic version also promised enclosure temperature and humidity logging, which the free plan does not include.

**What was built.** One shared component, `src/components/public/ContentSignupPrompt.jsx`: an in-page card (never a pop-up, never sticky), hidden for signed-in members, with one green "Create a free account" button to `/AuthPortal?mode=signup`, a quiet second link to `/pedigree-tracker` (the page that converts), and two true facts under it (Free for up to 10 geckos, No card needed). Every line was checked against the code.

| Page | Where | Headline |
|---|---|---|
| Morph page (for example Lilly White) | after the inheritance and price tier cards | "Track your own Lilly White's lineage and value, free" ([04](landing-speed-2026-10/04-morph-page-prompt-phone.jpg)) |
| Morph page | end of page, replacing the old box | "Keep your Lilly White geckos in one place" |
| Morph Guide index | full width in the grid after the first six morphs | "Know which morphs are in your collection? Keep them all in one place, free" ([05](landing-speed-2026-10/05-morph-guide-prompt-desktop.jpg)) |
| Care Guide and each care topic | after the content, worded by category | feeding: "Log feedings and weights for each of your geckos, free"; health: "Spot weight loss early with a weight history for every gecko"; life stages: "See whether your hatchling is on track for its age, free"; breeding: "Plan your pairing and follow every egg to hatch day, free" ([07](landing-speed-2026-10/07-care-topic-prompt-phone.jpg)) |
| Calculator (and every per-morph calculator page) | under the results, once a pairing is entered | "Run this pairing on your own geckos, free" ([06](landing-speed-2026-10/06-calculator-prompt-desktop.jpg)) |
| Genetics Guide | after the guide sections | "Know what your geckos carry? Record it once, free" |
| Morph category and inheritance hubs | end of page, replacing the old box | "Track the morphs in your own collection, free" |
| Existing article pages | end of page, replacing the old box | "Keep your own crested geckos in one place, free" (template only; no article was written or changed, and the blog stays shelved) |

The calculator copy says "run this pairing on your own geckos" rather than "save this pairing", because the app cannot save a hand-entered pairing as such; what is true is that a member's own sire and dam can be picked from their collection and the calculator infers hidden hets from three generations of parents.

**Attribution.** Each prompt sends `content_cta_viewed` once when half of it is on screen and `content_cta_clicked` on a click (with `cta`, `page_type`, `page`, `variant`, `target`). A click also stores the prompt in the browser for 7 days (`rememberSignupCta` in `src/lib/attribution.js`), and `recordSignupIfNew` in `src/lib/activation.js` adds `signup_cta`, `signup_cta_page` and `signup_cta_page_type` to `signup_completed` and copies it to `profiles.extra_data.signup_cta`. First touch says how someone arrived; this says which page convinced them. Verified in the browser: clicking the Lilly White prompt opened Create Account and stored `{"cta":"morph_mid","page":"/MorphGuide/lilly-white","page_type":"morph"}`, and the view events reached `user_events` ([10](landing-speed-2026-10/10-signup-from-morph-prompt-phone.jpg)).

**The number to watch:** signups per 100 content-page landing sessions, split by `signup_cta`. It is about 0.2 today. Compare the `content_cta_viewed` to `content_cta_clicked` ratio per `cta` after two to four weeks, and rewrite the weakest headline first.

**Gallery links and mistyped addresses.** A signed-out visitor on any address outside the public list used to get the bare sign-in form. Now (`src/components/public/SignedOutFallback.jsx`):

- A members-only page (any page in the app's registry, matched without regard to capitals) shows a short "For members" page that says what it is. The Community Gallery reads: "Photos of crested geckos shared by Geck Inspect members, filterable by morph, so you can see Lilly Whites, Harlequins and Axanthics in real animals rather than one example photo." Buttons: Create a free account and Sign in (both return to that page afterwards), and "Or look around the demo collection first". It is marked noindex. ([08](landing-speed-2026-10/08-gallery-signed-out-phone.jpg))
- Anything else shows the existing "Page not found" page, noindex ([09](landing-speed-2026-10/09-unknown-address-desktop.jpg)).
- `/AuthPortal` is now an explicit route for signed-out visitors (it used to work only because it fell into the catch-all).

It is still a "soft" 404: the server answers 200 and the page says noindex, because Vercel rewrites every unknown address to the app. A true 404 status would need every app path listed in `vercel.json`.

## 5. Checks

- Playwright at 390 x 844 and 1440 x 900 on the landing page, the Lilly White page, Morph Guide, Care Guide, a care topic, the calculator with a pairing, Genetics Guide, `/Gallery` and `/MorphGuid`: every prompt renders, no sideways scrolling, no page errors. The guest demo (Dashboard, My Geckos, Gallery) and the sign-in page still work on the production build with the lazy shell.
- `pnpm lint` clean, 1,303 unit tests pass (7 new in `src/lib/__tests__/landingSpeed.test.js`), `vite build`, `scripts/prerender.mjs` and `scripts/seo-audit.mjs` pass (159 routes, 0 errors).

## 6. What is left, in suggested order

1. **Re-measure on production** from a real phone (PageSpeed Insights mobile on `/`, `/MorphGuide/lilly-white`, `/CareGuide`, `/calculator`) once this is deployed. This sandbox cannot reach geckinspect.com.
2. **The landing page is still about 0.3 s over the line.** What remains in the main script is mostly the Supabase client (roughly 55 to 60 KB compressed), React and the router. The next step is to load the Supabase client only after the first paint for signed-out visitors with no saved session, which is a larger change to `AuthContext` and `supabaseClient` and was left for its own pass. The Google Fonts stylesheet in `index.html` also blocks the first paint on production; self-hosting the two weights the landing page uses, or adding `preconnect`, would help.
3. **Care Guide:** the Keeper's Guide slideshow (118 KB, mostly guide text) loads with the page. It could load when scrolled into view.
4. **Capture the photo slides on production** (dashboard, morph guide, Morph ID result, storefront, photo timeline) and re-capture the five shipped slides with real photos, then flip `shipped: true`. About an hour, steps in `public/screenshots/README.md`.
5. **Open the Community Gallery to signed-out visitors** (read-only). It is community content, good for search, and the "for members" page is a stopgap.
6. **Morph page header** still has a filled "Sign In" button; the landing page moved to a quiet "Sign in" link plus "Start free". Same change on the morph, care and calculator headers would match.

## 7. Files

New: `src/components/public/ContentSignupPrompt.jsx`, `src/components/public/SignedOutFallback.jsx`, `src/lib/editorialBlogDates.js`, `src/lib/__tests__/landingSpeed.test.js`, 11 WebP files in `public/screenshots/`.

Changed: `src/App.jsx`, `src/pages.config.js`, `vite.config.js`, `scripts/prerender.mjs`, `src/api/supabaseEntities.js`, `src/lib/attribution.js`, `src/lib/activation.js`, `src/lib/editorial.js`, `src/lib/dateUtils.js`, `src/components/landing/ProductTour.jsx`, `src/data/product-tour.js`, `public/screenshots/README.md`, `src/pages/Home.jsx`, `src/pages/MorphDetail.jsx`, `src/pages/MorphGuide.jsx`, `src/pages/MorphTaxonomyHub.jsx`, `src/pages/CareGuide.jsx`, `src/pages/CareGuideTopic.jsx`, `src/pages/GeneticsGuide.jsx`, `src/pages/GeneticCalculatorTool.jsx`, `src/pages/BlogPost.jsx`, `src/pages/BlogIndex.jsx`.

Not touched (another pass owns them): My Geckos, Dashboard empty states, Quick Add, demo data and the demo tour.
