# Geck Inspect Landing Page — DECISIONS.md

> **Purpose of this file.** A running log of every meaningful decision made about the landing page, the reasoning behind it, and the context at the time. `CONTEXT.md` answers *what is this*. `INTENT.md` answers *why is it that way*. This file answers *what changed, when, and why* — so that months from now we can see the full history of how the landing page evolved, which experiments worked, and which ideas were tried and rejected.
>
> **How to use this file.**
> - Each decision gets its own numbered entry.
> - Entries are append-only. Don't edit or delete old entries — if a decision is reversed later, add a new entry that supersedes it and references the old one.
> - Use the format below. Keep it short — one short paragraph per field is plenty.
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

## Seed entries — decisions made during the April 2026 landing page research session

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
**Context:** Currently `geckinspect.com` serves a React SPA shell — a visitor sees an almost-empty HTML page with JS that then builds the app. This is fine for the app itself but terrible for a marketing landing page: slow initial paint, poor SEO, no content visible without JS.
**Decision:** Build the landing page as static HTML, served separately from the SPA. The app lives at `/app` (or similar subpath), the marketing page at `/`.
**Reasoning:** Research consistently shows every second of load time costs ~7% of conversions; pages loading in 1 second convert 3x better than 5-second pages. A static landing page can load in well under 2 seconds. Pre-rendered HTML is also fully crawlable by Google without JS execution, which matters for SEO.
**Consequences:** Commits to treating the marketing surface and the app surface as two separate deployables. Either two Vercel projects, or one Next.js project with both static pages and the SPA under one roof. Slight maintenance overhead, but large conversion and SEO payoff.

---

### 3. Lead with founder credibility — "by a breeder, for breeders"

**Date:** 2026-04-21
**Status:** Accepted
**Context:** Competitor analysis showed the reptile software space is crowded with faceless "AI-powered platform" pitches. ReptiDex and HerpTracker use generic corporate framing. Breed Ledger leads with "built by an active breeder" and gets real traction from that positioning.
**Decision:** Put Tennyson's face, name, brand (tennyscrestedgeckos.com), and story prominently on the landing page. Include a 200-word founder story with a photo.
**Reasoning:** Niche hobbyist audiences trust people, not logos. A real breeder with an active operation is a structural credibility signal that competitors can't easily replicate. This is also the cheapest trust-building move available — no ad spend, just honesty.
**Consequences:** Commits Tennyson to being publicly associated with the product. The founder story and photo must be kept current. If the founder ever steps back from active breeding, this positioning needs revisiting.

---

### 4. Use "Start Free" as the primary CTA, never "Sign Up"

**Date:** 2026-04-21
**Status:** Accepted
**Context:** CTA wording has disproportionate impact on conversion. Research documents a 104% lift in trial starts from changing "Sign up for free" to "Try for free" on one SaaS product.
**Decision:** Primary CTA across the entire landing page is `Start Free →`. Never "Sign Up," "Register," "Submit," or "Create Account."
**Reasoning:** "Start" and "Try" reframe the action as exploratory rather than committal. "Sign up" implies ongoing obligation and triggers resistance. First-person variants ("Start my free account") may lift another 90% — worth A/B testing once we have traffic volume.
**Consequences:** All buttons, nav CTAs, and inline CTAs use this language. Requires discipline — any future copywriter or AI will default to "Sign Up" unless reminded.

---

### 5. Dark mode as the primary design aesthetic

**Date:** 2026-04-21
**Status:** Accepted
**Context:** The competitive set (Husbandry Pro, ReptiDex, HerpTracker, MorphMarket) all use bright, clinical, white-background interfaces. There was an option to go with a similar aesthetic to feel "familiar" to the category.
**Decision:** Primary visual direction is dark mode — deep charcoal background (~`#0E1410`) with green undertone. Accent color is crestie cream/sulfur (`#F4E4A1`). Secondary accent is forest green for genetics/data moments. Light mode toggle supported but dark is default.
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
**Decision:** Hero uses a looping 6–10 second animated product video (autoplay muted, lazy-loaded). Feature sections each have real product visuals, not illustrations. No stock imagery anywhere.
**Reasoning:** For UI-heavy SaaS products, animated visuals outperform screenshots, which outperform illustrations, which outperform text. This is documented across multiple 2026 conversion analyses. Interactive live demos would convert even better but are significantly more expensive to build — animated videos are 80% of the value at 10% of the effort.
**Consequences:** Need to produce a looping product video showing collection grid → gecko profile → pedigree tree → genetics calculator → predicted clutch. This is an asset gap that must be filled before launch. Rules out static screenshot shortcuts.

---

### 8. Show pricing on-page, not behind "Contact Us"

**Date:** 2026-04-21
**Status:** Accepted
**Context:** Many B2B SaaS pages hide pricing behind contact forms. For Geck Inspect's audience — hobbyist-to-small-business breeders — this would be a trust killer.
**Decision:** Display all four tiers (Free / Keeper $4 / Breeder $9 / Enterprise) with prices, features, and a CTA on each card. Enterprise shows "Contact for pricing" with a waitlist CTA but the other three are fully transparent.
**Reasoning:** Hidden pricing reads as expensive or manipulative to hobbyist audiences. This audience expects hobbyist-friendly pricing transparency — they're comparing against a $5/month competitor openly. Hiding pricing would lose the comparison before it started.
**Consequences:** Pricing changes must be handled carefully — the page itself becomes part of the pricing commitment. A/B testing pricing requires care.

---

### 9. No chatbots, no fake urgency, no stock photography

**Date:** 2026-04-21
**Status:** Accepted
**Context:** 2026 landing page trends include AI chatbots, countdown timers, "only 3 spots left" messaging, and stock imagery. These can lift conversions in some categories. The question was whether they fit Geck Inspect's audience.
**Decision:** Do not use any of these. No marketing chatbot. No countdown timers. No "limited spots." No stock photos of geckos or people.
**Reasoning:** The crested gecko hobbyist community is tight-knit and detects inauthenticity quickly. Fake urgency on a $4/month hobbyist tool reads as desperate. Stock photography reads as amateur. A chatbot reads as corporate and off-brand. These tactics might work for enterprise SaaS — they won't work here.
**Consequences:** Rules out a set of common "conversion hacks." Commits to earning trust through honesty and product quality rather than pressure tactics.

---

### 10. Lead testimonials with names, faces, and specific outcomes

**Date:** 2026-04-21
**Status:** Accepted
**Context:** The current user base is ~88 keepers — small but real. Could use anonymous or generic testimonials, aspirational copy ("Built for breeders everywhere"), or skip social proof altogether until the numbers are bigger.
**Decision:** All testimonials must include a full name, photo, and specific outcome ("migrated from 3 spreadsheets in an hour," "planned my first Lilly White pairing in 10 minutes"). Anonymous or generic testimonials don't ship. Live user stats ("250 geckos tracked by 88 keepers") are used as genuine small-but-specific social proof.
**Reasoning:** Small, specific, believable social proof outperforms large, vague, unbelievable social proof. "Trusted by 88 breeders" is more trust-building than "Trusted by breeders worldwide" when it's true.
**Consequences:** Must email existing users to collect testimonials with photos — this is a blocking asset gap. Commits to never inflating numbers or using fake testimonials, even under pressure.

---

### 11. "Your data, always exportable" as explicit trust micro-copy

**Date:** 2026-04-21
**Status:** Accepted
**Context:** The reptile software community has been burned — by Base44 platform lock-in, by MorphMarket's mediocre app, by apps that died and took data with them. Data portability is a specific active anxiety for this audience.
**Decision:** The phrase "Your data, always exportable" (or a close variant) appears directly under the primary CTA in the hero and again in the objection bar. Backed by a real CSV export feature available on all tiers, including free.
**Reasoning:** This is a load-bearing trust promise. The audience is specifically scanning for this signal. Stating it upfront, in plain language, kills one of the top-three objections before it forms.
**Consequences:** Commits to building and maintaining a real CSV export feature on all tiers. If export is ever broken or removed, this copy must come down immediately — the promise is only valuable if it's honored.

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
**Context:** Geck Inspect has many features — collection management, AI morph ID, genetics calculator, pedigrees, QR codes, weight tracking, feeding logs, shed tracking, market analytics, team collaboration, etc. The standard SaaS pattern is a grid of 6–9 small feature cards.
**Decision:** Only three features get their own substantial on-page section: AI Morph ID, Genetics Calculator, and Pedigrees with QR Codes. Each gets generous whitespace, a real product visual, and room to breathe. Other features are listed briefly in pricing tiers but don't get showcase space.
**Reasoning:** Research is clear that dense feature grids underperform deep single-feature showcases. Three features is the maximum before cognitive overload sets in. The three chosen are the most differentiated from competitors — the strongest proof of the crestie-specific positioning.
**Consequences:** Many real features go unmentioned on the landing page. That's fine — they get discovered in the app. The page's job is to get the sign-up, not to be a feature catalog.

---

### 14. Mobile-first design, sub-2-second load as a hard requirement

**Date:** 2026-04-21
**Status:** Accepted
**Context:** 62–83% of landing page traffic is mobile. Mobile conversion rates are typically 40–50% lower than desktop, largely due to friction that's invisible on desktop.
**Decision:** Design mobile-first, not desktop-adapted-to-mobile. All tap targets ≥48×48px, thumb-zone CTAs, vertical-first media. Total page load under 2 seconds on mobile (measured via PageSpeed Insights, target 90+ score).
**Reasoning:** Treating mobile as the starting point (rather than an adaptation) is the only way to avoid the mobile conversion gap that plagues most SaaS landing pages.
**Consequences:** Hero video must be lightweight (WebM preferred, H.264 fallback, poster image, lazy-loaded). Images are WebP, compressed. No heavy JavaScript libraries for the marketing page. This rules out some visually ambitious effects.

---

### 15. Plausible or PostHog for analytics, not Google Analytics

**Date:** 2026-04-21
**Status:** Accepted
**Context:** Analytics is non-optional — we need to know if the page converts. Standard choice is Google Analytics 4.
**Decision:** Use Plausible or PostHog (privacy-friendly, lightweight alternatives). Single primary conversion event: "started sign-up." Secondary events: scroll depth to pricing, completed sign-up, time on page.
**Reasoning:** Lighter than GA4 (faster page load), privacy-friendly (no cookie banner required in most jurisdictions), and the audience skews toward people who appreciate privacy-aware tools. Tracks what we actually need without the complexity.
**Consequences:** Commits to a particular analytics vendor. Commits to not chasing vanity metrics (page views, sessions, bounce rate in isolation) — only metrics that correlate with sign-ups.

---

### 16. Split CONTEXT / INTENT / DECISIONS across three files

**Date:** 2026-04-21
**Status:** Accepted
**Context:** Landing page strategy involves factual context, strategic reasoning, and a running history of choices. Could all live in one document.
**Decision:** Three separate files — `CONTEXT.md` (facts about the project), `INTENT.md` (strategic reasoning and principles), `DECISIONS.md` (this file — running log of specific decisions with dates).
**Reasoning:** Each file answers a different question and has a different lifecycle. CONTEXT changes when facts change. INTENT changes rarely, when strategy shifts. DECISIONS is append-only. Mixing them creates a document that's hard to update cleanly and hard for future collaborators to parse.
**Consequences:** Slight overhead in maintaining three files instead of one. Offset by much better clarity for future Claude Code sessions — which will be working from these files frequently.

---

## [Add new decisions below as they're made — append only, don't edit above]

---

### 17. Migrate authentication from Base44 to Supabase Auth

**Date:** 2026-04-21
**Status:** In progress
**Context:** Geck Inspect was migrated from Base44 to a self-managed GitHub + Supabase + Vercel stack in early April 2026. At time of migration, auth was still routing through Base44 while the rest of the stack had moved to Supabase — a transitional state that shouldn't ship long-term.
**Decision:** Replace Base44 auth with Supabase Auth as the single source of truth for user authentication. All existing ~88 users must be migrated without losing accounts, subscription status, or data linkage.
**Reasoning:** Keeping Base44 in the auth path means Geck Inspect is still dependent on a platform we're intentionally moving away from. It's a hidden single point of failure and a lock-in risk. Supabase Auth integrates cleanly with the existing Supabase database, supports email/password and social logins, and removes the last Base44 dependency.
**Consequences:** Requires a migration plan for existing users (likely a password reset flow or magic-link re-onboarding). Once complete, Base44 can be fully decommissioned as a dependency. Commits to Supabase as the auth vendor going forward.

---

### 18. Complete Stripe payment integration

**Date:** 2026-04-21
**Status:** In progress
**Context:** The pre-migration Base44 audit identified gaps in the Stripe integration — some remediated, some still open. Membership tiers (Free / Keeper $4 / Breeder $9 / Enterprise) are defined in the UI but not fully wired to live payment processing on the new stack.
**Decision:** Finish the Stripe integration so that Keeper and Breeder tiers can process real subscriptions, handle upgrades/downgrades, manage failed payments, and sync subscription status to the Supabase user records. Enterprise remains waitlist-only (email to tennysontaggart@gmail.com) until productized.
**Reasoning:** Revenue depends on this working. Without live payment processing, the pricing tiers on the landing page are aspirational rather than real, which creates trust risk if a visitor signs up and hits a broken checkout.
**Consequences:** Blocks the landing page launch if payments aren't working — the page will show prices for tiers that can't actually be subscribed to. Commits to Stripe as the payment vendor. Requires webhook handling, subscription lifecycle management, and a customer portal for existing subscribers.

---

### 19. Integrate the Foundation Genetics module into the live app

**Date:** 2026-04-21
**Status:** Pending
**Context:** A standalone, headless TypeScript genetics module ("Foundation Genetics") was built via Claude Code as the canonical source for crestie traits, inheritance rules, and breeding math. Geck Inspect's existing genetics code predates this module and uses its own morph tag system with different terminology.
**Decision:** Integrate the Foundation Genetics module as the genetic truth layer for all of Geck Inspect. This requires: (1) an audit of existing genetics code in the app, (2) a schema migration to align morph storage with the new taxonomy, (3) a component refactor to use the new module's API, and (4) data migration for existing user morph records.
**Reasoning:** Having two genetics systems in one codebase creates bugs, inconsistencies, and maintenance cost. The Foundation module is the deliberate, correct taxonomy — the existing code is legacy. Consolidating to one source of truth is the right long-term move even though it's a meaningful refactor.
**Consequences:** Not a drop-in — requires real engineering work. Must be done carefully to avoid disrupting existing user data. Commits to the Foundation Genetics module as the canonical taxonomy. Rules out the alternative of keeping both systems or maintaining legacy genetics code in parallel.

---

### 20. Build the Market Analytics section for Business Tools

**Date:** 2026-04-21
**Status:** In progress
**Context:** Serious crested gecko breeders, investors, importers, and shop owners need strategic market intelligence — not surface-level averages, but real signals about value, demand, scarcity, and timing. Currently this kind of analysis requires manually scraping MorphMarket, Pangea, Facebook breeder groups, and international classifieds.
**Decision:** Build a Market Analytics section inside the Business Tools page. Powered by two integrated data sources: first-party Geck Inspect data (listings, sales, asking-vs-sold spreads, breeding records, search behavior, watchlists, regional activity, trait-level transactions) AND external global market data (scraped signals from MorphMarket, Pangea, FB groups, expos, breeder sites, international classifieds in UK/EU/AU/JP/SE, import/export listings). The two sources must be architecturally separated so each can be weighted, filtered, and benchmarked independently.
**Reasoning:** This is a defensibly premium feature — nobody else has both first-party and external data integrated. It justifies a higher price point (Enterprise tier) and differentiates Geck Inspect from commodity tracking apps. First-party data becomes more valuable as the user base grows, which creates a long-term moat.
**Consequences:** Significant engineering scope — scraping infrastructure, data pipelines, analytics models, visualization. Must be architected to keep data sources cleanly separated. Likely gated behind the Breeder and Enterprise tiers. Rules out a simpler "average price lookup" approach that competitors could replicate.

---

### 21. Design the Enterprise waitlist-to-conversion flow

**Date:** 2026-04-21
**Status:** Pending
**Context:** Enterprise tier is currently "Coming Soon" with a waitlist CTA that routes to tennysontaggart@gmail.com. There's no structured flow for qualifying, onboarding, or converting these prospects, and no pricing is set.
**Decision:** Design a proper Enterprise waitlist-to-conversion flow before the landing page launches. Must include: a qualification form (collection size, use case, team size, rough budget), an intake triage process, pricing structure for Enterprise (likely custom), an onboarding process (data import, training, team setup), and a branded store page feature as a likely Enterprise differentiator.
**Reasoning:** The landing page will drive Enterprise interest whether we're ready or not. Currently every Enterprise inquiry goes to a personal Gmail and gets handled ad-hoc — this doesn't scale past a handful of prospects and creates inconsistent experiences. A structured flow captures leads properly and positions Enterprise as a real product, not a "talk to us" placeholder.
**Consequences:** Enterprise sales becomes a defined process rather than a Tennyson-only bottleneck. Commits to building Enterprise-specific features (team collaboration, wholesale pedigrees, branded store pages, custom onboarding). Rules out a pure self-serve strategy — Enterprise will require sales touch.

---

### 22. Gather landing page launch assets before build begins

**Date:** 2026-04-21
**Status:** Pending
**Context:** The landing page strategy requires specific assets that don't currently exist: named testimonials with photos from existing users, original gecko photography for hero and feature sections, a looping hero product video, a founder story with headshot, and possibly a video testimonial from a power user.
**Decision:** Treat asset gathering as a blocking prerequisite for the landing page build — not something to paper over with stock photography or placeholder copy. Specific assets needed: (1) 5–10 testimonials with names, photos, specific outcomes, (2) 5–10 crested gecko photos shot against clean backgrounds from Tennyson's own collection, (3) one 6–10 second looping hero product video showing the app in use, (4) one 30–60 second video testimonial from an existing power user (stretch goal), (5) a 200-word founder story with headshot.
**Reasoning:** The positioning ("by a breeder, for breeders") and the testimonial principles (real names, real faces, specific outcomes) only work if the assets are real. Launching without them would undercut the entire strategy. Asset gathering is also high-leverage — an hour of email outreach to existing users produces content that improves conversion more than an hour of design polish.
**Consequences:** Adds a pre-build phase to the landing page timeline. Commits to not shipping the landing page with stock imagery or fake testimonials even under pressure. Requires outreach to existing ~88 users — likely with a small incentive (free month) in exchange for testimonials.

---

### 23. Set up analytics and conversion tracking before launch

**Date:** 2026-04-21
**Status:** Pending
**Context:** Without analytics in place at launch, we lose the first weeks of real visitor data — and can't meaningfully A/B test anything until we have a baseline.
**Decision:** Install Plausible or PostHog (final vendor choice TBD) before the landing page goes live. Configure a primary conversion event: "started sign-up" (clicked primary CTA and reached sign-up form). Secondary events: scroll depth to pricing section, completed sign-up, time on page, bounce rate by device. No A/B testing for at least the first two weeks post-launch — observe first, test later.
**Reasoning:** A/B testing before ~500 visitors per variant is statistical noise. Two weeks of clean observation establishes a real baseline. Plausible/PostHog over GA4 because they're lighter, privacy-friendly, and match the audience's values.
**Consequences:** Requires an analytics vendor decision before launch. Commits to not adding Google Analytics or other heavyweight trackers. Slight learning curve for whichever tool is chosen.

---

### 24. Plan the first round of A/B tests

**Date:** 2026-04-21
**Status:** Pending
**Context:** Once the landing page has ~2 weeks of traffic and a baseline conversion rate, testing begins. The order of tests matters — testing low-leverage elements first wastes traffic.
**Decision:** After 2 weeks of baseline data, begin A/B testing in this order of priority: (1) headline copy, (2) hero visual (video variant vs. static variant), (3) primary CTA copy ("Start Free" vs. "Start my free account"), (4) pricing display (annual vs. monthly default), (5) feature section order. One test at a time. Each test runs until statistical significance or 4 weeks, whichever comes first.
**Reasoning:** Research consistently shows headline is the single highest-leverage element on a landing page. First-person CTAs can lift conversions up to 90% — worth testing once traffic is high enough. Running multiple tests simultaneously makes it impossible to know what moved the needle, so discipline on one-at-a-time is essential.
**Consequences:** Commits to a disciplined testing cadence rather than reactive changes. Requires enough traffic to reach significance — if volume is low, tests take longer. Each test's result goes into DECISIONS.md with the variant that won and by how much.

---
