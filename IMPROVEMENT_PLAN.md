# Geck Inspect - Improvement Plan and Hand-Off Prompts

Date: 2026-07-07. Produced from a five-track code audit (routing/dead code, bugs and logic contradictions, UX/workflow, backend/build/infra, marketing surface) plus the strategy docs (STRATEGY.md, ROADMAP.md, docs/INTENT.md, docs/DECISIONS.md) and the latest growth reports.

This file is written to be handed off. Every work item includes context, evidence with file:line references, a definition of done, and a copy-paste prompt you can give to Claude Opus 4.5, ChatGPT 5.5, or any capable coding agent with access to this repo.

---

## 0. How to use this file

1. Work through phases in order. Phase 1 protects revenue and trust. Phase 2 protects the codebase itself. Everything after that builds on a safe base.
2. One prompt per agent session. Do not batch unrelated items; small diffs are easier to verify and revert.
3. Paste the Standing Guardrails block (below) at the top of every prompt. It encodes the repo facts and style rules an outside model will not know.
4. After every change, the agent must run: `pnpm lint && pnpm typecheck && pnpm build`. The build chain includes the sitemap, llms-full, morphs CSV, vercel.json generators, prerender, and a strict SEO audit, so a green build is a meaningful check.
5. Verify in the running app (`pnpm dev`) for anything user-facing.

### Standing Guardrails (paste into every prompt)

```
Project facts you must respect:
- This is a Vite + React 18 SPA (NOT Next.js, despite older docs saying so). Routing is
  react-router-dom v6, wired through src/App.jsx plus a generated PAGES map in
  src/pages.config.js. Path alias "@/" points at src/.
- Package manager is pnpm (pinned in package.json). Backend is Supabase (project ref
  mmuglfphhwlaluyfyxsp): Postgres + RLS, storage, and edge functions under
  supabase/functions/. Billing is Stripe via edge functions plus RevenueCat
  (web SDK today, Capacitor SDK present for a future native shell).
- vendor/crested-gecko-app-0.1.0.tgz is the Foundation Genetics engine. It is a real,
  live dependency. Never delete or "clean up" the vendor/ directory.
- src/api/base44Client.js looks like legacy but is a live Supabase facade used
  everywhere. Do not remove it unless the task explicitly says to.
- Style rule, hard requirement: NO em dashes (U+2014) and no en dashes used as pause
  punctuation in any copy, code comment, doc, or generated asset you touch. Use a
  comma, a period, parentheses, or a colon instead. If you find existing em dashes in
  a file you are editing, fix them in the same commit.
- Brand rule: Geck Inspect is crested-gecko-FIRST. Never generalize copy to "reptiles"
  or "lizards." Use real crested gecko morph names in examples (Lilly White,
  Harlequin, Phantom, Cappuccino, Axanthic, Sable, Highway).
- The domain tennyscrestedgeckos.com is NOT this project's founder. Never cite it as a
  founder or credibility signal anywhere.
- Verification: run `pnpm lint && pnpm typecheck && pnpm build` before finishing.
  All three must pass.
- Git: commit directly to main with a clear message. Do not create feature branches or
  PRs unless the push to main is rejected by the proxy (HTTP 403 protected branch), in
  which case follow the escape hatch documented in CLAUDE.md.
```

---

## 1. State of the app (executive summary)

The honest picture, from the code:

**What is real and good.** Roughly 52 of the 61 authenticated pages read and write Supabase for real. The breeder pipeline (pairing, clutches, hatchery auto-creating hatchling records with inherited lineage) is the strongest flow in the app. Genetics data is internally consistent: `scripts/check-genetics-consistency.mjs` passes, and Cappuccino/Lilly White are classified the same way (incomplete dominant, with super-form warnings) across the taxonomy, the visualizer, and the Foundation Genetics engine. Lint and typecheck are clean. Notifications are genuinely produced by many real producers. The email lead magnet, referral links, QR passports, and guest mode all exist and work. Shipped marketing copy is already em-dash clean.

**What is broken or contradictory.** There are two tier-resolution functions that disagree, so paying RevenueCat users and admins get free-tier metered limits. A legacy `/Subscription` page lets any signed-in user self-assign a paid tier without paying. Trial length is advertised as 7 days, 30 days, and 3 months on different surfaces while Stripe has none configured. Two edge functions the app calls (`invoke-llm`, `shipzeros-proxy`) do not exist in the repo at all. The flagship AI morph ID flow computes a gecko's morphs and then throws the result away instead of offering "add to my collection."

**What is unfinished or facade.** Market Analytics ("Business Tools") renders deterministic mock fixtures behind an Enterprise paywall. MyListings shows hardcoded zero "Views" and "Inquiries" with "coming soon" tooltips. About nine real, working pages are unreachable from any navigation. The landing page has zero product screenshots (the folder is empty, so the tour component renders nothing) and no pricing link.

**The strategic frame.** Traffic is currently tiny (about 15 homepage views a week, zero search clicks). The app does not need more features. It needs the existing surface finished, contradictions removed, the one hero funnel (AI morph ID) connected end to end, and a landing page that shows proof. Breed Ledger launched May 15, 2026; the moat is crested-gecko-first depth plus finishing quality, not breadth.

Counts for orientation: 83 page files, 61 routed app pages, 23 edge functions in-repo (2 more invoked but missing), 65 migrations (8 are empty placeholders), 6 GitHub workflows, 0 tests, 6 parallel morph/trait catalogues, 19 blog posts.

---

## 2. Phase 1: Revenue and trust critical fixes

**STATUS: COMPLETED 2026-07-07** (commits e134931, 85dde32, 96ab275, 9429c59, 0dfd98c on main). Notes for later phases: vitest is now installed with `pnpm test` covering tierLimits and seasons, so Phase 2.3's harness setup is partly done. The winter season rule chosen in 1.4 is "a winter belongs to the year it ENDS in" (Dec 2026 through Feb 2027 is "2027 Winter"). Item 1.5 was adapted to the code as it exists now: the analytics module already had a real snapshot pipeline with an error state, so the fix removed the Enterprise upsell tied to data, added an explicit load-error banner with retry, made the MyListings Inquiries tile count real breeder_inquiries rows (Views tile removed, nothing tracks views), and replaced Market Pricing's hardcoded +5.2% trend with a computed 90-day median comparison. Wiring morph_price_entries into the analytics module's charts should happen in the snapshot generator (geck-data), not the client; that part remains open.

These are the "someone pays and gets a broken product" and "someone gets Pro for free" bugs. Do these first.

### 1.1 Unify the two tier resolvers

**Problem.** `tierOf` in `src/lib/tierLimits.js:117` and `effectiveTier` in `src/components/subscription/PlanLimitChecker.jsx:94` resolve a user's tier differently. `effectiveTier` honors `role === 'admin'` and `revenuecat_pro_active`; `tierOf` honors neither. But `tierOf` is what gates every metered feature: usage meters (`src/lib/usageMeter.js:38`), storage caps (`src/lib/uploadFile.js:131`), health screens (`src/components/health/HealthScreenCard.jsx:109`), IoT (`src/components/iot/IotSettingsCard.jsx:41`), the consultant (`src/pages/BreederConsultant.jsx:71`), and Promote (`src/pages/Promote.jsx:49`). A user who buys Pro through RevenueCat is treated as Breeder for gecko count but Free for storage, AI messages, and health screens. Admins are throttled too, despite the docstring at `tierLimits.js:22` claiming they bypass limits.

**Definition of done.** One exported tier-resolution function, used by both `tierLimits.js` and `PlanLimitChecker.jsx`, honoring (in priority order): admin role, grandfathered status, `revenuecat_pro_active`, `membership_tier`. Every consumer of `tierOf`/`getTierLimits`/`effectiveTier` resolves identically for the same user object.

**Prompt:**

```
[Standing Guardrails block here]

Task: unify tier resolution in the Geck Inspect subscription system.

Today there are two divergent resolvers:
- tierOf() in src/lib/tierLimits.js line ~117: honors subscription_status ===
  'grandfathered' and membership_tier only.
- effectiveTier() in src/components/subscription/PlanLimitChecker.jsx line ~94:
  also honors user.role === 'admin' (treated as enterprise) and
  user.revenuecat_pro_active (treated as breeder).

tierOf() feeds getTierLimits(), which gates usage meters (src/lib/usageMeter.js),
storage caps (src/lib/uploadFile.js), health screens, IoT polling, the breeder
consultant, and Promote. So RevenueCat subscribers and admins currently get FREE
metered limits even though other parts of the app treat them as paid.

Do this:
1. Create a single resolveTier(user) function in src/lib/tierLimits.js implementing
   the union of both behaviors, priority: admin -> enterprise; grandfathered ->
   mapped tier; revenuecat_pro_active -> breeder; else membership_tier; else free.
2. Make tierOf() delegate to it (keep the export for compatibility) and rewrite
   effectiveTier() in PlanLimitChecker.jsx to import and use it.
3. Grep for every import of tierOf, getTierLimits, and effectiveTier and confirm
   each call site passes the full user object (some may pass a profile row; make the
   resolver tolerant of both shapes: check user.role, user.subscription_status,
   user.revenuecat_pro_active, user.membership_tier, and the same fields nested
   under user.profile if present).
4. Add a small unit test (create the test setup if none exists: vitest is the
   natural fit for a Vite app; add "test": "vitest run" to package.json) covering:
   admin -> enterprise limits, revenuecat_pro_active -> breeder limits,
   grandfathered, plain membership_tier, and empty user -> free.
Verification: pnpm lint && pnpm typecheck && pnpm build && pnpm test.
```

### 1.2 Kill the legacy /Subscription page (free-tier-upgrade exploit)

**Problem.** `src/pages/Subscription.jsx:103-106` calls `base44.auth.updateMe({ membership_tier: tier.id })` when a user clicks Upgrade. No payment happens ("Payment processing coming soon" at line 311). The route is live via `src/pages.config.js:109,179`. It also shows wrong prices (Breeder annual $70 vs canonical $60 in `src/lib/stripe-config.js:46`), stale features ("AI morph identification (coming soon)" at line 24 while Free actually includes 1/mo), and it writes the tier to `user_metadata`, which then fights with the `profiles` row read path in `src/lib/AuthContext.jsx:24`. Two Settings cards still deep-link to it: `src/components/settings/CollectionsCard.jsx:274` and `src/components/settings/StorageUsageCard.jsx:105`.

**Definition of done.** `/Subscription` route redirects to `/Membership`. The page file and its `updateMe` tier write are deleted. Both Settings upgrade CTAs point at Membership. No client code path can set `membership_tier` directly.

**Prompt:**

```
[Standing Guardrails block here]

Task: remove the legacy self-serve subscription page, which is a paywall bypass.

Facts:
- src/pages/Subscription.jsx lets any signed-in user set membership_tier via
  base44.auth.updateMe() with no payment (lines ~103-106; note the "Payment
  processing coming soon" copy near line 311). base44.auth.updateMe writes to
  supabase.auth.updateUser user_metadata (src/api/base44Client.js ~38-43).
- The canonical pricing/checkout page is src/pages/Membership.jsx backed by
  src/lib/stripe-config.js and the stripe-checkout edge function.
- src/components/settings/CollectionsCard.jsx (~274) and
  src/components/settings/StorageUsageCard.jsx (~105) link to
  createPageUrl('Subscription').

Do this:
1. Delete src/pages/Subscription.jsx and remove its entry from src/pages.config.js.
2. Add a redirect so the old /Subscription URL lands on /Membership (a small
   <Navigate> route in src/App.jsx is fine; check how other redirects are done).
3. Update both Settings cards to link to createPageUrl('Membership').
4. Grep the whole src/ tree for 'Subscription' page links and updateMe calls that
   write membership_tier, subscription_status, or any entitlement field from the
   client; remove or flag each one in your summary. Entitlements must only be
   written server-side by the stripe webhook / revenuecat-webhook edge functions.
5. Check scripts/seo-routes.mjs and the generated sitemap for a /Subscription
   entry and remove it if present.
Verification: pnpm lint && pnpm typecheck && pnpm build. Then pnpm dev and confirm
/Subscription redirects to /Membership.
```

### 1.3 Reconcile pricing, trial, and feature claims to one source of truth

**Problem.** Trial length is claimed as 7 days (`src/pages/Membership.jsx:211,379,398`), 30 days (`src/components/promote/TrialOfferModal.jsx:9`), and 3 months (`src/components/admin/StoreAdmin.jsx:63`), while `stripe-config.js` price captions say "Billed monthly. Cancel anytime." with no trial. Marketplace sync is advertised in Breeder copy (`Membership.jsx:135,159`) but enforced as Enterprise-only (`PlanLimitChecker.jsx:54`, comment at line 17). The annual badge says "Save 20%" but actual savings are about 17% (`Membership.jsx:120`). Keeper/Breeder lifetime tiers render with prices but `price_id: null` (`stripe-config.js:42,47`), so the buttons are dead. Annual captions still say "Annual launches June 2026" (`stripe-config.js:41,46,54`), which is in the past.

**Definition of done.** `stripe-config.js` is the single source of truth for prices, trial policy, and per-tier features. Membership, Promote, and any JSON-LD derive from it. No surface advertises a feature a tier does not unlock. Dead lifetime buttons either work or are hidden. Stale date copy is gone.

**Prompt:**

```
[Standing Guardrails block here]

Task: make src/lib/stripe-config.js the single source of truth for Geck Inspect
pricing and reconcile every contradicting surface.

Known contradictions to fix:
1. Trial length: Membership.jsx claims a 7-day trial (~lines 211, 379, 398);
   TrialOfferModal.jsx offers 30 days; StoreAdmin.jsx grants 3 months; Stripe
   captions mention no trial. Decide with this rule: encode TRIAL_DAYS (or a
   per-context trial map) in stripe-config.js, default 7, and make every surface
   read it. The 30-day promo and 3-month store grant may stay as deliberate
   promotions, but each must state its own duration from a named constant, not a
   hardcoded string, and the pricing page must describe the default accurately.
2. Marketplace sync: PlanLimitChecker.jsx puts marketplace_sync only in the
   enterprise feature list (comment near line 17 says this is intentional), but
   Membership.jsx copy and its JSON-LD (~lines 135, 159) advertise it for Breeder.
   Move marketplace_sync into the breeder tier's features in PlanLimitChecker
   (that matches the marketing and is the better product decision; a Breeder plan
   without MorphMarket sync is not a breeder plan). Update the enterprise copy to
   emphasize what actually distinguishes it.
3. Annual badge says "Save 20%" (Membership.jsx ~line 120) but real savings are
   about 17%. Compute the percentage from the config per tier and render that.
4. Lifetime tiers for Keeper and Breeder show prices but have price_id: null in
   stripe-config.js (~lines 42, 47), so the purchase buttons are dead. Hide any
   lifetime option whose price_id is null, and leave a comment in stripe-config.js
   explaining they re-appear when real price IDs are added.
5. Remove stale "Annual launches June 2026" captions (today is July 2026).
6. Sweep for other hardcoded prices: grep src/ for "$2.99", "$5.99", "2.99",
   "5.99", "$60", "$70", "$149", "$349" and make every match read from
   stripe-config.js.
Verification: pnpm lint && pnpm typecheck && pnpm build. In pnpm dev, load
/Membership and confirm tiers, badges, and trial copy are consistent.
```

### 1.4 Fix the winter season contradiction

**Problem.** In `src/lib/seasons.js`, `computeSeasonWindow('winter', Y)` spans Dec Y to Feb Y+1 (lines 52-57), but `inferSeasonLabel` maps Jan/Feb of year Y to "Y Winter" (lines 93-109). A clutch laid in January is labeled the current winter but status-checked against a window that starts eleven months later, so it reports as "future." The file's own header comment (lines 12-14) admits the ambiguity.

**Definition of done.** One anchoring rule, applied by both functions, plus a unit test that round-trips `inferSeasonLabel` and `seasonStatus` for dates in every month.

**Prompt:**

```
[Standing Guardrails block here]

Task: fix a season-labeling contradiction in src/lib/seasons.js.

computeSeasonWindow('winter', Y) currently returns Dec of year Y through Feb of
year Y+1 (lines ~52-57). But inferSeasonLabel / SEASON_NAME_BY_MONTH label January
and February of year Y as "Y Winter" (lines ~93-109). Result: a breeding record
dated Jan 2026 labels itself "2026 Winter" but seasonStatus('winter', 2026)
evaluates a window starting Dec 2026, so the record's own season reads as
'future'.

Do this:
1. Adopt the label rule as canon: "Y Winter" means Jan/Feb of year Y plus Dec of
   year Y-1... wait, check first: read every consumer of computeSeasonWindow and
   inferSeasonLabel (grep src/ for both) and pick the anchor that requires the
   fewest call-site changes and no stored-data migration. Document the chosen rule
   in the file header and delete the "ambiguity" caveat comment.
2. Make both functions agree.
3. Add unit tests (vitest) that, for a date in every month of the year, assert
   seasonStatus(inferSeason(date)) returns 'current' when evaluated at that date.
4. Manually check the Breeding and BreedingSeason pages in pnpm dev with a
   January-dated record.
Verification: pnpm lint && pnpm typecheck && pnpm build && pnpm test.
```

### 1.5 Stop selling mock data: Market Analytics honesty pass

**Problem.** The Market Analytics module renders deterministic mock fixtures (`src/lib/marketAnalytics/mockFixtures.js:1-16`, records tagged `__mock: true`; fallback in `queries.js:60,123`) behind an Enterprise paywall with the banner "activate with an Enterprise subscription" (`components/market-analytics/MarketAnalytics.jsx:142,220`). Buying Enterprise today unlocks... preview fixtures. Similarly, MyListings shows hardcoded zero Views/Inquiries with "Feature coming soon!" tooltips (`src/pages/MyListings.jsx:36-37,280,299`). Selling analytics that do not exist is the fastest way to burn trust with exactly the breeders the strategy says to win.

**Definition of done.** No paywalled surface implies data that does not exist. Market Analytics is either (a) clearly labeled a preview with no upsell button, or better (b) rewired to real data (see the community price index big swing in section 8, and note `src/pages/MarketPricing.jsx` already collects real `morph_price_entries`). MyListings tiles are removed or driven by real counts.

**Prompt:**

```
[Standing Guardrails block here]

Task: honesty pass on paywalled analytics surfaces.

Facts:
- src/lib/marketAnalytics/mockFixtures.js generates deterministic mock data
  (records tagged __mock: true); src/lib/marketAnalytics/queries.js falls back to
  fixtures with _dataSource='preview' (~lines 60, 123).
  components/market-analytics/MarketAnalytics.jsx shows a PreviewDataBanner but
  also an Enterprise upsell (~lines 142-143, 220). Buying Enterprise unlocks the
  same mock data. It is mounted from Dashboard, MarketplaceSalesStats, Settings,
  and MarketplaceSell.
- src/pages/MyListings.jsx renders hardcoded views: 0 and inquiries: 0
  (~lines 36-37) with "Feature coming soon!" tooltips (~280, 299).
- Meanwhile src/pages/MarketPricing.jsx already collects REAL community price
  data into the morph_price_entries table.

Do this:
1. In MarketAnalytics, when _dataSource is 'preview', remove the Enterprise
   purchase CTA. Replace it with an honest "Sample data preview. Real market
   analytics are in development" banner. Keep the module visible (it is a good
   demo) but never imply payment unlocks real data.
2. Wire the module's price-trend panel to real morph_price_entries data where
   count >= a minimum threshold (say 5 entries for a morph), falling back to the
   labeled sample otherwise. Read src/pages/MarketPricing.jsx and
   src/lib/marketAnalytics/queries.js first to match shapes.
3. In MyListings, replace the fake Views/Inquiries stat tiles: if there is a
   listing_views or inquiries table/column in supabase/SCHEMA_SNAPSHOT.md or the
   inquiry components (grep for BuyerInquiryModal, send-breeder-inquiry), count
   real inquiries. If views are not tracked anywhere, remove the Views tile
   entirely rather than showing a fake zero.
Verification: pnpm lint && pnpm typecheck && pnpm build; check Dashboard,
MarketplaceSalesStats, and MyListings in pnpm dev.
```

---

## 3. Phase 2: Infrastructure safety nets

**STATUS: COMPLETED 2026-07-07.** Notes for later phases:
- 2.1: `invoke-llm` was fetched from Supabase and committed verbatim under `supabase/functions/invoke-llm/`; the deployed function uses `claude-haiku-4-5-20251001` by default. `shipzeros-proxy` was never deployed, so ShipZeros live mode is guarded by a `PROXY_DEPLOYED=false` flag instead of committing a fabricated function.
- 2.2: TABLE_MAP was verified against the live 108-table schema; the audit's "possibly missing" tables all exist (false alarm). The real bug was `parseSort` defaulting to `created_date` on tables that use `created_at` (collections, testimonials) or have no timestamp (collection_members, app_settings, social_post_photo_usage), which silently broke shared-collection queries. A true `supabase db dump` baseline still needs the DB password (documented in SCHEMA_SNAPSHOT.md).
- 2.3: vitest suite now covers tierLimits, seasons, parseSort, morphUtils, usageMeter, imageResize, and blog-helpers (74 tests), wired into CI. The RLS audit (docs/security/rls-admin-audit-2026-07.md) found admin gating is email-based and clean everywhere EXCEPT `profiles`, which has no admin UPDATE policy, so UserManagement's role/expert grants on other users silently no-op. Migration `20260707000000_profiles_admin_update_policy.sql` is committed but NOT APPLIED; it needs a manual `supabase db push` after review.
- 2.4: the old MORPHS regex silently dropped 4 morphs from the public CSV; both data-parsing scripts now import modules directly and fail loud. Strict SEO audit moved from the push gate to a weekly workflow.
- 2.5: client-side downscale to 1600px WebP is live in uploadFile.js. `transformImageUrl` (thumbnail helper) is committed but gated behind `VITE_SUPABASE_IMAGE_TRANSFORM` (default off); turning it on requires confirming Supabase image transformations are enabled (a paid feature), then adopting it in grids. That grid adoption is the remaining follow-up.
- 2.6: react-query was NOT removed (it has a real client + provider + a PageNotFound consumer); standardizing data fetching is still a separate future task. Env vars now warn in dev rather than throw, because production intentionally relies on the bundled fallbacks.

Do these before big refactors. They make every later change safer.

### 2.1 Commit the missing edge functions

**Problem.** `src/lib/invokeLlm.js:27` invokes an `invoke-llm` edge function used by blog generation, TrainModel, BreederConsultant, MassMessaging, and ChangeLogManager. `src/integrations/ShipZeros.js:30` invokes `shipzeros-proxy` (currently masked by `DEMO_MODE` defaulting on at line 22). Neither exists under `supabase/functions/`. They hold the Anthropic key server-side and are deployed out-of-band, so they are not version-controlled, not rebuildable, and invisible to review. If the deployed copy drifts or is lost, every AI feature silently breaks.

**Definition of done.** Both functions' source lives in `supabase/functions/`, with JWT verification and basic rate limiting on `invoke-llm` documented, and a README note on required secrets. If `shipzeros-proxy` was never deployed, the ShipZeros integration is explicitly gated so `VITE_SHIPZEROS_LIVE=true` cannot be flipped without the function existing.

**Prompt:**

```
[Standing Guardrails block here]

Task: bring two out-of-band Supabase edge functions under version control.

Facts:
- src/lib/invokeLlm.js (~line 27) calls supabase.functions.invoke('invoke-llm').
  The file header describes it as holding ANTHROPIC_API_KEY server-side. Consumers:
  src/lib/blog-api.js, src/pages/TrainModel.jsx, src/pages/BreederConsultant.jsx,
  src/components/admin/MassMessaging.jsx, src/components/admin/ChangeLogManager.jsx,
  src/api/integrations.js, src/integrations/Core.js.
- src/integrations/ShipZeros.js (~line 30) calls
  supabase.functions.invoke('shipzeros-proxy'), masked today by DEMO_MODE
  defaulting on (~line 22).
- Neither function exists in supabase/functions/. 23 other functions do; read
  supabase/functions/recognize-gecko-morph/index.ts and send-email/index.ts for
  the house style (Deno, CORS handling, env access, service-role usage).

Do this:
1. If you have Supabase MCP access, fetch the deployed source with the
   get_edge_function tool for 'invoke-llm' (and 'shipzeros-proxy' if deployed) and
   commit it verbatim under supabase/functions/<name>/index.ts, then review it.
   If you cannot fetch it, reconstruct invoke-llm from its call sites: accept
   { prompt, system, model, max_tokens, response_json_schema? }, require a valid
   user JWT, call the Anthropic Messages API with ANTHROPIC_API_KEY from env
   (default model claude-sonnet-5), enforce a simple per-user daily call cap using
   a Postgres counter table, and return { text } or parsed JSON when a schema was
   requested. Match the exact response shape src/lib/invokeLlm.js expects (read it
   carefully first).
2. Add supabase/functions/invoke-llm/README.md documenting required secrets and
   the deploy command (npx supabase functions deploy invoke-llm), mirroring the
   style of the other function READMEs.
3. For ShipZeros: add a guard so the live path throws a clear error mentioning the
   missing function unless the function exists; document in a comment that
   shipzeros-proxy must be committed and deployed before flipping
   VITE_SHIPZEROS_LIVE.
4. Do NOT deploy anything; committing source is the deliverable. List any
   uncertainty about the reconstructed contract in your summary.
Verification: pnpm lint && pnpm typecheck && pnpm build.
```

### 2.2 Reproducible schema baseline plus entity/table reconciliation

**Problem.** Eight migrations are empty "remote_snapshot" placeholders (for example `supabase/migrations/20260410025954_remote_snapshot.sql`), so a fresh `supabase db reset` cannot rebuild the real 96-table schema; it exists only in production. Separately, `src/api/supabaseEntities.js` maps entities (`MorphTrait`, `Clutch`, `BreedingProject`, `GeneticOutcomePrediction`, `Question`, `Answer`, `LineagePlaceholder`) to tables that appear in neither migrations nor `SCHEMA_SNAPSHOT.md`, and `parseSort` (line 174) defaults every list query to `order('created_date')`, which 400s on any table using `created_at`.

**Definition of done.** A real baseline migration dumped from production, a regenerated SCHEMA_SNAPSHOT.md, and a reconciliation of `TABLE_MAP` against the actual table list with dead mappings removed and the default sort made resilient.

**Prompt:**

```
[Standing Guardrails block here]

Task: make the Supabase schema reproducible and reconcile the entity map.

Facts:
- supabase/migrations/ has 65 files; 8 named *_remote_snapshot.sql contain only a
  placeholder comment, so the real schema (96 tables per SCHEMA_SNAPSHOT.md) is
  not reconstructible from the repo.
- src/api/supabaseEntities.js TABLE_MAP maps several entities to tables with no
  trace in migrations or SCHEMA_SNAPSHOT.md: morph_traits, clutches,
  breeding_projects, genetic_outcome_predictions, questions, answers,
  lineage_placeholders. They may exist in prod or may be dead.
- parseSort (supabaseEntities.js ~line 174) defaults every unsorted list() to
  order('created_date'), which errors on tables using created_at.

Do this (requires Supabase MCP access or the supabase CLI linked to project
mmuglfphhwlaluyfyxsp; if you have neither, stop and say so):
1. Pull the full public-schema DDL from production (supabase db dump or
   information_schema queries via MCP execute_sql, read-only) and commit it as a
   single baseline migration with a clear header comment, dated BEFORE the oldest
   placeholder so ordering stays valid, OR as supabase/schema-baseline.sql with a
   README explaining how to apply it to a fresh project. Choose the approach that
   does not disturb existing prod migration history.
2. Regenerate SCHEMA_SNAPSHOT.md's table list from the real information_schema
   (keep the doc's existing prose/format; refresh the date).
3. Reconcile TABLE_MAP: for each mapped table, confirm it exists in prod. Remove
   mappings to tables that do not exist and grep for their entity consumers; if a
   page queries a nonexistent table, note it in your summary (do not silently
   delete pages).
4. Make parseSort resilient: maintain a small set of tables known to use
   created_at (or introspect once and cache), or catch the 400 and retry without
   an order clause. Prefer the explicit set; document it.
Verification: pnpm lint && pnpm typecheck && pnpm build.
```

### 2.3 Test harness plus RLS/admin security audit

**Problem.** There are zero automated tests in the repo. CI (`.github/workflows/ci.yml`) runs lint, typecheck, a genetics-drift check, build, and a strict SEO audit, but nothing exercises logic. Meanwhile the admin panel is gated purely client-side (`src/pages/AdminPanel.jsx:190`), and migration history shows admin RLS was recently wrong twice (`20260517_fix_admin_rls_use_email_not_uid.sql`, `20260514_collection_rls_no_recursion.sql`), so the real security boundary has a track record of bugs and no regression net.

**Definition of done.** Vitest wired into CI. Unit tests for tier resolution, seasons, usage meters, and morph slug utilities. A written RLS audit: for every table the admin UI writes, the policy that permits it and the policy that blocks non-admins, with gaps fixed by migration.

**Prompt:**

```
[Standing Guardrails block here]

Task 1: add a minimal test harness. Install vitest as a devDependency, add
"test": "vitest run" to package.json scripts, and write unit tests for the pure
logic modules: src/lib/tierLimits.js (tier resolution and limits),
src/lib/seasons.js (label/window round-trip), src/lib/usageMeter.js (metering
math), src/lib/morphUtils.js (slugging and record picking). Target the behavior
documented in each file, not implementation details. Add a "test" step to
.github/workflows/ci.yml after typecheck.

Task 2: RLS audit for admin-writable tables. The admin UI (src/pages/AdminPanel.jsx
and src/components/admin/*) is gated client-side only (AdminPanel.jsx ~line 190).
Migrations 20260514_collection_rls_no_recursion.sql and
20260517_fix_admin_rls_use_email_not_uid.sql show admin RLS has been wrong before.
1. Enumerate every table written from src/components/admin/* and AdminPanel.jsx
   (grep for .from(', entity names, and supabase.functions.invoke calls).
2. For each, find the RLS policy in supabase/migrations/ that (a) permits the
   admin write and (b) blocks non-admin writes. Build a table: table | admin
   policy | non-admin block | verdict.
3. For any gap, write a migration adding the correct email-based admin policy,
   following the pattern in 20260517_fix_admin_rls_use_email_not_uid.sql. Do not
   apply it to prod; commit the migration file and flag it for manual review.
4. Also confirm no service-role key or privileged call is reachable from client
   code (grep src/ for service_role).
Verification: pnpm lint && pnpm typecheck && pnpm build && pnpm test.
```

### 2.4 Build pipeline hardening and CI gate sanity

**Problem.** `scripts/build-morphs-csv.mjs:36` hard-fails the build if the `MORPHS` array is not regex-findable, and `scripts/build-llms-full.mjs:47` silently emits empty output if `care-guide.js` changes shape. `seo-audit --strict` and the genetics-drift check are hard CI gates, so a stale `dateModified` can block a code deploy. The `build-vercel-json.mjs` header comment (lines 7-16) contradicts what the script actually does (line 146 emits a single catch-all; the code is right, the comment is stale).

**Definition of done.** Data-file parsing is import-based or fails loudly on empty output; content audits are non-blocking on the deploy path but strict on a scheduled job; the stale comment is fixed.

**Prompt:**

```
[Standing Guardrails block here]

Task: harden the Geck Inspect build pipeline.

1. scripts/build-morphs-csv.mjs (~line 36) and scripts/build-llms-full.mjs
   (~line 47) parse src/data/*.js with regexes; the first hard-fails on format
   drift, the second silently emits empty output. Convert both to import the data
   modules directly (they are ESM; use await import with a file URL). If direct
   import is blocked by JSX or path aliases in the data files, keep the regex but
   add a loud failure when the parsed result is empty or shrinks by more than 50%
   versus the committed output.
2. .github/workflows/ci.yml treats `node scripts/seo-audit.mjs --strict` and the
   genetics-consistency check as hard gates on every push. Keep genetics as a hard
   gate (it protects data correctness) but move seo-audit to non-strict on the
   push/deploy path, and add a separate scheduled weekly workflow that runs it
   with --strict and opens/updates an issue on failure (or simply fails visibly).
3. Fix the stale header comment in scripts/build-vercel-json.mjs (lines ~7-16):
   the script intentionally emits a single SPA catch-all rewrite and relies on
   Vercel's filesystem-first serving of prerendered dist/<route>/index.html files
   (the accurate explanation already exists at lines ~133-146). Make the header
   match reality.
Verification: pnpm build twice (should be deterministic), pnpm lint,
pnpm typecheck.
```

### 2.5 Photo upload pipeline (biggest cost and speed lever)

**Problem.** `src/lib/uploadFile.js` is the single upload path for all photos. It validates MIME and a 10 MB cap but never resizes; galleries then serve up-to-10 MB originals via `getPublicUrl` (line 159). This is the largest storage/egress cost driver and a mobile LCP hazard for an app whose content is photos.

**Definition of done.** Client-side downscale to a sane ceiling (about 1600px long edge, WebP, quality ~0.82) before upload, with EXIF orientation respected; list/grid views request transformed/thumbnail URLs; existing full-size images still render.

**Prompt:**

```
[Standing Guardrails block here]

Task: add client-side image resizing to Geck Inspect's single upload path and
thumbnail rendering to its galleries.

Facts: src/lib/uploadFile.js is the one upload function (MIME check + 10 MB cap,
no resize), storing originals in Supabase Storage and serving via getPublicUrl
(~line 159). Gecko photos are the app's dominant content; galleries currently
load originals.

Do this:
1. In uploadFile.js, before upload: decode with createImageBitmap (fall back to an
   <img> + canvas path for Safari), downscale so the long edge is <= 1600px, and
   re-encode to WebP at ~0.82 quality via canvas.toBlob. Skip re-encoding when the
   file is already smaller than 400 KB and within dimensions. Preserve GIFs
   unmodified. Keep the 10 MB pre-resize cap as a hard reject.
2. Export a getTransformedUrl(path, { width }) helper that uses Supabase Storage
   image transformations (render/image endpoint) when available, falling back to
   the public URL. Adopt it in the highest-traffic grids: the MyGeckos collection
   grid (src/components/my-geckos/), the public gallery components
   (src/components/gallery/), and GeckoCard-style thumbnails. Do not try to
   convert every consumer; list the ones you changed.
3. Storage math depends on bytes uploaded; confirm the storage usage meter
   (src/lib/usageMeter.js / StorageUsageCard) still reports correctly with the
   smaller files.
Verification: pnpm lint && pnpm typecheck && pnpm build; in pnpm dev, upload a
large photo and confirm the stored object is a downscaled WebP and grids load
thumbnails.
```

### 2.6 Small infra fixes (batch)

**Prompt:**

```
[Standing Guardrails block here]

Task: a batch of small, independent infra fixes. Do each as its own commit.

1. src/lib/supabaseClient.js (~lines 3-9) inlines the prod project URL and anon
   key as fallbacks, so a misconfigured env silently points builds at prod. Make
   both env vars required: throw a clear startup error when missing in dev, and
   keep a build-time check. Same treatment for the hardcoded test_ RevenueCat key
   fallback in src/lib/revenuecat.js (~line 22).
2. src/lib/revenuecat.js (~line 17) statically imports @revenuecat/purchases-capacitor
   into the web bundle. Convert the native SDK to a dynamic import() executed only
   when Capacitor.getPlatform() !== 'web', keeping the web SDK path unchanged.
3. Dynamic-import jspdf and html2canvas at the click handlers that trigger
   exports instead of top-of-module (grep src/ for "from 'jspdf'" and
   "from 'html2canvas'"; src/lib/exportUtils.js is the main one). Confirm
   src/Layout.jsx and anything else eagerly loaded imports none of: recharts,
   jspdf, html2canvas.
4. src/pages/BlogPost.jsx (~line 211) renders post.contentHtml with
   dangerouslySetInnerHTML. Add sanitization at render (DOMPurify, new dep) since
   the HTML originates from an LLM pipeline. Check src/pages/Home.jsx's
   dangerouslySetInnerHTML uses (~lines 474-544, 672): if their inputs are static
   local config, leave them but add a one-line comment noting the data must stay
   static.
5. src/lib/AuthContext.jsx runs buildUser twice on initial load (getSession at
   ~line 39 plus INITIAL_SESSION from onAuthStateChange at ~line 62). Gate so only
   one enrichment runs on boot.
6. Fix the dead UI state flagged by lint: src/pages/AnimalPassport.jsx
   (~458, 515) has copied/copyLink wired but unused (the copy-link button does
   nothing visible); src/pages/ImageImport.jsx (~30, 34) has processing/importing
   state never rendered (no loading indicator). Wire them into the JSX properly.
7. Decide the react-query question by deleting: only one file uses it while 21
   call supabase directly. Remove @tanstack/react-query and its provider unless
   you find real usage beyond one file (grep useQuery/useMutation/QueryClient).
   Note in your summary that standardizing data fetching is a separate future
   task.
Verification after each: pnpm lint && pnpm typecheck && pnpm build.
```

---

## 4. Phase 3: Dead code and redundancy cleanup

**STATUS: COMPLETED 2026-07-07.** Notes:
- 3.1: fresh greps caught two stale audit claims before deleting: `MorphGuideComment` the entity is still live (admin ContentModeration imports it from `@/entities/all`), so only the redundant shim file was removed; and removing `Passport.jsx` fully orphaned `innovations/GeckoPassport.jsx` (both its exports), which was deleted too. Also removed the four unused UI primitives + their four deps, and archived the root `base44/` snapshot to `docs/archive/base44/`. Build/tests/lint stayed green throughout.
- 3.2: done as a safe first increment, NOT a big-bang rewrite. `KNOWN_MORPH_SLUGS` now derives from the morph guide (it had already drifted, missing `cream`). The six catalogues use three id schemes and genuinely different morph sets, and the genetics dimension is already CI-checked, so the full consolidation is staged in `docs/specs/morph-catalogue-consolidation.md` rather than forced in one risky pass.
- 3.3: analysis only, delivered as `docs/specs/storefront-consolidation.md`. Recommends one public storefront (`Breeder.jsx`) + one editor (`MyStore.jsx`), with an ordered, publicly-safe execution plan. No storefront code was changed.

All findings verified by import-graph greps. The "do not remove" list at the end matters as much as the deletions.

### 3.1 Confirmed-dead deletion sweep

**Evidence.** Zero importers/routes verified for each: `src/pages/Passport.jsx` (orphaned older passport page; live ones are `AnimalPassport.jsx` and `PassportQR.jsx`); the whole `src/components/morph-guide/` dir (3 files; the live `MorphGuide.jsx` page defines its own `MorphCard` locally at line 112 and imports from the sibling `morphguide/` dir, no hyphen, which stays); `src/api/entities.js`; `src/api/integrations.js`; entity shims `src/entities/{Gecko,ForumPost,Notification,PageConfig,MorphReferenceImage,MorphGuideComment}.js`; shadcn primitives `drawer.jsx`, `input-otp.jsx`, `carousel.jsx`, `resizable.jsx` with their sole deps `vaul`, `input-otp`, `embla-carousel-react`, `react-resizable-panels`; the empty root dirs `eyeinthesky/` and `claude-seo/`; and the root `/base44/` snapshot dir (reference-only archive of the pre-migration backend, not part of the build).

**Prompt:**

```
[Standing Guardrails block here]

Task: dead-code deletion sweep. Each numbered group is one commit. Before deleting
anything, re-verify with a grep that nothing imports it (search for the filename,
the path with and without the @/ alias, and any named exports).

1. Delete src/pages/Passport.jsx (orphan; not in src/pages.config.js nor routed in
   src/App.jsx; superseded by AnimalPassport.jsx + PassportQR.jsx). Also remove
   the now-stranded GeckoPassportViewer named export from
   src/components/innovations/GeckoPassport.jsx if its only consumer was this page.
2. Delete src/components/morph-guide/ (MorphCard.jsx, MorphDetail.jsx,
   CommentSection.jsx). CAUTION: src/components/morphguide/ (no hyphen, contains
   RotatingMorphImage.jsx) is LIVE, imported by src/pages/MorphGuide.jsx. Do not
   touch it. Also delete src/entities/MorphGuideComment.js (its only importer was
   the dead CommentSection).
3. Delete src/api/entities.js and src/api/integrations.js (zero importers; verify
   src/integrations/Core.js is still imported elsewhere before touching anything
   in src/integrations/).
4. Delete dead one-line entity shims: src/entities/Gecko.js, ForumPost.js,
   Notification.js, PageConfig.js, MorphReferenceImage.js. Keep src/entities/all.js
   (heavily used) and the live shims User.js, DirectMessage.js, GeckoImage.js,
   MorphGuide.js.
5. Delete unused shadcn primitives src/components/ui/{drawer,input-otp,carousel,
   resizable}.jsx and remove their npm deps vaul, input-otp, embla-carousel-react,
   react-resizable-panels from package.json (re-grep each for dynamic usage
   first). Keep react-day-picker (calendar.jsx has a real consumer).
6. Move the root base44/ directory (old backend entity schemas and Deno function
   snapshots, not part of the Vite build) to docs/archive/base44/ with a one-line
   README saying what it is, or delete it if git history is considered archive
   enough; prefer the move. Delete the empty root dirs eyeinthesky/ and
   claude-seo/ if present (they are untracked local strays).
7. Rename hazard cleanup, comments only: src/api/base44Client.js is a LIVE
   Supabase facade with a misleading name and stale base44.app URLs in its header
   comment (lines ~8-16). Fix the header comment to describe what it actually is.
   Renaming the file/export itself touches dozens of imports; skip that for now.

DO NOT remove: vendor/crested-gecko-app-0.1.0.tgz (live Foundation Genetics
engine), src/api/base44Client.js, src/entities/all.js, src/components/morphguide/,
any of the six morph data catalogues.
Verification after each commit: pnpm lint && pnpm typecheck && pnpm build.
```

### 3.2 Consolidate the six morph catalogues

**Problem.** Six parallel morph/trait data sources exist, each live, each with its own naming: `src/data/morph-guide.js`, `src/lib/morphUtils.js`, `src/components/morph-id/morphTaxonomy.js` (partly backed by the Foundation Genetics engine), `src/lib/marketAnalytics/taxonomy.js`, `src/components/morph-visualizer/data/*`, and `src/components/my-geckos/morphTagCatalog.js`. Nothing is dead; the hazard is six sources of truth for morph names, categories, and inheritance that must be manually kept in sync (the CI genetics-drift check guards only part of this).

**Definition of done.** One canonical morph registry module (id, display name, slug, category, inheritance, aliases) that the other five import from, with per-surface extensions (price tiers, visualizer traits, tag groupings) layered on top rather than duplicated. `check-genetics-consistency.mjs` still passes.

**Prompt:**

```
[Standing Guardrails block here]

Task: consolidate Geck Inspect's six parallel morph catalogues into one canonical
registry with per-surface extensions. This is a refactor, not a content change:
zero user-visible differences.

The six sources and their consumers:
1. src/data/morph-guide.js (INHERITANCE, PRICE_TIERS, getMorph) -> MorphDetail,
   MorphTaxonomyHub, MorphGuide, ProjectLineDetail, lib/morphFaq.js
2. src/lib/morphUtils.js (morphSlug, pickBestMorphRecord, KNOWN_MORPH_SLUGS) ->
   MorphDetail, MorphGuide
3. src/components/morph-id/morphTaxonomy.js (ML taxonomy, snake_case ids, partly
   from the crested-gecko-app vendor package) -> Training, Recognition,
   gecko/VisualSiblings
4. src/lib/marketAnalytics/taxonomy.js (HIGH_VALUE_COMBOS, REGIONS, AGE_CLASSES)
   -> market-analytics components
5. src/components/morph-visualizer/data/{traits,presets,genetics}.js ->
   MorphVisualizer
6. src/components/my-geckos/morphTagCatalog.js (MORPH_CATEGORIES, ALL_MORPHS) ->
   MorphIDSelector

Plan of attack:
1. Read all six plus scripts/check-genetics-consistency.mjs (CI runs it; it
   compares curated surfaces against the Foundation Genetics engine in
   vendor/crested-gecko-app). The engine is the inheritance source of truth.
2. Create src/data/morphRegistry.js: for every morph/trait, { id (snake_case,
   matching morphTaxonomy ids), displayName, slug (matching morphUtils slugs),
   category, inheritance (from the engine where covered), aliases[] }. Generate
   the initial content from the union of the six sources; where names disagree,
   the morph-guide.js display name wins and others become aliases.
3. Convert sources 2, 3, and 6 to derive their exports from the registry (keep
   their public APIs identical so consumers do not change). Sources 1, 4, 5 keep
   their surface-specific data (guide prose, price tiers, visualizer layers) but
   import identity fields (name/slug/id/inheritance) from the registry.
4. Extend scripts/check-genetics-consistency.mjs to also assert every registry
   entry with engine coverage matches the engine, so drift fails CI.
Verification: pnpm lint && pnpm typecheck && pnpm build (build runs the genetics
check and the morphs CSV generator; both must pass). Spot-check /MorphGuide, a
/MorphGuide/<slug> detail page, the MorphIDSelector in the add-gecko form, and
/Recognition in pnpm dev.
```

### 3.3 Storefront cluster decision

**Problem.** Five overlapping "breeder selling" pages exist (`Store.jsx` supplies store, `StorePage.jsx` public breeder storefront, `MyStore.jsx` storefront editor, `BreederStorefront.jsx`, `Breeder.jsx` public breeder page) plus three marketplace routes for two real pages (`Marketplace.jsx` is a tab shell re-rendering `MarketplaceBuy`/`MarketplaceSell`, which are also independently routed). This is a product decision more than a code one, and it interacts with the "breeder mini-site" big swing in section 8, so the prompt below is an analysis task, not a refactor.

**Prompt:**

```
[Standing Guardrails block here]

Task: analysis only, no code changes. Map Geck Inspect's five overlapping
breeder-selling surfaces and recommend a consolidation.

Read: src/pages/Store.jsx (customer supplies store, /Store/*), StorePage.jsx
(public breeder storefront /store/:slug), MyStore.jsx (breeder edits own store),
BreederStorefront.jsx, Breeder.jsx (public breeder page), plus
src/components/{store,storefront,marketplace,morph-market}/ and the routes in
src/App.jsx and src/pages.config.js. Also note Marketplace.jsx is a tab shell
around MarketplaceBuy/MarketplaceSell which are ALSO routed standalone.

Deliver a markdown report: (1) what each page actually renders and which tables
it reads/writes, (2) which are reachable from nav (cross-check
src/lib/navItems.js and the command palette), (3) real usage signals if any
(posthog captures, notification producers), (4) a recommended end state with ONE
public breeder page and ONE seller-management page, listing which files merge,
which redirect, and which delete, (5) migration risk notes for any URLs already
shared publicly (storefront slugs, QR codes). Write the report to
docs/specs/storefront-consolidation.md.
```

---

## 5. Phase 4: UX and workflow

**STATUS (2026-07-09): 4.1, 4.3, 4.5 shipped. 4.2 and 4.4 open.**
- 4.1 (morph ID to collection) shipped: Recognition now offers "Add to my collection", building a pre-filled draft (photos, mapped morph tags, AI notes) that MyGeckos opens in the add form; guest path via sessionStorage; funnel events added.
- 4.3 (onboarding split) shipped: a first-run role prompt sets Keeper mode, and the tour filters breeder-only tiles in Keeper mode.
- 4.5 (a11y) shipped: EnclosureClimate carries non-color status words; the Expert/Admin badges already had text labels.
- 4.2 (nav rationalization) PARTIAL: the safe slice shipped, all 8 orphaned pages (BatchHusbandry, ImageImport, PrintableWorksheets, Pedigree, BreedingROI, BreedingLoans, GeckAnswers, MorphGuideSubmission) are now reachable via the command palette. The risky part (unifying the three nav taxonomies into one registry, Dashboard sidebar tile) is deferred to a focused session with runtime verification, since a nav-render bug affects every page.
- 4.4 (loading/empty states) DEFERRED: diffuse and lower-value; the two highest-traffic list pages (MyGeckos, Breeding) already have empty states, and the rest are reference/tool pages or complex renderers (Lineage) where insertion is risky for modest gain.

### 4.1 Connect the hero funnel: AI morph ID into the collection

**Problem.** The single best acquisition feature dead-ends. `Recognition.jsx` runs the real `recognize-gecko-morph` edge function (line 82) and renders analysis plus similar geckos, but there is no "add this gecko to my collection" handoff; `GeckoForm.jsx` has manual morph tags (line 822) and never consumes the recognition result. A new user's magic moment ends with retyping what the AI just told them.

**Definition of done.** From a recognition result: one button creates a pre-filled gecko (photo attached, morph tags applied, confidence noted) for signed-in users, or routes guests into signup with the result preserved and applied after auth. PostHog events fire at each step.

**Prompt:**

```
[Standing Guardrails block here]

Task: connect Geck Inspect's AI morph ID result to the add-gecko flow.

Facts:
- src/pages/Recognition.jsx calls the recognize-gecko-morph edge function
  (~line 82) and renders identified morphs; it can save training corrections but
  offers no path into the user's collection.
- src/components/my-geckos/GeckoForm.jsx has a MorphIDSelector for manual tags
  (~line 822). Morph ids in the recognition taxonomy are snake_case
  (src/components/morph-id/morphTaxonomy.js); the tag catalog is
  src/components/my-geckos/morphTagCatalog.js. Check id/name mapping carefully
  (normalizeMorphText.js has alias helpers).
- Guest mode exists (enterGuestMode in the auth context); guests can run
  recognition but cannot save.

Do this:
1. On the Recognition result card, add a primary button "Add to my collection".
   Signed in: navigate to the MyGeckos add flow with the analysis passed via
   router state (image URL or file reference, morph tags mapped to the tag
   catalog's ids, plus the raw confidence scores), and pre-fill GeckoForm from
   that state: photo attached, morph tags pre-selected, a note like "Morph ID by
   Geck Inspect AI (confidences: ...)" in the notes field. The user reviews and
   saves; respect the existing plan-limit checks.
2. Guest: the same button routes to AuthPortal with a post-auth redirect that
   restores the pending analysis (persist it in sessionStorage) and lands them in
   the pre-filled form. Test the round trip.
3. Instrument with the existing captureEvent helper (src/lib/posthog.js):
   morph_id_run, morph_id_add_to_collection_clicked, morph_id_gecko_saved,
   with is_guest and morph count properties.
4. Keep the em-dash rule in all new copy.
Verification: pnpm lint && pnpm typecheck && pnpm build; full manual run of both
paths in pnpm dev.
```

### 4.2 Navigation and IA rationalization

**Problem.** Three taxonomies disagree (DB/`FALLBACK_NAV_ITEMS` categories in `src/lib/navItems.js:96-127`, the two-section Manage/Discover model at lines 22-25, and the command palette's third grouping in `CommandPalette.jsx:33-72`). Nine real routed pages are reachable only by typing the URL: BreedingROI, BreedingLoans, BatchHusbandry, PrintableWorksheets, MorphGuideSubmission, TrainModel, ImageImport, GeckAnswers, Pedigree (the tutorial even advertises GeckAnswers, `TutorialModal.jsx:113`, with no way to click to it). Dashboard, the designated home base, has no nav tile (`SECTION_FOR_PAGE` omits it, `navItems.js:31-90`) and is reachable only via the logo.

**Definition of done.** One taxonomy definition consumed by the sidebar, the sections model, and the command palette. Every routed page is either reachable from nav/palette or explicitly retired. Dashboard has a home tile.

**Prompt:**

```
[Standing Guardrails block here]

Task: rationalize Geck Inspect's navigation so one taxonomy drives all three nav
surfaces and no live page is unreachable.

Facts:
- src/lib/navItems.js defines SECTIONS (manage/discover, lines ~22-25),
  SECTION_FOR_PAGE (~31-90), FALLBACK_NAV_ITEMS (24 items, ~96-127), and a Keeper
  mode filter (~139-169). src/Layout.jsx renders a 2-tab header + per-section
  sidebar (~756-757, 1275-1364) and admin-configurable nav via PageConfig
  (~630-710). src/components/command-palette/CommandPalette.jsx hardcodes a THIRD
  grouping of 27 pages (~33-72).
- Nine routed, real pages have no nav entry anywhere: BreedingROI, BreedingLoans,
  BatchHusbandry, PrintableWorksheets, MorphGuideSubmission, TrainModel,
  ImageImport, GeckAnswers, Pedigree. The tutorial mentions GeckAnswers
  (TutorialModal.jsx ~113) but there is no link to it.
- Dashboard has no tile in either section (only the logo reaches it).

Do this:
1. In navItems.js, build a single NAV_REGISTRY: every user-facing page with
   { page, label, icon, section (manage|discover), group (for palette),
   keeperVisible, breederVisible, adminOnly }. Derive FALLBACK_NAV_ITEMS,
   SECTION_FOR_PAGE, and the command palette groups from it. Delete the palette's
   hardcoded list and import from the registry.
2. Place the nine orphans: Pedigree, BatchHusbandry, BreedingROI, BreedingLoans
   belong under Manage grouped near Breeding (consider a "Breeding tools"
   sub-group or a tools row on the Breeding page itself rather than nine sidebar
   tiles); GeckAnswers under Discover; PrintableWorksheets under Manage;
   MorphGuideSubmission linked from the MorphGuide page header; TrainModel and
   ImageImport are power/admin utilities: palette-only entries, not sidebar.
3. Give Dashboard a Home tile pinned at the top of both sections.
4. Keep the admin PageConfig override working (it merges over the registry) and
   keep Keeper mode filtering, but review its default: it stays opt-in for now.
5. Do not add sidebar clutter: the sidebar per section should not exceed ~12
   items; use grouping headers.
Verification: pnpm lint && pnpm typecheck && pnpm build; click through every
registry entry in pnpm dev, both sections, keeper mode on and off, plus the
command palette.
```

### 4.3 Onboarding split: keeper vs breeder first-run

**Problem.** The auto-tutorial fires 1.5s after first load (`Layout.jsx:166-174`) and walks every user, including pure keepers, through about ten breeder/business tiles (`TutorialModal.jsx:197-257`). Keeper mode, which hides that surface (`navItems.js:139-169`), is off by default and buried in Settings. 80%+ of the market is keepers, per STRATEGY.md.

**Definition of done.** First-run asks one question ("Do you breed, or keep?"), sets Keeper/Breeder mode from the answer, and plays a mode-appropriate tour (keeper: add gecko, care logging, morph ID, care guide; breeder: full). Mode is switchable in Settings as today.

**Prompt:**

```
[Standing Guardrails block here]

Task: split Geck Inspect's first-run onboarding by audience.

Facts: src/Layout.jsx auto-opens the tutorial ~1.5s after first authenticated
load (~lines 166-174). src/components/tutorial/TutorialModal.jsx anchors a
walkthrough to every sidebar tile including breeding/business pages. Keeper mode
exists (src/lib/navItems.js ~139-169, toggled in Settings) and hides
breeder-oriented nav, but defaults off. Strategy: most users are keepers, not
breeders.

Do this:
1. Before the tour, show a single-question step: "How do you keep cresties?"
   with two big options: "I keep them as pets" and "I breed them" (plus a small
   "both/not sure" that maps to breeder). Persist the answer to the same
   preference field Keeper mode uses today, so nav filters immediately.
2. Build two tour scripts from the existing steps: keeper tour = Dashboard,
   MyGeckos + add-first-gecko, care/feeding logging, AI Morph ID, CareGuide,
   Settings; breeder tour = current full sequence. Reuse the anchoring mechanics;
   only the step lists differ.
3. If the user later flips modes in Settings, offer (do not force) the other
   tour.
4. Instrument: onboarding_role_selected {role}, tutorial_completed {role, steps}.
5. All new copy: crested-gecko-specific, no em dashes.
Verification: pnpm lint && pnpm typecheck && pnpm build; run both first-run paths
in pnpm dev with a fresh account/localStorage.
```

### 4.4 Loading, empty, and feedback states

**Problem.** 42 pages use bare spinners, 4 use Skeleton; `EmptyState` is imported by only 10 of ~61 pages. New users on a young platform see mostly blank or spinning screens, which reads as broken.

**Prompt:**

```
[Standing Guardrails block here]

Task: raise the floor on loading and empty states across Geck Inspect's ten
highest-traffic pages: Dashboard, MyGeckos, Breeding, Lineage, MorphGuide,
Recognition, Membership, CommunityConnect, GeckoDetail, MarketplaceBuy.

For each page: (1) replace full-page spinners with layout-shaped skeletons using
the existing Skeleton primitive (src/components/ui/skeleton.jsx) so the page
structure is visible while loading; (2) ensure every list/grid has a real empty
state using the shared EmptyState component (grep src/components/shared/ for it):
an icon, one sentence of crested-gecko-specific copy, and a primary action (e.g.
MyGeckos empty -> "Add your first gecko"; Breeding empty -> "Plan your first
pairing"; Lineage empty -> "Add parents to a gecko to grow your first family
tree"); (3) confirm fetch failures render an error state with a retry, not a
permanent spinner (grep each page for empty catch blocks and unawaited promises
while you are there and fix what you find).
Keep diffs per page small; one commit per page. No em dashes in any copy.
Verification: pnpm lint && pnpm typecheck && pnpm build; view each page in
pnpm dev with an empty account and with data.
```

### 4.5 Accessibility pass (small, bounded)

**Prompt:**

```
[Standing Guardrails block here]

Task: bounded accessibility fixes in Geck Inspect.

1. src/Layout.jsx renders Expert/Admin status as color-only glyphs (~lines
   1017-1018, 1183-1184) and the guest "view only" badge as a small color pill
   (~847-854). Add visible text labels or aria-labels plus a non-color cue
   (icon shape) to each.
2. Sweep icon-only buttons missing aria-label in src/Layout.jsx and
   src/components/my-geckos/ (most header buttons already have labels; fix the
   stragglers you find by grep for <Button variant="ghost" size="icon" without
   aria-label).
3. src/components/iot/EnclosureClimate.jsx encodes temp/humidity status by color
   band alone; add text status words (Good / Low / High).
Verification: pnpm lint && pnpm typecheck && pnpm build.
```

---

## 6. Phase 5: Marketing and conversion

**STATUS (2026-07-09): 5.2, 5.4, 5.6 shipped; 5.5 mostly shipped. 5.1 and 5.3 need input/capability.**
- 5.2 (funnel instrumentation) shipped: landing/guest/login/membership/checkout/upgrade/first-gecko events, with ProductAnalytics funnel descriptions updated to the real event names.
- 5.4 (pricing memo) shipped: docs/specs/pricing-decision-2026-07.md plus proposed DECISIONS.md entry 27 (keep Keeper $2.99, raise Breeder to $9.99). Needs Tennyson's decision to execute.
- 5.5 (content) 2 of 3 posts shipped: "Your First Crested Gecko Breeding Season" and "Crested Gecko Breeding Records" (the "how to read a pedigree" post remains).
- 5.6 (doc hygiene) shipped: banned-domain refs neutralized, cretti-briefing em dashes removed.
- 5.1 (product screenshots) OPEN, NEEDS CAPTURE: requires driving the running app with demo data and capturing 8 real screens (Playwright). Highest single landing-page fix, but it needs a real UI to photograph.
- 5.3 (landing conversion) PARTIALLY BLOCKED: the pricing strip, Pricing nav link, data-ownership line on Membership, and brand-casing fix are all doable autonomously; the founder block specifically needs Tennyson's real bio/brand facts (must not be invented).

The growth reports show the honest baseline: about 15 homepage views a week, zero search clicks, rankings on page 1-2 for several money terms with 0% CTR. The product cannot convert visitors it does not show anything to.

### 5.1 Ship the product screenshots (highest-impact single fix)

**Problem.** `public/screenshots/` contains only a README; `ProductTour` self-hides when no image loads (`ProductTour.jsx:62`), so the landing page shows zero product visuals. The 8-slide manifest already exists (`src/data/product-tour.js`). INTENT.md's own research: show the product, don't describe it.

**Definition of done.** Eight real screenshots (crested gecko content only, demo data allowed but realistic morph names) at the manifest's expected paths, optimized (WebP, sized for their container), and the tour renders on the landing page.

**Prompt:**

```
[Standing Guardrails block here]

Task: populate Geck Inspect's landing-page product tour with real screenshots.

Facts: src/data/product-tour.js defines 8 slides expecting images in
/public/screenshots/ (read it for exact filenames and captions);
public/screenshots/ contains only a README; src/components/landing/ProductTour.jsx
hides itself when images are missing (~line 62).

Do this:
1. Run the app (pnpm dev) seeded with guest/demo mode (it has mock collection
   data). For each of the 8 slides, navigate to the relevant screen and capture a
   clean screenshot with Playwright (Chromium is preinstalled; use a 1440x900
   viewport for desktop shots and 390x844 for any mobile-framed slide). Demo data
   must look real: crested gecko morph names (Lilly White, Cappuccino, Harlequin,
   Axanthic), no lorem ipsum, no empty tables. If a screen looks empty or broken
   in guest mode, fix the demo seed rather than skipping the slide.
2. Export as WebP, target under 150 KB each, at 2x the rendered container size
   (check ProductTour.jsx CSS for dimensions).
3. Confirm the tour renders on / and the captions match what the images show;
   update captions in product-tour.js if reality differs (no em dashes).
4. Add a build-time guard: a small check in scripts/seo-audit.mjs (or a new tiny
   script in the build chain) that warns when a manifest entry's image file is
   missing, so this never silently regresses.
Verification: pnpm build, then serve dist and view the landing page.
```

### 5.2 Instrument the conversion funnel

**Problem.** PostHog is installed but no signup/upgrade funnel events exist: no `signup_started/completed`, `guest_mode_entered`, `membership_viewed`, `checkout_started`. `ProductAnalytics.jsx:101` even defines a "Paid conversion funnel" dashboard with no events feeding it. INTENT.md's primary metric (started sign-up rate) is unmeasurable today.

**Prompt:**

```
[Standing Guardrails block here]

Task: instrument Geck Inspect's core conversion funnel in PostHog.

Facts: posthog-js is wired via src/lib/posthog.js (captureEvent helper) and a
PostHogPageTracker; existing events cover store/giveaway/gecko-add only.
src/components/admin/ProductAnalytics.jsx (~line 101) describes a "Paid
conversion funnel" with no events feeding it.

Add events (use captureEvent, snake_case, minimal properties):
- landing_cta_clicked {cta: 'hero'|'bottom'|'nav', target: 'guest'|'signin'}
  in src/pages/Home.jsx
- guest_mode_entered (auth context enterGuestMode)
- signup_started (AuthPortal form focus/submit start), signup_completed (first
  successful session after signup; check AuthContext for the right hook),
  login_completed
- membership_viewed (Membership mount), plan_selected {tier, interval},
  checkout_started {tier, interval} (the stripe-checkout invoke),
  checkout_completed if a success redirect/param exists (grep Membership.jsx for
  the post-checkout return path)
- upgrade_prompt_shown / upgrade_prompt_clicked {source} in
  PlanLimitChecker's limit-hit UI
- first_gecko_added (MyGeckos/GeckoForm: fire only when the save is the user's
  first gecko)
Also update ProductAnalytics.jsx's funnel description to list these event names
so the dashboard can be built in PostHog.
Respect posthog opt-out/consent handling already in src/lib/posthog.js. No
events on admin pages.
Verification: pnpm lint && pnpm typecheck && pnpm build; in pnpm dev with
PostHog debug, walk guest -> signup -> add gecko -> membership and confirm each
event fires once.
```

### 5.3 Landing page conversion fixes

**Problem.** Pricing is invisible (no section on Home, no Pricing link in header at `Home.jsx:311-327` or footer at 875-896). Social proof renders empty by design (`LiveStats` hides below 10, `Testimonials` below 3 approved rows). The founder story, which INTENT.md calls a structural trust mechanism, is absent (`About.jsx:68-116` names no one). The hero pill says "Welcome To The Geck OS" (brand jargon, `Home.jsx:336-338`) and brand casing wobbles between "Geck OS" and "geckOS" (`Home.jsx:352`, `About.jsx:114`). Data-ownership messaging exists on Home but not on Membership where the purchase decision happens.

**Prompt:**

```
[Standing Guardrails block here]

Task: landing page and pricing page conversion fixes for geckinspect.com.
Read docs/INTENT.md first; it is the design constitution for this page (5-second
test, one primary CTA, honesty over hype, specific claims over vague ones).

1. Pricing visibility: add a compact 3-tier pricing strip to src/pages/Home.jsx
   (Free / Keeper / Breeder with prices from src/lib/stripe-config.js and a
   "See full comparison" link to /Membership), and add a "Pricing" link to the
   Home header nav (~lines 311-327) and footer (~875-896).
2. Social proof: LiveStats (components/landing/LiveStats.jsx) hides below 10 per
   metric and Testimonials below 3 approved rows, so the page currently shows no
   proof. Keep the honesty thresholds. Add a founder block instead (INTENT.md
   section 4.2): first-person, named, with a photo placeholder at
   public/founder.jpg wired with a graceful hide-if-missing like ProductTour, one
   short paragraph on breeding cresties and why the app exists. IMPORTANT: do not
   invent biography facts; write the copy with [PLACEHOLDER: ...] markers for the
   breeding-operation name and years, and note in your summary that Tennyson must
   fill these before it renders (gate the section behind the photo existing).
3. Brand casing: pick "Geck OS" nowhere and "Geck Inspect" everywhere for the
   product name; the hero pill "Welcome To The Geck OS" (~336-338) becomes a
   species-first line such as "Built for crested geckos. Only crested geckos."
   Fix the "geckOS" string in Home.jsx (~352) and About.jsx (~114).
4. Data ownership at the point of purchase: add the "Your data is yours. Export
   everything to CSV anytime, on every plan." line to /Membership near the CTA
   buttons, matching the promise on Home (~line 386). Verify the export actually
   exists (grep for exportUtils / CSV export in Settings) and reference where it
   lives in the copy ("from Settings, anytime").
5. About page: name the founder (same placeholder discipline as item 2) and cut
   the anonymous "built by breeders" phrasing (About.jsx ~68-116).
All copy: crested-gecko-specific, specific claims over vague ones, no em dashes.
Verification: pnpm lint && pnpm typecheck && pnpm build (build includes the
strict SEO audit and prerender; both must stay green).
```

### 5.4 Pricing strategy review (decision memo, not code)

**Problem.** Keeper $2.99 and Breeder $5.99 sit below the market cluster ($4.99-$7.99 hobbyist, $9.99-$19 serious breeder per STRATEGY.md). Underpricing a premium-positioned product signals "hobby toy" against Breed Ledger and halves the revenue ceiling on a small TAM.

**Prompt:**

```
[Standing Guardrails block here]

Task: write a pricing decision memo for Geck Inspect. No code changes.

Inputs to read: src/lib/stripe-config.js (current: Free $0 with 10 geckos,
Keeper $2.99/mo or $30/yr, Breeder $5.99/mo or $60/yr, Enterprise $99.99/mo),
src/lib/tierLimits.js (what each tier actually gates), STRATEGY.md pricing
context (market clusters: hobbyist $4.99-7.99, serious breeder $9.99-19,
ops $49-99), ROADMAP.md item 2, docs/DECISIONS.md.

The memo (write to docs/specs/pricing-decision-2026-07.md) should cover:
1. Value-per-tier audit: what a Keeper and a Breeder actually get today that
   Free lacks, feature by feature, flagging anything currently broken or facade
   (marketplace sync enforcement, market analytics) that must be fixed before a
   price raise is defensible.
2. Three scenarios with revenue math at 100/500/2000 paying users: (a) keep
   current prices, (b) move to $4.99/$9.99 with grandfathering for existing
   subscribers, (c) keep Keeper cheap as a wedge but move Breeder to $9.99 and
   make it unmistakably worth it (MorphMarket sync, certificates, market data).
3. A recommendation with a migration plan (Stripe price creation,
   grandfathering rule, in-app announcement copy) and what must ship first.
4. Append the decision as a new numbered entry in docs/DECISIONS.md per that
   file's format.
No em dashes anywhere in the memo.
```

### 5.5 Content rebalance

**Problem.** 6 of 19 blog posts are Cappuccino-debate deep cuts; the roadmap's highest-intent beginner topic ("your first breeding season") is missing. Search Console shows impressions with zero clicks on "crested gecko pedigree tracker" (position 12.6), "gecko breeding records" (8.2), and calculator terms (6-11): ranking exists, click-through does not.

**Prompt:**

```
[Standing Guardrails block here]

Task: blog content rebalance for geckinspect.com.

Facts: 19 posts live in src/data/blog-posts.js (read one Cappuccino post first
to learn the exact shape: slug, keyphrase, TLDR callout, sections with
tables/callouts, FAQ pairs, internal links, citations). The blog pipeline docs
are docs/blog-style-guide.md and docs/blog-voice-examples.md; follow the voice.
Search Console (docs/growth-reports/2026-07-06.md) shows impressions but zero
clicks for: "crested gecko pedigree tracker" (pos 12.6, 42 impressions),
"gecko breeding records" (pos 8.2, 37), and the calculator cluster (pos 6-11).

Write THREE new posts targeting those gaps, one commit each:
1. "Your First Crested Gecko Breeding Season: A Month-by-Month Plan"
   (keyphrase: first crested gecko breeding season). The roadmap's missing
   beginner anchor. Cover pairing readiness (weight thresholds), introduction,
   lay cycles, incubation, hatchling care; internal-link to /Breeding features,
   the genetics calculator, and relevant MorphGuide pages.
2. "Crested Gecko Breeding Records: What to Track and Why" (keyphrase: gecko
   breeding records), positioned against spreadsheets, honest comparison,
   internal-link to the app's record features and the data-export promise.
3. "How to Read a Crested Gecko Pedigree" (keyphrase: crested gecko pedigree
   tracker), explaining lineage depth, het notation, and verification; link the
   Lineage and AnimalPassport features.
Each post: match the existing data shape exactly, 4+ FAQ pairs, 3+ internal
links, 2+ external citations to hobby authorities (ReptiFiles, Pangea, Repashy,
LMReptiles Foundation Genetics), crested-gecko examples only, no em dashes.
Then run the sitemap/llms builders via pnpm build and confirm the three slugs
appear in dist/sitemap.xml.
Also: update meta titles under 65 chars for the two existing pages ranking with
0% CTR if their titles exceed that (check the seo-audit output during build).
```

### 5.6 Doc hygiene sweep (em dashes and the banned domain)

**Problem.** Shipped copy is clean, but internal docs carry 338 em dashes (mostly generated reports) and root docs 169 more (`AUDIT_REPORT.md` 106). Two kaleidoscope docs reference the banned domain without a disclaimer, one as a citation that would read as founder-adjacent if ever published (`docs/kaleidoscope/GENETICS_GUIDE_CONTENT.md:257`, `KALEIDOSCOPE_INTEGRATION.md:269`).

**Prompt:**

```
[Standing Guardrails block here]

Task: documentation hygiene sweep.

1. Remove the two undisclaimed references to the banned domain: in
   docs/kaleidoscope/GENETICS_GUIDE_CONTENT.md (~line 257) replace the
   "Tenny's Crested Geckos. Crested Gecko Investment Guide 2025" citation with a
   neutral citation or delete it (this content could be published into the
   Genetics Guide; the citation must not survive that); in
   docs/kaleidoscope/KALEIDOSCOPE_INTEGRATION.md (~line 269) either delete the
   raw URL or annotate it with the standard "NOT Tennyson's site" disclaimer
   used in CLAUDE.md.
2. Fix em dashes in the HAND-AUTHORED root docs only: CLAUDE.md (2),
   cretti-briefing.md (61), and any in STRATEGY.md/ROADMAP.md. Use commas,
   periods, parentheses, or colons per the CLAUDE.md substitution rules. SKIP
   generated artifacts (docs/growth-reports/, docs/seo-audits/,
   docs/blog-reports/, AUDIT_REPORT.md): they are historical output, and their
   generators are the real fix. Check scripts/growth-report.mjs and
   scripts/seo-audit.mjs for em dashes in their template strings and fix the
   templates so future reports are clean.
Verification: grep -rn $'\u2014' scripts/*.mjs CLAUDE.md STRATEGY.md ROADMAP.md
cretti-briefing.md returns nothing; pnpm build stays green.
```

---

## 7. Phase 6: Mobile

**STATUS (2026-07-09):** the PWA install prompt already ships (`InstallAppButton` in Layout, handling `beforeinstallprompt`/`appinstalled`/standalone; manifest present). The offline caching service worker is DEFERRED by decision (DECISIONS.md entry 28): a caching SW is the highest-risk, hard-to-reverse change and must be built on a preview branch with device testing of the install/update/offline lifecycle, not shipped blind. The current `public/sw.js` is deliberately push-only.

### 6.1 Decide the Android story honestly

**Problem.** The Capacitor Android shell exists, but push cannot work in it: the stack is Web Push/VAPID only (`supabase/functions/send-push/index.ts`), there is no FCM anywhere in `android/`, and `@capacitor/push-notifications` is not installed. The Android System WebView does not support the Web Push API. Meanwhile `public/sw.js:4-6` intentionally disables offline caching, so the installed app is a browser tab that dies without signal. `capacitor.config.ts` comments imply App Store shipping but no `ios/` dir exists.

**Definition of done.** A decision (documented in DECISIONS.md) between: (a) invest in the native shell (add FCM push, offline cache, RevenueCat Capacitor billing per the ROADMAP appendix), or (b) park the shell and go PWA-first (service worker offline for the collection, install prompts, honest messaging). Then execute the chosen path. Given a solo founder and the ROADMAP's own recommendation ("ship the PWA in 30-45 days"), (b) first is the sane default.

**Prompt (for path b, PWA-first):**

```
[Standing Guardrails block here]

Task: make Geck Inspect a real PWA with offline support for the core collection
flows, and align messaging with reality.

Facts: public/sw.js currently no-ops by design (comment at lines 4-6);
public/manifest.json exists (start_url /MyGeckos, standalone). The Capacitor
Android shell cannot receive push (Web Push only, no FCM) and has no offline
support; do not touch android/ in this task.

Do this:
1. Replace sw.js with a versioned cache strategy: precache the app shell
   (index.html, the hashed JS/CSS entry chunks; integrate with Vite's manifest
   at build time via a small build script that injects the asset list),
   stale-while-revalidate for static assets and gecko photos, network-first for
   Supabase API calls. Bump-on-deploy cache versioning; the existing PWA-launch
   redirect in src/App.jsx (~202-214) suggests stale-icon pain, so make update
   flow explicit: detect a waiting SW and show a "Update available" toast that
   calls skipWaiting.
2. Offline read for the collection: cache the user's gecko list and photos so
   /MyGeckos and GeckoDetail render read-only offline with an "offline" banner.
   Full offline writes (queued mutations) are OUT of scope; add a visible
   "You're offline, changes are disabled" state instead of failing silently.
3. Add an install prompt affordance: capture beforeinstallprompt, show a
   dismissible "Install Geck Inspect" card on Dashboard after the user's second
   session (localStorage counter).
4. Test with Playwright: load the app, go offline (context.setOffline), confirm
   MyGeckos still renders from cache.
5. Documentation: append a DECISIONS.md entry (per its format) recording
   PWA-first, Android shell parked until FCM push + Capacitor billing are
   scheduled, iOS not started; and fix the capacitor.config.ts comment that
   implies App Store shipping today.
Verification: pnpm lint && pnpm typecheck && pnpm build; Playwright offline test
passes; Lighthouse PWA installability check passes against a served dist build.
```

---

## 8. Big swings: what would make it shine

Ranked by leverage. Each respects the crested-gecko-first identity and the five STRATEGY.md questions.

### 8.1 Shareable Morph ID cards (viral loop on the existing wedge)

The AI morph ID is the only feature with mass-market pull for the 80% keeper audience, and it is already built. After Phase 4.1 connects it to the collection, add a share artifact: every recognition result generates a beautiful card (gecko photo, identified morphs with confidence bars, "Identified by Geck Inspect" and a QR to the app) rendered server-side or via canvas, with a public URL and proper OG tags so it unfurls on Instagram/Reddit/Discord where the hobby lives. Every shared card is an ad with built-in proof. This is cheap (the pieces exist: qrcode.react, html2canvas, prerendered OG routes) and it compounds. Measure: cards shared per ID, signups with a card referrer.

### 8.2 Community-powered live market index (turn the facade into the moat)

STRATEGY.md lists "live market analytics" as an open gap nobody owns; the audit found the current analytics are mock fixtures, but `MarketPricing.jsx` already collects real `morph_price_entries` from the community. Lean in: make submitting a sale price frictionless (photo optional, morph tags from the registry, price, date), seed it from public MorphMarket listing data where terms permit, and publish a free, public "Crested Gecko Price Index" page per morph ("What is a Lilly White worth right now?") updated weekly. Public and free is the point: it is the single most linkable, quotable asset the site could have (every "what's my gecko worth" Reddit thread becomes a citation), it feeds SEO for the exact commercial queries already ranking with zero clicks, and the underlying dataset becomes a defensible asset no one-year-old competitor can replicate. Gate the deep analytics (trends, comps, your-collection valuation) behind Breeder tier: that makes the tier finally self-evidently worth $9.99.

### 8.3 Verified digital pedigree as the trust standard

The pieces exist: animal passports, QR codes, ClaimAnimal, lineage trees, breeder verification. Nobody in the market owns "provenance" (STRATEGY.md gap 4), and MorphMarket's 2.7-star trust problem is the wedge. Productize it: a gecko's passport page becomes a public, verifiable pedigree certificate (breeder-signed, transfer history via claims, morph ID attached), and "Geck Inspect Verified Pedigree" becomes the badge breeders put in their MorphMarket listings, with the QR resolving to the live record. Network effects: every sold gecko carries the badge to a new keeper, who claims the animal, who becomes a user. This also is the honest version of ROADMAP item 13 (institutional play) that a solo founder can actually ship.

### 8.4 The breeder mini-site (Breed Ledger's pitch, done crested-first)

Breed Ledger's biggest pitch is breeder websites. Geck Inspect already has five half-overlapping storefront surfaces (Phase 3.3). Consolidate them into one polished public breeder page at a clean URL (geckinspect.com/b/rockstar-geckos or a subdomain): bio, available animals with verified pedigrees, past production, testimonials, inquiry button. It is a website builder scoped down to the one page breeders actually need, prerendered for SEO so each breeder page ranks for their own brand name. Every breeder page footer says "Powered by Geck Inspect." That turns customers into distribution.

### 8.5 Offline-first Expo Mode

Breeders' highest-stakes usage windows are reptile expos (NRBE Daytona, Tinley) with terrible connectivity. `FieldMode.jsx` already exists. Combine it with the PWA offline work (Phase 6.1) into a marketable "Expo Mode": offline collection access, quick sale recording (buyer, price, animal, queued until signal), QR passport display for buyers at the table. Then market it AT the expo the roadmap already commits to attending. It is the rare feature that is both a real moat (offline sync is genuinely hard to copy quickly) and a story ("built by someone who actually stands at a table in Daytona").

### 8.6 Conformation AI beta (the long game, start the data flywheel now)

ROADMAP item 8's Option A (structure grading AI) is correctly ranked highest-defensibility, and the infra exists: `export-training-corpus` and `embed-gecko-image` edge functions, the TrainModel page, embeddings per photo. Do not attempt grading yet; start collecting labels now. Add an optional "rate this gecko's structure" flow for verified/experienced breeders (crest coverage, head structure, build) on community photos, framed as a fun expert-community feature (leaderboard for raters, GSGC-style criteria). Twelve months of labels is the moat; the model is the easy part later. This is also the feature to pitch established breeders in the ROADMAP outreach item: their judging eye becomes the product's brain, with credit.

### 8.7 Genetics calculator as an embeddable widget

The calculator is category baseline, but nobody lets other sites embed one. Ship a lightweight embeddable version (iframe or web component) that any breeder blog, care sheet site, or forum can drop in, with "Powered by Geck Inspect" linking back. Costs little (the engine is the vendored package), earns backlinks from exactly the hobby-authority domains STRATEGY.md says matter, and plants the brand on competitor-adjacent turf.

### A note on what NOT to build

The audit found 83 pages for an app with about 15 weekly homepage views. The failure mode of this codebase is breadth. INTENT.md already says it: one audience, deeply served, beats many audiences, shallowly served. Before adding anything from section 8, finish Phases 1-5. Candidates for explicit deprecation rather than investment: OtherReptiles (dilutes the moat), the supplies Store (not the business), BreedingLoans (niche of a niche), and the shipping integration while it points at a nonexistent edge function.

---

## 9. Suggested sequencing

| Order | Item | Size | Why now |
|---|---|---|---|
| 1 | 1.1 Tier resolver unification | S | Paying users are throttled today |
| 2 | 1.2 Legacy /Subscription removal | S | Open paywall bypass |
| 3 | 1.3 Pricing/trial/feature reconciliation | M | Chargeback and trust risk |
| 4 | 2.1 Commit missing edge functions | M | All AI features depend on unversioned code |
| 5 | 1.5 Analytics honesty pass | M | Stop selling mock data |
| 6 | 5.1 Product screenshots | S | Landing page shows nothing today |
| 7 | 5.2 Funnel instrumentation | S | Cannot improve what is not measured |
| 8 | 2.3 Tests + RLS audit | M | Safety net before refactors |
| 9 | 3.1 Dead-code sweep | S | Cheap; shrinks every later diff |
| 10 | 4.1 Morph ID -> collection | M | The hero funnel |
| 11 | 4.2 Nav/IA rationalization | M | Makes 9 hidden features findable |
| 12 | 4.3 Onboarding split | M | Keeper market is 80% of TAM |
| 13 | 2.5 Photo pipeline | M | Biggest cost + speed lever |
| 14 | 5.3 Landing conversion fixes | M | Needs screenshots + founder input |
| 15 | 1.4, 2.4, 2.6, 4.4, 4.5, 5.6 | S each | Batch between larger items |
| 16 | 5.4 Pricing memo, 3.3 storefront analysis | S | Decisions before building |
| 17 | 3.2 Morph registry consolidation | L | After tests exist |
| 18 | 6.1 PWA offline | L | Feeds Expo Mode (8.5) before Daytona (Aug 15) |
| 19 | 5.5 Content rebalance | M | Parallel-friendly, anytime |
| 20 | Section 8 big swings | L | Only after the base is finished |

S = under a day for a capable agent plus review. M = 1-3 days. L = a week-plus.

Two dates matter: NRBE Daytona is August 15-16, 2026 (Expo Mode and the outreach items want to land before it), and Breed Ledger has been live since May 15 (every trust-facade finding above is ammunition for them if left unfixed).

---

## 10. Per-change verification checklist

For every hand-off prompt's output, before merging:

1. `pnpm lint && pnpm typecheck && pnpm build` all green (build includes sitemap, llms-full, morphs CSV, vercel.json generation, prerender, and the SEO audit).
2. `node scripts/check-genetics-consistency.mjs` passes for anything touching morph/genetics data.
3. Manual walk of the affected flow in `pnpm dev`, including the empty-account state.
4. Grep the diff for the em dash character (`grep $'\u2014'`) and the banned domain: both must be absent.
5. New user-facing copy passes the crested-gecko-first check: species named, real morph names, no generic "reptile" framing.
6. Diff size sanity: if a "small fix" prompt produced a 40-file diff, reject and re-scope.
