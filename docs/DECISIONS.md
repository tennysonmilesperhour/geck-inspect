# Geck Inspect Landing Page: DECISIONS.md

> **Purpose of this file.** A running log of every meaningful decision made about the landing page, the reasoning behind it, and the context at the time. `CONTEXT.md` answers *what is this*. `INTENT.md` answers *why is it that way*. This file answers *what changed, when, and why*, so that months from now we can see the full history of how the landing page evolved, which experiments worked, and which ideas were tried and rejected.
>
> **How to use this file.**
> - Each decision gets its own numbered entry.
> - Entries are append-only. Don't edit or delete old entries. If a decision is reversed later, add a new entry that supersedes it and references the old one.
> - Use the format below. Keep it short: one short paragraph per field is plenty.
> - Log decisions at the moment they're made, not later. Memory is unreliable.
>
> **Entry format:**
> ```
> ### [N]. [Short title]
> **Date:** YYYY-MM-DD
> **Status:** Accepted | Superseded by #N | Rejected | Under review
> **Context:** What question or situation triggered this decision?
> **Decision:** What did we decide?
> **Reasoning:** Why? What alternatives did we consider and reject?
> **Consequences:** What does this commit us to? What does it rule out?
> ```

---

## Seed entries: decisions made during the April 2026 landing page research session

These entries capture the strategic decisions made during the initial landing page research and planning conversation. They are logged retroactively in a single batch but reflect real decisions that should guide future work.

---

### 1. Position Geck Inspect as crestie-specific, not reptile-general

**Date:** 2026-04-21
**Status:** Accepted
**Context:** The landing page needs a single clear positioning angle. The competitive set (Husbandry Pro, ReptiDex, HerpTracker, MorphMarket Animal Manager, Breed Ledger) all serve multiple reptile species. There was an implicit option to position Geck Inspect as "multi-species-ready, starting with cresties."
**Decision:** Position Geck Inspect exclusively as a platform for crested geckos. No mention of other species, no "coming soon to more reptiles" language, no hedging.
**Reasoning:** Specificity is the moat. The generalist platforms already exist and are mediocre at crestie genetics because they spread their modeling thin. Being "the only platform built specifically for crested geckos" is a defensible, differentiated position that none of the competitors can claim without rebuilding their entire product. Multi-species positioning would undercut this instantly.
**Consequences:** All landing page copy leads with cresties. Even if the app later expands to other species, the landing page will not lead with that. Commits us to being the deepest, not the broadest, in this category.

---

### 2. Separate the landing page from the React SPA

**Date:** 2026-04-21
**Status:** Accepted
**Context:** Currently `geckinspect.com` serves a React SPA shell: a visitor sees an almost-empty HTML page with JS that then builds the app. This is fine for the app itself but terrible for a marketing landing page: slow initial paint, poor SEO, no content visible without JS.
**Decision:** Build the landing page as static HTML, served separately from the SPA. The app lives at `/app` (or similar subpath), the marketing page at `/`.
**Reasoning:** Research consistently shows every second of load time costs ~7% of conversions; pages loading in 1 second convert 3x better than 5-second pages. A static landing page can load in well under 2 seconds. Pre-rendered HTML is also fully crawlable by Google without JS execution, which matters for SEO.
**Consequences:** Commits to treating the marketing surface and the app surface as two separate deployables. Either two Vercel projects, or one Next.js project with both static pages and the SPA under one roof. Slight maintenance overhead, but large conversion and SEO payoff.

---

### 3. Lead with founder credibility: "by a breeder, for breeders"

**Date:** 2026-04-21
**Status:** Accepted
**Context:** Competitor analysis showed the reptile software space is crowded with faceless "AI-powered platform" pitches. ReptiDex and HerpTracker use generic corporate framing. Breed Ledger leads with "built by an active breeder" and gets real traction from that positioning.
**Decision:** Put Tennyson's face, name, breeding brand, and story prominently on the landing page. Include a 200-word founder story with a photo.
**Amendment (2026-06-10):** This decision originally named an unrelated breeder's domain as the founder brand (the one CLAUDE.md lists under domain disambiguation). That was a mistake caused by a name collision; the domain belongs to an unrelated breeder who shares Tennyson's first name. Never present that domain as Tennyson's. The correct credibility signal is Tennyson's actual breeding operation under whatever brand name he chooses to publish (ask before assuming).
**Reasoning:** Niche hobbyist audiences trust people, not logos. A real breeder with an active operation is a structural credibility signal that competitors can't easily replicate. This is also the cheapest trust-building move available: no ad spend, just honesty.
**Consequences:** Commits Tennyson to being publicly associated with the product. The founder story and photo must be kept current. If the founder ever steps back from active breeding, this positioning needs revisiting.

---

### 4. Use "Start Free" as the primary CTA, never "Sign Up"

**Date:** 2026-04-21
**Status:** Accepted
**Context:** CTA wording has disproportionate impact on conversion. Research documents a 104% lift in trial starts from changing "Sign up for free" to "Try for free" on one SaaS product.
**Decision:** Primary CTA across the entire landing page is `Start Free →`. Never "Sign Up," "Register," "Submit," or "Create Account."
**Reasoning:** "Start" and "Try" reframe the action as exploratory rather than committal. "Sign up" implies ongoing obligation and triggers resistance. First-person variants ("Start my free account") may lift another 90%, worth A/B testing once we have traffic volume.
**Consequences:** All buttons, nav CTAs, and inline CTAs use this language. Requires discipline: any future copywriter or AI will default to "Sign Up" unless reminded.

---

### 5. Dark mode as the primary design aesthetic

**Date:** 2026-04-21
**Status:** Accepted
**Context:** The competitive set (Husbandry Pro, ReptiDex, HerpTracker, MorphMarket) all use bright, clinical, white-background interfaces. There was an option to go with a similar aesthetic to feel "familiar" to the category.
**Decision:** Primary visual direction is dark mode: deep charcoal background (~`#0E1410`) with green undertone. Accent color is crestie cream/sulfur (`#F4E4A1`). Secondary accent is forest green for genetics/data moments. Light mode toggle supported but dark is default.
**Reasoning:** Dark mode reads as premium and modern, signals "tech product" vs. "hobbyist utility," and makes crested gecko photography look dramatically better. The competitive contrast alone is a positioning signal.
**Consequences:** All design work proceeds dark-first. Photography must be lit for dark backgrounds. Light mode is a later concern, not a day-one requirement.

---

### 6. Treat the seven-objection hesitation map as the master framework

**Date:** 2026-04-21
**Status:** Accepted
**Context:** Landing page sections can proliferate endlessly if each one is justified on its own merits. Needed a single framework to decide what earns a place on the page and what doesn't.
**Decision:** Every section of the landing page must either (a) reinforce the positioning thesis or (b) kill one of the seven documented objections: "I don't get what this is," "I don't trust this," "it'll be too much work," "I'll get locked in," "it's going to cost more than I want," "it's probably another half-baked app," or cognitive overload. If a section does neither, it doesn't ship.
**Reasoning:** Anchors every structural decision to research-backed conversion psychology rather than taste. Gives a clear rejection criterion for scope creep.
**Consequences:** Future feature ideas (live chat, video library, blog embeds, etc.) get evaluated against this rubric, not against "would it look cool."

---

### 7. Show the product with animated visuals, not descriptions or illustrations

**Date:** 2026-04-21
**Status:** Accepted
**Context:** Options considered for the hero visual: (a) static screenshot, (b) custom illustration, (c) stock 3D art, (d) animated product video, (e) interactive live demo.
**Decision:** Hero uses a looping 6 to 10 second animated product video (autoplay muted, lazy-loaded). Feature sections each have real product visuals, not illustrations. No stock imagery anywhere.
**Reasoning:** For UI-heavy SaaS products, animated visuals outperform screenshots, which outperform illustrations, which outperform text. This is documented across multiple 2026 conversion analyses. Interactive live demos would convert even better but are significantly more expensive to build. Animated videos are 80% of the value at 10% of the effort.
**Consequences:** Need to produce a looping product video showing collection grid → gecko profile → pedigree tree → genetics calculator → predicted clutch. This is an asset gap that must be filled before launch. Rules out static screenshot shortcuts.

---

### 8. Show pricing on-page, not behind "Contact Us"

**Date:** 2026-04-21
**Status:** Accepted
**Context:** Many B2B SaaS pages hide pricing behind contact forms. For Geck Inspect's audience (hobbyist-to-small-business breeders), this would be a trust killer.
**Decision:** Display all four tiers (Free / Keeper $4 / Breeder $9 / Enterprise) with prices, features, and a CTA on each card. Enterprise shows "Contact for pricing" with a waitlist CTA but the other three are fully transparent.
**Reasoning:** Hidden pricing reads as expensive or manipulative to hobbyist audiences. This audience expects hobbyist-friendly pricing transparency. They're comparing against a $5/month competitor openly. Hiding pricing would lose the comparison before it started.
**Consequences:** Pricing changes must be handled carefully. The page itself becomes part of the pricing commitment. A/B testing pricing requires care.

---

### 9. No chatbots, no fake urgency, no stock photography

**Date:** 2026-04-21
**Status:** Accepted
**Context:** 2026 landing page trends include AI chatbots, countdown timers, "only 3 spots left" messaging, and stock imagery. These can lift conversions in some categories. The question was whether they fit Geck Inspect's audience.
**Decision:** Do not use any of these. No marketing chatbot. No countdown timers. No "limited spots." No stock photos of geckos or people.
**Reasoning:** The crested gecko hobbyist community is tight-knit and detects inauthenticity quickly. Fake urgency on a $4/month hobbyist tool reads as desperate. Stock photography reads as amateur. A chatbot reads as corporate and off-brand. These tactics might work for enterprise SaaS. They won't work here.
**Consequences:** Rules out a set of common "conversion hacks." Commits to earning trust through honesty and product quality rather than pressure tactics.

---

### 10. Lead testimonials with names, faces, and specific outcomes

**Date:** 2026-04-21
**Status:** Accepted
**Context:** The current user base is ~88 keepers, small but real. Could use anonymous or generic testimonials, aspirational copy ("Built for breeders everywhere"), or skip social proof altogether until the numbers are bigger.
**Decision:** All testimonials must include a full name, photo, and specific outcome ("migrated from 3 spreadsheets in an hour," "planned my first Lilly White pairing in 10 minutes"). Anonymous or generic testimonials don't ship. Live user stats ("250 geckos tracked by 88 keepers") are used as genuine small-but-specific social proof.
**Reasoning:** Small, specific, believable social proof outperforms large, vague, unbelievable social proof. "Trusted by 88 breeders" is more trust-building than "Trusted by breeders worldwide" when it's true.
**Consequences:** Must email existing users to collect testimonials with photos. This is a blocking asset gap. Commits to never inflating numbers or using fake testimonials, even under pressure.

---

### 11. "Your data, always exportable" as explicit trust micro-copy

**Date:** 2026-04-21
**Status:** Accepted
**Context:** The reptile software community has been burned: by Base44 platform lock-in, by MorphMarket's mediocre app, by apps that died and took data with them. Data portability is a specific active anxiety for this audience.
**Decision:** The phrase "Your data, always exportable" (or a close variant) appears directly under the primary CTA in the hero and again in the objection bar. Backed by a real CSV export feature available on all tiers, including free.
**Reasoning:** This is a load-bearing trust promise. The audience is specifically scanning for this signal. Stating it upfront, in plain language, kills one of the top-three objections before it forms.
**Consequences:** Commits to building and maintaining a real CSV export feature on all tiers. If export is ever broken or removed, this copy must come down immediately. The promise is only valuable if it's honored.

---

### 12. One primary CTA, repeated throughout the page

**Date:** 2026-04-21
**Status:** Accepted
**Context:** Some SaaS pages offer branching CTAs ("Start Free Trial" vs. "Book a Demo" vs. "Watch Video"). This accommodates multiple buyer personas but increases cognitive load.
**Decision:** Exactly one CTA across the entire landing page: `Start Free →`. It appears in the nav, the hero, after each major section, and in the final CTA block. No "Watch Demo," no "Book a Call," no "Contact Sales."
**Reasoning:** The audience is self-serve. They don't want a sales call; they want to try the product. Multiple CTAs create decision paralysis and dilute conversion tracking. One path, repeated, converts better.
**Consequences:** Enterprise tier uses a different path (waitlist email) but that's explicitly a separate, lower-prominence action. Commits to not chasing enterprise deals on the main landing page.

---

### 13. Three feature sections, not a grid of nine

**Date:** 2026-04-21
**Status:** Accepted
**Context:** Geck Inspect has many features: collection management, AI morph ID, genetics calculator, pedigrees, QR codes, weight tracking, feeding logs, shed tracking, market analytics, team collaboration, etc. The standard SaaS pattern is a grid of 6 to 9 small feature cards.
**Decision:** Only three features get their own substantial on-page section: AI Morph ID, Genetics Calculator, and Pedigrees with QR Codes. Each gets generous whitespace, a real product visual, and room to breathe. Other features are listed briefly in pricing tiers but don't get showcase space.
**Reasoning:** Research is clear that dense feature grids underperform deep single-feature showcases. Three features is the maximum before cognitive overload sets in. The three chosen are the most differentiated from competitors, the strongest proof of the crestie-specific positioning.
**Consequences:** Many real features go unmentioned on the landing page. That's fine. They get discovered in the app. The page's job is to get the sign-up, not to be a feature catalog.

---

### 14. Mobile-first design, sub-2-second load as a hard requirement

**Date:** 2026-04-21
**Status:** Accepted
**Context:** 62 to 83% of landing page traffic is mobile. Mobile conversion rates are typically 40 to 50% lower than desktop, largely due to friction that's invisible on desktop.
**Decision:** Design mobile-first, not desktop-adapted-to-mobile. All tap targets ≥48×48px, thumb-zone CTAs, vertical-first media. Total page load under 2 seconds on mobile (measured via PageSpeed Insights, target 90+ score).
**Reasoning:** Treating mobile as the starting point (rather than an adaptation) is the only way to avoid the mobile conversion gap that plagues most SaaS landing pages.
**Consequences:** Hero video must be lightweight (WebM preferred, H.264 fallback, poster image, lazy-loaded). Images are WebP, compressed. No heavy JavaScript libraries for the marketing page. This rules out some visually ambitious effects.

---

### 15. Plausible or PostHog for analytics, not Google Analytics

**Date:** 2026-04-21
**Status:** Accepted
**Context:** Analytics is non-optional: we need to know if the page converts. Standard choice is Google Analytics 4.
**Decision:** Use Plausible or PostHog (privacy-friendly, lightweight alternatives). Single primary conversion event: "started sign-up." Secondary events: scroll depth to pricing, completed sign-up, time on page.
**Reasoning:** Lighter than GA4 (faster page load), privacy-friendly (no cookie banner required in most jurisdictions), and the audience skews toward people who appreciate privacy-aware tools. Tracks what we actually need without the complexity.
**Consequences:** Commits to a particular analytics vendor. Commits to not chasing vanity metrics (page views, sessions, bounce rate in isolation), only metrics that correlate with sign-ups.

---

### 16. Split CONTEXT / INTENT / DECISIONS across three files

**Date:** 2026-04-21
**Status:** Accepted
**Context:** Landing page strategy involves factual context, strategic reasoning, and a running history of choices. Could all live in one document.
**Decision:** Three separate files: `CONTEXT.md` (facts about the project), `INTENT.md` (strategic reasoning and principles), `DECISIONS.md` (this file, a running log of specific decisions with dates).
**Reasoning:** Each file answers a different question and has a different lifecycle. CONTEXT changes when facts change. INTENT changes rarely, when strategy shifts. DECISIONS is append-only. Mixing them creates a document that's hard to update cleanly and hard for future collaborators to parse.
**Consequences:** Slight overhead in maintaining three files instead of one. Offset by much better clarity for future Claude Code sessions, which will be working from these files frequently.

---

## [Add new decisions below as they're made. Append only, don't edit above]

---

### 17. Migrate authentication from Base44 to Supabase Auth

**Date:** 2026-04-21
**Status:** In progress
**Context:** Geck Inspect was migrated from Base44 to a self-managed GitHub + Supabase + Vercel stack in early April 2026. At time of migration, auth was still routing through Base44 while the rest of the stack had moved to Supabase, a transitional state that shouldn't ship long-term.
**Decision:** Replace Base44 auth with Supabase Auth as the single source of truth for user authentication. All existing ~88 users must be migrated without losing accounts, subscription status, or data linkage.
**Reasoning:** Keeping Base44 in the auth path means Geck Inspect is still dependent on a platform we're intentionally moving away from. It's a hidden single point of failure and a lock-in risk. Supabase Auth integrates cleanly with the existing Supabase database, supports email/password and social logins, and removes the last Base44 dependency.
**Consequences:** Requires a migration plan for existing users (likely a password reset flow or magic-link re-onboarding). Once complete, Base44 can be fully decommissioned as a dependency. Commits to Supabase as the auth vendor going forward.

---

### 18. Complete Stripe payment integration

**Date:** 2026-04-21
**Status:** In progress
**Context:** The pre-migration Base44 audit identified gaps in the Stripe integration: some remediated, some still open. Membership tiers (Free / Keeper $4 / Breeder $9 / Enterprise) are defined in the UI but not fully wired to live payment processing on the new stack.
**Decision:** Finish the Stripe integration so that Keeper and Breeder tiers can process real subscriptions, handle upgrades/downgrades, manage failed payments, and sync subscription status to the Supabase user records. Enterprise remains waitlist-only (email to tennysontaggart@gmail.com) until productized.
**Reasoning:** Revenue depends on this working. Without live payment processing, the pricing tiers on the landing page are aspirational rather than real, which creates trust risk if a visitor signs up and hits a broken checkout.
**Consequences:** Blocks the landing page launch if payments aren't working: the page will show prices for tiers that can't actually be subscribed to. Commits to Stripe as the payment vendor. Requires webhook handling, subscription lifecycle management, and a customer portal for existing subscribers.

---

### 19. Integrate the Foundation Genetics module into the live app

**Date:** 2026-04-21
**Status:** Pending
**Context:** A standalone, headless TypeScript genetics module ("Foundation Genetics") was built via Claude Code as the canonical source for crestie traits, inheritance rules, and breeding math. Geck Inspect's existing genetics code predates this module and uses its own morph tag system with different terminology.
**Decision:** Integrate the Foundation Genetics module as the genetic truth layer for all of Geck Inspect. This requires: (1) an audit of existing genetics code in the app, (2) a schema migration to align morph storage with the new taxonomy, (3) a component refactor to use the new module's API, and (4) data migration for existing user morph records.
**Reasoning:** Having two genetics systems in one codebase creates bugs, inconsistencies, and maintenance cost. The Foundation module is the deliberate, correct taxonomy. The existing code is legacy. Consolidating to one source of truth is the right long-term move even though it's a meaningful refactor.
**Consequences:** Not a drop-in: requires real engineering work. Must be done carefully to avoid disrupting existing user data. Commits to the Foundation Genetics module as the canonical taxonomy. Rules out the alternative of keeping both systems or maintaining legacy genetics code in parallel.

---

### 20. Build the Market Analytics section for Business Tools

**Date:** 2026-04-21
**Status:** In progress
**Context:** Serious crested gecko breeders, investors, importers, and shop owners need strategic market intelligence: not surface-level averages, but real signals about value, demand, scarcity, and timing. Currently this kind of analysis requires manually scraping MorphMarket, Pangea, Facebook breeder groups, and international classifieds.
**Decision:** Build a Market Analytics section inside the Business Tools page. Powered by two integrated data sources: first-party Geck Inspect data (listings, sales, asking-vs-sold spreads, breeding records, search behavior, watchlists, regional activity, trait-level transactions) AND external global market data (scraped signals from MorphMarket, Pangea, FB groups, expos, breeder sites, international classifieds in UK/EU/AU/JP/SE, import/export listings). The two sources must be architecturally separated so each can be weighted, filtered, and benchmarked independently.
**Reasoning:** This is a defensibly premium feature: nobody else has both first-party and external data integrated. It justifies a higher price point (Enterprise tier) and differentiates Geck Inspect from commodity tracking apps. First-party data becomes more valuable as the user base grows, which creates a long-term moat.
**Consequences:** Significant engineering scope: scraping infrastructure, data pipelines, analytics models, visualization. Must be architected to keep data sources cleanly separated. Likely gated behind the Breeder and Enterprise tiers. Rules out a simpler "average price lookup" approach that competitors could replicate.

---

### 21. Design the Enterprise waitlist-to-conversion flow

**Date:** 2026-04-21
**Status:** Pending
**Context:** Enterprise tier is currently "Coming Soon" with a waitlist CTA that routes to tennysontaggart@gmail.com. There's no structured flow for qualifying, onboarding, or converting these prospects, and no pricing is set.
**Decision:** Design a proper Enterprise waitlist-to-conversion flow before the landing page launches. Must include: a qualification form (collection size, use case, team size, rough budget), an intake triage process, pricing structure for Enterprise (likely custom), an onboarding process (data import, training, team setup), and a branded store page feature as a likely Enterprise differentiator.
**Reasoning:** The landing page will drive Enterprise interest whether we're ready or not. Currently every Enterprise inquiry goes to a personal Gmail and gets handled ad-hoc. This doesn't scale past a handful of prospects and creates inconsistent experiences. A structured flow captures leads properly and positions Enterprise as a real product, not a "talk to us" placeholder.
**Consequences:** Enterprise sales becomes a defined process rather than a Tennyson-only bottleneck. Commits to building Enterprise-specific features (team collaboration, wholesale pedigrees, branded store pages, custom onboarding). Rules out a pure self-serve strategy. Enterprise will require sales touch.

---

### 22. Gather landing page launch assets before build begins

**Date:** 2026-04-21
**Status:** Pending
**Context:** The landing page strategy requires specific assets that don't currently exist: named testimonials with photos from existing users, original gecko photography for hero and feature sections, a looping hero product video, a founder story with headshot, and possibly a video testimonial from a power user.
**Decision:** Treat asset gathering as a blocking prerequisite for the landing page build, not something to paper over with stock photography or placeholder copy. Specific assets needed: (1) 5 to 10 testimonials with names, photos, specific outcomes, (2) 5 to 10 crested gecko photos shot against clean backgrounds from Tennyson's own collection, (3) one 6 to 10 second looping hero product video showing the app in use, (4) one 30 to 60 second video testimonial from an existing power user (stretch goal), (5) a 200-word founder story with headshot.
**Reasoning:** The positioning ("by a breeder, for breeders") and the testimonial principles (real names, real faces, specific outcomes) only work if the assets are real. Launching without them would undercut the entire strategy. Asset gathering is also high-leverage: an hour of email outreach to existing users produces content that improves conversion more than an hour of design polish.
**Consequences:** Adds a pre-build phase to the landing page timeline. Commits to not shipping the landing page with stock imagery or fake testimonials even under pressure. Requires outreach to existing ~88 users, likely with a small incentive (free month) in exchange for testimonials.

---

### 23. Set up analytics and conversion tracking before launch

**Date:** 2026-04-21
**Status:** Pending
**Context:** Without analytics in place at launch, we lose the first weeks of real visitor data, and can't meaningfully A/B test anything until we have a baseline.
**Decision:** Install Plausible or PostHog (final vendor choice TBD) before the landing page goes live. Configure a primary conversion event: "started sign-up" (clicked primary CTA and reached sign-up form). Secondary events: scroll depth to pricing section, completed sign-up, time on page, bounce rate by device. No A/B testing for at least the first two weeks post-launch: observe first, test later.
**Reasoning:** A/B testing before ~500 visitors per variant is statistical noise. Two weeks of clean observation establishes a real baseline. Plausible/PostHog over GA4 because they're lighter, privacy-friendly, and match the audience's values.
**Consequences:** Requires an analytics vendor decision before launch. Commits to not adding Google Analytics or other heavyweight trackers. Slight learning curve for whichever tool is chosen.

---

### 24. Plan the first round of A/B tests

**Date:** 2026-04-21
**Status:** Pending
**Context:** Once the landing page has ~2 weeks of traffic and a baseline conversion rate, testing begins. The order of tests matters: testing low-leverage elements first wastes traffic.
**Decision:** After 2 weeks of baseline data, begin A/B testing in this order of priority: (1) headline copy, (2) hero visual (video variant vs. static variant), (3) primary CTA copy ("Start Free" vs. "Start my free account"), (4) pricing display (annual vs. monthly default), (5) feature section order. One test at a time. Each test runs until statistical significance or 4 weeks, whichever comes first.
**Reasoning:** Research consistently shows headline is the single highest-leverage element on a landing page. First-person CTAs can lift conversions up to 90%, worth testing once traffic is high enough. Running multiple tests simultaneously makes it impossible to know what moved the needle, so discipline on one-at-a-time is essential.
**Consequences:** Commits to a disciplined testing cadence rather than reactive changes. Requires enough traffic to reach significance. If volume is low, tests take longer. Each test's result goes into DECISIONS.md with the variant that won and by how much.

---

### 25. Never store secrets on the profiles table

**Date:** 2026-06-10
**Status:** Accepted (enforced by migration)
**Context:** The production schema audit found `profiles` is publicly readable by design (`profiles_read_all USING true`, so public breeder pages work), but the Base44-era schema carried `morphmarket_api_key` and `palm_street_api_key` columns on that same table. No code referenced them and all 93 rows held NULL, so nothing leaked, but the shape was a loaded gun.
**Decision:** Dropped both columns (migration `20260610120000_drop_public_api_key_columns.sql`, applied to production). Standing rule: `profiles` is a public table; secrets and third-party credentials go in an owner-only table or in edge function secrets, never on profiles.
**Reasoning:** Anonymous visitors can SELECT every profiles column through PostgREST. A future feature storing a key there would expose it to anyone instantly. Removing the columns makes the mistake structurally impossible rather than relying on review to catch it.
**Consequences:** If MorphMarket or Palm Street API sync is ever built for real, it needs a new owner-only storage design first. `stripe_customer_id` / `stripe_subscription_id` remain on profiles (opaque IDs, unusable without the Stripe secret key, and billing flows depend on them); revisit if that ever becomes uncomfortable.

---

### 26. Morph guide explains BOTH genetics models instead of picking one

**Date:** 2026-06-10
**Status:** Accepted (enforced by check)
**Context:** The traditional hobby describes Harlequin, Pinstripe, Dalmatian, Tiger, and the base colors as "polygenic." Foundation Genetics (a reference authority per STRATEGY.md) models the underlying loci as Mendelian (dominant, incomplete dominant, fixed dominant, or recessive) with polygenic expression modifiers on top. The genetics drift check surfaced the conflict between our guide content and the engine the calculator runs on.
**Decision:** Affected morph guide entries keep their traditional `inheritance` label (which also pins the `/MorphGuide/inheritance/...` hub grouping and existing URLs) and carry a `foundationGenetics` paragraph explaining both readings. MorphDetail renders it as a "Two ways to read the genetics" section. `scripts/check-genetics-consistency.mjs` fails CI if a disagreeing entry lacks the paragraph or the paragraph stops naming the engine's model.
**Reasoning:** Both framings are genuinely used by breeders; picking one would either contradict the calculator (pure polygenic) or read as revisionist to longtime keepers (pure Mendelian). Explaining both is more honest, more useful, and differentiates the guide from competitors that copy one framing uncritically.
**Consequences:** Seven entries carry dual-model text today (harlequin, pinstripe, dalmatian, super-dalmatian, tiger, red-base, yellow-base). New entries that disagree with the engine must ship with the explanation or CI fails. If Foundation Genetics updates a model, the engine package update will surface every entry that needs new text.

---

### 27. Proposed: keep Keeper at $2.99, raise Breeder to $9.99

**Date:** 2026-07-08
**Status:** REJECTED 2026-07-09. Tennyson decided to keep Breeder at $5.99 (the low, accessible price is intentional; the whole point of the app is that existing options felt too expensive). The value-audit and migration mechanics in the memo stay useful if pricing is ever revisited, but no price change is planned.
**Context:** Keeper ($2.99) and Breeder ($5.99) both sit below the market band (hobbyist $4.99 to $7.99, serious breeder $9.99 to $19 per STRATEGY.md). Breeder in particular is priced like a hobbyist tier while shipping serious-breeder features (unlimited collection, MorphMarket sync, certificates, analytics). Full analysis in docs/specs/pricing-decision-2026-07.md.
**Decision (proposed):** Keep Keeper at $2.99 as a keeper-first acquisition wedge (undercuts ReptiDex's $4.99), and raise Breeder from $5.99 to $9.99 (annual $60 to $100), grandfathering existing subscribers via new Stripe price_ids. Do not market Enterprise until its market-intelligence data is live (currently preview-only). Do not raise Breeder until shipping integration works or is dropped from the feature list.
**Reasoning:** Breeders are the least price-sensitive segment and get the most value, so the raise lands there with least churn risk while roughly doubling Breeder ARPU; keeping Keeper cheap protects the 80%-of-market keeper funnel that is the whole thesis. Modeled ~$174K ARR at 2000 paying users vs ~$142K at current prices, recovering ~85% of a full market-align raise without sacrificing the wedge.
**Consequences:** Requires new Stripe prices + a grandfathering mapping in stripe-config, an in-app/email announcement (framed as "lock in $5.99 before the raise"), and 30 days of churn monitoring. Depends on the Phase 1 to 2 value fixes already shipped (marketplace_sync now in Breeder, analytics honesty, pricing/trial consistency). Open question: a mid "Business" tier (~$19 to $29) may be warranted later given the large Breeder-to-Enterprise gap.

---

### 28. PWA install prompt yes, offline caching deferred

**Date:** 2026-07-09
**Status:** Superseded by entry 29 (offline caching shipped 2026-07-09 with a network-first design that removes the white-screen risk this entry was guarding against)
**Context:** Roadmap item 6.1 wanted a PWA push: install-to-home-screen plus offline support via a caching service worker. On inspection, the install path already exists (`InstallAppButton.jsx` wired into `Layout.jsx`, handling `beforeinstallprompt`/`appinstalled`/standalone), the manifest is present, and `public/sw.js` is deliberately push-only with an explicit comment that layering a cache on top is a well-known cause of "stuck on an old version" bugs.
**Decision:** Keep the install prompt (already live). Do NOT ship an offline caching service worker blind. A caching SW is the single highest-risk change in the whole plan: a bad cache strategy or update lifecycle can white-screen the app for returning users and persists on their devices in a way a git revert does not immediately fix. It cannot be responsibly verified without runtime testing across install, update (skipWaiting), and offline scenarios, which is not available in the headless session where the rest of this work was done.
**Reasoning:** The user-facing PWA value (installable app, push notifications) is already delivered. Offline read of the collection is a real but secondary benefit, and the failure mode of getting the SW wrong is severe and hard to reverse. The correct place to build it is a focused session with a preview deploy and device testing, not a blind push to production main.
**Consequences:** Offline collection access remains unbuilt. When it is built, do it on a preview branch: version the cache, precache only the hashed app-shell assets, use network-first for Supabase calls and stale-while-revalidate for static assets, and ship an explicit "update available" toast that calls skipWaiting so users are never stranded on a stale worker. Test the full install/update/offline lifecycle on a real device before merging.

---

### 29. Offline caching service worker shipped (network-first, white-screen-proof)

**Date:** 2026-07-09
**Status:** Accepted
**Context:** Entry 28 deferred the offline caching worker because a bad cache strategy can white-screen returning users and the SW persists on-device past a git revert. Revisiting it, the specific failure mode entry 28 feared (a stale cached HTML shell shadowing a new deploy) is entirely a property of *cache-first* navigation. It disappears if navigations are network-first.
**Decision:** Ship offline caching in `public/sw.js` with a safety-first strategy rather than continue deferring it:
- **Navigations are network-first.** An online visitor always fetches fresh HTML from the server. The cached shell is served *only* when the network is unreachable. So a stale page can never shadow a new deploy for an online user, which is the whole risk entry 28 was guarding against.
- **Hashed `/assets/` output is served cache-first** because Vite fingerprints the filename, so those bytes are immutable and safe to keep forever.
- **Other same-origin static files use stale-while-revalidate** (instant from cache, refreshed in the background).
- **Cross-origin requests (Supabase, Stripe, storage, analytics) are never intercepted**, so collection/API data is always live and never served stale.
- `CACHE_VERSION` namespaces the caches; the activate handler purges older generations. All existing web-push handlers and the iOS `skipWaiting()` behavior are untouched.
**Reasoning:** Network-first navigation converts the highest-risk item in the plan into a low-risk one: the worst case for an online user is one extra network round-trip (identical to no SW at all), and the benefit is that the app opens instantly and the last-seen shell is readable offline. This is the standard, boring, safe PWA pattern.
**Recovery path (important, since a SW outlives a git revert):** If a future SW change ever misbehaves on a device, the fix is to (1) bump `CACHE_VERSION` and change the SW body so the browser detects an update and `skipWaiting()` swaps it in on next load, or (2) as a hard reset, ship a SW whose `activate` handler runs `caches.keys()` then deletes every `geck-*` cache and calls `self.registration.unregister()`. Because navigations are network-first, even a totally empty/broken cache still falls through to the live network, so a returning user is never fully stranded.

---

### 30. Referral reward is a free month of Keeper, not a revenue share

**Date:** 2026-09-04
**Status:** Accepted
**Context:** The launch review (F41) found the referral program half-built: the sidebar card promised "10% of every subscription paid by anyone who signs up through it, for life", but the migration that adds the referral columns and the payout ledger was never applied, and no code anywhere wrote a payout. The card hid itself, attribution updates failed silently, and the Stripe webhook called a Social Media Manager bonus function that reads columns that do not exist. Removing the program or shipping the 10 percent promise without a payout path were both on the table.
**Decision:** Keep the program, change the reward to something the platform delivers on its own. When a referred member pays their first real invoice, the referrer gets exactly one reward per referred member: a free-tier referrer becomes Keeper for 30 days (stacking when several referrals pay), a Stripe subscriber gets one month of their plan credited to their Stripe balance, and anyone else (grandfathered, App Store, lifetime) gets a ledger row marked needs_manual for an admin to settle. Free signups earn nothing, so fake accounts are worthless. Attribution is recorded server-side once and cannot be re-pointed by the member. A daily pg_cron job returns lapsed months to free and never touches a live Stripe or RevenueCat subscriber.
**Reasoning:** A cash revenue share needs payout rails (Stripe Connect or manual transfers), tax handling, and terms, none of which exist, and promising it to members without them is a liability. A free month of Keeper is understood instantly, costs forgone revenue rather than cash, converts free members into Keeper users for a month, and reuses the tier machinery that already gates every feature. The missing piece was expiry enforcement, which is one small function and a cron entry.
**Consequences:** `referral_rewards` is the ledger; rows with `applied_at` null need attention (Stripe credit failed or needs_manual). The webhook needs `STRIPE_SECRET_KEY`, which the project's edge functions already share. If the reward changes again, the copy lives in ReferralLinkCard.jsx and the rules in `award_referral_reward()`.

---

### 31. Automatic value estimates from listing asking prices, free, owner-only on gecko pages

**Date:** 2026-09-27
**Status:** Accepted
**Context:** The Collection Portfolio priced animals off `morph_price_cache`, which held one row, so almost every gecko showed no value. The Geck Data market schema already tracks roughly 9,900 crested gecko listings with traits, maturity, and sex. Tennyson asked for the Portfolio to estimate value automatically from a gecko's selected traits, for the estimate to appear on the gecko detail page, and for the feature to be advertised.
**Decision:** `public.trait_value_table()` serves p25, median, and p75 asking prices per crested trait, split by age class and sex, with the same filters as `geck_data.v_listing_value`. The app matches a gecko's traits against it, prices off the most valuable matched trait, and uses the quality tier to pick a point in the band (pet p25, breeder median, high-end halfway to p75, investment p75). It is free on every plan. On the gecko detail page the estimate is shown only to the owner. Other species are never priced from crested listings. Marketing copy calls it "real crested gecko listings" rather than the internal "Geck Data" name.
**Reasoning:** Listing asks are the largest honest price signal available; sold prices are too sparse to split by trait, age, and sex. Pricing off the top trait mirrors how the market sells a Lilly White Dalmatian (as a Lilly White) and matches Geck Data's own per-listing comparison. A free estimate is a strong activation hook for the free tier. Showing a buyer an estimate beside a seller's asking price would undercut sellers, so it stays private.
**Consequences:** Estimates are asks, not sale prices, and every surface says "estimate, not an appraisal". Trait combinations (Axanthic Lilly White) price off the single best trait, which undervalues stacked morphs; a combo-aware band is the next step if breeders ask for it. The RPC costs about 1s per call and is cached per session; move it to a materialized view with its own refresh job if it gets hot, and do not add it to `geck_data.refresh_market_matviews`, which the geck-data repo also edits.

---

### 32. Positioning: the business side of breeding, for new and small crested gecko breeders

**Date:** 2026-09-29
**Status:** Accepted (confirmed by Tennyson)
**Context:** Tennyson wants Geck Inspect known as the app that helps breeders succeed on the business side of breeding, especially newer and smaller breeders. A review of the business tools (docs/planning/vip-audit-2026-09-27.md, section 2C) found the pieces spread across a dozen pages, three of them showing wrong or made-up numbers, and almost nobody finding them. A four-step sprint fixed the numbers, made profit and loss real (sold prices, costs tied to pairings, profit by season and pairing), added a pairing value to every breeding plan, gathered everything into Business Tools (Money, Sales, Pricing), and added a buyer packet.
**Decision:** Lead with the business side. The landing page opens with "Price right. Pair smart. Sell with proof." and gives its three showcase sections (decision 13) to: know what it's worth (value estimates and asking-price ranges from real listings), pair for profit (offspring odds times hatchling prices, per egg), and sell with proof (passport, transfer, buyer packet, profit tracking). Everything else is one line under "Also in every account". Crested-gecko-first stays the identity: every number comes from crested gecko listings and the genetics engine is crested-only.
**Reasoning:** Competitors are multi-species or marketplace-first (STRATEGY.md). A new breeder's hardest questions are money questions (what to charge, which pairing is worth the eggs, did the season pay), and Geck Inspect can answer them from real crested gecko data. The three sections replace the showcase picks in decision 13 (Morph ID, calculator, pedigrees): the calculator and pedigrees now appear inside "pair for profit" and "sell with proof", and Morph ID moves to the "also included" line with its free first identification.
**Consequences:** Landing copy, SEO titles and social previews say "crested gecko breeding app for pricing, pairings and sales". Business Tools, the Portfolio, the pairing value panel and the buyer packet are the product's front door and must keep showing honest numbers: asking prices labeled as asking prices, unconfirmed sales flagged. Morph ID accuracy work continues but is no longer the headline.

---

### 33. Waitlist deposits are records, not payments; waitlists are a Breeder feature

**Date:** 2026-09-29
**Status:** Accepted (confirmed by Tennyson)
**Context:** Waitlists with deposits shipped on 29 Sep (P9.2): a breeder opens a waitlist for a pairing, buyers join and pick the outcome they hope for, and the breeder records deposits and matches buyers to hatchlings. The open question was whether Geck Inspect should take the deposits itself through Stripe, and what to charge for it.
**Decision:** Geck Inspect records deposits and never handles the money; buyers pay the breeder directly. Each waitlist carries written deposit terms, starting from an editable default (the deposit holds a place and counts toward the price; refundable until the buyer accepts a match; if the pairing misses, the buyer chooses a refund, next season or another gecko; transferable after a match; full refund if the breeder cancels). Buyers must agree to the terms to join, and the database keeps each buyer's exact wording and time. Signups can be marked Refunded. No fee on deposits or sales: waitlists earn money through the Breeder plan, which is required to create one.
**Reasoning:** Holding buyers' money makes the platform liable for identity checks on breeders, tax forms and chargebacks, and waitlist deposits sit for months, which is the worst case for disputes. INTENT.md says Geck Inspect is not a marketplace, and a cut of animal sales would make it one. There was no demand yet (no waitlist existed). Most deposit fights in the hobby come from unwritten terms, which the terms and agreement record address directly.
**Consequences:** Revisit card payments when about ten breeders are actively using waitlists and asking for them. If built, use Stripe Connect Standard accounts with direct charges, so each breeder is the seller of record, pays the card fees, handles refunds from their own Stripe dashboard and owns disputes, and Geck Inspect never holds funds. Check Stripe's restricted business list for live animal sales before starting.

### 34. The feature audit is the roadmap; blog work is shelved

**Date:** 2026-09-30
**Status:** Accepted (Tennyson)
**Context:** ROADMAP.md still carried the May 2026 plan and the 29 Sep NOW list. Tennyson said the parts left no longer apply. The feature completeness audit of 29 Sep already holds everything still worth doing.
**Decision:** `docs/planning/feature-completeness-audit-2026-09-29.md` is the plan. ROADMAP.md is now a pointer to it, a list of what is shelved, and a table of what each old item became. Blog posts and articles are shelved until Tennyson says otherwise: nothing is written, drafted, published or suggested, and the blog pipeline stays off.
**Reasoning:** One plan instead of two, so every session picks up the same next step. Shelving the blog is Tennyson's call.
**Consequences:** The comparison draft stays in `docs/drafts/` untouched. Blog topic ideas in the weekly growth report are data, not tasks. The blog half of plan step 33 waits. The RevenueCat and store setup checklist moved from the ROADMAP appendix to `docs/app-store-billing.md`.

### 35. The Market page: the market as a daily habit, member-only for now

**Date:** 2026-09-30
**Status:** Accepted
**Context:** Tennyson asked how to make the market analytics useful and interesting enough that members come back a couple of times a week, and some every day. The market data was only a set of charts in Business Tools and on the Geck Data site: nothing told a member when something changed that mattered to them.
**Decision:** Build a loop around change that is personal: a daily snapshot of the market and of each member's collection value; market lines on the Today card and in the Sunday digest; watchlists that notify after each market check; a morning brief (opt-in, sent only on mornings with news for that member); a live feed of new listings and price cuts from the US, Korea, Japan and Europe; Guess the Price (five real listings a day, the same for everyone, with a streak); and a seller view on the Breeder plan. All of it lives on a new member page, /Market. The number that says whether it works is the share of weekly active members who open something market-related on two or more days a week (Admin, Product Analytics, Market habit).
**Reasoning:** Charts are visited once; news about your own animals, your own watches and your own listings is what brings people back. A daily game gives a reason to come back on days with no news and trains the pricing eye breeders need. Everything shows asking prices on listings and says so, never sale prices. The page is member-only because its photos come from MorphMarket listings and D20 (scraped listing photos on public pages) is still open. The morning brief is off by default so nobody gets a daily email they did not ask for.
**Consequences:** The loop only feels alive while MorphMarket is checked: the US feed has been off since early September (GitHub is blocked), and until Tennyson runs the Mac setup or adds the proxy secret, US numbers come from the last full check and the live feed shows Korea, Japan and Europe only. A 30-minute newest-listings check (geck-data) now keeps new listings flowing within the hour once the feed is on. Details in `docs/planning/market-habit-2026-09-30.md`.


### 36. Market Intelligence absorbs the Marketplace; one grouped sidebar replaces Manage and Discover

**Date:** 2026-10-06
**Status:** Accepted (Tennyson)
**Context:** The app had two Market pages side by side (Market and Marketplace), and the sidebar showed only half the pages at a time behind Manage and Discover tabs, so a keeper in My Geckos never saw Morph ID or the market.
**Decision:** Market is now Market Intelligence. Its tabs are Today, Live, Watchlist, In-app listings (the old Buy page, replacing Guess the Price) and Your listings (the Seller Console plus the Breeder plan comparison). /Marketplace redirects to the In-app listings tab. The sidebar is one list in five groups (Collection, Breeding, Tools, Learn, Community) that members can fold. On phones the bottom bar is Home, My Geckos, Morph ID, Market and Menu.
**Reasoning:** Morph ID and the market are the subscription magnets, and the old tabs hid them half the time. Nineteen pages fit in one grouped list, and Keeper mode trims it to about eleven.
**Consequences:** Group membership and order live in code (NAV_GROUPS in src/lib/navItems.js). The section setting in admin Page Management no longer changes the sidebar; only its Hidden bucket does. Guess the Price is out of the app but its code stays.

### 37. The iPhone home screen app uses the opaque status bar

**Date:** 2026-10-06
**Status:** Accepted (Tennyson asked for the app to fill the screen)
**Context:** On iPhone, the app added to the home screen ended 47 points above the bottom of the screen, and a dark green strip (the page's body color) filled the rest. The cause is an iOS 26 bug (WebKit 301108): with the translucent status bar style, iOS draws the app from the top of the screen but sizes it as if it started below the status bar. No CSS or script can paint into that strip; other projects tried taller heights, measured heights and bleed layers on real devices and all failed.
**Decision:** `apple-mobile-web-app-status-bar-style` is `default` instead of `black-translucent`. iOS then gives the app an opaque status bar, tints it with `theme-color` (#064e3b, the header green), and sizes the app from below the status bar to the bottom edge. The body color is now the bottom bar's color over the page (#061f1e at the time of writing), so installs made before this change, which keep the old style until reinstalled, show the strip as part of the bar.
**Reasoning:** The status bar keeps the green header look, and the bottom bar reaches the screen edge with only the home indicator's padding. Switching styles is the only fix confirmed on devices.
**Consequences:** Do not switch back to `black-translucent` unless Apple fixes the bug. iOS reads the tag only when the app is added, so anyone who installed it before 6 Oct 2026 must remove it from the home screen and add it again to lose the strip. Pages no longer draw under the status bar on iPhone, so `env(safe-area-inset-top)` is 0 there; the headers already pad with it, so nothing else changes.

### 38. Market Intelligence is Enterprise only, and Enterprise goes on sale

**Date:** 2026-10-06
**Status:** Accepted (Tennyson asked for it)
**Context:** Every signed-in member, free included, could use the Market Intelligence page in full: the daily brief, the live feed, watchlists and the pricing analytics on Business Tools. The Membership page listed it under Enterprise, but Enterprise was marked Coming soon, so nobody could buy it.
**Decision:** Today, Live and Watchlist on /Market and the Market analytics section on Business Tools need the `market_intelligence` feature (Enterprise, and admins). Other plans see a short, faded, read-only slice of the real panel with an upgrade card (src/components/subscription/MarketPreviewGate.jsx). In-app listings, the Seller Console and the Breeder "Against the market" view are unchanged. Enterprise is on sale at the existing Stripe prices, $99.99 a month or $1,000 a year, with the optional 7-day trial like the other paid plans.
**Reasoning:** The market data is the one thing no competitor has, and it costs real money to collect. Giving it away on Free left Enterprise with nothing to sell.
**Consequences:** The gate is in the app only. The brief, tape and watchlist database functions still answer any signed-in member, and watches saved before this change keep sending alerts. A server-side check (effective_tier_for_current_user() in those functions, as the seller view already does) closes that. A price of exactly $100 needs a new Stripe price and its id swapped into stripe-config.js and both edge functions. Decision 21 (Enterprise as a sales-led waitlist) is superseded.

### 39. The phone bars are liquid glass; the warp runs in Chromium only

**Date:** 2026-10-06
**Status:** Accepted (Tennyson asked for liquid glass bars)
**Context:** Tennyson asked for the phone header and bottom bar to be liquid glass: mostly transparent, with a slight warp of what passes behind them. The page never passed behind the header (it sat above the scroll area). The warp needs an SVG filter on the backdrop, which only Chromium renders: Safari has an open WebKit bug (245510) and drops the whole backdrop-filter, blur included, when it sees url() there.
**Decision:** On phones the header floats over the page (fixed, its height measured into `--top-bar-h`), and the scroll area pads its top by that height. Both bars use `.liquid-glass` (layout-theme.css): a light blur that lifts color and brightness, a faint white tint, and a bright inner edge. In Chromium, `html.glass-warp` (set in main.jsx) adds `#gi-glass-warp`, soft noise through feDisplacementMap, so the page ripples as it scrolls behind. The iPhone status bar (theme-color) is now the active theme's page background instead of the header green (decision 37), so it does not read as a green strip above a clear header.
**Reasoning:** This is as close to Apple's Liquid Glass as the web allows today. iPhone gets the glass without the ripple until Safari renders SVG backdrop filters.
**Consequences:** Never let Safari see url() in a backdrop filter. When WebKit ships SVG backdrop filters, widen the `glass-warp` check in main.jsx. Sticky parts of pages keep `top-0`: Chrome and Safari keep sticky boxes inside the scroll area's padding, so they stop just below the header. Desktop is unchanged.

### 40. Time to sell estimates, from the May to June sales window

**Date:** 2026-10-06
**Status:** Accepted (Tennyson asked for it)
**Context:** Members wanted to know how long a crested gecko like theirs takes to sell. The only listing-level sale dates are from 17 May to 7 Jun 2026, when the scraper still marked listings as sold (6,520 listings with an age class, 1,774 sold). Since then sales are counted only per morph per day ("came down"), which cannot be tied to one gecko's traits.
**Decision:** `public.sell_time_model()` returns the market's sales rate (sales per listing-day) and a multiplier for each age class, sex, price position (against the median for the same age and leading trait) and trait with at least 20 listings. Small groups are pulled toward the market rate. The app (src/lib/sellTime.js) multiplies the factors that fit a gecko (the traits as one geometric mean, so correlated traits do not stack) and shows how long until half of geckos like it sell, plus the chance it sells within 2 weeks and within a month. It appears on the gecko's Estimated Value card and on the Sell page price helper. Enterprise only, checked in the database function; other plans see one locked line.
**Reasoning:** A steady-rate model fits the data (it predicts 15% sold in 2 weeks; 15% were) and lets three weeks of sales say something about a two-month wait. Across the market half sell in about 58 days; hatchlings, unsexed geckos, Axanthic and Cappuccino sell faster; adults, males, Partial Pinstripe and Cream slower; pricing well below similar geckos speeds a sale by about 20%.
**Consequences:** The numbers are from spring 2026 and do not move until sales are tracked per listing again. When the scraper records sold dates again the function picks them up with no change (it uses the whole sold window). Times past a month are projections and the card says so.
