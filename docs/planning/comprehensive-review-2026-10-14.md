# Comprehensive review of Geck Inspect, 14 October 2026

> Public copy. This repository is public, so the one or two sentences that spell out how to exploit the open security findings are left out here; the complete report, with those details, is on the private page linked from the session that produced it. Everything else is identical.

A review of the whole product on every front: strategy, business, product, design, content, AI, engineering, security, operations and process, in 39 categories, each scored, with evidence, and ending in one plan. It was done alongside a separate adversarial review of the same app; Part D says where the two agree, where they differ, and what each found that the other missed. Nothing in the repository was changed by the review itself; this document is the only commit. It was revised on 15 October after an independent panel compared it with the adversarial review and checked every disagreement against the repository; the corrections are marked in place and summarised in D7.

## The answer in one paragraph

Geck Inspect is the deepest crested gecko product on the web, and it is not yet a business. The genetics engine, the Morph Guide, the care guide, the honest Morph ID, the passports and the breeder tools are real and mostly good. Around them sit 80 pages and about 40,000 lines of code that nobody uses, a market-data product built on a competitor's listings whose full US sweep has been blocked since early September (a partial newest-listings route still runs), a $99.99 plan on sale against that data, and a plan to start a second species. The numbers are 61 accounts, 7 weekly actives, about 1 non-admin member logging care each week, 0 of 17 September signups back after a week, and about $9 of monthly revenue. One security pattern (write rules check who wrote a row, never what it points at) lets any member take ownership of any public gecko and write history onto any animal, and must be fixed this week. The next 90 days should be a sales experiment with ten hand-onboarded breeders, a frozen feature surface, one plan and one scoreboard, and a decision on 17 January 2027.

## The ten things that matter most

1. **Fix the ownership pattern this week.** A gap in how transfer requests are checked lets any signed-in member take ownership of any public gecko (the mechanism is in the private copy of this report); any member can log weights, feedings, sheds and vet visits onto any public gecko and the owner cannot remove them; any member can email every other member from the official address with their own text; profile rows are not pinned to their email; every signed-in account can harvest member emails. Five SQL changes with tests (E1, items 1 to 5).
2. **Talk to breeders.** The growth plan's five breeder conversations for the week of 6 October are recorded nowhere; the breeder-interviews file does not exist; one complimentary plan has been granted against a target of ten to twenty. Nothing in this report matters more than forty messages and eight calls (E1, item 13).
3. **Freeze breadth.** No new features, species, tiers or tools until weekly active breeders have grown four weeks running. Park the ball python plan (decision 43, made eight days after the research said not to). Retire what has zero use behind flags.
4. **Prove the reason to come back is arriving.** The personal weigh-in reminder job went live on 8 October, but there is no delivery log, zero members have reminder settings stored, and 19 of the 35 digest recipients are legacy profiles that cannot sign in. Reminders that follow the animal's real cadence, a delivery log, four lifecycle emails, and a Today screen are the retention plan (E2, items 15, 16 and 20; E3, item 25).
5. **Take Enterprise off sale** until the US feed is reliable and someone has asked for it; add the server-side gate it lacks; capture first-party sale prices so the market product has a second leg; get an hour of counsel on the scraped-data position (A2, A4, B9).
6. **Make the agents safer than the members.** The committed Claude settings pre-approve every write tool with an empty deny list, the Supabase server is not read-only, the nightly triage bot reads anonymous text while holding the service-role key, every push deploys production, and the admin account has no second factor (C5, E1 item 10).
7. **Fix the published errors.** The Lilly White origin claim in the blog and its FAQ markup is wrong and is being fed to AI assistants; the privacy policy's Do Not Track sentence is false; the Terms name no state; the support address is a personal Gmail under another brand (B7, A11, E1 item 9).
8. **Give the first five minutes one job.** The landing headline fails the project's own five-second test, the demo downloads 3.5 MB of photos, four demo pages look broken, tapping a gecko on a phone does nothing, and the default theme paints every paragraph blue with 622 contrast failures (A10, B3, B4).
9. **Measure what the model adds before spending on it.** On the adversarial review's recount, a bare nearest-photo lookup scores the same as the Morph ID model (43.2 against 43.6 percent top-1) on a holdout that leaks sellers. Build a seller-disjoint adjudicated set before tuning anything; grade the 5.5 models on it; move the consultant and health screen to cheaper current models (B8, E3 item 29).
10. **Keep the docs true.** CONTEXT.md, STRATEGY.md, ROADMAP.md and the design document contradict the code in 21 places tabulated in Part C; every session is told to read them first. One afternoon fixes the four entry documents; a weekly reconcile keeps them fixed (A14, C13).

## Report card

Scores are 1 (broken or absent) to 5 (as good as it needs to be). They are a direction, not a ranking; a 2 beside a 4 does not mean the 2 is more urgent.

| # | Category | Score | One line |
|---|---|---|---|
| A1 | Market position and thesis | 4 | Right thesis, drifting execution (species expansion, breadth) |
| A2 | Competitive landscape | 4 | Well researched; the data moat is borrowed from the main competitor |
| A3 | Target customer coherence | 2 | Six audiences served, one named; breeders pay, keepers are sold to |
| A4 | Pricing and packaging | 3 | Good low prices; Enterprise on sale on stale data with a client-only gate |
| A5 | Monetization mechanics | 3 | Careful billing code around $11.97 of lifetime revenue |
| A6 | Acquisition | 2 | 2,000 sessions become 20 signups; content pages lose 78 to 94 percent |
| A7 | Activation | 3 | The right guided first gecko, unproven on a phone against production |
| A8 | Retention | 1 | Zero week-two return; the reminder job went live on 8 October with no delivery log and no member settings stored |
| A9 | Breeder distribution | 2 | All the parts exist; five passports, two transfers, zero conversations |
| A10 | Brand, voice, copy | 3 | Specific and honest; three voices in the docs; the headline has no noun |
| A11 | Legal and privacy | 3 | Thorough policies; scraping exposure, no state, no entity, no consent gate |
| A12 | Unit economics | 2 | Costs are not written down; evaluation AI spend ran 40 times production use (the adversarial review's production figure) |
| A13 | Strategic risks | 2 | MorphMarket dependence, bus factor of one, a second species |
| A14 | Roadmap and decision hygiene | 3 | Excellent logs, stale foundations, decisions that reverse fresh research |
| B1 | Feature scope | 2 | About 40,000 lines serve features with zero use |
| B2 | Information architecture | 3 | Good groups; nine pages with four names; eight pages hidden on phones |
| B3 | First run and empty states | 3 | Much better since 5 October; four demo pages still look broken |
| B4 | Visual design system | 2 | Surfaces coherent; colour incoherent; three design docs for a product that is none of them |
| B5 | Mobile and native | 3 | No overflow, good Field Mode; 22 percent chrome; root scrolling breaks iOS habits |
| B6 | Accessibility | 2 | 622 contrast failures; an off-screen menu read before every page |
| B7 | Domain correctness | 4 | Mendelian core verified correct; polygenic percentages and a published origin error |
| B8 | AI features | 3 | Honest design; thin, seller-leaking evidence; a generation-old model |
| B9 | Market intelligence | 3 | Clever and unique; built on a blocked feed and sold at $99.99 |
| B10 | Community | 2 | Complete code, no community since April |
| B11 | Breeder tools | 3 | Complete on paper, never run by a breeder |
| C1 | Architecture | 3 | Good bones; two gecko records, god components, 29 dead modules |
| C2 | Data layer and identity | 2 | Email as identity; silent-empty reads; 500-row caps |
| C3 | Database, RLS, migrations | 2 | Sound structure; one systemic ownership flaw, one critical |
| C4 | Edge functions | 3 | 21 of 34 grade A; a notification relay, a webhook that swallows write failures, and an unmetered AI call |
| C5 | Web security and agents | 3 | Strong headers; `unsafe-inline`; agents with more power than members; public repo |
| C6 | Performance | 3 | 205 kB entry on every page; PDF libraries on the main page; 2.2 MB Morph Guide |
| C7 | Offline, PWA, native | 3 | Right service-worker design; a queue that can drop or duplicate logs |
| C8 | Testing and gates | 2 | 1,657 tests deep in lib; lint and typecheck cover a minority; no browser tests |
| C9 | CI/CD and release | 3 | Pinned, least-privilege workflows; every push deploys; bots deploy weekly |
| C10 | Observability | 2 | No uptime, no spend alerts, no backups documented; two outages from empty credit |
| C11 | Dependencies | 3 | Good overrides, four of them stale; six unused packages |
| C12 | SEO and agent access | 4 | Technically excellent; ahead of the business |
| C13 | Documentation | 3 | More than most funded teams; decaying truth |
| C14 | Operations | 2 | Personal Gmail, no cost sheet, no restore drill |

## How to read this document

Part A is strategy and business. Part B is product and design. Part C is engineering, ending in C15, the list of what this review could not close and the production checks that would. Part D reconciles this review with the adversarial one. Part E is the plan, in the order to do it, with who does what and what done looks like. Every finding names its evidence (a file and line, a document, a measurement, or a production number from the funnel documents). Where something could only be confirmed against the live database or a real phone, it says so.

## Method and evidence

- The repository at commit `c2266aa` on main. Twelve more commits landed on main during the review (main was at `cc1b2fe` when this was committed); the ones that change a finding, such as the lifetime memberships, are noted where relevant.
- The repo's own gates, run here: lint clean, typecheck clean, 1,657 tests in 128 files passing in 15 seconds, genetics consistency passing, `pnpm build` in 54 seconds with 161 prerendered routes and a clean SEO audit.
- Four supporting reviews written for this report (code architecture; database, functions and security, built by parsing the 265 runnable migrations in order (a read of the SQL, not an execution against Postgres); domain, AI, SEO, build, CI and dependencies; in-browser UX and accessibility on 44 pages at two sizes), plus a full digest of the adversarial review's transcript and its report.
- Independent re-verification by hand of the claims that carry the most weight (the transfer takeover, the notification relay, the care-record policies, the profile policies, the social-post metering, the agent configuration, the Lilly White text, the logo handler, the Morph Guide canvas work), and a separate skeptical pass over eighteen findings whose verdicts are folded into the severities used here.
- Production numbers come from the 5 October funnel and growth documents and from the adversarial review's aggregate queries; this review had no database access and says so wherever a number depends on it.
- No member names, emails, messages or payment details were read.
- Revised 15 October: a panel of seven independent reviewers read this report and the adversarial one in full, each on one lens, and an eighth checked every factual disagreement between them against the repository. The errors it found here are corrected in place (each marked "the first version of this report") and its scores and the findings this report had dropped are in D7.

## Part A. Strategy and business

### A1. Market position and thesis

**Score: 4 of 5 (the thesis is right; the execution has drifted).**

The thesis in INTENT.md and STRATEGY.md is sound and still unique: the only crested-gecko-first platform, built by someone who breeds them. The 5 October competitive research confirms it held: Breed Ledger went multi-species and dog-heavy, ReptiDex is in maintenance mode, MorphMarket and Husbandry.Pro are generic. Nobody else combines a crested genetics engine, a morph guide, a care guide, growth bands and a Morph ID that admits uncertainty.

Three things pull against the thesis today:

1. **Decision 43 (13 October) starts a ball python product.** The plan (`docs/planning/ball-python-app-2026-10.md`) estimates "several weeks" for ball python genetics alone, before any market or Morph ID work. Eight days earlier (5 October) the competitive research ended with "What not to do: ... add more species. Both dilute the crested-first position for little gain." The ball python market is also the most crowded one in reptile software: MorphMarket, Cltch (in-app DNA tests), HatchLedger (300+ hatcheries, $39 to $179 a month) and Day56 (236 breeders) all live there, and none of Geck Inspect's edges (crested genetics, crested price data, crested Morph ID) transfer. With about 1 weekly active keeper and $8.98 of monthly revenue, weeks of work on a second species is the single largest strategic risk in the repo right now. Recommendation: park decision 43 until the crested product has 50 weekly active keepers or 25 paying members, whichever comes first. If Tennyson wants a cheap test of ball python demand, a landing page with a waitlist costs a day, not weeks.
2. **The positioning headline and the growth plan point at different people.** Decision 32 (29 September) makes the landing page "Price right. Pair smart. Sell with proof", the business side of breeding for small breeders. The growth plan (5 October) says "Win crested gecko keepers one gecko at a time" and names weekly active keepers as the north star. Both are defensible, but a visitor cannot be sold two stories. The data says breeders are the ones who pay (4 of 10 self-declared breeders added a gecko and 2 subscribed; 1 of 5 keepers added a gecko and none paid), while keepers are 80 percent of owners and the distribution loop (passports) is how keepers arrive. The coherent version is: sell to breeders, and let breeders bring keepers in through every animal they sell. The headline should say so in plain words (see A10).
3. **The feature surface outgrew the user base.** There are 80 page files, 20 sidebar destinations in five groups, a store, a forum, a social publishing tool, an AI consultant, enclosure sensors, worksheets, other reptiles and a market intelligence suite, for 61 accounts and roughly 7 weekly actives. During the hours this review ran, main received eleven more commits: five artwork and placeholder styles, demo photo work, a crawlable pricing page, and lifetime memberships on sale. Breadth is not a moat; it dilutes polish and makes the first five minutes harder. The feature completeness audit already retired some of it. More should go, or at least go dark until the core loop works (A8).

### A2. Competitive landscape and threats

**Score: 4 of 5 (well researched; one blind spot).**

`docs/planning/competitive-landscape-2026-10.md` is a genuinely good piece of work: sourced, dated, honest about what could not be verified. Its ten moves are the right ten. Two additions:

- **The real competitor for a keeper's attention is a spreadsheet and a Facebook group, not another app.** The MorphMarket forum thread the research cites says as much. Every onboarding decision should be measured against "is this easier than my spreadsheet", not against ReptiDex.
- **MorphMarket is both the biggest competitor and the sole upstream for the market data product.** Every price, value estimate, time-to-sell model, Guess the Price round and Price Index row comes from scraping MorphMarket listings. MorphMarket already blocks the GitHub runners (the full US check has not run on schedule since early September; the last one was 6 October, and only a partial newest-listings route is alive), the documented workaround is a residential proxy or a home computer (routing around a block after notice is the pattern a court punished in the 3Taps case), and decision 44 calls the listing copies "the largest legal exposure in the Geck stack". A takedown letter or a login wall would remove the only "only Geck Inspect has this" feature and the entire Enterprise plan overnight. This is not a reason to stop, but the dependence should be named in STRATEGY.md and hedged: first-party sale prices from members (the buyer packet and claimed transfers already record them), breeder-submitted price reports, and a documented fallback where the Market page degrades to "last known" with a date rather than failing.

STRATEGY.md itself is dated May 2026, carries a banner that its assumptions need revalidation, hedges the Breed Ledger launch as "previously scheduled for May 15, 2026", and still frames Dusty as "one year in". The October research corrected all of that and asked for STRATEGY.md to be updated; it was not. The flat stale sentence ("Breed Ledger launches May 15, 2026") lives in CLAUDE.md, the one file every session reads first. A future session reading STRATEGY.md first will reason from stale facts (A14).

### A3. Target customer and persona coherence

**Score: 2 of 5.**

The documents name three personas (keeper, hobbyist breeder, business) and the app serves at least six: keeper, breeder, buyer (passport and claim pages), seller (marketplace), shop (store and sensors), and AI agents (/data and /mcp). The tier names (Free, Keeper, Breeder, Enterprise) say who each plan is for, but the product does not: a keeper who signs up sees Breeding, Lineage, Pairing Planner, Season Planner, Business Tools and Promote in the sidebar (Keeper mode trims it to 12 items, but only if they pick "keeper" at the role question, which 15 of 56 members answered).

What the data says about who actually shows up: the pedigree tracker page converts 27 percent of a small number of visitors, activated members go to Lineage first, and the only evaluated purchase came from a breeder who ran Morph ID on a clutch. The person with the clearest reason to pay is a **small breeder with 10 to 60 animals who sells a few clutches a year**. The keeper is the person that breeder's buyers become.

Recommendation: write one sentence that names the primary customer and put it at the top of INTENT.md, PRODUCT.md and the landing page. Then audit every sidebar item against that person. Anything they would not open in their first month goes behind a "More" fold or a plan.

### A4. Pricing and packaging

**Score: 3 of 5.**

Prices (`src/lib/stripe-config.js` at the reviewed commit `c2266aa`): Free (10 geckos), Keeper $2.99 or $30 a year, Breeder $5.99 or $60 a year, Enterprise $99.99 or $1,000 a year. Lifetime rows ($149 and $349) existed in the config with no Stripe price and were hidden; they went on sale later the same day (see below). Decision 27 rejected raising Breeder; the October research agrees that price is not the constraint at this size.

What is right: the low Keeper and Breeder prices are a real differentiator against Breed Ledger ($29) and HatchLedger ($39), and the annual savings badge is computed from the actual numbers rather than hard-coded, so it cannot drift.

What is wrong:

- **Enterprise at $99.99 went on sale on 6 October (decision 38), one day after the research recommended retiring the card** "until there is something behind it". The thing behind it is Market Intelligence, whose US feed has been off since early September. Selling a $1,000-a-year market data plan whose core market has not been fully checked in over a week (last US full check 6 October per `docs/agent-review/2026-10-12.json`) is a refund and chargeback risk and makes the pricing page look unserious next to $5.99. Either hide the card until the US feed is reliable, or sell it only after a conversation (a "Talk to us" button is honest; a Stripe checkout for stale data is not).
- **The Enterprise gate is client-side only.** Decision 38's own consequences section admits the market brief, live feed and watchlist database functions "still answer any signed-in member". A search of the migrations finds no tier check in `market_brief`, `market_tape` or `market_watch_*`. Anyone who opens the browser console or calls the API with their own session gets the $99.99 product free. Small today (nobody is trying), but it is the kind of gap that Aikido or a curious member finds. Add `effective_tier_for_current_user()` checks inside those functions, as the seller view already does.
- **The free tier gives away the retention features and sells the one-off ones.** Free includes lineage trees, value estimates, feeding groups, the calculator and the forum, and sells Morph ID credits (one lifetime free try). The funnel document shows the 10-gecko cap has fired once ever, so Free is not converting anyone through limits. Its own recommendation 10 (gate moments of value such as pedigree export, hatch reminders and sale history, keep the core collection free so the habit forms first) is right and has not been acted on.
- **Four trial mechanisms coexist:** the opt-in 7-day trial, the 30-day Keeper promo tied to Promote, the store signup grant, and the referral month. Each has its own flag and copy. The funnel document says one member's 7-day trial ended after 28 minutes because a second checkout was started; the adversarial review's reading of the Stripe log shows it was ended by an authenticated Stripe request nine minutes after an `admin-end-trial` function was deployed (D3 item 5), so the document is wrong and the member is owed a refund. Separately, `stripe-checkout` now refuses a trial once `free_trial_used` is set, but nothing stops a second checkout from replacing a trialing subscription; that still needs the test in feature audit section 8 item 3.
- **Lifetime plans went on sale during this review** (commit `5e82ff5`, 14 October, 17:17 UTC, on main after the reviewed commit: Keeper $149 and Breeder $349 one-time, with 462 new lines in the Stripe webhook and 193 in checkout). A lifetime price is a promise that the product outlives the payment; Part E treats a wind-down as a live outcome, the Terms have no section on subscriptions, renewals, refunds or what a lifetime plan means if the service closes, and the native app sells only the two subscriptions through RevenueCat, so a web-only lifetime plan visible in the app is an Apple guideline 3.1.1 exposure on top of the 4.2 risk. It is also the newest money-handling code in the repo and nobody has run a test-mode purchase through it. The money is welcome if it comes, but this is exactly the kind of change E0 rule 4 says should go through a gate first.
- **The support address on the pricing page, the Terms, the privacy policy and the Stripe portal is `morphiclabsdata@gmail.com`** (`src/lib/supportContact.js`). It is a personal Gmail under a different name than the product. The growth plan flagged this on 5 October and it is still there. A `support@geckinspect.com` forward costs nothing and is the single cheapest trust fix in this report.

### A5. Monetization mechanics

**Score: 3 of 5 (well engineered, lightly used).**

The billing stack is more careful than most products ten times this size: one plan resolver (`resolveTier`) mirrored by one SQL function, Stripe and RevenueCat writing to separate fields that are never mixed, complimentary plans in their own table, a documented runbook (`docs/BILLING.md`) and a verified live plan switch (`docs/stripe-plan-switching.md`). That is strong. The membership webhook is the weak link, and the first version of this report overstated it: it writes the event's fields as received rather than re-reading the subscription, it has no event-level idempotency, and when the profile write fails it logs a warning, marks the event processed and returns 200, so Stripe never retries and a paying member can stay on Free (`stripe-webhook/index.ts`, the `upsertProfileByEmail` helper). The adversarial review's section 06 found this; it is now C4's top webhook item.

The weaknesses are about what the mechanics are wrapped around:

- Lifetime cash collected is $11.97. Of three "paying members", one was on a 100 percent coupon and one cancelled 27 minutes after paying when a Morph ID attempt failed. The honest paying-member count is one, and that member has not opened the app since 7 September.
- `payment_events` holds 2 rows against 6 paid Stripe invoices and recorded a Breeder invoice as `free`. Revenue reporting in the admin panel cannot be trusted until this table is rebuilt from Stripe events.
- Pending cancellations are invisible in the profile and nobody is told when a member cancels. A `subscription_cancelled` event with Stripe's reason is a one-line webhook addition and would have told Tennyson about Member 3 the same hour.
- Social post overage billing, lifetime plans, the Keeper promo and store checkout are all built and all switched off. Dead monetization code is a maintenance cost with no revenue.

### A6. Acquisition

**Score: 2 of 5.**

About 2,000 signed-out sessions a month (an upper bound that includes JavaScript-running crawlers) become about 20 signups. Last week's growth report: 269 sessions, 236 users, 23 from Google organic, 205 direct. Organic search is tiny; the Morph Guide ranks on page 2 for "crested gecko morphs" (position 12.8, 80 impressions, 0 clicks) and the CareGuide at position 22.

The content pages that bring most of the traffic lose 78 to 94 percent of visitors after one page and produced about one signup in a month. The highest-converting page (`/pedigree-tracker`, about 27 percent) gets 15 visits. Nothing arrives by referral, waitlist, passport, transfer, collaborator invite or store grant. Guests click "look around the demo" four times as often as "create account" but 3 of 36 guest sessions sign up.

What would move this, in order: (1) a contextual sign-up prompt on every Morph Guide, Care Guide and calculator page that leads to something shaped like the pedigree tracker page (the growth funnel's item 5; the landing-speed pass started this); (2) the breeder channel in A9; (3) fixing the Morph Guide's title and intro so "crested gecko morphs" moves from page 2 to page 1 (the growth report has the prompt ready); (4) short product videos from the app itself (research move 8). Paid acquisition is premature at a 0 percent week-2 return.

### A7. Activation and onboarding

**Score: 3 of 5 (the right work is in progress; it is unproven).**

Before 5 October, 68 percent of new members never added a gecko, and 11 of 15 non-activated September signups stood on an empty My Geckos page and left. The 5 October activation pass (`docs/planning/activation-2026-10.md`) built the right answer: one guided first gecko (photo or name, then parents, then a payoff screen with the family card, the first weigh-in, reminders on by default and the value estimate), a guest demo that ends in "create a free account to keep Mango", and a measured funnel (`first_gecko_flow` events).

Two caveats:

- **Nobody knows whether the reason to come back is arriving.** The weigh-in reminder job was written on 5 October and applied on 8 October (it is in the migration chain as `20261008081343`, with its daily cron at 14:20 UTC), but `docs/planning/deploy-queue-2026-10-03.md` and the activation doc still say "not applied, waiting on Tennyson", there is no email delivery log (the send function answers before Resend does), and the adversarial review's query found zero members with reminder settings stored. So the switches exist, the job runs, and there is no evidence a single reminder has reached a phone. A delivery log and one end-to-end test on a real account are the first things to do this week.
- **None of it has been exercised on a phone against production.** The pass was verified against mocked data in headless Chromium. The photo path (two photos, one free Morph ID) has never been tried end to end by a new account on a real device.

Smaller: the role question still gates Keeper mode and only 15 members ever answered it; sign-up now asks for a display name (step 32, good); the tour was rebuilt on 6 October into six topic tours, which is more than a newcomer needs (one tour, three stops, then the first gecko).

### A8. Retention and habit

**Score: 1 of 5 (nothing has worked yet; the plan is right).**

Of 17 September signups old enough to measure, 0 returned seven or more days later. 2 of 22 returned on any later day. No new member has logged a second weigh-in. 161 weekly digests went to 35 members in 30 days and 4 were read (2.5 percent). The digest job selects recipients from the geckos table, so every recipient owns at least one gecko; the problem is that 19 of the 35 are legacy profiles from the old platform that cannot sign in (the adversarial review's verifier put 58 percent of last month's notification emails at addresses with no login), and the digest has nothing personal to say to the rest. Hatch alerts, by contrast, were read 91 percent of the time, almost all by the admin account. Personal, time-based prompts work; generic ones do not.

The market habit loop (`docs/planning/market-habit-2026-09-30.md`) is a real idea with a real metric, but it cannot run while the US feed is off, it was then gated to Enterprise (decision 38), and 0 members have opted into the brief, saved a watch or played Guess the Price.

The retention plan that is both cheap and evidenced: (1) confirm the weigh-in reminder job is firing and that its emails arrive; (2) stop sending the digest and reminders to addresses with no login; (3) a four-email lifecycle sequence from the member's own data (day 0 welcome with one action, day 1 if no gecko, day 3 lineage, day 7 and 14 "time to weigh Mango"); (4) make every reminder link open a one-tap action; (5) measure weekly active keepers excluding admin, which the Funnel card now does. Nothing else in retention should be built until that curve bends.

### A9. Distribution through breeders

**Score: 2 of 5 (the parts exist; the channel does not).**

The passport, claim, transfer with buyer email, printed QR cards, rack label sheets, buyer packet and reviews-only-from-claimed-transfers all exist in code (feature audit steps 17, 31, 10). Five geckos have passport codes and two transfers exist. No signup has ever arrived through a passport.

This is the loop with the best economics in the whole plan: a breeder who sells 40 animals a year hands Geck Inspect 40 keepers who arrive with a gecko already in their account. It needs Tennyson, not code: 10 to 20 mid-size breeders hand-onboarded (import their spreadsheet for them, offer the $120 prepaid founding Breeder year and comp through `membership_comps` only those who decline but will send cards, ask for one thing: the QR card goes with every sale). The growth plan scheduled this for week 2 (13 to 19 October). The repo has no `docs/planning/breeder-interviews-2026-10.md`, so the five breeder conversations scheduled for week 1 have not been written up.

### A10. Brand, voice and copy

**Score: 3 of 5.**

Strong: the em-dash rule is nearly enforced (six files under src still carry one, three of them sticker-store copy and three tests), the no-fake-urgency and no-stock-photo rules are honoured, specific numbers replace adjectives in most places, morph names are used correctly and consistently (Lilly White, Harlequin, Cappuccino, Axanthic, Sable, Highway), and the Morph ID copy promises "a ranked shortlist with evidence" rather than "identifies your morph", which matches what the evaluation shows it can do (B8).

Weak:

- **The headline fails INTENT.md's own 5-second test.** "Price right. Pair smart. Sell with proof." is three verbs with no noun. A cold visitor cannot say back "it is a [what] for [who]". The badge above it ("Built only for crested geckos") and the subhead ("Records, genetics and real market prices for crested gecko breeders and keepers, in one app") do that job; the headline should. A candidate that keeps decision 32's intent: "The crested gecko breeder's record book, with real prices." Test two or three against the 5-second question with five breeders.
- **Three brand voices coexist in the docs.** PRODUCT.md: "knowledgeable, grounded, specific, like a trusted breeder". DESIGN-SYSTEM.md: "like a Bloomberg terminal built for gecko breeders, not cutesy, not gamified". The app: dark emerald glass, a tarot-style placeholder card, Guess the Price with streaks, badges and "Level Up & Achievements" notifications. Pick PRODUCT.md's voice (it matches the audience) and retire DESIGN-SYSTEM.md, which also specifies a light sage palette and DM Serif that the product abandoned (B4).
- The product name appears as "Geck Inspect", "Geck Data", "Geck Intellect", "GeckGenius" (the consultant, in a code comment) and "Morphic Labs" (the support email). One product, one name, one support address.

### A11. Legal, privacy and compliance

**Score: 3 of 5.**

Good: the privacy policy (updated 8 October) names every processor including Anthropic, PostHog, GA4, Resend and the Robauto pixel; it describes in-app deletion, anonymisation of shared records as "Former member", and GDPR and CCPA rights; the Terms separate educational content from advice, make the marketplace a listing platform only, and require age 13. Leaked-password protection is on. Account erasure is designed and coded.

Gaps, in order of exposure:

1. **Scraped marketplace data is the business's largest legal exposure and its largest asset at the same time** (A2). Decision 44 pulled single listings, photos and sellers behind a login, which is the right move. Still open: the `listing-images` bucket is public, so any photo URL already in the wild keeps working; the Price Index is published CC BY 4.0, which licenses out numbers derived from another company's listings under Geck Inspect's name. Get one hour of a lawyer's time on this before registering the MCP server in public directories (agent-access decision 3, scheduled for 19 October).
2. **Governing law is "the State in which Geck Inspect is operated"**, which names no state. For a terms page that is otherwise careful, name the state.
3. **Terms "last updated" is 8 September while the privacy policy is 8 October.** The Terms do not mention the open data licence, the MCP server, the market data, Enterprise, or AI training on member photos beyond an opt-in sentence. They should.
4. **Analytics identifies members by email** in PostHog and in `public.user_events` (the funnel document's data quality item 12). Hash it.
5. **No cookie or consent banner for EU visitors** while GA4 and PostHog load on every page. GA4 in the EU without consent is the thing regulators have actually fined. The simplest compliant answer is to drop GA4 (PostHog plus the first-party `user_events` table already cover the funnel) and keep PostHog in cookieless mode for signed-out visitors.
6. **Account erasure is live but undocumented as such.** The erasure migration was applied on 8 October (`20261008081305` in the chain), so in-app deletion works end to end in code, yet the deploy-queue document still lists it as waiting for Tennyson, and the disposable-account proof in RELEASE_READINESS gate 4 has not been run. Residual data after erasure: Stripe webhook payloads, Resend logs and the PostHog person keyed by email.
7. **Children:** the Terms allow 13 to 17 with parental agreement, the privacy policy says "not directed to children under 13", and sign-up does not ask for age. Consistent enough for the US; fine for now.

### A12. Unit economics and cost structure

**Score: 2 of 5 (the costs are not written down anywhere).**

No document lists the monthly bill. From the repo and the docs, the recurring costs are: Supabase (Pro at least, with pg_cron, Vault, edge functions and a second schema for market data), Vercel (two projects once Geck Intellect is counted), Anthropic (Morph ID about 3 cents a call, an evaluation run about $6, the daily canary about 6 cents a day, the AI consultant and Promote drafting), Replicate (photo fingerprints; under $5 of credit throttles the lookup to one request at a time), Resend, PostHog, the domain, the Apple Developer Program ($99 a year, needed for the iPhone app), a residential proxy if the US feed is restored that way ($5 to $15 a month), and the Claude Code sessions that do most of the building (the adversarial review session alone has cost over $100 at the time of writing).

Against that: $8.98 of monthly recurring revenue, heading to $2.99 on 1 November. Revenue does not need to cover costs at this stage, but the ratio should be known, and "which features cost money per use" should drive what Free includes. Recommendation: one page, `docs/COSTS.md`, with each service, its plan, its monthly cost and what would make it jump. Then price Free so that a free member can never cost more than about 10 cents a month (today a free member can run 10 consultant messages, 5 visual searches, 3 growth reels and 1 health screen a month, plus the lifetime Morph ID try).

### A13. Strategic risks

Ranked by how much of the business each one could remove:

1. **MorphMarket dependence** (A2, A11). Mitigation: first-party price data, a documented degraded mode, legal review.
2. **Bus factor of one, with most code written by AI sessions.** 43 of the 84 commits in the shallow history are authored "Claude" and 24 "Tennyson". The docs are the only institutional memory and they are drifting (A14). Mitigation: keep the docs truthful (one session a week whose only job is to reconcile docs with code), and keep the number of moving parts small.
3. **Spending the next quarter on ball pythons** (A1).
4. **Apple rejecting the iPhone app under guideline 4.2** (RELEASE_READINESS.md is honest about this). Mitigation: a small native capture flow before submission, as the doc suggests.
5. **Reliability in the first week.** The category's number one complaint is lost records and silent reminders. Much of what shipped on 2 to 7 October has never been clicked through against production on a phone. One lost clutch log from a breeder who was hand-onboarded ends the breeder channel.
6. **AI cost abuse.** Free-tier AI allowances, an open MCP server with no key and no documented rate limit, and anonymous endpoints that send email. Small today, unbounded in principle (B8, C4).

### A14. Roadmap coherence and decision hygiene

**Score: 3 of 5 (unusually well documented; now drifting).**

The decision log (44 entries), the feature completeness audit with dated status lines, the deploy queue and the growth plan are better than what most funded startups keep. Three problems:

1. **Stale foundations.** CONTEXT.md says auth "was still routing through Base44", Keeper is $4 and Breeder $9, Enterprise is "waitlist only", and lists a Mac mini path. STRATEGY.md is from May. DESIGN-SYSTEM.md describes a light product that does not exist. Every new session is told to read these first. The domain review (Part C) tabulates the contradictions.
2. **Plans multiply faster than they close.** Since 29 September: the feature audit (34 steps), the VIP audit, the market habit plan, the growth plan, the activation plan, the first-impression plan, the landing-speed plan, the instrumentation plan, the agent-access plan with a weekly review, the ball python plan, and now two reviews. Each is good on its own. Together they are more than one person can hold, and they do not share one priority list. ROADMAP.md points at the feature audit, but the growth plan has superseded it in practice.
3. **Decisions that reverse research within days** (Enterprise on sale, ball pythons) suggest decisions are being made in sessions that have not read the latest research. The fix is procedural: every decision entry should cite the research it read, and any decision that contradicts a recommendation less than 30 days old should say why.

Recommendation: one file, `docs/NOW.md`, with at most ten items, owned by Tennyson, rewritten every Monday. Everything else is reference. The plan in Part E of this report is a first draft of it.

## Part B. Product and design

The product findings come from an in-browser pass done for this report: 44 addresses at a phone size (390 by 844, touch) and a laptop size (1440 by 900) in Chromium, with production Supabase answered in-browser (empty tables, the real landing counts) and guest mode on, axe-core on all 88 loads, keyboard, form, dialog, tour, palette, bottom-bar and reduced-motion checks by script, 210 screenshots. Public pages ran on local content; app pages ran on the demo collection. Real photos, live Morph ID, live market data, email, Stripe and anything that needs a real phone could not be judged and are listed as owner checks in Part E.

### B1. Feature scope and surface area

**Score: 2 of 5.**

47 registered pages, 80 page files, 20 sidebar destinations in five groups, 28 command-palette entries, a store with 213 products from 15 vendors, a social publishing tool, an AI consultant, enclosure sensors, printable worksheets, other reptiles, a forum, a gallery, a marketplace, a market intelligence suite with a daily game, a website builder (13 October), and a morph study quiz (14 October). Against that: feeding, shed, vet, waitlist, review, giveaway, mentor, sensor, order and social-connection tables with zero rows ever; 4 carts and 0 orders; 6 Promote posts to one platform; 0 price-game guesses; forum and messages silent since April. The architecture review's count of code serving features with no use is about 40,000 lines plus about 13 of 34 edge functions.

Breadth has three costs here. It hides the core loop (B2 and B3). It multiplies the surfaces that must be kept honest, secure and fast (every category in Part C). And it is what the last two weeks of commits were spent on while the five breeder conversations in the growth plan did not happen (A9).

The September audit retired ten pages behind redirects, which is the right mechanism. Recommendation: use it again, harder, with Tennyson deciding the list (E3, item 23): behind flags now, deleted after a month of zero traffic, tables kept.

### B2. Information architecture and navigation

**Score: 3 of 5 (the October regrouping helped; names drift and the phone hides eight pages).**

What works: everything in the sidebar is one click deep; the five groups (Collection, Breeding, Tools, Learn, Community) are sensible; Keeper mode trims 20 items to 12; the phone bottom bar (Home, My Geckos, Morph ID, Market, Menu) pins the right four; the drawer is a proper modal when open; the command palette lists the 28 page entries in six groups plus a quick-actions block.

What does not:

- **The same page has up to four names.** Breeding / Breeding Plans / "Breeding Management"; My Geckos / "My Gecko Collection"; Market Intelligence / Market / "Marketplace" / "Marketplace Trust"; Season Planner (sidebar and h1) / Project Manager (palette) for one page, beside Season Timeline, a different page; Morph ID / "AI Morph Recognition"; Image Gallery / Community Gallery; Lineage / Lineage Tree. Nine pages drift across sidebar, palette, bottom bar and heading. A member who searches "season" in the palette finds neither name they saw in the sidebar.
- **Eight pages exist only in the command palette, and the palette has no keyboard shortcut and no phone entry point.** Ctrl and Cmd+K do nothing although the placeholder promises shortcuts; the phone header has no search button. Batch Husbandry, Printable Worksheets, Image Import, Pedigree, Liked Geckos, My Listings, Buy and Sell, and Submit a Morph are unreachable on a phone except through Dashboard links. Two of those (worksheets, batch feeding) are things a keeper with a rack uses weekly.
- **The Breeding group is a grab bag of seven**, three of which are selling (Business Tools, Promote, and by extension My Store and My Listings, which are not in the sidebar at all). A breeder thinks keep, breed, sell; a Sell group would match.
- **Other Reptiles sits second in the Collection group on the first screen a keeper sees**, which dilutes the species-first identity for no benefit; AI Consultant and Market Intelligence (Enterprise-gated) stay in Keeper mode.
- The guest drawer carries "VIEW ONLY" on 12 of 20 items, doubling its height on a phone.
- The desktop icon rail shows 22 unlabeled icons by default for guests, with the same chart icon on Dashboard, Business Tools and Portfolio.

Recommendation: one label pass over `navItems.js` and the page headings (one name per page everywhere); the Ctrl+K listener and a search icon in the phone header; a Sell group; Other Reptiles and the consultant under More; one "Demo: look, do not save" line instead of eleven badges; the rail expanded for the first week. The adversarial review's four-tab proposal (Today, Geckos, Log, More) is the right end state and is in E3.

### B3. First run, onboarding and empty states

**Score: 3 of 5 (much improved on 5 October; a few demo pages still look broken).**

The sign-up form is clean: real labels, correct autocomplete, 44 px inputs, Google sign-in. The role question is clear and says what each choice hides. The guided first gecko (photo or name, parents, payoff) is the right shape, and in the demo it now ends in "Create a free account to keep Pumpkin" with a way back. The tour became a one-line bar with the page visible, and a hub of six tours with a keeper or breeder toggle. The shared empty-state pattern (title, one line, one action) is good where it is used.

Still wrong on the path the landing page sends visitors down:

- **Demo pages that look broken:** Promote spins forever; Batch Husbandry says "No feeding groups yet" while the Season Planner shows groups A, B and C; Pedigree says "Add a ?geckoId= query parameter to view a gecko's pedigree"; the AI Consultant has no heading; Settings is a sign-in wall. A visitor who clicked "look around the demo" (four times as often as "create account") meets these.
- **Tapping a gecko's photo or name on a phone does nothing** (only the small View and Edit icons act), open since the 5 October QA.
- The role question's close-without-choosing silently records "show me everything", so an accidental tap gives a keeper the full breeder sidebar.
- The tour's welcome line and every stop title truncate at 390 px ("Every geck..."), so the one sentence that should sell the stop never reads in full.
- The password field's placeholder is eight dots, which looks like a saved password; the sign-up tabs are Title Case while every button is sentence case.
- My Geckos on a phone shows five buttons, two tabs, a search, a sort, a view toggle, a filter bar and a bulk-actions bar before the first gecko card at 1,350 px down; the gecko record page starts with four stacked buttons above the photo.
- The tutorial's data file still carries blurbs for retired pages (Store, Training, Breeding ROI); the modal filters them out, so this is dead data, not a visible defect.

None of these is large. Together they are the difference between a demo that converts 3 of 36 sessions and one that converts a third of them.

### B4. Visual design system

**Score: 2 of 5 (coherent surfaces, incoherent colour, three documents describing products that do not exist).**

The September normalisation held: one page header on 21 of 24 app pages, house tabs, no white cards, consistent lucide icons, consistent `p-4 md:p-8` rhythm, cards on one surface token, the glass phone bars working as decision 39 describes. Those are real wins for a product that had three card systems a month ago.

The colour system is the problem:

- **The default theme is Blizzard blue** (`ThemeContext.jsx:64`), and because the `slate` scale re-tints with the accent, every muted paragraph on every public page renders mid-blue on near-black. axe fails contrast on 33 of 44 pages (622 nodes); in-text links on the calculator, price, data and terms pages sit at 1.3 to 1.6 to 1 against the surrounding blue (3 to 1 required). The emerald header and sidebar tint do not follow the theme, the logo is copper, the hero photo is forest green, the guest notice is yellow, the Enterprise card is amber, the calculator's primary button is purple. On the default theme the Dashboard shows four accent colours on one screen. The 5 October first-impression review proposed a neutral body text token (proposal 3.4); it is still unbuilt. One token change in `index.css` (the slate remap) fixes most of the 622 nodes.
- **Three design documents, none describing the product.** `docs/specs/DESIGN-SYSTEM.md` specifies a light sage palette with DM Serif Display (used in exactly one file); decision 5 chose dark charcoal with a cream accent; CONTEXT.md section 8.4 describes a third palette with Satoshi and JetBrains Mono. What ships is a dark slate shell with six user themes, Montserrat on the landing page, Inter in the app and Righteous for one wordmark.
- The Morph Guide index, the most-visited public page, shows letter placeholders ("LW", "A", "C") in gradient boxes beside real ink drawings for 28 of 36 morphs (only the eight study morphs have drawings; checked in the sandbox, production photos need checking).
- The Dashboard's stat tiles and greeting use a green gradient surface seen nowhere else; the Lineage page has its own toolbar and no header.
- The glass bars have no solid fallback where `backdrop-filter` is unsupported (older Android web views), where they go fully transparent.

Recommendation: Emerald as the default theme (one line); a neutral light-grey body-text token that does not re-tint; `text-slate-500` one step lighter on dark surfaces; underlined in-text links; one design document rewritten from the shipped tokens, the other two deleted; a `@supports` fallback for the bars; real drawings or photos for the 28 placeholder morphs, starting with the ones shown first, before anything else visual.

### B5. Mobile experience and native shells

**Score: 3 of 5.**

Good: no horizontal overflow on any of 44 phone pages; the bottom bar never covers content (the scroller's padding holds even with the guest notice up); dialogs fit the screen; Field Mode takes the whole screen with a 56 px always-visible exit and 90 px rows in 28 px type, which is right for a hand holding a gecko; reduced motion is honoured for CSS animations only (there is no framer-motion `MotionConfig`, so its JavaScript animations ignore the setting, as the adversarial review said; the first version of this report called it honoured); safe-area insets are wired; the September overscroll fix held in Chromium.

Not good:

- **Phone chrome takes about 22 percent of the screen in the demo** (header 65 px, bottom bar 59 px, guest notice 62 px, plus a 56 px feedback button overlapping list rows on the right); on the gecko record and Breeding the notice covers the card being read.
- **Every public page scrolls inside `#root` rather than the document** (`layout-theme.css:9-15`), an accident of the app shell's fixed frame. On iOS Safari that stops the address bar collapsing (losing about 80 px of a 664 px viewport), disables tap-the-status-bar-to-top, and makes `window.scrollTo` a silent no-op (the Membership page's waitlist scroll already cannot work).
- Touch targets: the landing slideshow dots are 6 by 6 px; 5 to 17 targets under 44 px on each phone app page; the guest-notice dismiss is 22 px.
- Forum titles truncate with an ellipsis on phones (a truncated question is the one thing a forum card must not hide); the Lineage tree cuts the fourth grandparent at the right edge with no scroll hint.
- Layout shift: calculator 0.27 on a phone (poor), Breeding 0.11, desktop Dashboard 0.09.
- The guest demo downloads 3.5 MB of photos for 19 cards (one JPEG is 2.1 MB), so the slowest page in the app is the one the landing page's second button leads to.
- The native shells (Capacitor) have camera, local reminders, store billing and in-app deletion, and no push, no app links, no CI build, no store listing; the 4.2 rejection risk is real and acknowledged in RELEASE_READINESS.md. Nothing in this pass could judge the iOS bounce, the notch or the status bar; those remain owner checks.

### B6. Accessibility

**Score: 2 of 5 (WCAG 2.2 AA is the stated target; the page is not there).**

By count over 88 loads: colour contrast 622 failing nodes on 33 pages; landmark regions 339 (mostly best practice); label-content-name mismatch 149 nodes on 24 pages (the Morph Guide's SVG diagram groups, the header Messages and Notifications links with the count inside); button-name, which is critical, 60 nodes on 10 pages (every Radix Select trigger has no accessible name when empty, on the calculator, blog filters and app forms); target-size 34; link-in-text-block 20; heading-order 19; no `h1` on Lineage, guest Settings and the AI Consultant; two `<main>` landmarks on Care Guide and Lineage; no `<main>` or skip link on the landing page, sign-in and the 404; the Lineage tree is a scroll region nothing inside can focus.

The one that matters most: **the closed phone drawer is still present for keyboards and screen readers on every phone page.** It is a `role="dialog"` named "Menu", 844 px tall, rendered on every page and merely translated off screen when closed, with no `aria-hidden` or `inert` and 32 focusable links. A screen reader announces a menu dialog with 30 links before the page, and Tab walks through off-screen links.

What is right: every image has alt text (0 missing in 88 loads, demo photos labelled "illustrative photo, not this demo animal"); the Quick Add dialog is labelled, traps focus, closes on Escape and has 44 px controls; sign-up labels and autocomplete are correct; colour is never the only status signal on the pages walked; the app shell has a skip link; focus rings are visible on 20 of 22 landing stops.

Recommendation, in order: mount the drawer only while open (or `inert` it closed); the neutral text token (B4); `aria-label` through `SelectTrigger`; the SVG groups' labels to include the visible word; one `<main>` from the shell; `h1` through the shared page header everywhere; a 24 px hit area on the slideshow dots; a skip link on the public shell. Most of this is a day of work and clears the critical and serious rows.

### B7. Content and domain correctness (morph guide, care guide, genetics guide, calculator)

**Score: 4 of 5 (the Mendelian core is right; the edges contradict each other).**

This is the part of the product an experienced breeder will judge first, so it was checked by running the genetics engine directly, not by reading the copy. The core is correct and consistent across the tag translator, the engine, the genetics guide, the morph guide, the Promote prompt and llms.txt: Lilly White x Lilly White gives 25 percent Super Lilly White with the lethal warning; Frappuccino x Lilly White is warned; Luwak x Luwak gives 25 percent Super Cappuccino (warned) and 25 percent Super Sable; Cappuccino x Highway produces no super under the allelic model; Axanthic and Phantom are recessive with correct het, 66 percent possible-het and 50 percent possible-het math; a bare "Phantom" tag means visual (decision D13); White Wall maps to Whiteout. The 25 percent lethal warning is marked conditional when it rests on an unproven het, which is a thoughtful touch.

Findings, in order of how much a breeder would mind:

1. **A published origin error.** The Lilly White blog post and its FAQ JSON-LD (`src/data/blog-posts.js:2553`, `:2740`) say the morph "was discovered by Anthony Caponetto at ACR in 2014 and named after his daughter". The morph guide, llms.txt and the hobby say Lilly Exotics (Nick Lumb, UK, 2010); AC Reptiles imported and popularised it. (The non-blog surfaces do not fully agree either: the morph guide says late 2010 and the engine's trait table says proven in 2012.) `project-lines.js` leans the wrong way too and says the ACR line "continues to produce Super Lilly White animals", which is odd for a lethal genotype. Search engines and AI assistants are being fed the wrong version with structured markup. It has been on the agent-access backlog since 7 October.
2. **Polygenic traits are computed as single genes in collection mode.** The engine models Harlequin (incomplete dominant), Pinstripe and Dalmatian (dominant), Red Base (recessive) and Yellow Base (dominant) as single loci. Manual mode already drops those loci, and the calculator footer promises "no fake percentages", but when the parents come from the member's collection the tags fall through the translator to the engine and the headline outcome list, the clutch card and the share link print "25% Extreme Harlequin" for a Harlequin x Harlequin pairing (verified by running a prediction). The guide's dual-model policy (decision 26) explains both views in prose, but that percentage is what an experienced breeder will screenshot. Suppress Punnett percentages for those traits in the output and show the expression band instead; keep the engine math behind a toggle labelled "Foundation Genetics model, unproven".
3. **Hidden-het inference overstates.** `src/lib/genetics/hetInference.js` (the combine at line 315, documented at lines 51 to 52) combines ancestry lines as independent events and never conditions on the subject being non-visual: a sire tagged Het Axanthic whose own dam is visual Axanthic returns 75 percent (truth 50), and Het x Het parents return 75 percent where breeders say 66. The number is labelled an estimate, but 75 versus 66 is exactly the number a breeder spots.
4. **Two life-stage weight scales in one care guide** (feeding table 0 to 8 / 8 to 20 / 20 to 35 g; life stages 0 to 3 / 3 to 15 / 15 to 35 g, which the growth chart uses), incubation windows that differ between `incubationProfiles.js` and the care guide table, breeding readiness "about 35 to 40 g" in llms.txt against 40 g strict in the app, shed intervals stated two ways (every 1 to 4 weeks in the care guide, every 2 to 3 weeks for juveniles in the feeding guide), and an uncited claim that Super Highway hatchlings show nostril problems.
5. **The morph guide has no entry for Phantom as a gene, Empty Back, Whiteout, Luwak, Super Cappuccino, Super Sable, Fire or ChoCho** while the calculator has pages for several of them (at about 110 words each). Sable, Luwak and Highway were added on 14 October, so this is in motion.
6. The consistency script checks dominance labels and dual-model phrasing on nine surfaces but not blog posts (where the origin error lives), the care guide, llms.txt facts, the Morph ID prompt, origins and history, prices against the index, or the Kaleidoscope documents (which carry a third model of Tiger and Phantom). It runs in CI only, so a Vercel deploy never enforces it.

Recommendation: fix the Lilly White text today; add an accepted-facts table (origin, originator, year, inheritance) per morph to the consistency check and run the check inside `pnpm build`; hide single-gene percentages for polygenic traits; fix the het-inference conditioning; unify the two weight scales and the incubation windows; add an incubation test mirroring the growth-band one.

### B8. AI features (Morph ID, AI Consultant, Promote, health screen)

**Score: 3 of 5 (honest design, thin evidence, aging models).**

Morph ID is the flagship and the best-designed AI feature in the category: two photos, fired state, per-photo observations, evidence markers, uncertainty reasons, look-alike notes, a strip of nearest verified geckos, "insufficient evidence" as a real answer, scores labelled as not calibrated probabilities, a refund when photos are unusable, a replay guard so a double tap is not charged twice, and a 90-second deadline with refund. The Recognition page promises "an evidence-first shortlist" and nothing more. That matches PRODUCT.md's principles and the community's real objection to AI identification (most crested "morphs" are polygenic visual descriptors and one photo is not enough).

The evidence behind it is thinner than the design: the holdout is 220 MorphMarket listings graded against seller tags (noisy; 74 carry two tags), with no human-adjudicated subset and no genetic traits in the class mix. Across the recorded runs, top-1 agreement with the breeder's tag is 37 to 44 percent (43.6 percent on the shipped version 61), top-3 is 68.6 to 75.9 percent, and the shipped version answers 95 percent of photos (the earlier version withheld a third as "insufficient evidence"). On the earlier runs Pinstripe, Tricolor and Tiger were never named first; version 61's ordering rule now gets Pinstripe first 18 times out of 35; Extreme Harlequin is usually called Harlequin. (The first version of this report quoted the superseded runs only.) The evaluation is manual-only, has no regression threshold, and its results live in a database table and a 90-day artifact rather than in the repo.

Models and cost: Morph ID runs `claude-sonnet-4-6` at $3 per million input tokens when `claude-sonnet-5-5` ($2) and `claude-opus-5-5` ($4) are already allow-listed and handled by the request code but have never been graded; the AI Consultant defaults to a dated `claude-haiku-4-5-20251001` ($1) when `claude-haiku-5-5` is $0.10; the scheduled scripts hard-code the older ids. A full evaluation run costs about $6; a typical identification 3 to 5 cents. The Anthropic credit ran out in the first week of October (the triage log records the error on 7 October; the adversarial review's production logs show Morph ID calls failing on 6 and 8 October, 5 of 23 lifetime calls, not the six-day outage the first version of this report claimed); Replicate (photo fingerprints) is under $5, which throttles the lookup.

Strategically: Geckistry's identifier is free and unlimited; Geck Inspect gives Free one lifetime try and sells three a month for $2.99. With top-1 near 40 percent, the paid value is not the label but the evidence packet and what only a lineage-aware app can add (het inference, pairing value, the nearest verified animals). The competitive research's move 2 (make Morph ID a shareable front door with a result card people post into "what morph is this?" threads) is still the right move and has not shipped.

Recommendation: grade `claude-sonnet-5-5` and `claude-opus-5-5` on the holdout (about $12) and switch to the winner; move the consultant and health screen to 5.5 models; commit each eval run's headline to `docs/morph-id-eval/`; build a 50-animal adjudicated set for the pattern classes sellers mislabel; add a 20-animal smoke eval on changes to the function; give every account one free identification a month and sell the evidence features; ship the shareable result card; put spend alerts on both providers.

### B9. Market intelligence and data products

**Score: 3 of 5 (unique and clever; built on sand).**

What exists is impressive for a solo project: a daily market snapshot per market and morph, collection value estimates from similar listings with quality tiers, watchlists with notifications, a morning brief, a live feed across four markets, Guess the Price, a seller console, a time-to-sell model, a 4,000-run season projection in the Pairing Planner, a public Price Index with monthly history, and open datasets. Every surface says "asking prices" rather than sale prices, which is the right honesty.

The problems are upstream and commercial, not in the code:

- **The US feed has been degraded since early September** because MorphMarket blocks the GitHub runners. A partial "newest listings" route has run since 30 September and the adversarial review's queries show rows still arriving on 14 October, but the last full US catalog check (the one the Price Index, the brief and the watchlists depend on) was 6 October. Until a full check runs on schedule the brief does not send, the live feed leans on Korea, Japan and Europe, and watchlists only match when a check happens. The documented fixes (a Mac cron or a residential proxy) carry their own risk: routing around a block after notice is the fact pattern of the 3Taps case, which is why Part A recommends asking for a licensed feed and capturing first-party prices instead.
- **The whole product depends on scraping a competitor** that has already blocked one path and whose single listings decision 44 calls the largest legal exposure in the stack (A2, A11).
- **Enterprise went on sale at $99.99 on this data** one day after the research recommended retiring the card, and the gate is client-side only (A4, C4).
- **Nobody uses it yet:** 0 brief opt-ins, 0 watches, 0 Guess the Price guesses, and the habit metric's baseline is "at most 1 member opened anything market-related per week".
- The time-to-sell model is trained on three weeks of May to June data and will not move until the scraper records sold dates again.

Recommendation: restore the US feed before selling another Enterprise seat; add the server-side gate; start capturing first-party sale prices (buyer packet, claimed transfers, a one-field "what did it sell for" on archive) so the product has a second leg; keep the public index coarse; and treat Market Intelligence as a Breeder-plan retention feature with a cheap "pro data" add-on rather than a $1,000-a-year plan until the data is reliable and someone has asked for it.

### B10. Community (forum, gallery, messages, notifications)

**Score: 2 of 5.**

The forum has 13 posts, the last in April; direct messages have been silent since April; the gallery has 38 member photos. The October work made these features complete (editing, photos, pin, lock, real counts, report buttons, blocking, paged notifications, one-click unsubscribe), which is the right thing to do before a store review, but none of it changes the fact that there is no community to moderate yet. The notification system is the strongest piece: records first, dispatched by the database with recipient preferences, email and web push, and the only engagement that works (hatch alerts read 91 percent of the time).

Two wrong defaults: the weekly digest goes to 35 gecko owners, 19 of whom are legacy profiles that cannot sign in, and is read 2.5 percent of the time; new-member notifications for "Level Up & Achievements" and "Gecko of the Day" exist for a product whose brand doc says "not gamified".

Recommendation: no new community features; stop the digest for addresses with no login; let the forum live as the place "what morph is this?" threads can land from the Morph ID share card; revisit community when weekly active keepers pass 50.

### B11. Breeder tools (passports, transfers, waitlists, breeder pages, business tools, worksheets)

**Score: 3 of 5 (complete on paper, unproven in the hand).**

Between 29 September and 7 October the breeder side went from partial to complete in code: passports with weights visible to buyers, a transfer dialog with a buyer email and resend and cancel, claim with name and photo, parent names kept after a claim, reviews only from claimed transfers, admin-verified breeder badges with a checklist, an inquiries inbox, waitlists with written deposit terms and confirmation emails, rack label sheets, a buyer packet, profit by season and pairing, pairing value on every plan, a breeder page that now doubles as a website (13 October). This is a coherent, differentiated set, and it is what decision 32 says the product is for.

What is missing is proof: none of it has been run on a phone against production by a real breeder; the MorphMarket CSV export has never been tested against MorphMarket's importer (feature audit step 19, waiting on Tennyson); five geckos have passport codes and two transfers exist; zero waitlists, zero inquiries and zero reviews have ever been created; the Keeper 50-gecko and collaborator caps that distinguish Breeder are not enforced on the server (C4).

Recommendation: the breeder channel in A9 is the test. Ten hand-onboarded breeders will find the bugs faster than another audit, and they will tell you whether "your crested gecko website for $5.99" is a reason to switch.

## Part C. Engineering

The numbers in this part come from running the repo's own gates in this session (lint clean, typecheck clean, 1,657 tests in 128 files passing in 15 s, genetics consistency check passing, `pnpm build` in 54 s with 161 prerendered routes and a clean SEO audit) and from two read-only reviews written for this report (code architecture, and domain/build/CI/dependencies). File and line references are to commit `c2266aa` on main.

### C1. Architecture and code structure

**Score: 3 of 5 (good bones, too much mass).**

Size: 171,654 lines under `src/` (75,793 in components, 41,110 in pages, 35,465 in lib, 14,615 of content data), 34 edge functions (about 11,300 lines), 265 migration files, 23 build scripts. 80 page files, 50 registered routes, 379 components.

What is genuinely good:

- The page registry is explicit and documented (`src/pages.config.js`), every page is lazy-loaded through a loader that retries chunk fetches and reloads once on a stale deploy, there is one shell instance with a per-page error boundary, retired pages live in one data file that the router, the sidebar and the edge redirects all read, and feature flags from `page_config` are applied at the router with a protected list of essential pages.
- The entity layer (`src/api/supabaseEntities.js`) documents every schema exception with the production date it was checked, keeps pure and tested record builders, and gives anonymous reads explicit column lists so owner emails never leave the server for signed-out visitors.
- Feeding and shed writes all go through one module (`src/lib/husbandryLog.js`), so the "two feeding logs" problem from the September audit is really closed.
- There are no TODO, FIXME or HACK markers anywhere, one `eslint-disable`, and six `console.log` calls. That discipline is rare.

What is wrong:

- **The gecko record is still two implementations.** `src/pages/GeckoDetail.jsx` (557 lines) and `src/components/my-geckos/GeckoDetailModal.jsx` (1,267 lines, 18 state variables, 31 entity calls) both render weights, breeding history, husbandry and events. Feature audit step 14 was marked done by linking one to the other; every new section (vet visits) is now added twice.
- **The biggest files carry the app's state by hand.** MarketplaceSalesStats 1,664 lines with 27 state variables; PromoteComposer 1,505 with 33; MyGeckos 1,359; GeckoForm 1,335; Layout 1,487 with the sidebar markup written twice (mobile and desktop). `react-hook-form` and `zod` are installed for forms and used by none of the 14 forms; `react-query` is used in 9 files while 204 effects fetch by hand.
- **Cache invalidation is a window event bus:** 24 dispatches of 10 custom event names and 42 listeners (`geckos_changed`, `unread_counts_changed`, and so on), with one bridged into react-query.
- **Base44-era leftovers still shape code paths.** `Layout.jsx:360-364` and `layoutCache.js:76` branch on `e.response?.status`, a shape Supabase errors never have, so the retry and the "database temporarily unavailable" branches are dead; `main.jsx:50-56` posts messages to a sandbox parent that no longer exists; `src/lib/VisualEditAgent.jsx` (647 lines) is dev-only but still read by every session.
- **Dead code:** 29 modules are never imported (including 721- and 667-line "previous" preview components, a second price game panel, 19 of 51 UI primitives) and six packages are unused (`react-hook-form`, `@hookform/resolvers`, `satori`, `react-day-picker`, two Radix packages); `src/components/ui/sonner.jsx` imports two packages that are not installed.
- **26 native browser dialogs** (`confirm`, `alert`, `prompt`) remain in paid and destructive flows, including store checkout errors and the waitlist buyer form, against the design doc's "never alert()" rule and the 44 px touch rule.

Recommendation: one consolidation sprint (about a week): pick one gecko record and delete the other; extract the sidebar into one component; delete the 29 unused modules and six packages in one verifiable commit; replace the dead Base44 branches; adopt `useQuery` and `useMutation` page by page starting with GeckoDetailModal, Messages and MarketplaceSalesStats; one `useConfirm()` hook in place of the 26 dialogs.

### C2. Data layer and identity model

**Score: 2 of 5.**

The identity boundary is the deepest technical debt in the product. There are two identifiers for a member: the legacy text `profiles.id` and the Auth UUID, and ownership of most records is stored as the member's **email** in `created_by` (dozens of client-side filters on `created_by` against the member's email). ENGINEERING.md documents this honestly as a "deliberate compatibility boundary". It has four live consequences:

1. An email change orphans a member's entire history (the growth funnel doc's data quality item 9).
2. Comparisons are exact-case in most places (`Layout.jsx:485`) and lowercased in one (`geckoLimit.js:23`), so a member whose auth email casing differs from older rows sees different counts in different places.
3. When the profile read fails and nothing is cached, `user.id` silently stays the Auth UUID (`userProfile.js:61-70`), so anything keyed by `user.id` writes the wrong key for that session, with no flag saying which kind of id it holds.
4. Every RLS policy on an email-keyed table has to resolve the caller's email, which is why the September launch review found 208 policies re-evaluating auth functions per row.

Also in this category: data loading hides failures. 76 call sites turn any error into an empty list (`.catch(() => [])`), so a bad column, an RLS denial or a dropped request all render as "no data" (this is how the collection-member bug stayed hidden for months); entity `.list()` and `.filter()` have no default limit and PostgREST truncates silently; the admin analytics screens load whole tables including `gecko_images` rows that each carry a 768-float embedding; My Geckos and Field Mode stop at 500 geckos with client-side search; the forum does one query per comment for likes and notifications do one insert per follower; every entity `create()` and every telemetry event makes a network round trip to the auth server (`supabase.auth.getUser()`, 18 sites) when the local session would do; the profile, entitlements and comps reload on every tab focus.

Recommendation: (1) a migration plan for `owner_profile_id`/`owner_auth_id` columns on the email-keyed tables, backfilled by trigger as `geckos` and `gecko_images` already did in October, with policies rewritten to the UUID; this is a multi-week project and should be scheduled, not improvised; (2) a shared `safeList()` that reports the error and returns `[]`; (3) a default cap on entity reads; (4) `getSession()` instead of `getUser()` except where a server-verified identity matters; (5) server-side search past 500 geckos.

### C3. Database schema, RLS and migrations

**Score: 2 of 5 (good structure, one systemic flaw).**

Structure: 265 migration files after the September rebaseline (a production schema dump followed by real migrations, with the originals archived), a conventions document, a schema snapshot, SQL regression scripts for billing, launch repairs, market combos and RevenueCat access, and a documented rule that deploy scripts must never replay migrations. RLS is on for every table, all 172 SECURITY DEFINER functions have their search path pinned, the privileged profile columns are frozen by trigger, admin functions check `is_admin()`, and the September launch review closed four critical findings. That is a sound foundation.

The systemic flaw, which the adversarial review found and this review's own database pass missed until it was re-checked by hand: **write policies prove who wrote a row, never that the writer may touch the object the row points at.** Ownership is keyed on email strings, and the insert policies on child tables check only `created_by = auth.email()`. Concretely, in the current migration chain:

1. **Any signed-in member can take ownership of any public gecko (critical).** `transfer_requests_insert_own` checks only `created_by`; there is no trigger on `transfer_requests` and no foreign key on `animal_id`; `claim_transfer()` (migration `20261003004122`) checks only the request's status, expiry and that `to_email` matches the caller, then sets `geckos.created_by` to the caller and writes an ownership record marked "purchased". Gecko ids are readable for the 323 public geckos. Two transfers exist in production and nothing suggests this has been exploited; it needs fixing this week regardless.
2. **Strangers can write history onto any gecko (medium).** `weight_records`, `feeding_records`, `shed_records`, `vet_records`, `gecko_events` and `ownership_records` insert policies check only `created_by`; where foreign keys exist (feeding, shed, vet and ownership records) they prove the gecko exists, not that the caller owns it, and weight records and gecko events have none; the passport page reads every record by animal id; the owner cannot delete the forged rows (delete policies are author-only); forged weigh-ins feed the owner's reminders and digest. The skeptical check kept this at medium rather than high because it is write-only (no data leaks), needs a signed-in account, touches geckos whose ids the attacker can read (public geckos, plus private parents whose ids show through a public child's sire and dam links), and every forged row carries the attacker's email, so it is attributable and cleanable by SQL.
3. **Profile rows are not pinned to their email (medium, confirmed with corrections).** `profiles_update` and `profiles_insert_own` accept `created_by = auth.email()`, and the privileged-column trigger does not freeze `email` or `created_by`, so a member can plant a second profile row for an address that has not signed up yet, and that row survives the real person's signup because the auth trigger does nothing on conflict. The skeptical check narrowed the rest: since September the profile SELECT policy is owner-only, so the planter cannot read the planted row, touch its role or tier, or lock the victim out. But the planter keeps write access to the victim's public name, business name, bio and links after the victim signs up, for as long as the row exists. On a platform selling breeder trust that is persistent impersonation, not a cosmetic nuisance, which is why the first version of this report was wrong to call it low. The adversarial review's production query found six rows where `created_by` differs from `email`. Cheap to fix in the same trigger.
4. **Every signed-in member can harvest member emails in one request (medium).** The biggest hole is `read_profiles()`, which returns the email of every public profile to any signed-in caller (first defined in migration `20261002213226`, redefined in `20261003024242`); after that, the 8 October migrations revoked email columns from `anon` only, and `authenticated` still reads `created_by` on `gecko_images` (policy USING true), public `geckos`, forum posts and comments, and `owner_email` on store pages. Sign-up is open, so "signed-in" means anyone.
5. **Default privileges grant EXECUTE on every new public function to anon and authenticated** (baseline lines 16949 to 16952), which is why two clean-up migrations already exist; the next helper ships callable by the public key the moment it is created.
6. Decision 44 is half applied: anon grants were revoked on the listing tables, but the `USING (true)` policies and `authenticated` grants remain, so one free signup can download the scraped corpus; the `listing-images` bucket is still public.
7. The public anon key can insert directly into `breeder_inquiries` (bypassing the edge function's rate limits), `support_messages` (a deletion-request-shaped row pages every admin by push and email), `user_events` and `newsletter_subscribers`, with no throttle on any of the four.

The fix for items 1 to 3 is one pattern: a `can_edit_gecko(p_id)` SECURITY DEFINER helper used in the WITH CHECK of every child table, ownership checks inside every SECURITY DEFINER function that trusts a client-chosen id, a trigger that freezes `geckos.created_by` and `profiles.email`, and a `create_transfer_request()` RPC that replaces direct inserts. Then one SQL regression test per table, next to `supabase/tests/launch_repair_regressions.sql`.

Open items that are structural rather than security:

- Five migrations written on 3 and 5 October (account erasure, two anon email-column lockdowns, the definer lock, personal weigh-in reminders) waited five days for a hand-run because the Supabase tool refuses statements containing `delete`, `drop` or `revoke`; they were applied and reconciled on 8 October (PR #107 renamed them to the versions production recorded). The documents never caught up: `docs/planning/deploy-queue-2026-10-03.md`, the activation plan and the feature audit still say "not applied, waiting on Tennyson", and `supabase/pending/` still holds a waitlist file whose revoke is already in the chain. Two reviews this week built findings on that stale text before checking the chain. One `supabase migration list` against production (the query is in the security appendix) settles it; then the deploy-queue file and the pending folder should go.
- The `geck_data` schema (market data, 81 tables) is shared with the separate geck-data repo, which also edits it. Two repos writing one schema with one migration history is a coordination risk that both CLAUDE.md files try to manage by convention.
- Generated artefacts are tracked in git and drift: `api/_lib/mcp-core.js` is rebuilt on every deploy, and the committed copy was behind the morph data (no Sable or Highway) until this session's build refreshed it.

### C4. Edge functions and server security

**Score: 3 of 5.**

All 34 edge functions were read and graded (the full table is in the supporting security review). Twenty-one grade A: tier, cycle, price id and return URL validated server-side in `stripe-checkout`; constant-time secrets and event-id idempotency in the RevenueCat pair, which is the best-built code in the repo; signatures verified over the raw body in both Stripe webhooks; recipients looked up from the database rather than the request in the inquiry, waitlist and transfer emails; model choice and metering server-side in Morph ID, the consultant and the import scanner; social tokens encrypted at rest; no secret in the repo (this review's scan of the shallow clone, and the adversarial review's scan of all 1,870 commits of the full history, found only the public anon key).

The gaps:

- **Notifications are an email and push relay any member can drive (medium to high, confirmed with corrections).** `notifications_insert_any_authed` constrains only `created_by`; the guard trigger sanitises the link and length but not the recipient or the type; the dispatcher sends every row to `send-email` and `send-push`; default preferences enable every email type. One free signup can email every member from alerts@geckinspect.com with up to 500 characters of their own text under a fixed per-type subject ("Geck Inspect announcement", "New message"), and can loop inserts to burn the Resend quota the reminders depend on. The skeptical check narrowed it on two points: the attacker controls neither the subject nor any HTML (the body is escaped), and recipients must be existing profiles with email on, which is nearly all of them, so that narrows little. It also got one point wrong, as the adversarial review said: the guard only rewrites links that do not start with a slash, so a protocol-relative link passes, and the service worker and the in-app dropdown open it off-site (only the email path prefixes the site address). That makes push and in-app notifications a phishing vector, and the one-line fix is to accept only links that match a single leading slash. Push reaches only members who opted in and registered a device. The September fix (F09) stopped sender spoofing, not recipient choice.
- **`generate-social-post` is unmetered across posts (medium).** Any signed-in member can call it (the "Promote is off" switch is enforced only in the router); it logs cost but never consumes a credit, unlike `invoke-llm`. It does cap generations at ten per social post, but a member can insert unlimited posts or reset the counter under the all-commands policy, so the cap bounds one post, not the account. Each call is a Sonnet 5.5 request with up to two images and 8,000 output tokens, roughly 2 to 9 cents; the only real ceiling is the Anthropic account's spend limit, which has already been hit once by accident.
- **Market Intelligence, the Enterprise product, is gated only in the browser (medium).** The latest `market_tape`, `market_brief` and watchlist functions carry no tier check; decision 38 admits it.
- **Keeper's 50-gecko cap, the collaborator caps and the Promote image and scheduled-post caps are enforced only in the browser (medium).** `enforce_free_gecko_limit()` exits for any tier other than Free; nothing limits `collection_members`.
- The membership Stripe webhook has no event-level idempotency (the store webhook does), compares the signature with `===`, and falls back to `customer_details.email` for an email-keyed upsert that can create or re-key a profile row (low on its own: the money and referral paths already dedupe on the invoice id, so a replayed event can only re-stamp timestamps or re-assert "active"; the fix is a copy of the store webhook's code). The serious defect in the same file was missed by the first version of this report: a failed profile write is logged with `console.warn` and the handler still marks the event processed and returns 200 (`upsertProfileByEmail`, then `markLog("processed")`), so Stripe never retries and a paying member can stay on Free with nobody told (medium; the adversarial review's section 06 has it; the fix is to throw so the event is marked failed and Stripe retries).
- `embed-gecko-image` is an unmetered Replicate call for any member; `send-collection-invite` resends unlimited invite emails per pending row; `waitlist-signup` has no honeypot or network limit; `store-checkout` accepts arbitrary success and cancel URLs (checkout is off); the MCP endpoint and bot page views write unthrottled rows through an anon-callable function (all medium).
- `config.toml` carries a `verify_jwt` line for six of the 34 functions (three false, three true), so the other 28 rely on the deploy flag, so a future deploy without the flag silently breaks the webhooks and the notification dispatcher (low).

Independent of the gaps, three facts stand:

- Metered features are correctly server-side: `consume_feature_credit` resolves the tier itself and ignores what the client sends; Morph ID credits are granted only to the service role; five edge functions call `effective_tier_for_current_user()`.
- The fixes are small and mechanical: a tier-aware gecko trigger plus one on `collection_members`; `effective_tier_for_current_user()` inside the market functions; `consume_feature_credit` in `generate-social-post`; a recipient and type allowlist in `guard_notification_insert()` or RPCs for cross-member notifications; event-id idempotency and `timingSafeEqual` copied from the store webhook.

### C5. Web security, headers, agents and secrets

**Score: 3 of 5 (strong headers, one big hole, and an agent configuration that trusts too much).**

Good: HSTS with preload, nosniff, frame-options, referrer policy, a tight permissions policy, COOP, a Content-Security-Policy that is now enforced (14 October) with a reporting endpoint, cache headers per asset class, SHA-pinned GitHub Actions with least-privilege permissions, and a launch review that closed 60 of 62 findings including four critical ones.

The hole: `script-src` includes `'unsafe-inline'` (`vercel.json`). That keeps the inline Google Analytics loader and the Robauto beacon working, and it also means the policy gives almost no protection against injected scripts, which was the whole point of finding F43. The blog renders HTML from markdown through a hand-written sanitiser (`src/lib/blog-helpers.js`), and there are four `dangerouslySetInnerHTML` sites. Moving the two inline loaders into external files (or dropping GA4 and the beacon, see A11 and C10) lets `'unsafe-inline'` go; the prerender already emits per-route HTML, so a build-time hash list is also possible.

Also: the implicit OAuth flow is used on web (tokens in the URL fragment) where PKCE would keep tokens out of referrers and analytics, and the GA4 page tracker sends the full URL with only email parameters redacted, so an access token can reach Google Analytics after a Google sign-in, an email confirmation or a password reset; claim and invite tokens sit in the path and reach the Robauto pixel and PostHog; `geckDataClient.js` falls back to the production project when env vars are missing, so a test build silently reads production market data; the `$or` filter builder interpolates values into the PostgREST filter string without escaping (safe today because the only caller passes the session email).

**The AI agents that build the product have more power than any member, and less supervision.** `.claude/settings.json` (committed) sets `defaultMode: acceptEdits` and pre-approves Bash, Edit, Write, WebFetch, every GitHub tool and every Supabase and Vercel tool, with empty ask and deny lists; `.mcp.json` starts the Supabase server without `--read-only`; CLAUDE.md tells every session to push to main, auto-merge, and route around the sandbox when it blocks a push. The nightly error-triage workflow reads anonymous `error_logs` text (anyone can insert rows), lets a model rewrite any existing repo file and open a pull request, and holds the Anthropic key and the database service-role key while it does so; the only protection against injected instructions is the system prompt (the GitHub token cannot push workflow files, but that does not make the job safe, as the adversarial review showed: after the model's proposed fix is written to disk, the same job runs `pnpm lint` and `pnpm typecheck` with the service-role key and the Anthropic key in its environment, and lint executes `eslint.config.js`, which the fix may have rewritten). The weekly agent review reads raw user-agent strings from `agent_hits` (anyone can write them) and pushes to main. None of this has been exploited, and the adversarial review's own verifier rates the likelihood "moderate to low", but the payoff of a successful injection is total. The fixes are cheap: split the triage job so the model never runs in the process that holds the secrets (or switch it off and rotate the service-role key, as the adversarial review recommends), a code-level denylist and size cap in its `propose_fix`, no fix proposals from anonymous reporters, `--read-only` on the Supabase server for scheduled sessions, Supabase and Vercel write tools moved to "ask", and the admin account on two-factor sign-in (the adversarial review found zero verified MFA factors on any account, which this review could not check without production access).

**The repository is public.** It contains the funnel and revenue numbers, the schema and every access rule, security write-ups of unfixed holes, project ids, the admin's identity, signed MorphMarket image URLs with seller usernames in the evaluation split, and a STRATEGY.md section titled "His weaknesses (which Geck Inspect can exploit)" about a named competitor. The open-data and agent-access story does not need the application code to be public. Make it private (two minutes), or at minimum move the strategy and security documents out.

### C6. Performance

**Score: 3 of 5.**

Measured from this session's build: 10.3 MB of JavaScript raw (3.0 MB gzipped) in 457 chunks; the entry chunk is 668 kB raw / 205 kB gzipped on every page; CSS 272 kB / 44 kB. The entry chunk is mostly the Supabase client (auth 433 kB, storage 116 kB, postgrest 111 kB, realtime 102 kB of source), react-router (375 kB) and react-dom. The landing-speed pass (October) measured the landing page about 0.3 s over its 2-second mobile target.

The Morph Guide index, the site's main search landing page, mounts ten illustrated-gecko components on first render; each one draws two 1536 by 1024 ink-study images (2.26 MB for the set) into a full-resolution canvas, reads every pixel twice, flood-fills and re-encodes to PNG on the main thread with no downscaling, worker or idle gating. How many seconds that costs a phone could not be measured here (the adversarial review measured about 3 s), but the shape of the work is wrong for a cold anonymous visitor, and the eight layers can be precomputed at build time; a second unused set of the same images (2.4 MB) ships in `public/`.

Specific waste elsewhere: `jspdf` (391 kB raw, 129 kB gzipped, plus 160 kB of canvg) sits in the static import graph of `MyGeckos.jsx` (through the gecko detail modal and `buyerPacket.js`) and `AnimalPassport.jsx` (through `certificateExport.js`), so the main signed-in page pays for PDF export on every load even though `exportUtils` already lazy-loads it; `html2canvas` (202 kB) is a direct static import in `Lineage.jsx` and reaches `Pedigree.jsx` through the poster export component; 13 font weights across three families load from Google Fonts; 45 files in `public/` exceed 200 KB, three of them (5 MB) unreferenced, and the guest demo serves a 2.1 MB JPEG; the shell polls unread counts on two 60-second timers and the live feed every 30 s while Supabase Realtime is already in the bundle (a 15-second notifications dropdown poller also exists in the code, but that component is never imported).

Recommendation and budget: make the PDF and canvas libraries dynamic at the export action; defer the Supabase client for signed-out visitors with no saved session (the single largest lever on landing speed); self-host 3 or 4 font weights; delete or compress the heavy images; then hold a budget in CI (entry at most 150 kB gzipped, any public page at most 200 kB before first paint, route chunks at most 60 kB, no library over 50 kB outside a user action) with a size-limit check so the next regression is caught.

### C7. Offline, PWA and native shells

**Score: 3 of 5.**

The service worker is small, commented, network-first for navigations (so a stale shell can never shadow a deploy), cache-first for hashed assets, and never touches cross-origin or API data; decision 29 explains why, and it is the right design. The offline queue is pure, tested, owner-scoped and whitelists what it will replay. The native shells are minimal Capacitor projects with mixed content off, a privacy manifest, store billing through RevenueCat and an honest release-readiness document.

Two correctness risks in offline Field Mode, which is a headline promise:

1. The Supabase client aborts every request after 30 s, and the queue's network-error test does not recognise an abort (verified by running the function with the postgrest-shaped error), so on a weak-but-connected signal, which is exactly where Field Mode is used, a queued feeding log is classed as a database refusal and **deleted**; the member sees a toast with the wrong reason ("refused by the server") and is told to log it again (`offlineQueue.js:164-206`, `FieldMode.jsx:384`). The skeptical check rates this low because the loss is one log per incident and it is not silent; it is still the wrong behaviour for the feature's one promise.
2. If a write reaches the server but the response is lost, it is queued and replayed with no idempotency key (`offlineSync.js:29-58`), so the log can be **duplicated**; `save_gecko_record` takes a request id, the feeding and shed writes do not.

Smaller: the worker stores every navigation under one cache key, so the offline shell for `/MyGeckos` can be whichever prerendered public page loaded last; open-data JSON under `/data/` is served stale-while-revalidate to agents; the cache version is bumped by hand. Native push, app links and a CI build are still missing (feature audit step 9), and the 4.2 rejection risk is real.

### C8. Testing and quality gates

**Score: 2 of 5 (deep where it is, absent where the risk is).**

1,657 test cases across 128 files, zero skipped, with real coverage of genetics, billing semantics, identity switching, offline queue ordering, guest isolation. (The SQL regression scripts under `supabase/tests` are wired to no runner, workflow or package script, so they are documentation, not coverage; the adversarial review said so and the first version of this report counted them.) That is the good news.

The gates are narrower than they read:

- ESLint is configured for `src/components`, `src/pages` and `Layout.jsx` only (`eslint.config.js:10-14`). `src/lib` (35,465 lines), `src/api`, `src/hooks`, `App.jsx`, `scripts/`, `api/` and every edge function are never linted, and because the config's `rules` block replaces the recommended rule sets rather than extending them, only five rules are active even on the matched files (no undefined-variable check, no missing-key check, no unreachable-code check). `react-hooks/exhaustive-deps` is off everywhere, with 379 effects in the app.
- `pnpm typecheck` is a syntax gate with `checkJs` off; because the compiler follows imports it does parse about 650 files including `src/lib`, which is better than the config suggests, but it types nothing. ENGINEERING.md says so, while the docs elsewhere cite "lint, test and typecheck pass" as evidence.
- Test-to-source ratio: lib 0.36, api 0.24, components 0.01 (11 files for 74,000 lines), pages 0.00, hooks 0.00. The form that performs the atomic gecko save (`GeckoForm.jsx`, 1,335 lines) has no test. Component tests use the deprecated `react-test-renderer` and mock nearly every dependency, so they verify wiring, not behaviour. There is no browser-level or end-to-end test, and five tests depend on the wall clock.
- The genetics consistency check runs in CI but not in `pnpm build`, so a Vercel deploy never enforces it.

Recommendation: widen the ESLint file list and turn on `exhaustive-deps` as a warning; put the genetics check into `pnpm build`; add jsdom and Testing Library with three page smoke tests (GeckoForm save, Messages, Membership checkout button); add one Playwright flow (sign up, add a gecko, log a feeding) that runs against a preview or a local mock; freeze time in the five clock-dependent tests.

### C9. CI/CD, deployment and release process

**Score: 3 of 5.**

Twelve workflows, all SHA-pinned, with least-privilege permissions. CI runs lint, typecheck, tests, the genetics check and the full build on every push. A deploy-watch workflow opens an issue when a production build fails, which closed the August incident where production served a two-week-old build in silence.

Problems:

- **Every push to main deploys production and CI does not block it.** The only gate is `pnpm build`'s own lint and tests, which Vercel runs in parallel with CI. There is no staging; GitHub's ruleset on main blocks only deletion and force-push, and nothing in the repo records even that.
- **Four scheduled bots commit to main** (nightly error-triage ledger, weekly growth report, weekly agent traffic export, twice-monthly SEO audit), so docs-only commits trigger about four production deploys a week, and the error-triage bot opens draft pull requests on `error-triage/*` branches, which creates exactly the Vercel preview deploys CLAUDE.md says it does not want.
- The scheduled scripts hard-code older model ids (`claude-sonnet-4-6`, `claude-haiku-4-5`).
- `scripts/README.md` documents two of the 23 scripts.

Recommendation: a Vercel "ignored build step" that skips docs-only commits; move bot output to a `reports` branch or to Supabase; turn the triage bot's pull requests into issues with patches; record branch protection in README; add the size-limit and genetics checks to the build.

### C10. Observability, analytics and error triage

**Score: 2 of 5.**

In place: a first-party `error_logs` table fed by window error handlers and the error boundary with a per-minute budget, a nightly AI triage that reads it and files fixes, a daily canary that prices four reference geckos and runs two real Morph IDs, `user_events` for product events, PostHog, GA4, an admin Funnel card and a health page with deploy version and scheduled jobs.

Missing or wrong:

- **No uptime monitor.** Nothing checks that the site, sign-in, checkout or the MCP endpoint answer between the canary's daily run. README's baseline checklist still has "uptime incl. checkout URL" unchecked.
- **No provider spend alerts.** The Anthropic credit ran out on 7 October (`docs/error-triage-state.json`: "Your credit balance is too low to access the Anthropic API"), which the adversarial review's production logs show failing Morph ID calls on 6 and 8 October (5 of 23 lifetime production calls; the first version of this report overstated it as a six-day outage); Replicate sits under $5, which throttles the photo lookup to one request at a time. Both have already failed once each.
- **No backups documented.** No file describes database backups, point-in-time recovery, storage bucket backups or a restore drill. 349 geckos and 3,800 photos have no written recovery path.
- Edge functions and Vercel functions log only to retention-limited provider logs; there is no error sink or release tagging, and the triage agent reads minified stack frames.
- **Three analytics systems identify members by email:** PostHog `identify(user.email)`, `user_events.user_email`, `error_logs.user_email`, plus the Robauto beacon on every page. Decision 15 and CONTEXT.md say "no Google Analytics"; GA4 is live.
- `payment_events` misses most payments (A5), and the Morph ID credit ledger disagrees with the call log.

Recommendation: a free external uptime check on four URLs; spend alerts in the Anthropic and Replicate consoles plus a weekly balance line in the canary; one `docs/OPERATIONS.md` naming every secret's home, the backup setting and a quarterly restore drill; drop the Robauto beacon; hash the analytics id.

### C11. Dependencies and supply chain

**Score: 3 of 5.**

Good: 19 security overrides, DOMPurify pinned, SHA-pinned actions, Dependabot, no GPL or AGPL, one copy each of React and ReactDOM.

Needs attention: 64 packages behind (18 by a major: React 19, Vite 8, Tailwind 4, TypeScript 7, ESLint 10, recharts 3, framer-motion 14); `pnpm audit` shows 14 advisories (9 high) all on tooling paths except `sharp` under `@vercel/og`; four of the security overrides now pin versions **below** the patched ones (`brace-expansion` 1.1.18 vs 1.1.21 and 5.0.9 vs 5.0.12, `js-yaml` 4.3.1 vs 4.3.2, `postcss` 8.5.28 vs 8.5.30), which defeats their purpose; the RevenueCat web SDK is 29 minor versions behind; the vendored genetics engine declares the Anthropic and OpenAI SDKs as runtime dependencies so every install pulls an old Anthropic SDK and the OpenAI SDK for code the app never calls, and its tarball does not record a source commit; `heic-to` is LGPL in the browser bundle (low risk, worth a NOTICE line); `html-to-image` and `html2canvas` do the same job.

Recommendation: bump the four stale overrides and `@vercel/og` now; remove the six unused packages; make the engine's AI adapters optional; schedule React 19 and Vite 8 as one deliberate upgrade with the four coupled packages (helmet-async, day-picker, date-fns, framer-motion).

### C12. SEO and agent access

**Score: 4 of 5 (technically excellent; strategically ahead of the business).**

Technically this is the best-built part of the product: 161 prerendered routes with per-page metadata, JSON-LD, noscript bodies, canonical links, a sitemap with real modification dates, markdown twins of every guide page with canonical headers back to the HTML, an 8 KB llms.txt with topic files, open datasets with DataCatalog markup, a read-only MCP server with six tools, agent-hit logging, and a static audit that reports zero issues.

Findings:

- **Stale modification dates on pages edited this week.** The structured data's `dateModified` for `/GeneticsGuide` and `/calculator` is hard-coded to 17 April in `src/lib/editorial.js`, while the sitemap carries 6 October and 29 September from `scripts/content-dates.json`; both pages changed on 14 October. The content-dates step is run by hand (last on 12 and 14 October) and the two surfaces disagree; the first version of this report pinned this on the sitemap. Google uses `lastmod` and `dateModified` to decide when to recrawl.
- **95 of 161 routes have under 300 words of crawlable text**, and the nine calculator pairing pages have about 110 words each, mostly navigation. For GPTBot and ClaudeBot, which do not render JavaScript, those pages are empty.
- **The money pages' descriptions are truncated definitions** ending mid-clause; Harlequin has 0.68 percent click-through on 147 impressions at position 8.6. Hand-written descriptions for the ten highest-impression morph pages is an afternoon of work with a measurable result.
- The landing page ranks for "crested gecko genetics" (position 12.6) when `/GeneticsGuide` should; `/blog/tag/records` ranks for "gecko breeding records" when `/breeding-records` is the intended page.
- **Agent access is a large investment for no measured return yet.** In the first full week of logging: 12 reads of llms.txt, 6 of the MCP server card, zero MCP tool calls, one GA4 session from ChatGPT. The artefacts cost nothing to keep. The weekly agent review session, the weekly export and the planned directory listing are the recurring cost; make the review monthly until activation moves.
- A Lilly White origin contradiction is published in FAQ JSON-LD and fed to assistants (see B7).

### C13. Documentation and maintainability

**Score: 3 of 5 (volume high, truth decaying).**

The docs are the project's memory and most of them are good. The problem is that the ones every session is told to read first are the wrong ones. The domain review tabulated 21 contradictions between documents and code; the important ones: CONTEXT.md says auth may still be on Base44, Keeper is $4 and Breeder $9, Enterprise is waitlist-only, the landing page has no hero or pricing, there is no Google Analytics, and Foundation Genetics is not integrated (every one is false today); STRATEGY.md is from May and still says Breed Ledger launches 15 May; ROADMAP.md says Morph ID accuracy is retired while three commits this week continued it; DESIGN-SYSTEM.md describes a light sage palette with DM Serif that the product never shipped, and CONTEXT.md describes a third palette; DECISIONS.md is still titled a landing-page decision log; PRODUCT.md is the Morph ID brief presented as the product brief; README and CLAUDE.md say no pull requests while a bot opens them nightly. All of these files carry a 6 October git date from the em-dash sweep, so file dates no longer signal staleness.

Recommendation: rewrite CONTEXT.md sections 1 to 5 and 8 from the code (one page, one afternoon); fold the three palettes into one design document that matches the shipped tokens; retitle DECISIONS.md and move PRODUCT.md to `docs/specs/morph-id-product.md`; update STRATEGY.md from the October research; add a weekly "docs reconcile" step to whichever session runs on Mondays.

### C14. Operations: support, moderation, backups, costs

**Score: 2 of 5.**

Support runs through a personal Gmail and an in-app ticket inbox that now records replies (feature audit step 16). Moderation has report buttons everywhere, a reports view with hide and remove, and blocking; it has never had an acceptance pass (release gate 5). Backups are undocumented (C10). Costs are unlisted (A12). Secrets live in four dashboards with no inventory. Two provider credit balances have each run dry once. There is no on-call, which is fine for one person, but there is also no alert that would wake that person.

The single document that fixes most of this is `docs/OPERATIONS.md`: services and costs, secrets and where they live, backup settings and the restore drill, the uptime and spend alerts, the support address, and the weekly checklist (deploy queue applied? bots healthy? feed on?).

### C15. What this review did not close, and the production checks that would

A completeness pass over the drafts found topics that no category above covers well. They are listed here so the next person does not mistake silence for a clean bill.

1. **Lifetime memberships as a product and legal event.** The Terms have no section on subscriptions, renewals, refunds, trials or what a one-time lifetime plan means if the service closes; the native app sells only the two subscriptions, so a web lifetime plan visible in the app is an Apple 3.1.1 question; the webhook code written for it has not been exercised. Needs: Terms sections (E2 item 22), a test-mode lifetime purchase, a decision on native visibility.
2. **Email deliverability and compliance.** No postal address in the email footer (commercial mail with upgrade links needs one), no bounce or complaint webhook (failures only reach a console line), SPF, DKIM and DMARC documented nowhere, and 58 percent of last month's notification mail went to addresses that cannot sign in. The retention thesis rides on this channel. Needs: the Resend dashboard and DNS records (production), an `email_deliveries` table fed by a Resend webhook (E2 item 20).
3. **Time zones and units.** Every reminder job fires at a fixed UTC hour (14:10 to 14:25, about 7 am Pacific and 11 pm in Seoul); neither profiles nor the reminder SQL carry a time zone; copy is Fahrenheit-first and grams-only; listing prices show a raw currency code. The market product courts Korea, Japan and Europe. Needs: a time zone on the profile and in the reminder queries before any non-US member is asked to rely on reminders.
4. **Whether the breeding records fit the animal.** The genetics engine was verified; the record model was not. An egg carries only its breeding plan, lay and hatch dates and status, so parentage is inherited from the plan with no way to record a possible prior sire, while the guide itself says females retain sperm for months. A clutch after a pair change can be mis-sired and the passport prints that lineage with the app's authority. Needs: a "possible sire" field or a warning when a female's previous pairing is within the retention window.
5. **The second product and the shared schema.** The `geck_data` schema (81 tables) is written by a separate scraper repo and read by a second site, and decision 43 adds a third site from this repo on the same database. Nobody reviewed the scraper's reliability (the adversarial review found its refresh job failing 109 of 169 runs in a week on a 120-second timeout), the multi-site build, or whether `geck_data` policies hold for a member who owns animals in two species. Needs: the geck-data repo and `cron.job_run_details` (production).
6. **Provenance of the genetics engine.** The vendored package is `UNLICENSED`, its author string is "Tenny's Crested Geckos" (the name CLAUDE.md says is not Tennyson's brand), and no source repository or commit is recorded, yet the calculator, the consistency check and the MCP pairing tool all import it. The most differentiated logic in the product cannot be rebuilt from this repo. Needs: Tennyson to confirm where the source lives and to set the licence and author fields.
7. **Sign-in as a surface.** `config.toml` has no `[auth]` block, so password rules, sign-up rate limits, captcha, OTP expiry and email-enumeration behaviour are dashboard settings nobody has read; MFA is asserted absent on the adversarial review's word; the email-change path that orphans history is a user flow that should be blocked or migrated, not only a data note. Needs: the Supabase Auth dashboard (production).
8. **Photo handling and content safety.** Uploads are downscaled and re-encoded in the browser, which strips metadata as a side effect, but originals under 1,600 px and 400 KB, GIFs and decode failures are stored untouched, so about 600 older originals may carry camera GPS data; two buckets are public; there is no written procedure for illegal content in a public bucket, no report-handling target, and no stance on animal-welfare content. Needs: a sample with `exiftool` (production), a one-time re-encode job, a short moderation procedure. **Checked 31 Oct 2026 (read-only):** `scripts/photo-gps-audit.mjs` read every photo in `geck-inspect-media` and `promote-images` (thumbnails skipped). 273 of the 706 photos stored before 1 October carry a camera GPS position (latitude and longitude); none of the 176 stored since do. All 273 are JPEGs between 0.4 and 14 MB, 262 of them in the `base44.app/` folder (photos brought over from the old platform in April and May 2026, which never went through the browser re-encode) and 11 in `uploads/`. So the estimate above (small originals, GIFs, failed decodes) was the wrong group: the leak is the migrated originals. Nothing was changed. The same script has a `--strip` mode that saves each original before writing a copy with the GPS zeroed in place; it has not been run, because the database and photo backups are not running yet (`docs/OPERATIONS.md`, section 3). The steps and checks before running it are at the top of the script.
9. **Tax and consumer law.** Checkout has no automatic tax, payouts go to a person, and there is no refund policy, auto-renewal disclosure or cancellation text, which auto-renewing plans need in several US states and which EU buyers' 14-day withdrawal right expects. Needs: Stripe Tax settings (production), the Terms sections in E2 item 22.
10. **Scheduled-job health and unbounded tables.** Nineteen cron jobs run and only seven days of their history are kept, so a failing job is invisible after a week; `agent_hits`, `user_events`, `error_logs` and Stripe webhook payloads grow without retention. Needs: `cron.job_run_details` and table sizes (production), a weekly job-health line in the ops digest.
11. **The founder's hours against the plan.** Part E assigns thirteen owner items in week one with no hour estimate, and E1 item 13 alone is forty messages and eight calls; the same person is listed on about twenty other projects in `docs/planning/agent-access-prompts.md`. Needs: Tennyson to write the number of hours a week this gets, and the plan to fit it.
12. **Import, export and print quality, which the hand-onboarding plan depends on.** The CSV importer's date formats, morph-tag parsing and parent linking were not reviewed; the MorphMarket export has never met MorphMarket's importer; there is no whole-account export although the Terms tell members to export what they want to keep; the rack labels and buyer packet have never been printed. Needs: one real spreadsheet import and one printed sheet before item 14 of the plan.
13. **Production numbers carry two definitions.** "56 accounts" (5 October, logins) and "61 accounts" (14 October, admin excluded); "about 1 weekly active" (members logging care) and "7 weekly actives" (signed in). Every figure in this report should be read with its date and definition, and the admin Funnel card should show both activity definitions side by side.

**The production verification list.** These could not be checked from the repository. Each is one query or one dashboard look, and the review's severities move if any comes back unexpected.

1. `select version from supabase_migrations.schema_migrations where version in ('20261008063704','20261008081011','20261008081043','20261008081305','20261008081343')`: the October security and reminder migrations are live.
2. `select proname, proacl from pg_proc where proname in ('join_waitlist','open_price_index','log_agent_hit','admin_growth_funnel','active_comp_tier')`: anon should appear only on the price index and the agent-hit logger.
3. `select jobname, schedule, active from cron.job order by 1` and the last week of `cron.job_run_details`: which jobs exist, which fail.
4. `select key, value from geck_data.runtime_config where key = 'morph_id_per_ip_daily'`: without it Morph ID has no per-network cap.
5. `select count(*) from profiles where email <> created_by`: the scope of the profile pinning fix.
6. `select count(*) from social_platform_connections where access_token is not null`: plaintext tokens left from before encryption.
7. Edge Functions dashboard: `verify_jwt` off for every function that checks its own bearer; `rapid-api` and `admin-end-trial` deleted.
8. Database settings: backup tier, retention, point-in-time recovery on or off; storage bucket visibility for `listing-images` and `geck-inspect-media`.
9. Stripe: how many webhook endpoints exist and which signing secret each function holds; Stripe Tax; the lifetime prices in test mode.
10. `select name from vault.secrets`: the notification service key and the unsubscribe secret both exist.
11. Auth settings: MFA factors on the admin account, password rules, sign-up rate limits, captcha.
12. Resend: domain DNS records, bounce and complaint rates for alerts@geckinspect.com.
13. PostHog: whether person profiles are retained for deleted members.
14. `select count(*), min(created_date) from agent_hits`, `user_events`, `error_logs`: growth and retention of the unbounded tables.
15. A sample of ten pre-October original uploads through `exiftool -gps:all`. Done 31 Oct 2026 for every photo, not a sample: see item 8 of the list above (C15).

## Part D. The adversarial review: where it is right, where it is wrong, and what it found that this review did not

### D1. What it is

A separate session was asked to "critique it without mercy on every level" and "pair every critique with how you would do it so much better". It ran eight parallel reviewers (security, architecture, performance, UX, billing and ops, Morph ID and AI, SEO and legal, business), had read-only access to the production database (aggregate queries only), ran two verification workflows of its own (one to complete and re-check the security findings, one to try to refute its thirty most consequential claims), and wrote a 24,000-word report in 17 sections with a report card, a 14-day fix list and a 90-day plan with kill criteria. It cost about $163, was stopped three times by rate limits, and was published at 19:39 UTC as a private page titled "Geck Inspect Teardown" (https://claude.ai/artifact/NyJizLyshfkGSjV9uBp8ex), deliberately kept out of the public repository because it maps unfixed security holes. It was read here twice: through a complete digest of its transcript while it was still running, and then as the published page.

Its one-sentence verdict: "the next 90 days are a sales experiment, not an engineering project." That sentence is right, and this review reaches it independently (Part A and Part E).

### D2. Where the two reviews agree

Nearly everything structural. Both reviews found, independently and from different evidence:

- The business does not exist yet in the numbers (61 accounts, 7 weekly actives, about $9 of monthly revenue, zero week-two retention) while the product surface is enormous (80 pages, about 40,000 lines serving features with zero use).
- The founder is writing audits and shipping features instead of talking to breeders; the five breeder conversations scheduled for the week of 6 October are not recorded anywhere.
- The best data asset is scraped from the biggest competitor, the full US catalog sweep has been blocked since early September (a partial newest-listings route runs), and selling Enterprise on it at $99.99 one day after the research said not to was a mistake.
- The ball python plan contradicts the crested-first thesis and the research written eight days before it.
- Email-as-identity is the root of most of the security and data problems.
- The notification table is an email and push relay for any member.
- Member emails are harvestable by any signed-in account.
- Profile rows are not pinned to their email.
- The nightly triage bot reads anonymous text while holding the service-role key and the ability to edit the repo.
- The repository is public and contains things that should not be.
- The Lilly White origin claim in the blog is wrong and is being served to AI assistants with structured markup.
- The calculator shows Mendelian percentages for polygenic traits. (The het-inference overstatement in B7 is this review's finding alone; the adversarial review calls the possible-het math correct, and the first version of this report wrongly listed it as shared.)
- Morph ID's design is honest and its evidence is thin.
- Payments, trials and tiers are more careful than the rest of the code; the Stripe membership webhook lacks event idempotency.
- The CSP still allows inline scripts; analytics identify people by email; there is no consent gate; the privacy policy's Do Not Track sentence is false for Google Analytics.
- No uptime monitor, no spend alerts, no documented backups, provider credits that have already run out.
- Every push deploys production with no gate CI can enforce; bots deploy production several times a week.
- The docs are extensive and drifting; CONTEXT.md, STRATEGY.md and the design system document are wrong.

Where both reviews agree, the reader should treat the finding as settled.

### D3. What it found that this review missed

Credit where it is due. These were not in this review's own findings until its transcript was checked and the claims were re-verified by hand against the migration chain:

1. **Gecko takeover through transfers (critical).** The adversarial review's security-completion workflow found that `transfer_requests_insert_own` checks only who created the row, there is no trigger or foreign key on the animal id, and `claim_transfer()` never checks that the request's creator owns the animal. This review's own database pass, which replayed all 271 migrations with a parser, marked transfers "ok" because the policies looked correctly scoped. The parser evaluated who may write a row, not whether the row may point at someone else's object. That is exactly the systemic pattern the adversarial review named: "a database rule has to check what a row points at, as well as who wrote it." Re-verified here against `20260410025954_remote_schema.sql` and `20261003004122_passport_transfers_lineage.sql`: confirmed.
2. **Care records against any gecko** (weight, feeding, shed, vet, events, ownership): same pattern, same cause, confirmed by reading the policies and by this review's skeptical pass, which rated it medium rather than high (write-only, attributable, public geckos only).
3. **A member can place a gecko on another breeder's public page** by changing `created_by` as a collection editor (no trigger freezes it). Plausible from the policy text; not independently re-run.
4. **The admin account has no second factor and every admin check ignores the assurance level.** Needs production access to confirm; cheap to fix; included in the plan.
5. **The trial that "ended after 28 minutes" was ended by an authenticated Stripe request** (API or Dashboard) nine minutes after an `admin-end-trial` function was deployed and replaced with a stub, not by a second checkout. The growth funnel document's explanation is wrong, and the member was charged on day one. The adversarial verifier downgraded this to medium (the member renewed on 4 October, no chargeback), which is fair. The action is the same: refund the $2.99, correct the document, and never let an agent session hold the live Stripe key.
6. **A bare nearest-photo lookup scores the same as the model** on the Morph ID holdout (43.2 percent against 43.6 percent top-1), and 62 percent of test animals have a same-seller nearest neighbour in the retrieval pool, so the measured accuracy is partly a seller-recognition score. This review's domain pass reported the eval numbers as given; the adversarial review recomputed them from the eval files. If it holds, the 4-cent model call adds almost nothing over the free lookup, and the honest statement is "we do not yet have a valid accuracy number". That changes what the Morph ID roadmap should be (an adjudicated gold set split by seller, before any model tuning).
7. **58 percent of last month's notification emails went to legacy profiles that cannot sign in** (verified by its checker with corrected numbers: 102 of 177 emails to 18 no-login addresses). Mail nobody can act on is how sending domains lose reputation. This review had only the digest read rate.
8. **The market is smaller than STRATEGY.md says.** STRATEGY.md's 800,000 US crested gecko households would be about 13 percent of all US reptile-owning households (APPA puts those at about 6 million). The adversarial review's bottom-up count from the scraper (about 970 active US sellers, 279 with ten or more listings) gives a realistic paying universe of a few hundred serious breeders plus one to two thousand small sellers, and a revenue ceiling in the tens of thousands a year at today's prices. This review accepted STRATEGY.md's numbers; it should not have. The correction does not change the plan (the plan does not depend on the TAM), but it changes the ambition: this is a good solo business or a lifestyle product, not a venture-scale one, and decisions should be sized accordingly.
9. **Cron jobs failing unseen** (`refresh-market-matviews` 109 of 169 runs failed in a week on a 120-second timeout; the daily canary 3 of 8; error triage 41 of 60 historically) and **8.6 GB of photos (11,721 objects) with no off-platform backup**, including 10,903 copied listing photos in a public bucket. From production; not checkable here; consistent with everything else in the operations category.
10. **Every route is blank until the auth check returns**, and with an expired token and a slow backend the spinner can last 30 seconds; the Morph Guide index does pixel extraction over 2.2 MB of images on the main thread; the sidebar logo's error handler can loop when the fallback also fails. The first two come from the performance reviewer's measurements; the third was re-verified here by reading the handler (setting the DOM `onerror` property does not detach React's own handler). This review's performance pass measured bundle sizes, not runtime behaviour, so it missed these.

### D4. Where this review disagrees or would say it differently

1. **The report card is harsher than the evidence in places.** "Security D" sits beside its own list of what is done well (RLS everywhere, pinned search paths, frozen privileged columns, verified webhooks, no secrets in history, server-side metering). The holes are real and some are critical, but they share one cause and one fix pattern, and the launch review closed four criticals a month ago. "Testing and release D" is fair. "Architecture C-" is fair. "Business viability D" is fair on the numbers but says nothing about the fact that no acquisition loop has been tried yet. A reader should take the grades as a direction, not a ranking.
2. **"Make the repo private" as item 1 of 17.** Agreed that it is cheap and should happen. But it is listed as the first action because the report describes unfixed holes, and three of the top five holes can be fixed in the same session. Fix the transfer and notification policies first (one session), then flip the repository. Both on day one.
3. **Pricing.** The adversarial review recommends two paid plans with Breeder at $12 to $15 a month and a $120 prepaid Founding Breeder year, and calls the current prices "set by fear". The Founding Breeder year is right and this review recommends it too (A4, A9). The raise is premature: with one real paying member, a price change produces no signal, and Tennyson has already decided twice (decisions 27 and the October research) that the low price is the point. Test the $120 prepaid offer with the ten hand-onboarded breeders; if five take it, the list price can follow. Do not spend an engineering session on new Stripe prices before then.
4. **"Delete about 40,000 lines of unused features."** The direction is right (A1, C1), and the disagreement is smaller than the first version of this report made it: the adversarial week one deletes only files nothing imports, and its "delete or archive" of the zero-use features sits in week eight. What remains is method: this report retires behind flags and route redirects first (the repo already has `retiredPages.js` and the page-config switch), deletes after a month of zero traffic, and keeps the tables, so that no agent session makes an irreversible deletion alone.
5. **The retention critique.** "The retention plan assumes a weekly habit the animals do not create" is a strong point: adults eat every two or three days and are weighed monthly, so a weekly keeper habit is not natural. But the conclusion (aim retention at breeders, whose hatch alerts are read 91 percent of the time) and this review's conclusion (seed reminders from the member's own data and stop the generic digest) are the same plan seen from two sides. The north-star metric should be weekly active breeders rather than keepers, and the reminders should follow the animal's real cadence (feeding every three days, weigh-in every two to four weeks for juveniles, monthly for adults, hatch windows daily). That is a one-word change to the growth plan and a settings change to the reminder defaults, not a different strategy.
6. **CLAUDE.md "optimises for the wrong risk".** Partly agreed. The push-to-main and auto-merge rules exist because preview deployments failed on migrations, and the report's own verifier corrected its first reading (the escape hatch is for the sandbox proxy, not GitHub protection). The fix the adversarial review proposes (a gate, not a brake: pull requests with auto-merge on green CI, required checks on main, human review for money, auth, access and deletion) is the right one, and it does not need preview deployments to work: Vercel can ignore non-main branches entirely.
7. **The 90-day kill criteria.** "Fewer than 3 paying breeders after 20 conversations and 10 imports: prepare wind-down" is a legitimate tripwire for a venture-style decision. For a solo founder who breeds crested geckos and has built the deepest crested gecko reference on the web, the honest third outcome is not "stop as a business" but "run it as a reference and a record book at low cost", which the report itself lists as path B and F. The decision day (17 January 2027) and the weekly scoreboard are right; the framing of the bottom outcome should be gentler and more useful.
8. **"Nothing is truly prerendered."** The prerender writes metadata, structured data and a noscript body, and the React tree mounts into an empty root. That is a deliberate design (documented in the SEO files) that trades first paint for a single rendering path, and Googlebot renders JavaScript. It is a performance finding, not a correctness one; the fix (static above-the-fold HTML for the ten public money pages) is in Part E.
9. **The "editorial team" claim.** The adversarial review calls the authorship claims on the About page and in `editorial.js` untrue because the blog pipeline was autonomous. Fair as far as it goes, but the blog pipeline has been paused since 15 July and the blog shelved since 30 September, and the care and morph guides are hand-reviewed by the founder who breeds the animals. Replace "editorial team" with the true sentence ("written with AI assistance and reviewed by Tennyson, who breeds crested geckos") rather than treating it as fabrication.

### D5. What it could not verify, and what it got wrong by its own account

Its own verification pass downgraded or corrected several of its claims before this report was written, which is to its credit: the support-messages flood was overstated (only deletion-request-shaped rows email anyone, and only the single admin); the "issue #91 open since 2 October" was a reused alert issue whose comments were all fixed the same day; the trial finding went from high to medium; the Het Axanthic label contamination went from high to medium (10 of 1,693 photos in the live pool); the AI consultant proxy went from high to medium because the page is switched off. Its published text says the security section was re-checked by a separate skeptical reviewer and that every correction is already in it; the transcript digest this report first worked from predates that pass, so where the two still disagree on a severity, the published adversarial report is the one to read, and D7 records where the repository sided with it.

Claims it marks as plausible rather than confirmed, and which this review also could not check: EXIF GPS data in about 600 un-re-encoded original JPEGs; the full error-triage injection chain end to end; stored XSS through unchecked hrefs in the forum photo grid; native blob downloads doing nothing in the iOS web view; sales tax exposure; the MorphMarket terms of service text (never retrieved); the monthly running cost ($60 to $300, estimated).

One number both reviews should present carefully: "1 non-admin weekly active keeper" (members logging care) and "7 people active this week" (signed in) are different definitions of active, and the adversarial report uses both.

### D6. What to take from it

Read its 14-day list and its 90-day plan; they are good. Treat its report card as direction. Fix the ownership pattern it found before anything else. Keep its "what you didn't know you didn't know" lessons; the first one ("a database rule has to check what a row points at, as well as who wrote it") is the single most useful sentence either review produced, and it should go into `supabase/SCHEMA_CONVENTIONS.md` today.

### D7. An independent comparison of the two reports, and the findings this one does not carry

After the first version of this report was committed, a panel of seven independent reviewers read both reports in full, each on one lens, and an eighth listed every factual point on which the two disagree and checked it against the repository. The panel was not told which report to prefer and was asked not to reward length or the later date. Its scores, out of 10:

| Lens | Adversarial review | This report | Stronger |
|---|---|---|---|
| Security and database findings | 8 | 6 | Adversarial |
| Business and strategy | 8 | 6 | Adversarial |
| Product, design and UX | 8 | 7 | Adversarial |
| Engineering | 8 | 7 | Adversarial |
| Domain correctness and AI | 8 | 7 | Adversarial |
| Evidence and verifiability | 6 | 8 | This report |
| Actionability of the plan | 7 | 8 | This report |
| Honesty and calibration | 7 | 7 | Tie |

Of 35 factual disagreements, the repository sided with the adversarial review on 6, with this report on 5, partly with both on 16, with neither on 2, and 6 turn on production data this report could not see. Of the 21 corrections the first version of this report made to the adversarial review, 11 held and 10 did not; the ten are now fixed above, each marked "the first version of this report". The panel's reading, which this report accepts: the adversarial review is the primary source for security detail, the money mechanics, the habit-loop frictions in the product, measured performance and testing, and the Morph ID evaluation; this report is the better map, the better-cited document, and the more usable plan. Neither is a replacement for the other. Read them together.

**Findings the adversarial review carries that this report did not.** Each was checked against the repository during the revision unless marked production. They belong in the plan: the security items are folded into E1 items 1, 2, 5 and 10 above; the rest go to the backlog behind the decision in E5.

Security and data:

1. A recipient can rewrite a direct message's content and sender (`direct_messages_update_own` has no WITH CHECK).
2. Any member can read the whole Morph ID usage log, including hashed IPs, tiers and costs (`geck_data.model_invocations` is readable by everyone).
3. A forged account-deletion request (anyone can insert a support message with that subject) pages the admin, and the Support Inbox's one-click erase takes its target from the ticket's email with no check on who filed it.
4. Account erasure deletes every weight, feeding, shed, vet and event record the member ever logged on any animal, including geckos they sold, whose passports then lose their history (`20261008081305`, step 1f).
5. `redeem_signup_grant`'s tier change is silently undone by the privileged-columns trigger, because that trigger keys on `auth.role()`, which stays "authenticated" inside a definer function; any other member-session function that writes the tier would be reverted the same way.
6. Any member can insert geckos into someone else's collection, owners can add anyone as an already-accepted member, and a pending invitee can read the whole collection.
7. Fake "verified purchase" breeder reviews are possible through member-writable transfer rows.
8. Signed-out visitors can read `sold_price`, and the sire and dam ids of private parents, on public geckos (`20261008081011`).
9. IoT API keys are stored in plain text; `GRANT ALL ON TABLE` gives anon and authenticated TRUNCATE; two functions take the first `x-forwarded-for` value for rate limits; the Meta and Reddit OAuth state is not bound to the browser session; "member since" can be backdated and feeds the trust tier.
10. Guide signup marks any typed email as consenting and clears earlier unsubscribes; collection invites carry a typed sender name; waitlist confirmations treat hand-added rows as confirmed.

Billing:

11. The membership webhook swallows profile write failures (now in A5 and C4) and treats any completed checkout with a customer email as a membership purchase.
12. Social-post overage billing posts to a Stripe usage-records endpoint that Stripe has removed (`report-social-overage`), so it would fail the day it is switched on.
13. The health screen consumes its credit before the call and never refunds on failure.
14. Three ways to pay twice: web plus App Store, two-tab double checkout, and the free cap bypass through archived rows (the trigger runs only before insert and lets archived rows through); no failed-payment notice on `past_due`; the phone app shows the web Morph ID price with no native check.
15. Any Breeder-tier member can open a full analysis of any named store, any member can search sellers by name and location, and any member can claim any store as their own MorphMarket link (`seller_market_find` checks nothing but the query length).

AI and genetics:

16. The AI Consultant's whole system prompt, persona included, is assembled in the browser; `invoke-llm` adds only "You are a helpful assistant", and the endpoint stays open while the page is switched off.
17. Photo-inferred traits can be saved as genotypes, and a Lilly White read as Whiteout maps to White Wall (`calculatorCatalog.js:589`), which can switch off the Lilly White x Lilly White lethal warning.
18. Welfare facts disagree across surfaces: the engine rates Super Cappuccino a severe health risk while the keeper guide lists Cappuccino among the morphs with viable supers.
19. Het Axanthic listings were mapped to the visual Axanthic label, 3,682 bulk-approved rows are stored as verified, and two line names in the catalogue have no source. (The first version of this report mentioned only the severity downgrade.)
20. Morph ID evaluation method: the ordering rule was found on run 19 and checked on the same 220 photos; a 413-image validation split is unused; 550 px thumbnails stand in for phone photos; there is no "not a crested gecko" set; Lilly White, Cappuccino, Axanthic and White Wall are not scored; the confidence shown as "signal 82/100" is the model's own estimate; the result card invents a retail range; cost logging ignores cache-write tokens.
21. The landing FAQ claims "photo-led references for every major morph" and calls the calculator "co-dominant" with expected percentages for Harlequin and Pinstripe, both shipped as structured data.

Product and content:

22. Floating widgets cover Cancel and Save in Weigh-in mode; six hand-built overlays lack `role="dialog"`, so the rule that hides floating notices never fires; sixteen files hand-build overlays with no Escape, focus trap or `aria-modal`.
23. The push-permission banner appears on every route from the first minute; the landing's two hero buttons do the same thing; the demo opens on the wrong screen; the gecko record puts the sticker upsell above parents and value; the pricing page argues against itself; the calculator's answer sits far below the button behind 18 unlabelled selects; a skull emoji marks deceased geckos (`GeckoCard.jsx:17`); demo forum personas carry invented view counts.
24. Share cards for passport, breeder, store and waitlist pages unfurl as the homepage; soft 404s under `/MorphGuide/`; mixed URL casing 404s; `robots.txt` gives GPTBot `Allow: /` above the general rules; Price Index rows with as few as 5 listings.
25. The organization markup and the landing footer point at two "garden" Instagram accounts (`index.html:221-222`, `Home.jsx:1108-1111`) that need confirming as Tennyson's; "verified breeder" means three different things on three surfaces; 26 of 42 external reference images are CC BY-NC on a commercial service; an Albino entry names a private breeder and town.

Engineering and operations:

26. Unbounded queries: the Dashboard reads every profile and forum post, Community Pulse runs four full-table reads, My Geckos fetches every weight record, and the 1,000-row cap gives large breeders a wrong "latest weight".
27. Performance detail: render-blocking CSS 88 to 91 percent unused, 223 chunks under 1 KB, Google Analytics at head parse, member photos served full size with transforms off, and the landing-speed document's result does not reproduce on a throttled phone.
28. The offline queue's flush guard is per tab while the queue is shared, and composite Field Mode logs are not atomic.
29. Native shells: the Android RevenueCat key is missing; file downloads do nothing in the iOS web view; neither store's small-business program is enrolled.
30. Credit months reset at midnight UTC; the List-Unsubscribe header is dropped if token generation errors.
31. `scripts/check-env.mjs` treats the Supabase URL and key as optional because of a "hardcoded fallback" that no longer exists (`supabaseClient.js` has none outside tests). `docs/MIGRATIONS.md` says apply then commit; `supabase/SCHEMA_CONVENTIONS.md` says merge then apply.
32. About 25 routes declared twice, three URL styles, page config loaded twice, five or six analytics systems, and two in-app analytics dashboards capped at 1,000 rows.
33. Edge-function hygiene: four supabase-js import specifiers across two registries, 23 hand-written JSON helpers, 20 copies of sign-in boilerplate, and the Replicate model resolved to "latest".
34. The genetics engine ships compiled only, is patched from outside, declares the OpenAI and Anthropic SDKs as runtime dependencies, and its facts are restated in at least nine places; one `traits.json` that every surface reads is the right fix.
35. Production cannot be rebuilt from the repository: buckets, storage policies, cron jobs and Vault secrets exist only in production (no `storage.objects` policy appears anywhere in the migrations), and the 1 October incident hid 5,092 listings over a one-word species mismatch.

Business and legal:

36. The market sizing (10 to 20 times smaller than STRATEGY.md says, from an outside households benchmark and a bottom-up count of about 970 active US sellers), the revenue ceiling that follows, the per-member AI cost table, the founder operating model against $60 to $300 a month of running cost, the six strategic paths compared side by side, and the mechanics of the Founding Breeder offer. This report reached the same conclusions and used those numbers without carrying the arithmetic; the adversarial section 03 has it.
37. Legal items this report lacks: no DMCA agent for a site with member uploads, California's automatic-renewal law against the absent billing terms, EU and UK VAT on digital sales from the first sale, and the case law behind the scraping exposure.

Production only (could not be checked here):

38. Zero MFA factors on any account; six profiles whose `created_by` differs from `email`; 10,903 objects in a public listing-images bucket; 585 originals never re-encoded; `rapid-api` and `admin-end-trial` deployed but absent from the repo, and `store-checkout` the reverse; `refresh-market-matviews` failing 109 of 169 runs in a week; the `admin-end-trial` timeline behind the 28-minute trial.

**What both reports missed**, per the panel: the `auth.role()` pattern in item 5 is checked for one caller and not the others; no storage policy is recorded in the repository at all; neither plan sizes the founder's hours, budgets the agent sessions, or tells a non-technical founder how to apply the week-one SQL safely. Item 11 of C15 and E1 item 8 are the nearest this report comes; they should be read with that gap in mind.

## Part E. The plan

### E0. Five rules the plan follows

1. **The next 90 days are a sales experiment.** The question to answer by 17 January 2027 is whether crested gecko breeders will pay for records, passports and transfers. Every engineering hour that does not serve that question, or close a hole that could hurt a member, waits.
2. **Fix the ownership pattern before anything else.** One cause (write rules check the author, not the object) produces the critical and most of the highs. Fix the pattern, not the instances.
3. **Freeze breadth.** No new pages, species, tiers, tools or integrations until weekly active breeders have grown four weeks in a row. Retire what has zero use behind flags; delete after a month.
4. **Gate, do not brake.** Keep shipping fast, but through a pull request that auto-merges on green checks, with a human in the loop for money, auth, access and deletion, and no agent holding a live payment key or the service role in an interactive session.
5. **One plan, one scoreboard, one owner.** If Tennyson adopts it, this file's week table replaces the feature audit as the active plan; until then ROADMAP.md points here as a proposal and the feature audit stands. Tennyson rewrites the top ten every Monday.

Effort labels: S under a day, M one to three days, L a week or more. "Session" means a Claude session can do it; "Tennyson" means only he can.

### E1. Days 1 to 7: stop the bleeding

| # | Item | Effort | Who | Done when |
|---|---|---|---|---|
| 1 | **Close the gecko takeover and forged-history holes.** `can_edit_gecko(p_id)` helper; WITH CHECK on `transfer_requests`, `weight_records`, `feeding_records`, `shed_records`, `vet_records`, `gecko_events`, `ownership_records`, `eggs`; `claim_transfer()` re-checks that the request creator owned the animal; a trigger freezes `geckos.created_by` outside `claim_transfer`; a `create_transfer_request()` RPC replaces direct inserts; one SQL regression test per table; the same pass adds WITH CHECK to `direct_messages`, an owner-or-admin read policy on `geck_data.model_invocations`, ownership and status checks on collection inserts, and removes `sold_price` and parent ids from the anon grant. | M | Session, Tennyson applies | A test account cannot create a transfer for a gecko it does not own, and cannot log a weight on one. |
| 2 | **Close the notification relay.** `guard_notification_insert()` requires `user_email = auth.email()` except for an allowlist of social types backed by a real interaction row, plus a per-caller rate limit, and accepts only links matching a single leading slash; or move cross-member notifications into RPCs. | S | Session | A member insert naming another recipient is refused; messages and forum replies still notify. |
| 3 | **Pin profiles to their email.** Freeze `email` and `created_by` in the privileged-column trigger; drop the `created_by` clause from both profile policies; audit the six rows where they differ. | S | Session, Tennyson applies | An update to `email` is refused for non-admins. |
| 4 | **Revoke email columns from `authenticated`** on `gecko_images`, `geckos`, forum tables, store pages and breeder profiles, mirroring the 8 October anon grants; add the test that asserts the grant list. | S | Session | A signed-in PostgREST read of `gecko_images.created_by` is refused. |
| 5 | **Meter `generate-social-post`** through `consume_feature_credit`; gate the market functions with `effective_tier_for_current_user()`; make the gecko-limit trigger tier-aware (and run it for archived rows) and add one on `collection_members`; make the membership webhook throw on a failed profile write so Stripe retries instead of marking the event processed. | S | Session | A Free account's social-post call consumes a credit; a Keeper's 51st gecko is refused by the database; a webhook event whose profile write fails is marked failed, not processed. |
| 6 | **Make the repository private**; move `STRATEGY.md`'s competitor paragraph and the security write-ups out of the public history is not possible, so private is the fix. | S | Tennyson | Repo visibility is private. |
| 7 | **Take Enterprise off sale** until the US feed is reliable and a breeder has asked for it; keep the comp mechanism. | S | Session | The Membership page shows Enterprise as "Talk to us". |
| 8 | **Settle the migration state and prove one reminder arrives.** Run the `schema_migrations` query from the security appendix to confirm the 8 October migrations (definer lock, anon email columns, erasure, weigh-in reminders) are live; retire `deploy-queue-2026-10-03.md` and the `supabase/pending/` folder; add a gecko on a test account and confirm the weigh-in reminder email and push reach a phone. | S | Session checks, Tennyson tests on a phone | `supabase migration list` matches the repo; one reminder received; the stale documents are gone. |
| 9 | **Fix the published errors.** Lilly White origin in the blog post, its FAQ and `project-lines.js`; the privacy policy's Do Not Track sentence; the Terms' governing state and operator name; `support@geckinspect.com` everywhere (`supportContact.js`, Stripe portal, Terms, privacy). | S | Session, Tennyson supplies the state and the forward | The pages say what is true; `llms-full.txt` rebuilt. |
| 10 | **Agent safety.** `--read-only` on the Supabase MCP server for scheduled sessions; Supabase and Vercel write tools moved to "ask" in `.claude/settings.json`; the triage job split so the model never runs in the process holding the service-role key (or switched off, with the key rotated), a code-level denylist and diff cap in its `propose_fix`, no proposals from anonymous reporters; turn on two-factor sign-in for the admin account and require it in `is_admin()`. | S | Session, Tennyson enables MFA | A triage run cannot touch `scripts/`, `api/`, `.github/`, `package.json` or migrations; admin sign-in asks for a code. |
| 11 | **Alerts and backups.** Spend alerts in the Anthropic and Replicate consoles; a free external uptime check on `/`, `/AuthPortal`, `/Membership`, `/mcp`; confirm the Supabase backup tier and write it into `docs/MIGRATIONS.md`; a weekly copy of the storage buckets off the platform. | S | Tennyson, session writes the doc | A deliberate 5-minute outage pages Tennyson; a restore of one bucket has been tried once. |
| 12 | **Refund the day-one $2.99** to the member whose trial was ended by hand, and correct `growth-funnel-2026-10.md` section 6. | S | Tennyson | Refund issued; doc corrected. |
| 13 | **Message 40 crested gecko breeders** with 1,000 to 15,000 followers who sell on MorphMarket or Palmstreet; book 8 calls. Script: the five questions in `growth-plan-2026-10.md`. Write every answer into `docs/planning/breeder-interviews-2026-10.md`. | ongoing | Tennyson | 8 calls booked; the file exists. |

Items 1 to 5 are one or two sessions of SQL with tests; they should be the only engineering work until they are applied.

### E2. Weeks 2 to 4: the loop that can work

| # | Item | Effort | Who | Done when |
|---|---|---|---|---|
| 14 | **Hand-onboard ten breeders.** Import each one's spreadsheet or MorphMarket export for them; offer the $120 prepaid Founding Breeder year first and record who takes it (prepayment is the test; a comped account is not evidence); comp through `membership_comps` only a breeder who declines but will send cards; ask for one thing: the passport QR card goes with every animal sold. | ongoing | Tennyson | 5 collections imported by day 30 and 10 by day 60 (the E5 checkpoints); 5 breeders sending cards. |
| 15 | **Reminders that follow the animal.** Reminder defaults by life stage (feeding every 3 days, juveniles weighed every 2 to 4 weeks, adults monthly, hatch windows daily); every reminder link opens a one-tap log; the weekly digest and reminders stop for addresses with no login (19 of last month's 35 digest recipients). | S | Session | A new gecko gets a schedule without the member touching Settings; digest volume drops by more than half. |
| 16 | **Four lifecycle emails from the member's own data** (day 0, day 1 if no gecko, day 3 lineage, day 7 and 14 weigh-in). Copy approved by Tennyson; sent through `send-email`; opens and clicks logged through a Resend webhook into an `email_deliveries` table. | M | Session, Tennyson approves copy | The first cohort receives all four; open rates visible in the admin Funnel card. |
| 17 | **The shareable Morph ID result card.** Photo, likely traits, confidence words, "visual traits, not proven genes", a link back; one free identification per account per month; the share event measured. | M | Session | A card posted into a Facebook thread brings a measurable signup. |
| 18 | **Gate, do not brake.** Required checks on main (lint, tests, genetics check, size budget); the scheduled bots write to a `reports` branch or Supabase; a Vercel ignored-build step for docs-only commits; the triage bot files issues with patches instead of pull requests; staging project or Supabase branch for migrations. | M | Session, Tennyson sets branch protection | A red commit cannot reach production; docs commits do not deploy. |
| 19 | **Offline logging correctness.** Treat abort errors as retryable; give every queued field log a request id honoured by an idempotent RPC or a unique index; one unit test for the abort path. Then the airplane-mode check on a phone. | S | Session, Tennyson tests | A feeding logged in airplane mode saves once, not zero or twice. |
| 20 | **Stripe webhook hygiene.** Event-id idempotency and the constant-time compare copied from the store webhook; require `metadata.supabase_email`; record `subscription_cancelled` with Stripe's reason; rebuild `payment_events` from the webhook log; a Resend bounce webhook. | S | Session | Admin revenue tile matches Stripe; a cancellation shows up the same hour. |
| 21 | **Docs reconcile.** Rewrite CONTEXT.md sections 1 to 5 and 8 from the code; update STRATEGY.md from the October research including the market-size correction; one design document matching the shipped theme; retitle DECISIONS.md; move PRODUCT.md to the Morph ID spec; `docs/OPERATIONS.md` with services, costs, secrets, backups and the weekly checklist; ROADMAP.md points at this plan. | M | Session | A new session reading the four entry documents gets no false facts. |
| 22 | **Legal basics.** Single-member LLC and business bank account; Stripe payouts to it; a DMCA agent; Terms sections for subscriptions, renewals, trials, refunds, AI output and value estimates; an hour of counsel on the scraped-data position before any registry listing. | L elapsed, S work | Tennyson | Terms name the operator and the state; payouts land in the business account. |

### E3. Weeks 5 to 8: make the product worth the breeder's trust

| # | Item | Effort | Who | Done when |
|---|---|---|---|---|
| 23 | **Retire breadth.** Behind flags and redirects: Promote, the supplies store and sticker builders, the AI Consultant, Guess the Price, Other Reptiles, Community Connect remnants, the Morph Visualizer, the morph study preview, the website builder unless a breeder is using it. Keep the tables. The 29 never-imported modules and six unused packages can go in this window's first commit, since nothing imports them. Delete the flagged code after a month of zero traffic. | M | Session, Tennyson decides the list | Sidebar has at most 12 destinations; Keeper mode at most 8. |
| 24 | **One gecko record.** Merge the modal and the page; weights, feeding, sheds, vet visits, lineage, value and passport in one place with parents and value above the fold; the sticker upsell at the bottom. | M | Session | Every part of a gecko's history is reachable from its card in one tap. |
| 25 | **A Today screen** as the first tab on phones: what is due (feedings, weigh-ins, hatch windows, vet follow-ups), one-tap logging, then the collection. Four phone tabs: Today, Geckos, Log, More. | M | Session | A feeding is logged in two taps from a cold open. |
| 26 | **Performance.** Lazy-load the PDF and canvas libraries at the export action; defer the Supabase client for signed-out visitors; precompute the Morph Guide pigment layers at build time; fix the logo error loop; self-host four font weights; compress or delete the heavy public images; stable chunk hashes; a size budget in CI (entry 150 kB gzipped, public page 200 kB before first paint, route chunk 60 kB). | M | Session | Landing LCP under 2.5 s on a throttled phone; Morph Guide index under 500 KB and under 200 ms blocking. |
| 27 | **SEO that moves the money pages.** Hand-written descriptions for the ten highest-impression morph pages; `build:content-dates` inside `pnpm build`; real odds and warnings in the calculator pairing pages' server HTML; `/GeneticsGuide` as the target for "crested gecko genetics"; a canonical hint from the records tag page to `/breeding-records`; noindex on `llms-full.txt`. | S | Session | "crested gecko morphs" moves to page one within a month of the change. |
| 28 | **Domain correctness.** Hide single-gene percentages for Harlequin, Pinstripe, Dalmatian and the base colours (show the expression band); fix the het-inference conditioning; unify the two weight scales and the incubation windows; add origin and history facts to the consistency check and run it in `pnpm build`; add the missing morph guide entries (Phantom, Empty Back, Whiteout, Luwak, the supers). | M | Session | `pnpm check:genetics` covers the blog and care guide; a breeder reviewing the calculator finds nothing to dispute. |
| 29 | **Morph ID evidence.** A 50-animal adjudicated gold set split by seller, labelled by three breeders; grade `claude-sonnet-5-5` and `claude-opus-5-5` on it; commit each run's headline to `docs/morph-id-eval/`; a 20-animal smoke eval on changes; move the consultant and health screen to 5.5 models. | M | Session, Tennyson recruits the labelers | A published accuracy number with a seller-disjoint split and a baseline beside it. |
| 30 | **Testing that catches the next regression.** ESLint over the whole `src/`, `scripts/` and `api/` with `exhaustive-deps` as a warning; jsdom and Testing Library with smoke tests for GeckoForm, Messages and Membership; one Playwright flow (sign up, add a gecko, log a feeding, transfer it) against a preview; freeze time in the five clock-dependent tests. | M | Session | The Playwright flow runs on every pull request. |
| 31 | **Privacy and consent.** Identify PostHog by the auth id; drop the Robauto beacon; GA4 either removed or behind a consent gate for EEA and UK visitors; PKCE on web; redact tokens from analytics URLs; a 90-day retention job for `error_logs`, `agent_hits` and webhook payloads; the CSP without `'unsafe-inline'` for scripts (hash the four inline bodies at build time). | M | Session | No analytics call fires for an EEA visitor before consent; CSP report queue stays empty. |

### E4. Weeks 9 to 13: decide with evidence

| # | Item | Effort | Who | Done when |
|---|---|---|---|---|
| 32 | **The identity migration.** Owner uuid columns on the email-keyed tables, backfilled by trigger as `geckos` already does; policies rewritten to the uuid; email change supported. Scheduled only if the breeder experiment is working; otherwise deferred. | L | Session | An email change keeps every record; `created_by` email filters are gone from the client. |
| 33 | **The iPhone app**, only if five of the ten breeders say reminders on the lock screen would change how they use it: native push, app links, the store listing, the TestFlight purchase and restore checks, a small native capture screen for guideline 4.2. | L | Session, Tennyson owns the store | TestFlight build in breeders' hands. |
| 34 | **The market data decision.** If the US feed is restored and breeders use the Market page: first-party sale price capture, a documented degraded mode, legal review done, Enterprise back as a conversation. If not: keep the public Price Index as a reference asset and stop building on the feed. | M | Tennyson decides | One sentence in DECISIONS.md either way. |
| 35 | **Decision day, 17 January 2027.** See E5. | | Tennyson | |

### E5. The scoreboard and the decision

Weekly, on the admin Funnel card and in `docs/NOW.md`: breeder conversations held; collections hand-imported; paying breeders (not comped, not friends) and monthly recurring revenue; passports issued and claimed; weekly active breeders (members logging a record on their own animal in the last 7 days, admin excluded); non-admin signups and the day-one first-gecko rate; monthly cost.

Day 30 (17 November): 15 or more conversations, 5 imports, 2 paying breeders, 10 passports issued, monthly cost under $100. Fewer than 15 conversations means the engineering work pauses and the time goes to conversations.

Day 60 (17 December): 6 paying breeders, 50 passports issued, 15 claimed, 3 claimers still active two weeks later, 4 or more weekly active breeders. Fewer than 3 paying breeders after 20 conversations and 10 imports means the product is a reference and a record book, not a subscription business, and the plan for 2027 should be written on that basis.

Day 90 (17 January 2027), one of three outcomes written into DECISIONS.md:

- **Invest:** 10 or more paying breeders at $10 a month or more, 5 or more weekly active breeders for four straight weeks, 25 or more passports claimed, at least one referral from a breeder's buyer. Then: the identity migration, the iPhone app, the Breeder price to $9.99 for new members, and the first part-time help.
- **Maintain:** 3 to 9 paying breeders. Keep the record book, the guides, the calculator and the passports; retire the rest; cap monthly cost; keep one session a week for bugs and content.
- **Reference:** fewer than 3. Keep the open reference (guides, calculator, Price Index, MCP) as the most accurate crested gecko source on the web at near-zero cost; stop charging; keep the records free for the members who have them.

Tripwires at any time: a legal notice about the market data (stop collection the same day); costs above $150 a month with revenue under $50 at day 60; any billing or privacy incident (freeze deploys until it is understood).

### E6. What not to do before decision day

No ball python work (decision 43 is paused, not cancelled). No Enterprise sales. No new species, tiers, integrations, games, stores or social tools. No new audits or reviews; this one and the adversarial one are enough for a quarter. No registry listing of the MCP server until counsel has looked at the data position. No price changes before five breeders have answered the $120 offer. No weekly agent review; monthly is enough. No blog posts (still shelved).
