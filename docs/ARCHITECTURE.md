# Architecture: a map of the code

Where things are and how they fit, for a session that has not seen this repository before. It is a map, not a specification: every claim names the file to check. If this page and the code disagree, the code wins; fix this page.

Written 11 November 2026 from the code. For what production runs that the repository cannot rebuild (storage, scheduled jobs, secrets), read `docs/INFRASTRUCTURE.md`. For the rules of working with third-party services, read `docs/ENGINEERING.md`.

## 1. The shape in one paragraph

Geck Inspect is one single-page web app (Vite and React) that talks straight to a Supabase project (a Postgres database with row-level security, sign-in, file storage and edge functions). Vercel serves the built site and four small server functions. The same web build is wrapped by Capacitor into an iPhone app and an Android app. There is no Next.js and no server of our own.

"Row-level security" means the database itself decides which rows each signed-in member may read or change, so the app can call it directly from the browser.

## 2. From the address bar to a screen

| Step | File | What it does |
|---|---|---|
| 1 | `index.html` | Sets the theme before anything paints, preloads one font. |
| 2 | `src/main.jsx` | Starts React, the service worker, the global error boundary. |
| 3 | `src/App.jsx` | Chooses one of two route sets: **signed-out** (public pages) or **signed-in and guest** (the app). |
| 4 | `src/Layout.jsx` | The app shell for signed-in members and guests: sidebar, phone header (the page's title, or the wordmark on Today, with Search, Morph ID and the bell), phone tab bar, Log sheet, quick search, floating notices. |
| 5 | `src/pages/*.jsx` | One file per page (about 90 files). |

How a page gets its address:

- **Most app pages** are listed once in `src/pages.config.js` (`PAGES`). `App.jsx` turns each key into a route named after it: `MyGeckos` becomes `/MyGeckos`. The addresses are capitalised for that reason.
- **Public pages and special addresses** are written out in `App.jsx` (`/calculator`, `/passport/:passportCode`, `/claim/:token`, `/MorphGuide/:slug` and so on).
- **Retired pages** are listed in `src/lib/retiredPages.js`. Each becomes a redirect. `scripts/build-vercel-json.mjs` writes the same redirects into `vercel.json` so they also work before the app loads.
- **A page an admin switched off** in the Pages tool shows an "unavailable" notice.

What is in the menu is a separate list: `src/lib/navItems.js`. One registry (`NAV_REGISTRY`) feeds the sidebar (`NAV_GROUPS`, 12 destinations, 7 in Keeper mode), the phone tabs (`PHONE_TABS`: Today, Geckos, Log, More) and the quick search (`PALETTE_ITEMS`). A test, `src/lib/navItems.derived.test.js`, holds the menu's size.

Where a member lands: `memberHome()` in `src/lib/pwaLaunch.js`, the only place that names the home. Since 13 November 2026 it is Today on every device: after sign-in, at `/`, from the logo and in the installed app. The Dashboard page is called Overview and is reached from Today's toggle.

## 3. Folders

| Folder | What is in it |
|---|---|
| `src/pages/` | One file per page. |
| `src/components/` | 53 folders, one per feature area (`gecko`, `my-geckos`, `breeding`, `morph-id`, `passport`, `transfers`, `onboarding`, `auth`, `navigation`, `subscription`, `admin`, and so on). `src/components/ui/` is the shared kit (buttons, dialogs, tabs, toasts). `src/components/shared/` holds `PageHeader`, `EmptyState`, image components. |
| `src/lib/` | Logic with no screen: plan limits, dates, money, sign-in helpers, the offline queue, analytics. About 250 files, most with a test beside them or in `__tests__/`. |
| `src/data/` | Content that ships in the build: the Morph Guide, Care Guide, genetics sections and glossary, comparison pages. |
| `src/entities/`, `src/api/` | The data layer (section 4). |
| `src/styles/`, `src/index.css` | Design tokens, themes, the app shell's styles, fonts. |
| `src/hooks/` | Small shared hooks. |
| `api/` | Vercel server functions: `mcp.js` (the MCP server for AI agents), `morph-share.js` and `share.js` (link preview pages), `og-pairing.js` (preview images). |
| `middleware.js` | Runs at Vercel's edge: link-preview cards for passports, breeder pages and stores; the AI traffic log. |
| `supabase/migrations/` | Every database change, in order. |
| `supabase/functions/` | Edge functions (section 5). |
| `supabase/tests/` | SQL tests for the security rules (40 files). |
| `scripts/` | Build steps, checks and scheduled jobs. `scripts/README.md` is the index: every script, what runs it and what it writes. |
| `e2e/` | Browser tests. |
| `content/weekly-notes/` | The Weekly Gecko Notes emails, one file each. |
| `public/` | Files served as they are: images, fonts, the service worker, the manifest. |
| `art/` | Source artwork that is not deployed. |
| `ios/`, `android/` | The Capacitor phone projects. |
| `vendor/` | The genetics engine, as a packaged file (`crested-gecko-app`). |
| `docs/` | Documentation. The map is `docs/README.md`. |

## 4. Data: how the app reads and writes

- **The client.** `src/lib/supabaseClient.js` (and `src/lib/supabaseLazy.js`, which loads it on first use so signed-out pages stay light).
- **Entities.** Pages mostly do not write SQL or call Supabase directly. They use entity objects from `src/entities/all.js` (built in `src/api/supabaseEntities.js`): `Gecko.filter(...)`, `Gecko.update(id, fields)`, `WeightRecord.create(...)`, `Egg`, `BreedingPlan`, and so on. Each maps to one table.
- **The current member.** `api.auth.me()` in `src/api/appClient.js` returns the signed-in account merged with its `profiles` row. `src/lib/AuthContext.jsx` holds it for the whole app (`useAuth()`).
- **Guests.** `src/lib/guestMode.js` marks a browser tab as a guest. Reads come from sample data (`src/lib/guestMockData.js`, `src/lib/guestBreederDemo.js`); writes are stopped before they reach the database and show one "create an account" notice.
- **Who may see a gecko.** `src/lib/geckoAccess.js` (`getVisibleGeckos`): the member's own collection plus collections shared with them.
- **Server functions in the database (RPCs)** do the work that must be all-or-nothing or must not trust the browser: `save_gecko_record`, `create_transfer`, `claim_transfer`, `my_care_today`, `admin_scoreboard`. They are defined in migrations.
- **Caching.** `@tanstack/react-query` is set up in `src/lib/query-client.js` and used by some pages (My Geckos, Today). Many older pages still load with their own `useState` and `useEffect`.
- **Offline.** `public/sw.js` caches the app. `src/lib/offlineQueue.js` and `src/lib/offlineSync.js` hold care logs made with no signal and send them later, once each.
- **Identity.** Many tables still key rows by the member's email (`created_by`). Moving them to the account id is plan item E4 32 and is deferred. Do not add new email-keyed tables.

## 5. The server side

| Piece | Where | How it gets to production |
|---|---|---|
| Database changes | `supabase/migrations/*.sql` | Merging to `main` applies new files (Supabase's GitHub integration). Read `docs/MIGRATIONS.md` first. |
| Edge functions | `supabase/functions/<name>/`, one folder per function. How many there are and which are declared in `supabase/config.toml` is in `docs/INFRASTRUCTURE.md`, section 2 | Declared functions deploy on merge. Two (`embed-gecko-image`, `export-training-corpus`) are deployed by hand. |
| Scheduled database jobs | Defined in migrations, run by pg_cron | Listed in `docs/INFRASTRUCTURE.md`, section 4 (the one table of job schedules). |
| Scheduled repository jobs | `.github/workflows/` (14 workflows: CI, integration, backup, growth report, SEO audit, agent traffic, canary and others) | Listed in `docs/OPERATIONS.md`, section 5. |
| The website | Vercel builds `main` | `pnpm build`, then deploy. Documentation-only commits skip the build. |

What the main edge functions do: `recognize-gecko-morph` (Morph ID), `send-email` (every email), `stripe-checkout` and `stripe-webhook` (web payments), `revenuecat-webhook` (App Store payments), `delete-my-account`. The full table, with which need a signed-in caller, is in `docs/INFRASTRUCTURE.md`.

## 6. Money and plans

- Plan limits: `src/lib/tierLimits.js`. Prices and Stripe price ids: `src/lib/stripe-config.js`. Which plan a member is on: `resolveTier` in `tierLimits.js`. The one table of today's prices and limits in the documents is `docs/CONTEXT.md`, section 5.
- Limit checks in the app: `src/components/subscription/PlanLimitChecker.jsx`. The database also refuses a gecko over the limit.
- Web purchases go through Stripe; iPhone purchases through Apple and RevenueCat. The contract is `docs/BILLING.md`.

## 7. The look

- Tokens and the six themes: `src/index.css`. How Tailwind reads them: `tailwind.config.js`. The member's choice: `src/lib/ThemeContext.jsx`.
- The app is dark only. The default theme is Emerald.
- Shared components: `src/components/ui/`, `src/components/shared/PageHeader.jsx`, `src/components/shared/EmptyState.jsx`.
- The one design document: `docs/specs/DESIGN-SYSTEM.md`.

## 8. The phone apps

Capacitor wraps the built website. `capacitor.config.ts` holds the app id and colours. Native-only code is small: `src/lib/nativeShell.js` (status bar), `src/lib/nativeAuth.js` (sign-in callback), `src/lib/appleSignIn.js`, `src/lib/revenuecat.js` (purchases), `src/components/native/NativeCareSync.jsx` (local reminders). A change to the website reaches the phone apps only when a new build is uploaded.

## 9. Analytics

`captureEvent(name, properties)` in `src/lib/posthog.js` sends product events to PostHog and mirrors them to the `user_events` table. Event names and the funnel are in `docs/planning/instrumentation-2026-10.md`. Visitors in the EEA and UK are asked first (`src/lib/analyticsConsent.js`).

## 10. Building and checking

| Command | What it does |
|---|---|
| `pnpm dev` | Local site. Needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`). |
| `pnpm lint` | ESLint. The warning cap is in `package.json`; do not raise it. |
| `pnpm test` | About 3,800 unit tests (Vitest), in a minute. |
| `pnpm test:e2e` | Browser tests (Playwright) on a laptop size and a phone size. Supabase is answered inside the browser by `e2e/support/fake-supabase.js`, so no keys or network are needed. |
| `pnpm check:genetics` | Checks that every page tells the same genetics story. |
| `pnpm build` | The environment check, lint and the unit tests, then the sitemap, the open data, the site build, prerendering of public pages and the SEO audit. It does not run `pnpm check:genetics` or the browser tests; CI runs those. `scripts/README.md` lists every step. |
| `node scripts/check-doc-links.mjs` | Finds broken links between documents. |

SQL tests for the security rules run in CI (`.github/workflows/integration.yml`) and locally through `scripts/sql-harness/`.

CI fails a push to `main` that adds a picture over 200 KB to `public/` or makes a public page load too much code (`scripts/check-bundle-size.mjs`, `scripts/bundle-budget.json`).

## 11. Where to make common changes

| To change | Start in |
|---|---|
| What is in the menu | `src/lib/navItems.js` (and its test) |
| A page's address, or retire a page | `src/pages.config.js`, `src/lib/retiredPages.js` |
| What a gecko's record shows | `src/components/gecko/record/` |
| The add-a-gecko forms | `src/components/my-geckos/QuickAddGecko.jsx`, `GeckoForm.jsx` |
| Logging care | `src/pages/QuickLog.jsx`, `src/pages/FieldMode.jsx`, `src/lib/today.js` |
| Today's list | `src/pages/Today.jsx`, `src/lib/today.js`, the `my_care_today` function |
| Sign-up and sign-in | `src/components/auth/LoginPortal.jsx`, `src/lib/emailLinkAuth.js` |
| The first-run question | `src/components/onboarding/RoleQuestion.jsx` |
| Passports and transfers | `src/pages/AnimalPassport.jsx`, `src/components/transfers/`, `src/lib/transfers.js` |
| Morph ID | `src/pages/Recognition.jsx`, `src/components/morph-id/`, `supabase/functions/recognize-gecko-morph/` |
| Plan limits or prices | `src/lib/tierLimits.js`, `src/lib/stripe-config.js` |
| An email | `supabase/functions/_shared/lifecycle-copy.ts`, `content/weekly-notes/`, `supabase/functions/send-email/` |
| Money formatting | `src/lib/money.js` |
| The landing page | Frozen while the homepage test runs (`docs/planning/homepage-ab-test-2026-10.md`) |

## 12. Old addresses in specs, and the real ones

Old specs (the `P` files in `docs/specs/` and `docs/specs/history/`) were written before the app's addresses were settled, and they name addresses that never existed or were renamed. Do not build from them. This table gives the real address for each, checked on 12 November 2026 against `src/App.jsx`, `src/pages.config.js` and `src/lib/retiredPages.js`.

Real addresses of app pages are capitalised, because each comes from its key in `src/pages.config.js` (section 2).

| Address in an old spec | Spec | The real address, or what happened |
|---|---|---|
| `/collection` | P1, P6, P3 | `/MyGeckos` |
| `/collection/new` | P1 | Adding a gecko is a window on `/MyGeckos`, not an address of its own (`/MyGeckos?add=1` opens the first-gecko step) |
| `/collection/:id/edit` | P1 | Editing is a window on `/MyGeckos` (`/MyGeckos?gecko=<id>&open=edit`). The record as a page is `/GeckoDetail?id=<id>` |
| `/collection/:id/qr` | P1 | `/passport/:passportCode/qr` (the QR card belongs to the passport, not the collection) |
| `/passport/:passport_code`, `/passport/:code` | P1, storefront consolidation | `/passport/:passportCode` |
| `/claim/:token` | P1 | `/claim/:token` (this one is real as written) |
| `/b/:slug` | P8, the feature priority map | `/Breeder/:slug` (the breeder's public page). The store page is `/store/:slug`, lower case |
| `/b/:slug/widget` | P8 | Never built: there is no embed widget |
| `/b/:slug/journal` | P9 | Never built, and shelved with all blog work |
| `/settings/storefront` | P8 | `/MyStore`. An older `/BreederStorefront` redirects there |
| `/market` | P2 | `/Market` (Prices; called Market Intelligence until 13 November 2026). The older price page is `/MarketPricing` |
| `/settings/alerts` | P2 | Never built: there are no price alerts. The nearest thing is the Watchlist tab on `/Market` |
| `/answers`, `/answers/new`, `/answers/:id` | P5 | Never existed. Geck Answers was folded into the Forum: `/GeckAnswers` redirects to `/Forum` |
| `/loans`, `/loans/:id`, `/loans/accept/:token` | P4 | Never existed. Breeding Loans is retired: `/BreedingLoans` redirects to `/Breeding` |
| `/breeding`, `/breeding/new`, `/breeding/:id` | P3 | `/Breeding`. A plan has no address of its own. Breeding ROI is retired: `/BreedingROI` redirects to `/Breeding` |
| `/groups/:id/feed`, `/groups/:id/weigh` | P6 | `/BatchHusbandry`, one page |
| `/admin/photo-submissions` | P10 | Never built as an address. Review is a tab inside `/AdminPanel`; members submit at `/MorphGuideSubmission` |

Addresses that did exist and now redirect (retired pages such as `/Promote`, `/Store`, `/OtherReptiles`, `/Marketplace`) are listed in `src/lib/retiredPages.js`, with where each goes.
