# Geck Inspect: CONTEXT.md

> **Purpose of this file.** This is the factual, long-lived context for Geck Inspect. It answers the question *"what is this project, and what's the state of it right now?"* for any future collaborator (human or AI). It should not contain aspirational goals, strategy, or reasoning for decisions. The reasons behind decisions live in `docs/DECISIONS.md`; the plan lives where `ROADMAP.md` points. When something material changes (stack, schema, pricing, ownership, critical file paths), update this file.

> **Last reconciled with the code: 15 October 2026** (sections 1 to 5 and 8, plan item E2 21 of `docs/planning/comprehensive-review-2026-10-14.md`). **Corrected in the text on 12 November 2026** for what changed after that: the features retired on 16 October, the menu and phone tabs, the two landing pages under test, and the facts that now have one home elsewhere (edge function counts, how a merge deploys, the competitor list). Each statement names the file it comes from, so the next reconcile can check it quickly. When the code and this file disagree, the code wins and this file gets fixed.

---

## 1. What Geck Inspect is

Geck Inspect is a web app for crested gecko (*Correlophus ciliatus*) keepers and breeders at `geckinspect.com`. It is built around crested gecko traits, genetics and records, not reptiles in general. The one exception there used to be, an "Other Reptiles" list for animals that are not geckos, was retired on 16 October 2026; its records are kept (`src/lib/retiredPages.js`).

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

Optional tools that are metered per plan (`src/lib/tierLimits.js`, `src/lib/usageMeter.js`): the photo health screen, visual search and growth reels on the gecko record. Morph ID has its own monthly allowance (section 5). The AI Consultant chat and Promote (social posts) used to be on this list; both were retired on 16 October 2026.

**The shape of the app** (`src/lib/navItems.js`, `src/lib/ThemeContext.jsx`, `index.html`):

- The sidebar has 12 destinations, 8 in Keeper mode (a menu setting that hides the breeding and selling pages). A test holds both numbers (`src/lib/navItems.derived.test.js`).
- On a phone the bottom tabs are Today, Geckos, Log and More, and the app opens on Today: what is due today, the week ahead, then the collection (`src/pages/Today.jsx`).
- The app is dark only. New visitors start on the Emerald theme; a member can pick one of six.
- Members get the getting-started emails for their first two weeks and then Weekly Gecko Notes, one short care email a week (`content/weekly-notes/`, `docs/planning/weekly-notes-2026-10.md`).

**Retired, with code and tables kept** (`src/lib/retiredPages.js`; what each did, where its links go and how to switch one back on is in `docs/planning/retired-features-2026-10.md`): Promote (social posts), the AI Consultant, Other Reptiles, the supplies store with its sticker builders, and the visual website editor on My Store, all on 16 October 2026; Guess the Price, the Morph Visualizer and Community Connect earlier in October; Breeding Loans, Mentorship, Giveaways and Shipping before that. The enclosure sensor screens (Govee) are switched off in the app (`IOT_SENSORS_ENABLED` in `src/lib/iotClient.js`). Do not describe any of these as live.

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
- **Backend:** one Supabase project, `mmuglfphhwlaluyfyxsp` (Postgres, Auth, Storage, Edge Functions, pg_cron, Vault). On 15 October 2026 the `public` schema had 128 tables and 197 functions, and the `geck_data` schema (market and reference data, written by the separate geck-data repo) had 62 tables. The edge functions live in `supabase/functions`; how many there are, which ones a merge deploys and which are deployed by hand is in `docs/INFRASTRUCTURE.md`, section 2. Merging to `main` also changes the database and the edge functions; `docs/MIGRATIONS.md` tells how.
- **Auth:** Supabase Auth everywhere (`src/lib/AuthContext.jsx`, `src/lib/supabaseClient.js`). Nothing routes through Base44 any more.
- **Source control and CI:** GitHub, `tennysonmilesperhour/geck-inspect`. GitHub Actions runs CI and the scheduled bots, listed in `docs/OPERATIONS.md`.
- **Payments:** Stripe on the web (`supabase/functions/stripe-checkout`, `stripe-webhook`, `stripe-billing-portal`; live price ids in `src/lib/stripe-config.js`). RevenueCat with Apple StoreKit inside the native app (`docs/BILLING.md`).
- **Native app:** Capacitor 8 projects for iOS and Android (`capacitor.config.ts`, app id `com.geckinspect.app`). The iPhone app has been submitted to the App Store and is in review work: rejected twice, build 13 resubmitted on 26 October, and the project is now at build 15 with Sign in with Apple switched on (`docs/planning/app-store-resubmission-2026-10-26.md`). Nothing has been submitted to Google Play.
- **Email and push:** Resend sends email from the edge functions (`send-email` and others) and reports deliveries, opens, clicks and bounces back to `resend-webhook`; web push uses VAPID keys (`send-push`).
- **AI:** Anthropic Claude for Morph ID, the health screen and import parsing (and for the AI Consultant and Promote drafting, which are retired for members but kept). Replicate makes the photo fingerprints that Morph ID uses to find similar reference photos (`supabase/functions/_shared/visual-embedding.ts`).
- **Analytics:** Google Analytics 4 is started by the app on production hostnames only (`src/lib/ga.js`, called from `src/lib/GA4PageTracker.jsx`). PostHog is on in production: the production build refuses to finish without `VITE_POSTHOG_KEY` (`scripts/check-env.mjs`), and the client loads it after the first paint, except in guest mode (`src/lib/posthog.js`); it identifies members by their auth id with plan and role only, never by email. Neither loads under Do Not Track or Global Privacy Control, after a visitor turns analytics off, or, for visitors in the EEA and the UK, before they accept on the consent banner (`src/lib/analyticsConsent.js`; `middleware.js` sets the `gi_analytics_region` cookie from Vercel's country header, and a European browser time zone also counts). First-party product events go to `public.user_events` (`src/lib/telemetry.js`); they set no cookie and do not wait for the consent choice, which covers Google Analytics and PostHog only, so the banner and the privacy policy's switch name those two and never say "nothing is counted" (privacy policy section 5 describes the first-party count, and `src/lib/__tests__/privacyPolicy.test.js` keeps the wording and the code in step). The Robauto.ai pixel was removed on 16 October 2026. The weekly growth report reads GA4 and Google Search Console.
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
- **Operations:** `user_events`, `error_logs`, `agent_hits`, `page_config` and `app_settings` (navigation and feature flags). `error_logs` and `agent_hits` rows older than 90 days are deleted daily, and webhook payloads older than 90 days are cleared (`public.apply_privacy_retention`, cron job `privacy-retention-daily`).

Market and reference data live in the `geck_data` schema and are read through `src/lib/geckDataClient.js`.

The genetics engine is the vendored package `crested-gecko-app` (`vendor/crested-gecko-app-0.1.0.tgz`, called "Foundation Genetics" in older docs). The app reaches it only through `src/lib/genetics/index.js`, and `pnpm check:genetics` (`scripts/check-genetics-consistency.mjs`) checks the hand-written guide content against it. Where the package's source lives and what its licence is are not recorded in this repo (comprehensive review, C15 item 6).

## 5. Membership tiers (current pricing)

This table is the one place in the documents where prices are written out; other documents point here. The source of truth is the code: `TIER_PRICING` and `ENTERPRISE_ON_SALE` in `src/lib/stripe-config.js` for prices, and `TIER_LIMITS` in `src/lib/tierLimits.js` for limits. If the table and the code disagree, the code wins; fix the table. Read from the code on 12 November 2026:

| Plan | Price | Gecko limit | Morph ID |
|---|---|---|---|
| Free | $0 | 10 active geckos | 1 a month (decision 46) |
| Keeper | $2.99 a month, $30 a year, or $149 once (lifetime) | 50 | 3 a month |
| Breeder | $5.99 a month, $60 a year, or $349 once (lifetime) | none | 6 a month |
| Enterprise | $99.99 a month or $1,000 a year when on sale | none | 15 a month |

- Enterprise is off sale (`ENTERPRISE_ON_SALE = false`, decision 45). Existing Enterprise members and complimentary grants keep access. Admins are treated as Enterprise.
- Lifetime plans are one-time Stripe payments on the website only. The iPhone app sells monthly and yearly Keeper and Breeder through the App Store (`docs/BILLING.md`).
- Trials are opt-in: a 7-day trial (`TRIAL_DAYS`) from its own button, once per account. A plain purchase is billed the same day. A one-time 30-day Keeper promo (`KEEPER_PROMO_TRIAL_DAYS`) also exists in the code: the Membership page still honours its link (`?intent=keeper_trial`), but the only page that offered it was Promote, which is retired, so nothing in the live app leads to it.
- Each plan also has monthly allowances for health screens, visual searches and growth reels (`TIER_LIMITS`). The allowances for AI Consultant messages, enclosure sensor reads and social posts are still in that file, for features that are retired or switched off.
- Morph ID allowances reset at midnight UTC on the 1st. Free had one identification, ever, until plan item 17 of the comprehensive review made it one a month (decision 46). `monthlyMorphIDCredits` in `tierLimits.js` and the `consume_morph_id_credit` SQL function (which uses 1 for Free) are the truth, not this table. Extra scans in `morph_id_bonus_credits` sit on top.

A member's plan is the highest of: the Stripe plan on their profile, a verified App Store purchase, an active complimentary plan, and a grandfathered Breeder grant (`resolveTier` in `src/lib/tierLimits.js`, mirrored in SQL by `effective_tier_for_current_user()`).

Goals: the old "1,000 users" target is retired. The current scoreboard (paying breeders, passports issued and claimed, weekly active breeders, monthly cost) and the day 30, 60 and 90 checkpoints are in Part E5 of `docs/planning/comprehensive-review-2026-10-14.md`.

## 6. Key files and paths

- Repo root: `tennysonmilesperhour/geck-inspect`
- Local: `/Users/tennyson/dyad-apps/geck inspect`
- Live app: `https://geckinspect.com` (and `https://geck-inspect.vercel.app`)
- Enterprise waitlist: the button on the Membership page

## 7. Competitors

The competitor picture, the market size and the positioning are in `STRATEGY.md` (the conclusions) and `docs/planning/competitive-landscape-2026-10.md` (the 5 October 2026 research, with a source for each fact). The April 2026 list this section used to hold is in git history.

---

## 8. The landing page

Two landing pages are being tested against each other, so what a signed-out visitor sees at `/` depends on which one their browser was given. `docs/planning/homepage-ab-test-2026-10.md` is the authority on the test: who is enrolled, what is measured and what is frozen. This section only says what the two pages are. The files named here must not be changed while the test runs (`docs/RULES.md`, section 3).

- **The chooser** is `src/pages/Home.jsx`, served at `/` and `/Home`. It picks one of the two pages below. Visitors who are not enrolled in the test see the control page.
- **The control page** is `src/pages/HomeControl.jsx`: the landing page as it was before the test.
- **The "business assistant" page** is `src/components/landing/business/BusinessHome.jsx`: a different design built around sample pricing, a single-gene pairing, an expense ledger and a buyer packet, with real product screenshots. Its sample interactions never create member records.

Both pages lead to the same sign-up, the same app and the same prices. The page at `/` is prerendered to static HTML at build time (`scripts/prerender.mjs`), so it can be read without JavaScript and loads fast on a phone. It is part of the same Vite app, not a separate site.

What is on the control page, top to bottom:

1. The hero: "Price right. Pair smart." with one "Start free" button. Larger screens also show a product screenshot; phones skip downloading it.
2. Free tools usable before signing up: the genetics calculator and Morph ID.
3. A product tour (`src/components/landing/ProductTour.jsx`) and live counts (`LiveStats.jsx`).
4. Three feature sections from the positioning in decision 32: price every gecko from real listings; see what a pairing's eggs are worth before you pair; hand every buyer the full history, and see what you made.
5. "Also in every account", a comparison block ("Built for crested gecko breeders") and the founder section ("Made by a crested gecko breeder, for the next one").
6. An email capture card and testimonials (`Testimonials.jsx` stays hidden until at least three approved quotes exist).
7. Free crested gecko tools and guides, a short "About the crested gecko" section, an FAQ (the same list feeds the FAQPage structured data) and a closing call to action ("Start with one gecko.").

Pricing is not on the control page. It lives on `/Membership`, linked from the navigation and the footer.

How it looks: the control page uses Montserrat (`.landing-font` in `src/styles/layout-theme.css`) and the app uses Inter. The business page has its own stylesheet (`src/components/landing/business/business-home.css`). While the test runs, a signed-out visit that opens on the homepage keeps the look the test launched with, not the Emerald default (decision 53; the test document says how). The April 2026 design brief (charcoal with a cream accent, Satoshi and JetBrains Mono) was never built and does not describe the current look.

How it is measured: the test's own metrics are in PostHog and are described in the test document. Outside the test: GA4 page views and events, and first-party events in `public.user_events` (section 3). Signups by first-touch source are on the admin Funnel card.

The April 2026 brief this section used to hold (the state at the time, a target architecture, a section plan, a design direction, an asset list and metrics) is in git history before 15 October 2026. The reasoning behind it is in `docs/INTENT.md` and decisions 1 to 16 in `docs/DECISIONS.md`.

---

## 9. Ongoing / open items

The April 2026 list here (auth migration, Stripe, Foundation Genetics integration, Market Analytics buildout, landing page revamp) is done. The active plan is Part E of `docs/planning/comprehensive-review-2026-10-14.md` (Tennyson asked on 15 October 2026 for it to be implemented; see `ROADMAP.md`). The feature audit, `docs/planning/feature-completeness-audit-2026-09-29.md`, is kept for its status lines. Enterprise is off sale until the US market feed is reliable (section 5).
