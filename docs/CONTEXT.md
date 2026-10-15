# Geck Inspect: CONTEXT.md

> **Purpose of this file.** This is the factual, long-lived context for Geck Inspect. It answers the question *"what is this project, and what's the state of it right now?"* for any future collaborator (human or AI). It should not contain aspirational goals, strategy, or reasoning for decisions. Those live in `INTENT.md` and `DECISIONS.md`. When something material changes (stack, schema, pricing, ownership, critical file paths), update this file.

---

## 1. What Geck Inspect is

Geck Inspect is a web platform for crested gecko (*Correlophus ciliatus*) breeders and keepers. It is not a generic reptile tracking app. It is species-specific, built from the ground up around the taxonomy, genetics, and market dynamics of cresties.

The platform combines five things in one product:

1. **Collection management**: per-animal records (photos, weight history, feedings, sheds, notes, lineage, custom IDs).
2. **AI morph identification (Morph ID)**: upload a top and a side photo, get an evidence-first shortlist of traits (Lilly White, Harlequin, Dalmatian, Cappuccino, Pinstripe and others; Sable and Highway are in the repo and go live with the next `recognize-gecko-morph` deploy) with the visible evidence, uncertainty reasons and look-alikes. Its scores are rankings, not calibrated probabilities (`supabase/functions/recognize-gecko-morph/README.md`).
3. **Genetics calculator**: predicts clutch outcomes using correct inheritance modeling for crestie traits: Lilly White (incomplete dominant), axanthic (recessive), phantom, Cappuccino/Sable/Frappuccino allelic series, polygenic patterning. Tracks het carriers across generations.
4. **Multi-generation pedigrees**: visual, clickable pedigree trees per animal. Each animal gets a QR code that resolves to its live record. Cross-breeder lineage linking with approval workflow.
5. **Market analytics (live: the Market page, value estimates on gecko records, and Business Tools)**: combines first-party app data (listings, completed sales, search behavior, regional activity, trait-level transactions) with scraped external market signals (MorphMarket, Pangea, FB groups, international classifieds, expo releases) to give breeders, investors, and shop owners strategic market intelligence.

Historical pricing benchmarks (entry $50 to $250, mid $120 to $450, high-end $400 to $800+, Lilly White $250 to $1,200, Axanthic up to $2,500, average about $350) were originally sourced from an external investment guide written by an unrelated breeder who happens to share Tennyson's first name. That site is NOT Tennyson's brand and its address is deliberately not repeated here (see the domain disambiguation note in CLAUDE.md). The app's own prices now come from its listing data (the Geck Inspect Price Index and the Market page), not from this guide.

## 2. Who it's for

Three distinct user personas, each addressed by a membership tier (prices in section 5):

- **The keeper**: hobbyist with 1 to 10 geckos. Wants to never forget a feeding, track weights, remember sheds. Uses the Free tier (up to 10 geckos).
- **The hobbyist breeder**: 10 to 100 animals, runs pairings, cares about lineage and morph accuracy. Uses Keeper (up to 50 geckos) or Breeder (no gecko limit).
- **The business**: commercial breeders, importers, shops with 100+ animals, multiple staff, wholesale operations, branded store pages. Enterprise (Market Intelligence) is off sale since 15 October 2026; the Membership page shows it as "Coming soon" with a waitlist button.

## 3. Stack and infrastructure

- **Frontend:** React + Vite, deployed on Vercel at `geck-inspect.vercel.app` with production domain `geckinspect.com`.
- **Backend / database:** Supabase (Postgres + Auth + Storage).
- **Source control:** GitHub, repo `tennysonmilesperhour/geck-inspect`.
- **Local development:** Mac mini, path `/Users/tennyson/dyad-apps/geck inspect`.
- **Payments:** Stripe is live on the web (checkout, webhook and customer portal, with live price ids in `src/lib/stripe-config.js`). RevenueCat handles purchases in the mobile shells. See `docs/BILLING.md`.
- **Historical:** The app was originally built on Base44. Migrated off Base44 in early April 2026 to the current stack. At time of migration: 38 entities in the Base44 schema, ~88 registered users, ~250 gecko records, security vulnerabilities and Stripe gaps identified and partially fixed.
- **Auth status:** Supabase Auth everywhere (`src/lib/AuthContext.jsx`, `src/lib/supabaseClient.js`). Nothing routes through Base44 any more.
- **Analytics:** Google Analytics 4 runs on production pages (`index.html`, `src/lib/ga.js`) and honours Do Not Track; the weekly growth report is built on it. Product events go to `public.user_events` through `captureEvent`, and to PostHog when it is switched on (`src/lib/posthog.js`).

## 4. Core data model (high level)

The Base44 migration preserved the structural shape of the schema even as it moved to Supabase. The essential entities are:

- **Geckos**: the central entity. Fields include owner, species (fixed to C. ciliatus), sex, hatch date, morph tags, weight history, photo URLs, parents (sire_id, dam_id), status (active, sold, deceased, loaned), custom ID, notes.
- **Clutches / Pairings**: links two geckos (sire + dam), records incubation data, expected/actual hatch dates, offspring linking.
- **Feedings, Sheds, Weights**: time-series events attached to a gecko.
- **Morph traits**: the canonical taxonomy of crestie morphs and their inheritance rules. This is the "genetic truth layer" that drives the calculator.
- **Users, Memberships, Subscriptions**: account data and Stripe subscription linkage.
- **Listings / Sales**: marketplace-adjacent data feeding Market Analytics.
- **AppSettings, PageConfig**: configuration tables driving navigation and feature flags.

A separate headless genetics engine (the "Foundation Genetics" module, package `crested-gecko-app`) is the canonical source for traits and inheritance math. It is vendored in `/vendor` and integrated: the app reaches it only through `src/lib/genetics/index.js`, and `scripts/check-genetics-consistency.mjs` (`pnpm check:genetics`) checks the hand-curated surfaces against it.

## 5. Membership tiers (current pricing)

The source of truth is `TIER_PRICING` in `src/lib/stripe-config.js` and `TIER_LIMITS` in `src/lib/tierLimits.js`. As of 15 October 2026:

| Tier | Price | Notes |
|---|---|---|
| Free | $0 | Up to 10 geckos; one free Morph ID try |
| Keeper | $2.99/mo, $30/yr, or $149 once (lifetime) | Up to 50 geckos; 3 Morph IDs a month |
| Breeder | $5.99/mo, $60/yr, or $349 once (lifetime) | No gecko limit; 6 Morph IDs a month |
| Enterprise | $99.99/mo or $1,000/yr when on sale | Off sale since 15 Oct 2026 (`ENTERPRISE_ON_SALE = false`); shown as "Coming soon" with a waitlist |

Growth target: 1,000 users.

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

> Added April 2026. The marketing landing page at `geckinspect.com` is a separate concern from the app itself and deserves its own context block. For the strategy and reasoning behind the landing page design, see `INTENT.md`.

> **Status 15 October 2026.** Sections 8.1 to 8.6 are the April 2026 brief and are kept for history. What shipped differs: the landing page (`src/pages/Home.jsx`) is prerendered at build time and has a hero with a product screenshot, free tools, feature sections, a comparison table, a founder section, guides, an FAQ (with FAQPage structured data) and a final call to action; pricing lives on `/Membership`, linked from the nav and footer. Analytics is Google Analytics 4 plus first-party events (section 3), not Plausible. The shipped colors and fonts are the theme tokens in `src/index.css` and `tailwind.config.js` and the fonts loaded in `index.html` (Montserrat, Righteous, Inter), not the palette in 8.4.

### 8.1 State in April 2026

As of April 2026 the landing page was minimal: essentially the app's JS bundle shell with basic SEO metadata. A cold visitor to `geckinspect.com` saw a brief text description of the platform and was directed to create a free account. There was no hero section, no product demonstration, no social proof, no pricing visible, no founder story, no feature showcase.

The app itself (`/app` or wherever auth-gated routes live) is a React SPA. The marketing page needs to be treated as a **separate, static-rendered surface** so it loads fast, is crawlable, and does not depend on the JS bundle to be visible.

### 8.2 Target architecture for the landing page

- **Rendering:** Static HTML (server-rendered or fully pre-built). Not a client-side React render. Target sub-2-second load on mobile.
- **Deployment:** One Vercel project serves the Vite + React application and build-time prerendered public pages. The landing page is `/`; authenticated routes use the same application.
- **SEO:** Full semantic HTML, meta tags, OpenGraph, structured data for the product (Schema.org `SoftwareApplication`).
- **Assets:** All images WebP, compressed. One hero product video (WebM + H.264 fallback, autoplay muted, lazy-loaded, poster image). Real crested gecko photography sourced from Tennyson's own collection. No stock imagery.
- **Analytics:** Plausible or PostHog (privacy-friendly, lightweight). Single primary conversion event: "started sign-up."

### 8.3 Landing page section structure

The landing page is built around eight sections, in order. See `INTENT.md` for the reasoning behind this structure. The high-level skeleton:

1. **Nav** (minimal): Logo | Features | Morph Guide | Pricing | Log in | Start Free →
2. **Hero**: split layout. Left: headline + subhead + primary CTA + trust micro-copy. Right: animated product preview (looping 6 to 10 second video of the app in use).
3. **Objection bar**: four short trust signals addressing data ownership, free tier, founder credibility, setup time.
4. **Feature showcase**: three deep sections (not a grid): AI Morph ID, genetics calculator, pedigrees with QR codes. Each with its own real product visual.
5. **Persona segmentation**: three cards: For the keeper / For the hobbyist breeder / For the business.
6. **Social proof**: testimonials with names and photos, live stats counter (geckos tracked, keepers, clutches planned), one video testimonial if available, founder story with Tennyson's photo and brand.
7. **Competitive comparison table**: honest feature comparison vs. Husbandry Pro, MorphMarket Animal Manager, spreadsheets.
8. **Pricing**: three cards (Free / Keeper / Breeder / Enterprise), with an FAQ below addressing top objections.
9. **Final CTA**: distraction-free, one button.
10. **Footer**: Terms, Privacy, Contact, Blog, Morph Guide, About.

### 8.4 Design direction

- **Color palette:** Dark mode primary. Background deep charcoal with green undertone (~`#0E1410`). Accent color crestie cream/sulfur (`#F4E4A1` or similar vibrant Lilly White cream). Secondary accent deep forest green for genetics/data moments. Light mode toggle supported.
- **Typography:** Oversized confident hero type (Satoshi, Inter Tight, or General Sans for headlines). Warm monospace (JetBrains Mono) for genetics/numeric callouts.
- **Motion:** Subtle scroll-triggered animations. Pedigree tree builds branch-by-branch on scroll. Stats count up. Genetics calculator fills in predictions. Everything CSS-animated where possible, not JS-heavy. Respect `prefers-reduced-motion`.
- **Photography:** Tennyson's own geckos, clean backgrounds, shallow depth of field, gecko looking at the viewer. No stock.

### 8.5 Assets still needed

As of drafting this:

- Testimonials with photos from existing ~88 users (outreach email pending).
- 5 to 10 high-quality gecko photos from Tennyson's own collection for hero and feature sections.
- A 30 to 60 second video testimonial from one existing power user.
- A 6 to 10 second looping hero product video showing: collection grid → gecko profile → pedigree tree → genetics calculator → predicted clutch.
- A 200-word founder story with headshot.

### 8.6 Metrics to track

Single primary conversion: **started sign-up** (clicked the primary CTA and reached the sign-up form). Secondary: **scroll depth to pricing section**, **time on page**, **completed sign-up**. All tracked via Plausible/PostHog, no Google Analytics.

---

## 9. Ongoing / open items

The April 2026 list here (auth migration, Stripe, Foundation Genetics integration, Market Analytics buildout, landing page revamp) is done. Open work is tracked in `docs/planning/feature-completeness-audit-2026-09-29.md`, and the proposed 90-day order is Part E of `docs/planning/comprehensive-review-2026-10-14.md`. Enterprise is off sale until the US market feed is reliable (section 5).
