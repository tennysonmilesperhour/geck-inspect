# Geck Inspect — CONTEXT.md

> **Purpose of this file.** This is the factual, long-lived context for Geck Inspect. It answers the question *"what is this project, and what's the state of it right now?"* for any future collaborator (human or AI). It should not contain aspirational goals, strategy, or reasoning for decisions — those live in `INTENT.md` and `DECISIONS.md`. When something material changes (stack, schema, pricing, ownership, critical file paths), update this file.

---

## 1. What Geck Inspect is

Geck Inspect is a web platform for crested gecko (*Correlophus ciliatus*) breeders and keepers. It is not a generic reptile tracking app — it is species-specific, built from the ground up around the taxonomy, genetics, and market dynamics of cresties.

The platform combines five things in one product:

1. **Collection management** — per-animal records (photos, weight history, feedings, sheds, notes, lineage, custom IDs).
2. **AI morph identification** — upload a photo, get a morph breakdown (Lilly White, harlequin, dalmatian, cream-back, tiger, pinstripe, etc.) with probabilities.
3. **Genetics calculator** — predicts clutch outcomes using correct inheritance modeling for crestie traits: Lilly White (incomplete dominant), axanthic (recessive), phantom, Cappuccino/Sable/Frappuccino allelic series, polygenic patterning. Tracks het carriers across generations.
4. **Multi-generation pedigrees** — visual, clickable pedigree trees per animal. Each animal gets a QR code that resolves to its live record. Cross-breeder lineage linking with approval workflow.
5. **Market analytics (in development)** — combines first-party app data (listings, completed sales, search behavior, regional activity, trait-level transactions) with scraped external market signals (MorphMarket, Pangea, FB groups, international classifieds, expo releases) to give breeders, investors, and shop owners strategic market intelligence.

The canonical crestie pricing/genetics reference used across the app is tennyscrestedgeckos.com/crested-gecko-investment-guide-2025, which covers morph categories, pricing benchmarks (entry $50–250, mid $120–450, high-end $400–800+, Lilly White $250–1,200, axanthic up to $2,500, average ~$350), and the full genetics taxonomy.

## 2. Who it's for

Three distinct user personas, each addressed by a membership tier:

- **The keeper** — hobbyist with 1–10 geckos. Wants to never forget a feeding, track weights, remember sheds. Uses free tier.
- **The hobbyist breeder** — 10–100 animals, runs pairings, cares about lineage and morph accuracy. Uses Keeper ($4/mo) or Breeder ($9/mo) tier.
- **The business** — commercial breeders, importers, shops with 100+ animals, multiple staff, wholesale operations, branded store pages. Uses Enterprise tier (planned, not yet launched — currently collects waitlist signups via tennysontaggart@gmail.com).

## 3. Stack and infrastructure

- **Frontend:** React + Vite, deployed on Vercel at `geck-inspect.vercel.app` with production domain `geckinspect.com`.
- **Backend / database:** Supabase (Postgres + Auth + Storage).
- **Source control:** GitHub, repo `tennysonmilesperhour/geck-inspect`.
- **Local development:** Mac mini, path `/Users/tennyson/dyad-apps/geck inspect`.
- **Payments:** Stripe (integration in progress, partially remediated during the pre-migration audit).
- **Historical:** The app was originally built on Base44. Migrated off Base44 in early April 2026 to the current stack. At time of migration: 38 entities in the Base44 schema, ~88 registered users, ~250 gecko records, security vulnerabilities and Stripe gaps identified and partially fixed.
- **Auth status:** At the time of the last session, auth was still routing through Base44 and the next planned step was replacing it with Supabase auth. Verify current state before assuming this is done.

## 4. Core data model (high level)

The Base44 migration preserved the structural shape of the schema even as it moved to Supabase. The essential entities are:

- **Geckos** — the central entity. Fields include owner, species (fixed to C. ciliatus), sex, hatch date, morph tags, weight history, photo URLs, parents (sire_id, dam_id), status (active, sold, deceased, loaned), custom ID, notes.
- **Clutches / Pairings** — links two geckos (sire + dam), records incubation data, expected/actual hatch dates, offspring linking.
- **Feedings, Sheds, Weights** — time-series events attached to a gecko.
- **Morph traits** — the canonical taxonomy of crestie morphs and their inheritance rules. This is the "genetic truth layer" that drives the calculator.
- **Users, Memberships, Subscriptions** — account data and Stripe subscription linkage.
- **Listings / Sales** — marketplace-adjacent data feeding Market Analytics.
- **AppSettings, PageConfig** — configuration tables driving navigation and feature flags.

A separate headless TypeScript genetics module (the "Foundation Genetics" module, built via Claude Code) exists as the canonical source for traits and inheritance math. Integrating it into Geck Inspect is a pending task that requires schema migration + component refactor — it is not a drop-in.

## 5. Membership tiers (current pricing)

| Tier | Price | Notes |
|---|---|---|
| Free | $0 | Core tracking, limited geckos |
| Keeper | $4/mo | Highlighted in UI, most keepers |
| Breeder | $9/mo | Most popular tier, full breeding features |
| Enterprise | TBD | Coming soon, waitlist only |

Growth target: 1,000 users.

## 6. Key files and paths

- Repo root: `tennysonmilesperhour/geck-inspect`
- Local: `/Users/tennyson/dyad-apps/geck inspect`
- Live app: `https://geckinspect.com` (and `https://geck-inspect.vercel.app`)
- Waitlist email: `tennysontaggart@gmail.com`
- External reference: `https://tennyscrestedgeckos.com/crested-gecko-investment-guide-2025/`

## 7. Known competitors in the space

Geck Inspect's competitive landscape as of April 2026:

- **Husbandry Pro** — configurable, species-agnostic, enterprise-leaning. Dated UI.
- **ReptiDex** — newer entrant, AI + pedigree angle, broad species coverage. Spread thin.
- **HerpTracker** — fast logging focus (3-tap), team collaboration. Generic, not breeder-first.
- **Breed Ledger** — built by a crestie breeder (Geckistry). Positions as storefront + records.
- **MorphMarket Animal Manager** — bundled with the MorphMarket marketplace. User complaints about stability.

Geck Inspect's differentiation: **the only platform built specifically for crested geckos**, with genetics and morph taxonomy modeling that the generalist tools don't have.

---

## 8. The landing page

> Added April 2026. The marketing landing page at `geckinspect.com` is a separate concern from the app itself and deserves its own context block. For the strategy and reasoning behind the landing page design, see `INTENT.md`.

### 8.1 Current state

As of April 2026 the landing page is minimal — essentially the app's JS bundle shell with basic SEO metadata. A cold visitor to `geckinspect.com` sees a brief text description of the platform and is directed to create a free account. There is no hero section, no product demonstration, no social proof, no pricing visible, no founder story, no feature showcase.

The app itself (`/app` or wherever auth-gated routes live) is a React SPA. The marketing page needs to be treated as a **separate, static-rendered surface** so it loads fast, is crawlable, and does not depend on the JS bundle to be visible.

### 8.2 Target architecture for the landing page

- **Rendering:** Static HTML (server-rendered or fully pre-built). Not a client-side React render. Target sub-2-second load on mobile.
- **Deployment:** Same Vercel project, either as Next.js static pages at the root or as a separate lightweight project. The SPA app moves to a subpath (`/app`) or remains at the root with the landing page at `/` — either works, pick the one simpler to maintain.
- **SEO:** Full semantic HTML, meta tags, OpenGraph, structured data for the product (Schema.org `SoftwareApplication`).
- **Assets:** All images WebP, compressed. One hero product video (WebM + H.264 fallback, autoplay muted, lazy-loaded, poster image). Real crested gecko photography sourced from Tennyson's own collection — no stock imagery.
- **Analytics:** Plausible or PostHog (privacy-friendly, lightweight). Single primary conversion event: "started sign-up."

### 8.3 Landing page section structure

The landing page is built around eight sections, in order. See `INTENT.md` for the reasoning behind this structure. The high-level skeleton:

1. **Nav** — minimal: Logo | Features | Morph Guide | Pricing | Log in | Start Free →
2. **Hero** — split layout. Left: headline + subhead + primary CTA + trust micro-copy. Right: animated product preview (looping 6–10s video of the app in use).
3. **Objection bar** — four short trust signals addressing data ownership, free tier, founder credibility, setup time.
4. **Feature showcase** — three deep sections (not a grid): AI Morph ID, genetics calculator, pedigrees with QR codes. Each with its own real product visual.
5. **Persona segmentation** — three cards: For the keeper / For the hobbyist breeder / For the business.
6. **Social proof** — testimonials with names and photos, live stats counter (geckos tracked, keepers, clutches planned), one video testimonial if available, founder story with Tennyson's photo and brand.
7. **Competitive comparison table** — honest feature comparison vs. Husbandry Pro, MorphMarket Animal Manager, spreadsheets.
8. **Pricing** — three cards (Free / Keeper / Breeder / Enterprise), with an FAQ below addressing top objections.
9. **Final CTA** — distraction-free, one button.
10. **Footer** — Terms, Privacy, Contact, Blog, Morph Guide, About.

### 8.4 Design direction

- **Color palette:** Dark mode primary. Background deep charcoal with green undertone (~`#0E1410`). Accent color crestie cream/sulfur (`#F4E4A1` or similar vibrant Lilly White cream). Secondary accent deep forest green for genetics/data moments. Light mode toggle supported.
- **Typography:** Oversized confident hero type (Satoshi, Inter Tight, or General Sans for headlines). Warm monospace (JetBrains Mono) for genetics/numeric callouts.
- **Motion:** Subtle scroll-triggered animations. Pedigree tree builds branch-by-branch on scroll. Stats count up. Genetics calculator fills in predictions. Everything CSS-animated where possible, not JS-heavy. Respect `prefers-reduced-motion`.
- **Photography:** Tennyson's own geckos, clean backgrounds, shallow depth of field, gecko looking at the viewer. No stock.

### 8.5 Assets still needed

As of drafting this:

- Testimonials with photos from existing ~88 users (outreach email pending).
- 5–10 high-quality gecko photos from Tennyson's own collection for hero and feature sections.
- A 30–60 second video testimonial from one existing power user.
- A 6–10 second looping hero product video showing: collection grid → gecko profile → pedigree tree → genetics calculator → predicted clutch.
- A 200-word founder story with headshot.

### 8.6 Metrics to track

Single primary conversion: **started sign-up** (clicked the primary CTA and reached the sign-up form). Secondary: **scroll depth to pricing section**, **time on page**, **completed sign-up**. All tracked via Plausible/PostHog, no Google Analytics.

---

## 9. Ongoing / open items

- Auth migration from Base44 to Supabase auth (was pending at last session).
- Stripe integration completion.
- Foundation Genetics module integration into the live app.
- Market Analytics section buildout (separate spec in progress).
- Landing page revamp (this document's section 8 — see INTENT.md for strategy).
- Waitlist-to-Enterprise conversion flow.
