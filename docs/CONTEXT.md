# Geck Inspect: CONTEXT.md

> **Purpose of this file.** This is the factual, long-lived context for Geck Inspect. It answers the question *"what is this project, and what's the state of it right now?"* for any future collaborator (human or AI). It should not contain aspirational goals, strategy, or reasoning for decisions. Those live in `INTENT.md` and `DECISIONS.md`. When something material changes (stack, schema, pricing, ownership, critical file paths), update this file.

> **Last reconciled with the code: 15 October 2026** (sections 1 to 5 and 8, plan item E2 21 of `docs/planning/comprehensive-review-2026-10-14.md`). Each statement names the file it comes from, so the next reconcile can check it quickly. When the code and this file disagree, the code wins and this file gets fixed.

---

## 1. What Geck Inspect is

Geck Inspect is a web app for crested gecko (*Correlophus ciliatus*) keepers and breeders at `geckinspect.com`. It is built around crested gecko traits, genetics and records, not reptiles in general. One small exception exists: an "Other Reptiles" list (`src/pages/OtherReptiles.jsx`) lets members keep simple records for animals that are not geckos.

What a member can do today (pages in `src/pages`, menus in `src/lib/navItems.js`):

1. **Keep a record for each gecko.** Photos, weights with a healthy growth band, feedings, sheds, vet visits, notes, a status (Pet, Holdback, Future Breeder, Ready to Breed, Proven, For Sale, Sold and others) and an ID code. Field Mode and Batch Husbandry log care at the rack. Weigh-in and feeding reminders open a one-tap log at `/log` (`src/pages/QuickLog.jsx`). Field Mode and `/log` entries wait on the phone when there is no signal and sync later, saved once (`src/lib/offlineQueue.js`, `src/lib/offlineSync.js`).
2. **Breed and trace lineage.** Breeding plans with eggs and hatch dates (`Breeding`, `BreedingSeason`, `PairingPlanner`), multi-generation lineage (`Lineage`, `Pedigree`), passports with a QR code (`AnimalPassport`, `PassportQR`), and transfers where the buyer claims the animal with its history (`ClaimAnimal`, `src/lib/transfers.js`).
3. **Run the genetics calculator.** Clutch odds, a reverse calculator and Clutch Lab, all driven by the vendored genetics engine (section 4).
4. **Ask Morph ID.** Upload photos and get a ranked, evidence-first shortlist of visible traits, what the photos cannot confirm and which photo would help next (`src/pages/Recognition.jsx`, `supabase/functions/recognize-gecko-morph`). It is an identification aid, not a genetic test, and its scores are rankings, not calibrated probabilities. A member can share a result as a public card at `/morph-id/r/<id>` (`src/components/morph-id/MorphShareCard.jsx`, `api/morph-share.js`). The Morph ID brief is `docs/specs/morph-id.md`.
5. **Read the reference guides.** Morph Guide, Care Guide, Genetics Guide and the Quality Scale. They are public and prerendered for search engines.
6. **See prices.** A value estimate on each gecko record, pairing value on breeding plans, the public Geck Inspect Price Index, and the members-only Market page (`src/pages/Market.jsx`, `src/lib/marketAnalytics/`). Prices come from asking prices on public crested gecko listings collected into the `geck_data` schema, not from confirmed sales. Market Intelligence (Enterprise) is off sale (section 5).
7. **Run the breeder side.** A public breeder page and store page, waitlists with written deposit terms (no money is taken online, decision 33), Business Tools for sales and costs with profit by season and by pairing (`src/pages/MarketplaceSalesStats.jsx`), printable worksheets, rack labels, buyer packets and a MorphMarket CSV export.
8. **Join the community.** Forum, gallery, direct messages and notifications, with report and block buttons.
9. **Let AI agents read the open data.** `/data` files, `llms.txt`, markdown twins of public pages and a read-only MCP server at `/mcp` (`api/mcp.js`). See `docs/planning/agent-access-2026-10.md`.

Optional tools that make paid AI calls and are metered per plan (`src/lib/tierLimits.js`): the AI Consultant chat, the photo health screen, visual search, growth reels and Promote (social posts). Plan item 23 of the comprehensive review proposes retiring several of these behind flags.

Historical pricing benchmarks in older docs (entry $50 to $250, mid $120 to $450, high-end $400 to $800+, Lilly White $250 to $1,200, Axanthic up to $2,500, average about $350) came from an external guide written by an unrelated breeder who happens to share Tennyson's first name. That site is NOT Tennyson's brand and its address is deliberately not repeated here (see the domain disambiguation note in CLAUDE.md). The app's own prices come from its listing data.

## 2. Who it's for

Three kinds of member, each matched to a plan (prices in section 5):

- **The keeper**: one to ten geckos, wants feedings, weights and sheds remembered. Free covers up to 10 active geckos.
- **The hobby breeder**: runs pairings, cares about lineage and getting traits right. Keeper (up to 50 geckos) or Breeder (no gecko limit).
- **The business**: larger breeders and shops. Enterprise (Market Intelligence) is off sale since 15 October 2026; the Membership page shows it as "Coming soon" with a waitlist button.

What the evidence says about who pays, as of 14 October 2026 (the comprehensive review and the adversarial review it reconciles): no self-identified keeper has paid (0 of 5), the 10-gecko free limit has stopped someone once, and the one habit seen in the data is breeders acting on hatch alerts. Part E of `docs/planning/comprehensive-review-2026-10-14.md` therefore treats breeders as the customer to test for the next 90 days. That is the plan, not a change to the product, which still serves keepers.

## 3. Stack and infrastructure

- **Web app:** React 18 and Vite 6, a single-page app with build-time prerendered public pages (`package.json`, `scripts/prerender.mjs`). Tailwind CSS 3 with Radix-based shadcn primitives (`src/components/ui`). There is no Next.js in this repo.
- **Hosting:** Vercel, production domain `geckinspect.com`. Every push to `main` deploys production, except a push that only changes `docs/` or top-level Markdown files (`ignoreCommand` in `vercel.json`). Vercel also serves four serverless routes (`api/mcp.js`, `api/share.js`, `api/og-pairing.js`, and `api/morph-share.js` for shared Morph ID cards at `/morph-id/r/<id>`) and the routing middleware (`middleware.js`), which logs crawler visits to `agent_hits` and returns real 404 pages.
- **Backend:** one Supabase project, `mmuglfphhwlaluyfyxsp` (Postgres, Auth, Storage, Edge Functions, pg_cron, Vault). On 15 October 2026 the `public` schema had 128 tables and 197 functions, and the `geck_data` schema (market and reference data, written by the separate geck-data repo) had 62 tables. `supabase/functions` holds 35 edge functions; 33 functions were deployed on 15 October: 32 of the repo's 35 (not the two store functions, and not `resend-webhook`, which is new in round 2 and deploys with that merge) plus `rapid-api`, which has no repo copy. Merging to `main` applies new migration files and deploys the functions declared in `supabase/config.toml`, through the Supabase GitHub integration; the rest are deployed by hand. Details in `docs/MIGRATIONS.md` and `docs/planning/deploy-queue-2026-10-03.md`.
- **Auth:** Supabase Auth everywhere (`src/lib/AuthContext.jsx`, `src/lib/supabaseClient.js`). Nothing routes through Base44 any more.
- **Source control and CI:** GitHub, `tennysonmilesperhour/geck-inspect`. GitHub Actions runs CI and the scheduled bots, listed in `docs/OPERATIONS.md`.
- **Payments:** Stripe on the web (`supabase/functions/stripe-checkout`, `stripe-webhook`, `stripe-billing-portal`; live price ids in `src/lib/stripe-config.js`). RevenueCat with Apple StoreKit inside the native app (`docs/BILLING.md`).
- **Native app:** Capacitor 8 projects for iOS and Android (`capacitor.config.ts`, app id `com.geckinspect.app`). Nothing has been submitted to either store (`docs/RELEASE_READINESS.md`).
- **Email and push:** Resend sends email from the edge functions (`send-email` and others) and reports deliveries, opens, clicks and bounces back to `resend-webhook`; web push uses VAPID keys (`send-push`).
- **AI:** Anthropic Claude for Morph ID, the health screen, the AI Consultant, Promote drafting and import parsing. Replicate makes the photo fingerprints that Morph ID uses to find similar reference photos (`supabase/functions/_shared/visual-embedding.ts`).
- **Analytics:** Google Analytics 4 loads on production hostnames only, and not at all when Do Not Track or Global Privacy Control is on (`index.html`, `src/lib/ga.js`). PostHog is on in production: the production build refuses to finish without `VITE_POSTHOG_KEY` (`scripts/check-env.mjs`), and the client loads it after the first paint, except in guest mode (`src/lib/posthog.js`). First-party product events go to `public.user_events` (`src/lib/telemetry.js`). A Robauto.ai pixel in `index.html` counts visits from AI assistants. The weekly growth report reads GA4 and Google Search Console.
- **Services, costs and secrets:** every outside service, what it costs where that is written down, and where each secret lives is in `docs/OPERATIONS.md`.
- **History:** the app started on Base44 and moved to this stack in early April 2026 (at the time: 38 Base44 entities, about 88 registered users, about 250 gecko records).

## 4. Core data model (high level)

Most tables record the owner by email in `created_by`; some also carry a uuid (`geckos.owner_profile_id`). `supabase/SCHEMA_CONVENTIONS.md` explains why, and how to read profiles safely. The main tables in `public`:

- **`geckos`**: the central record. Name, species (almost all "Crested Gecko"; some rows are blank and two are "Gargoyle Gecko"), sex, hatch date or estimated hatch year, morph tags, parents (`sire_id`, `dam_id`, plus free-text parent names for parents not in the app), status, photos, weight, ID code, passport code, quality score, asking, listing and sold prices, archive state and reason, and collection.
- **Care history:** `weight_records`, `feeding_records`, `shed_records`, `vet_records` and `gecko_events`, each tied to a gecko. `gecko_images` holds photos.
- **Breeding:** `breeding_plans` (a sire and a dam with season details) and `eggs` (lay date, hatch date and status, each belonging to a plan, so an egg's parents are the plan's pair).
- **Ownership and sharing:** `transfer_requests` and `ownership_records` (passport transfers and their history), `collections` and `collection_members` (shared collections).
- **Accounts and plans:** `profiles` (one row per member, including Stripe fields and preferences), `membership_comps` (complimentary plans), `revenuecat_entitlements` (store purchases), `payment_events`.
- **Metering:** `morph_id_usage` and `feature_usage` record each metered AI call against the plan's allowance.
- **Breeder and community:** `breeder_profiles`, `breeder_store_pages`, `breeder_reviews`, `gecko_waitlists`, the `forum_*` tables, `direct_messages`, `notifications`, `testimonials`.
- **Operations:** `user_events`, `error_logs`, `agent_hits`, `page_config` and `app_settings` (navigation and feature flags).

Market and reference data live in the `geck_data` schema and are read through `src/lib/geckDataClient.js`.

The genetics engine is the vendored package `crested-gecko-app` (`vendor/crested-gecko-app-0.1.0.tgz`, called "Foundation Genetics" in older docs). The app reaches it only through `src/lib/genetics/index.js`, and `pnpm check:genetics` (`scripts/check-genetics-consistency.mjs`) checks the hand-written guide content against it. Where the package's source lives and what its licence is are not recorded in this repo (comprehensive review, C15 item 6).

## 5. Membership tiers (current pricing)

The source of truth is `TIER_PRICING` and `ENTERPRISE_ON_SALE` in `src/lib/stripe-config.js` and `TIER_LIMITS` in `src/lib/tierLimits.js`. As of 15 October 2026:

| Plan | Price | Gecko limit | Morph ID |
|---|---|---|---|
| Free | $0 | 10 active geckos | 1 a month (decision 46) |
| Keeper | $2.99 a month, $30 a year, or $149 once (lifetime) | 50 | 3 a month |
| Breeder | $5.99 a month, $60 a year, or $349 once (lifetime) | none | 6 a month |
| Enterprise | $99.99 a month or $1,000 a year when on sale | none | 15 a month |

- Enterprise is off sale (`ENTERPRISE_ON_SALE = false`, decision 45). Existing Enterprise members and complimentary grants keep access. Admins are treated as Enterprise.
- Lifetime plans are one-time Stripe payments on the website only. The iPhone app sells monthly and yearly Keeper and Breeder through the App Store (`docs/BILLING.md`).
- Trials are opt-in: a 7-day trial (`TRIAL_DAYS`) from its own button, once per account, and a one-time 30-day Keeper promo offered on the Promote page (`KEEPER_PROMO_TRIAL_DAYS`). A plain purchase is billed the same day.
- Each plan also has monthly allowances for the AI Consultant, health screens, visual searches, growth reels, enclosure sensor reads and social posts (`TIER_LIMITS`).
- Morph ID allowances reset at midnight UTC on the 1st. Free had one identification, ever, until plan item 17 of the comprehensive review made it one a month (decision 46). `monthlyMorphIDCredits` in `tierLimits.js` and the `consume_morph_id_credit` SQL function (which uses 1 for Free) are the truth, not this table. Extra scans in `morph_id_bonus_credits` sit on top.

A member's plan is the highest of: the Stripe plan on their profile, a verified App Store purchase, an active complimentary plan, and a grandfathered Breeder grant (`resolveTier` in `src/lib/tierLimits.js`, mirrored in SQL by `effective_tier_for_current_user()`).

Goals: the old "1,000 users" target is retired. The current scoreboard (paying breeders, passports issued and claimed, weekly active breeders, monthly cost) and the day 30, 60 and 90 checkpoints are in Part E5 of `docs/planning/comprehensive-review-2026-10-14.md`.

## 6. Key files and paths

- Repo root: `tennysonmilesperhour/geck-inspect`
- Local: `/Users/tennyson/dyad-apps/geck inspect`
- Live app: `https://geckinspect.com` (and `https://geck-inspect.vercel.app`)
- Enterprise waitlist: the button on the Membership page

## 7. Known competitors in the space

Geck Inspect's competitive landscape as of April 2026. The current picture is `docs/planning/competitive-landscape-2026-10.md` (5 October 2026).

- **Husbandry Pro**: configurable, species-agnostic, enterprise-leaning. Dated UI.
- **ReptiDex**: newer entrant, AI + pedigree angle, broad species coverage. Spread thin.
- **HerpTracker**: fast logging focus (3-tap), team collaboration. Generic, not breeder-first.
- **Breed Ledger**: built by a crestie breeder (Geckistry). Positions as storefront + records.
- **MorphMarket Animal Manager**: bundled with the MorphMarket marketplace. User complaints about stability.

Geck Inspect's differentiation: **the only platform built specifically for crested geckos**, with genetics and morph taxonomy modeling that the generalist tools don't have.

---

## 8. The landing page

The landing page is `src/pages/Home.jsx`, served at `/` and prerendered to static HTML at build time (`scripts/prerender.mjs`), so it can be read without JavaScript and loads fast on a phone. It is part of the same Vite app, not a separate site.

What is on it, top to bottom:

1. The hero: "Price right. Pair smart." with one "Start free" button. Larger screens also show a product screenshot; phones skip downloading it.
2. Free tools usable before signing up: the genetics calculator and Morph ID.
3. A product tour (`src/components/landing/ProductTour.jsx`) and live counts (`LiveStats.jsx`).
4. Three feature sections from the positioning in decision 32: price every gecko from real listings; see what a pairing's eggs are worth before you pair; hand every buyer the full history, and see what you made.
5. "Also in every account", a comparison block ("Built for crested gecko breeders") and the founder section ("Made by a crested gecko breeder, for the next one").
6. An email capture card and testimonials (`Testimonials.jsx` stays hidden until at least three approved quotes exist).
7. Free crested gecko tools and guides, a short "About the crested gecko" section, an FAQ (the same list feeds the FAQPage structured data) and a closing call to action ("Start with one gecko.").

Pricing is not on the landing page. It lives on `/Membership`, linked from the navigation and the footer.

How it looks: the landing page uses Montserrat (`.landing-font` in `src/styles/layout-theme.css`) and the app uses Inter. Colours come from the theme tokens described in `docs/specs/DESIGN-SYSTEM.md`. The April 2026 design brief (charcoal with a cream accent, Satoshi and JetBrains Mono) was never built and does not describe the current look.

How it is measured: GA4 page views and events, PostHog, and first-party events in `public.user_events` (section 3). Signups by first-touch source are on the admin Funnel card.

The April 2026 brief this section used to hold (the state at the time, a target architecture, a section plan, a design direction, an asset list and metrics) is in git history before 15 October 2026. The reasoning behind it is in `docs/INTENT.md` and decisions 1 to 16 in `docs/DECISIONS.md`.

---

## 9. Ongoing / open items

The April 2026 list here (auth migration, Stripe, Foundation Genetics integration, Market Analytics buildout, landing page revamp) is done. The active plan is Part E of `docs/planning/comprehensive-review-2026-10-14.md` (Tennyson asked on 15 October 2026 for it to be implemented; see `ROADMAP.md`). The feature audit, `docs/planning/feature-completeness-audit-2026-09-29.md`, is kept for its status lines. Enterprise is off sale until the US market feed is reliable (section 5).
