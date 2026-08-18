# MORPH_CALCULATOR_PLAN.md - Geck Inspect

Last updated: August 2026
Status: Built. All three phases shipped August 18, 2026; the only open checkbox is the vendored engine package's own data review (1.9), which needs a rebuild in the package's source repo. Adoption targets (logged clutches, shared projects) accrue over the coming season. Companion to ROADMAP.md (see item 19).
Research basis: five parallel research passes (competitors, reptile-wide calculator landscape, community feedback mining, crested gecko genetics science, calculator UX and education research), August 18, 2026. Source links inline.

---

## 1. The one-paragraph thesis

The Morph Calculator can become the single most defensible feature of Geck Inspect, because it sits at the intersection of everything the platform already has (a real genetics engine, lineage records, AI morph ID, market analytics, a morph guide) and everything the competition does badly. Only two serious competitors exist: Dusty Mumphrey's engine (ReptiDex, Geckistry, Breed Ledger) and MorphMarket's new template calculator. Both are beatable on crested-gecko-specific ground: nobody handles the 2-egg clutch reality, nobody offers a reverse "how do I make X" mode, nobody teaches while it calculates, nobody makes results fun to share, and nobody is honest about polygenic traits in a way serious breeders respect. The plan below matches the incumbents on table stakes, then wins on four open lanes no reptile calculator occupies: goal-seeking, clutch and season probability, multi-generation planning, and explanation-rich playfulness.

---

## 2. Where we are today (honest inventory)

What already exists and is genuinely good:

- A vendored genetics engine (`crested-gecko-app`, the Foundation Genetics module) with 27 traits, dominance types including allelic complexes (Cappuccino x Sable correctly produces Luwak, not Super Cappuccino), a combo-morph resolver with named outcomes (Frappuccino, Luwak, Tricolor, Halloween, and more), a risk registry with severity levels and source links, a tag-to-genotype importer, and an eval harness.
- A free, no-signup calculator at `/calculator` with manual entry and "from my collection" modes, plus 8 per-trait SEO landing pages at `/calculator/:morph`.
- A Monte Carlo clutch simulator with "chance of at least one" bars.
- A lineage-based hidden-het inference model (`lib/genetics/hetInference.js`) already shipping on gecko profiles.
- A Morph Visualizer that renders phenotypes, a Genetics Guide, a Morph Guide, and market price analytics.

What is underpowered or disconnected:

1. The public picker exposes only 8 of the engine's traits. No Sable, no Highway, no base colors, and therefore no Luwak teaching moment, which is one of the best "wow" interactions crestie genetics offers.
2. The engine computes full combined offspring phenotypes with combo names, but the UI only shows per-locus bars. Our best output never reaches the screen.
3. There is no Punnett square visual anywhere, even though the page markets itself as a Punnett square calculator.
4. Results have no permalink, no share card, no image export. A breeder cannot show anyone what they just computed.
5. Het inference and the calculator do not talk to each other. Collection mode treats an untagged gecko as wild-type even when lineage says it is 66% likely het Axanthic.
6. The clutch simulator defaults to 6 eggs. Crested geckos lay 2-egg clutches every 30 to 45 days across a roughly 8-month season (about 12 to 20 eggs per pairing per year). Our default misrepresents the biology of our own species.
7. No reverse mode, no season planning, no market value layer, no links from outcomes to the Morph Guide.
8. One hygiene item: the vendored engine's source list cites "Tenny's Crested Geckos Morph Guide." Per the domain disambiguation rule in CLAUDE.md, that citation needs review in the next package update.

---

## 3. What the research found

### 3.1 The competitive picture (two real competitors)

**Dusty Mumphrey's engine** powers ReptiDex (free web calculator, 32 crestie alleles, 33 named morphs, 31 combos), Geckistry, and Breed Ledger. His public repo was read line by line ([Dusttoo/reptile-genetics-engine](https://github.com/Dusttoo/reptile-genetics-engine)). What it does well, verified from source:

- Treats UNKNOWN inheritance as a first-class state, handled conservatively.
- Models allele relationships: SUPPRESSES (Sable vs Cappuccino), REQUIRES, ENHANCES, LETHAL_HOMOZYGOUS.
- Gives polygenic traits probability priors instead of fake Mendelian odds (both parents express: 30% strong, 50% present, 20% absent; one parent: 10/40/50; neither: 2/8/90).
- The moat feature: Bayesian confidence blending, `confidence = 1 - 1/(1 + n/10)`. As breeders log real clutch outcomes, observed ratios displace textbook odds (at 10 logged clutches, observations carry 50% of the weight). His calculator literally learns from breeding data.
- Inheritance rules live in the database, not in code, so genetics updates are data migrations, not releases.

His weaknesses: a tiny user base, one year of personal crestie breeding data, a confusing ReptiDex-to-Breed-Ledger transition, and a multi-species pivot that dilutes crestie depth.

**MorphMarket** quietly added a [crested gecko calculator](https://www.morphmarket.com/c/reptiles/lizards/crested-geckos/genetic-calculator/) after a community thread asked for one in November 2024. Its strengths are audience scale, URL-encoded shareable pairings (`?s1=...&s2=...`), a "Calculate" button on every listing, expected counts per clutch size, and Breeding Plans that aggregate a whole season. Its weakness: it is a multi-species template, cresties are an afterthought, and MorphMarket's own docs concede that crestie outcomes are "less predictable."

Everything else (IB Exotic, crestedmorphcalc.xyz, HatchLedger tools, generic Punnett sites) is minor, abandoned, or SEO filler. Lil Monsters' Interactive Morph Guide proves demand for visual outcome rendering but shipped as a beta without conditional logic. The old World of Ball Pythons wizard is dying of database staleness, which is the cautionary tale: calculators die when their trait list stops absorbing new genes, not when their UX ages.

### 3.2 What users actually complain about (mined from forums, app reviews, and communities)

Top recurring complaints across venues:

1. Species or trait not supported (cresties were absent from MorphMarket until users begged).
2. Allelic genes computed wrong (MorphMarket's ultramel corn snake bug produced impossible "amel het ultra" genotypes; this is exactly the Cappuccino/Sable class of problem).
3. Combos not recognized or named in results.
4. No 66%/50% possible-het inputs. This is the single longest-lived feature request in the hobby ([open since September 2020](https://community.morphmarket.com/t/possible-het-input-to-morph-calculator-1189/11449) with 50+ replies).
5. Silent input corruption (links that drop "het" and compute the wrong pairing without warning).
6. Confusing genotype-heavy result tables (a whole YouTube tutorial genre exists just to explain the incumbent calculators).
7. Paywalled or half-broken calculators inside husbandry apps (actively resented).

Top wishes: multi-generation planning ("click a baby, keep planning"), reverse lookup ("post the name of a snake and see what went into making it"), photos on every predicted outcome, clutch math, expected pairing value in dollars, and collection integration that reduces data entry.

What people love and we must not lose: instant trustworthy math, pictures, free with no login wall, playfulness ("fun to play around with" comes up verbatim), and completeness of the trait list.

Crestie-specific confusion the research surfaced repeatedly: "percent" is overloaded. 66% het Axanthic (a probability of carrying a gene) and "95% pinstripe" (physical dorsal coverage) read identically to buyers and get confused constantly. No existing tool disambiguates them. A crested-first calculator that visually separates chance from expression fixes a real, documented problem.

### 3.3 The genetics science (what we can honestly compute)

Crested gecko genetics is a two-layer system, and the calculator must be architected around exactly that split:

**Layer 1, proven single genes** (Punnett math is honest here): Lilly White (incomplete dominant, super lethal), Axanthic (recessive), Phantom (recessive, expression modified by background), Cappuccino and Sable (incomplete dominants, allelic with each other at one locus, with Highway suspected as a third allele in the same complex), Empty Back, Soft Scale. Emerging or disputed single-gene claims that deserve an "Emerging" badge rather than full confidence: Whiteout/White Wall, Tangerine, Monochrome, "Genetic Hypo."

**Layer 2, polygenic forever (for now)**: Harlequin, Extreme, Flame, Pinstripe coverage, Dalmatian spotting (note: "Super Dalmatian" is marketing for roughly 100+ spots, not a homozygous super), Tiger/Brindle, Tricolor, Lavender, base colors, structure. Respected breeders reason about these through lineage and "best to best" selection, never percentages.

Facts the calculator should encode as first-class knowledge:

- Frappuccino = Cappuccino + Lilly White. It is not the super form of Cappuccino (that is Super Cappuccino, marketed by some as "Melanistic," which has documented health defects and is banned from sale on MorphMarket). This is the single most common naming confusion in the hobby and a teaching opportunity.
- Cappuccino x Sable is the safe pairing within the complex (produces Luwak, can never produce a super). Capp x Capp risks 25% compromised supers. LW x LW risks 25% lethal eggs and is universally condemned.
- Clutch = 2 eggs. Season = roughly 6 to 10 clutches. Per-egg odds and season expectations are different numbers and breeders think in both.
- No commercial DNA test exists for any crestie morph (two reference genomes were published in 2024 and 2025, but no hobby morph has been mapped to a gene). Lineage plus breeding-trial evidence is the only genotyping cresties have. A calculator that tracks that evidence IS the DNA test of this species, which is a product argument worth making publicly.
- Cold Fusion is a lineage, not a trait (per Pangea). "Latte," "Choc Chip," and "Sassy" do not exist in any authority source; exclude them.

Authority sources to align with and cite in-product: [Foundation Genetics by LM Reptiles](https://lmreptiles.com/foundation-genetics/) (the hobby's de facto peer review), [MorphMarket Morphpedia](https://www.morphmarket.com/morphpedia/crested-geckos/) (the community-standard vocabulary), Pangea's genetics articles, and AC Reptiles' trait write-ups.

### 3.4 Design research: what makes calculators loved, educational, and shared

Full findings live with the research agents; the principles that shape this plan:

- **Answer first, explanation on demand.** Headline results instantly; a "Why these odds?" expander that walks the Punnett math one step at a time (the WolframAlpha pattern).
- **Natural frequencies beat percentages** (Gigerenzer's risk-communication research): "in a typical 8-egg stretch, expect 2 visual Axanthics" is understood correctly far more often than "25%." Use a fixed denominator, show percent and 1-in-N on hover.
- **Icon arrays work.** A grid of egg icons with outcomes colored in, with hit placement randomized on each view, measurably improves how accurately people perceive odds.
- **Let people roll the dice.** A "hatch a simulated clutch" button teaches variance and counters the gambler's fallacy better than any paragraph, and it is simply fun. Pokemon shiny-odds tools proved the framing: "how many eggs until 90% odds of at least one?"
- **Every result is a permalink; every permalink unfurls.** MorphMarket already URL-encodes pairings. We should too, plus per-result OG share cards (nearly free on Vercel via @vercel/og) and a downloadable clutch card image for screenshot-first Facebook groups (the Enka.network pattern).
- **Progressive disclosure, one product.** Simple picker by default; advanced panels (poss-het percentages, allelic complex detail) appear contextually; an omnibox that parses "lw het ax x ax" for power users. Never a separate "pro calculator."
- **Multi-generation planning** (the chicken-genetics community's Kippenjungle calculator is the only tool anywhere with "continue with this offspring," and its users treat it as infrastructure).
- **Put the calculator where decisions happen**: inline on gecko profiles, breeding plans, and listings, with the standalone page as the shareable public artifact.

---

## 4. Product vision

**The Clutch Lab: the definitive crested gecko pairing tool.** One genetics engine surfaced three ways: a fast calculator for breeders, an explorable explanation for learners, and a playful simulator for everyone. Positioning line: honest math for a species everyone else rounds off.

Five pillars, each mapped to a competitive gap:

1. **Honest by design.** Per-trait confidence badges (Proven / Emerging / Lineage / Polygenic) with citations to Foundation Genetics and Morphpedia. Punnett math only where science supports it; expression-band estimates for polygenic traits; explicit "chance vs expression" visual separation. This out-credibilities ReptiDex's "32 alleles" framing, which launders line-bred looks into gene-speak.
2. **Built for 2-egg clutches.** Per-egg odds, per-clutch odds, and per-season expectations as three linked views. Lethal outcomes accounted as expected egg loss, not hidden.
3. **Teaches while it calculates.** Every result expandable into the why. Animated Punnett square that traces which parent gamete produced which cell. Misconception-targeted copy (the square does not guarantee; each egg is an independent draw).
4. **Plans, not just predicts.** Reverse mode, collection scanning, multi-generation routes, season planning, expected clutch value in dollars.
5. **Fun to share.** Permalinks, OG cards, clutch cards, hatch-reveal moments, a season recap. The calculator becomes Geck Inspect's top-of-funnel growth loop.

Business guardrail: the core calculator stays free with no login wall forever (community research shows paywalled calculators are actively resented, and free tools are how WOBP and MorphMarket built their moats). Gate the collection-connected planning layers (reverse-scan my collection, season planner, outcome logging analytics) behind Pro.

---

## 5. The build plan

### Phase 1: Close the table-stakes gap (2 to 3 weeks)

Goal: no feature reason left to use ReptiDex or MorphMarket instead. Mostly UI work over the engine we already have.

- [x] **1.1 Full trait coverage in the public picker.** (Shipped Aug 2026: all proven and emerging Mendelian traits, complex slot with Luwak and supers, Highway provisional.) Every proven and emerging Mendelian trait from the engine, including the Cappuccino/Sable complex as a single locus picker (so a parent can be Luwak), grouped by category, with search. Highway as a provisional complex allele with a caution badge.
- [x] **1.2 Confidence badges everywhere.** (Shipped Aug 2026: Proven/Emerging badges with hover explanations in the picker and per-morph pages. Remaining: a richer popover citing each trait's primary sources from the engine.) Proven / Emerging / Lineage / Polygenic chips on every trait, with a popover citing sources (engine already stores `primary_sources`, `proven_by`, `confirmed`). This is our credibility signature.
- [x] **1.3 Combined outcomes with combo names.** (Shipped Aug 2026.) Render the engine's `offspring_phenotypes`: "25% Frappuccino (Lilly White Cappuccino)" with named combos first, full genotype detail behind a toggle (phenotype-first view was a top community request).
- [x] **1.4 Possible-het inputs.** (Shipped Aug 2026 for manual mode via weighted genotype scenarios. Remaining: collection mode, which wants het-inference prefill from lineage, see 3.4.) "100% het / 66% poss het / 50% poss het" options for recessives in both manual and collection mode, propagated correctly through the math. This closes the hobby's longest-open feature request and the vocabulary is already standard on crestie listings.
- [x] **1.5 Egg-first probability display.** (Shipped Aug 2026: natural-frequency headlines, scatter egg arrays with reshuffle, 2-egg clutches, season selector, at-least-one and eggs-for-90% math, lethal-loss accounting.) Natural frequency headline ("out of 8 eggs, expect about 2"), an egg icon array with randomized placement, percent and fraction on hover. Clutch size defaults to 2 with a season view (clutches x eggs). Expected viable-egg accounting when lethal supers are in play.
- [x] **1.6 Permalinks.** (Shipped Aug 2026: ?sire=...&dam=... state with a copy-link button.) Encode both parents (traits + zygosity + poss-het levels) in the URL. Every calculation shareable, bookmarkable, embeddable. Foundation for all social features.
- [x] **1.7 Outcome links.** (Shipped Aug 2026 for outcomes with existing guide entries. Remaining: Morph Guide entries plus photos for Sable, Phantom, Empty Back, and Luwak, which have no guide pages yet.) Every named outcome links to its Morph Guide entry with a photo thumbnail (photos on outcomes are the single most-cited reason users preferred WOBP).
- [x] **1.8 Safety rails as first-class UI.** (Shipped Aug 2026: unfilterable warnings, complex coaching tips including the Luwak safe-pairing suggestion and the Sable check-nostrils note.) LW x LW and Capp x Capp warnings stay prominent and unfilterable, with the Luwak alternative surfaced as the safe-pairing suggestion ("looking for the complex look without super risk? Capp x Sable produces Luwak and can never make a super").
- [ ] **1.9 Engine data audit.** (Partial Aug 2026: app-side confidence labels applied per the science research; Dalmatian and Pinstripe deliberately left out of the Mendelian picker. Remaining: the vendored package's own trait review, including the source-citation cleanup, on its next rebuild.) Review all 27 traits and 14 combos against the science research: confidence levels for Whiteout, Tangerine, Monochrome, Hypo (line-bred vs "Genetic Hypo" claims), Highway provisional status, verify combo list against Morphpedia/Foundation Genetics naming, remove anything unsupported, and review the "Tenny's Crested Geckos" source citation per the CLAUDE.md domain rule.
- [x] **1.10 SEO expansion.** (Shipped Aug 2026: per-trait pages for all 11 pickable traits incl. Sable, Highway, ChoCho, plus 10 per-pairing landing pages at /calculator/pairing/<slug>.) Per-trait calculator pages for every newly exposed trait, plus per-pairing landing pages for the top searched crosses ("Lilly White x Lilly White," "Cappuccino x Sable," "Axanthic x het Axanthic") with pre-filled parents and explainer copy. These match documented search behavior and the questions asked constantly in forums.

Definition of done: a breeder can compute any proven-gene crestie pairing with poss-het inputs, see named combos with photos and citations, share the result as a link, and nothing in the output overstates the science.

### Phase 2: Differentiate (4 to 6 weeks)

Goal: the four white-space lanes no reptile calculator occupies.

- [x] **2.1 Reverse mode ("Make me a...").** (Shipped Aug 2026 at /calculator/reverse: 18 targets, exact per-locus math, welfare-excluded parents, lethal and compromised-egg costs per route, proven-het flags, collection scanning for signed-in users, permalinks into the forward calculator.) Pick a target (Frappuccino, Axanthic Lilly White, Phantom Frappuccino), get the parent genotype combinations that can produce it, ranked by odds per egg, with warnings attached. For signed-in users: scan my collection for pairs that can produce the target, including poss-het parents with adjusted odds ("if Zelda is really het Axanthic, this pairing gives 12.5% per egg"). No reptile tool does this; Pigeonetics proved the interaction is fun enough to be a game.
- [x] **2.2 Hatch simulator.** (Shipped Aug 2026: hatch-a-clutch dice roller with staged reveals, running tally vs expectation, gambler's-fallacy copy; season simulation and eggs-for-90% landed in Phase 1.) A "hatch this clutch" button that rolls real dice egg by egg with a small reveal animation, plus "simulate the whole season" for the distribution view (the existing Monte Carlo hook is 90% of the math; this is presentation). Include "how many eggs for a 90% chance of at least one?" framing.
- [x] **2.3 "Why these odds?" ladder.** (Shipped Aug 2026: per-gene interactive Punnett squares with hover gamete tracing, independence-multiplication explainer, poss-het scenario notes. Remaining: deeper links into Genetics Guide sections.) Expandable explanation on every outcome: animated Punnett square where hovering a cell traces which allele came from which parent, then the multiplication across loci, in plain language. Reuses Genetics Guide content as the deep layer.
- [x] **2.4 Share cards.** (Shipped Aug 2026: downloadable clutch-card PNG plus dynamic unfurls via /api/share and /api/og-pairing edge functions with a Share link button. One-time post-deploy check of the two endpoints recommended.) Dynamic OG images per permalink (@vercel/og: parents, egg array, headline odds, geckinspect.com branding) and a one-tap "download clutch card" image for Facebook groups and Discord. A compact, recognizable visual format is the growth loop.
- [x] **2.5 Omnibox entry.** (Shipped Aug 2026: "lilly white het axanthic x sable" parses into both parents, with aliases, poss hets, supers, and Melanistic; unreadable words are reported, never silently dropped. Remaining: wire into the site-wide command palette.) A single input that parses "lilly white het axanthic x axanthic," with fuzzy matching over trait names, aliases, and abbreviations. Wire into the site-wide command palette. Expert speed without expert-only UI.
- [x] **2.6 Calculator everywhere.** (Shipped Aug 2026: "Pair in calculator" on gecko profiles via sireGecko/damGecko deep links, command-palette actions, breeding-plan embed since Phase 1. Marketplace listings remain a light follow-up.) "Pair with..." on every gecko profile, predicted outcomes inline on breeding plans (already partially wired), odds preview on marketplace listings. The standalone page remains the public shareable surface.
- [x] **2.7 Expected clutch value.** (Shipped Aug 2026: Morph Guide price bands per outcome plus an expected season value band with stated coverage. Live MorphMarket-derived pricing can replace guide ranges later.) Wire MorphPriceIndex/market analytics into outcomes: "expected value per clutch: $X to $Y based on current listings," with the honesty caveat baked in. Breeders do this by hand today with calculator odds and MorphMarket prices; nobody serves it.
- [x] **2.8 Chance vs expression disambiguation.** (Shipped Aug 2026: probability renders as eggs and percents, polygenic expression as meters and bands in its own panel.) Distinct visual languages: probability chips (dice icon, "66% poss het") vs expression meters (gradient bar, "90% pin coverage"). Explainer tooltip on each. Fixes the documented buyer confusion no competitor acknowledges.

Definition of done: at least one feature in every research-identified white-space lane is live, and share-card links are circulating in at least one community venue.

### Phase 3: Build the moat (2 to 3 months, overlaps Phase 2)

Goal: things that compound with data and cannot be copied in six months.

- [x] **3.1 Predicted vs actual: the outcomes flywheel.** (Shipped Aug 2026: pairing_outcome_logs table with owner RLS, one-tap clutch logging against prediction snapshots on collection pairings, running prediction-vs-reality tallies. Community-level anonymized aggregates deliberately wait for volume and a consent flow.) When a clutch hatches in the Hatchery, prompt one-tap logging of actual phenotypes against the pairing's prediction. Show per-pairing "prediction vs reality" and, with consent, aggregate anonymized cross statistics community-wide ("across 214 logged LW x normal eggs on Geck Inspect: 51% Lilly White"). Dusty's engine has the Bayesian math but only his own animals; our users' collective data is a dataset he cannot replicate. This is the calculator's version of the AI-training moat and the direct answer to ROADMAP item 8.
- [x] **3.2 Polygenic expression engine.** (Shipped Aug 2026 first slice: per-parent expression scores seeded from tags, qualitative bands, never percentages. Lineage-depth band tightening is the follow-up.) Per-parent expression scores (0 to 100) for Harlequin, Pinstripe coverage, Dalmatian density, sourced from morph tags, AI morph ID output, and lineage. Output honest likelihood bands ("most likely mid-to-high harlequin; extremes possible"), tightened by lineage depth. Never fake percentages. This models how top breeders actually reason and no competitor attempts it credibly.
- [x] **3.3 Multi-generation project planner.** (Shipped Aug 2026: "Breed this baby next" on every viable predicted offspring chains generations through permalinks, and the reverse calculator plans two-generation hold-back routes from your own collection, back-crosses flagged. Saved named projects with season timelines are the Pro follow-up.) "Continue with this offspring" on any predicted outcome, chaining crosses into a named project ("Road to Axanthic Frappuccino: 2 generations, best case 2028, cumulative odds per egg laid"). Combines reverse mode + het inference + season math into the stickiest serious-breeder feature. Projects are saved, shareable, and Pro-gated.
- [x] **3.4 Photo-in, genetics-out.** (Shipped Aug 2026: lineage het-inference auto-fills possible hets on collection parents with per-parent notes; AI Morph ID already feeds the same morph_tags the calculator reads, closing the loop.) AI Morph ID suggests calculator inputs from parent photos ("this looks Lilly White with strong harlequin; confirm?"), and the hidden-het panel's lineage inferences pre-populate poss-het levels in collection mode. The three systems (AI ID, lineage, calculator) become one loop, which is a Geck Inspect-only combination.
- [x] **3.5 Learn mode: Clutch Lab puzzles.** (Shipped Aug 2026: six-puzzle ladder at /calculator/learn from first Lilly White to a two-generation Phantom Frappuccino, par scoring, forbidden-pairing lessons, every puzzle proven solvable within par by the test suite.) A Pigeonetics-style ladder of always-solvable challenges ("produce a Phantom Lilly from this starting group," "get a Luwak without risking a super"), scored on fewest pairings, sharing the real engine and visual language. Feeds the keeper market (ROADMAP item 9), schools, and social sharing. Crestie genetics as a game nobody else can ship because nobody else has the engine plus the guide content.
- [x] **3.6 Season recap ("Hatch Wrapped").** (Shipped Aug 2026 first slice: season scorecard from logged clutches with a downloadable recap card. The full cross-pairing yearly Wrapped moment builds on a season of logged data.) End-of-season shareable recap per breeder: eggs, hatches, odds beaten or missed, luck percentile, rarest hatch. The Spotify Wrapped pattern applied to a breeding season; pairs with the outcomes flywheel data.
- [x] **3.7 Data architecture for trait velocity.** (Shipped Aug 2026: genetics_trait_overrides table, public-read RLS with service-role-only writes, runtime loader merging patches AND brand-new provisional traits into the catalog, with app-side exact math for loci the vendored engine does not know. A new gene is now a database row, not a deploy.) Move trait/combo/risk definitions to a Supabase-backed store with the vendored package as fallback, so proving a new gene (the hobby moves fast: Highway, Monochrome, whatever 2027 brings) is a data update, not a release. WOBP died of database staleness; Dusty already ships rules-in-database. Trait freshness is existential.

Definition of done: outcome logging is live with at least 100 real clutches recorded, one multi-gen project has been planned and shared publicly by a real breeder, and the trait store can add a new gene without a deploy. (Status Aug 2026: all machinery is shipped and tested; the 100-clutch and shared-project marks are adoption outcomes for the coming season.)

---

## 6. What we deliberately will NOT do

- No fake precision on polygenic traits. No "72% chance of Extreme Harlequin." Bands and honesty, always. This is the trust position.
- No neutral presentation of LW x LW. The math is shown, the warning is unmissable and unfilterable, and lethal eggs are counted as losses.
- No login wall or paywall on the core calculator. Ever. (Planning layers on top of your collection are the Pro surface.)
- No multi-species expansion of the calculator. Gargoyle geckos are the only adjacency worth considering someday (uncalculatable today, closest hobby overlap), and only after Phase 3 ships. Crested-gecko-first is the moat.
- No sub-grading names the community rejects ("Phantom Pin A/B/C"). Expression is a meter, not a name.
- No em dashes in any calculator copy, per house style.

---

## 7. Success metrics

- Search: #1 for "crested gecko genetics calculator" and top 3 for per-trait queries ("lilly white calculator," "cappuccino genetics"). Baseline per ROADMAP item 3 tracking.
- Sharing: permalink visits and share-card impressions (target: calculator becomes a top-3 referral source for new signups within 2 months of Phase 2).
- Engagement: calculations per week, % of signed-in users who run a collection-mode pairing, simulator plays per session.
- Flywheel: clutch outcomes logged (target 100 in first season after Phase 3.1), poss-het records created from lineage inference.
- Credibility: unprompted mentions by established breeders (STRATEGY.md list), zero accuracy corrections from Foundation Genetics-aligned reviewers.

## 8. Sequencing note

Phase 1 is almost entirely UI over the existing engine and should ship inside the current hatch season while "what will my pairing produce" questions peak in the communities. Phase 2's share cards should be live before the fall hatch wave for maximum spread. Phase 3.1 (outcome logging) wants a full season of data, so it starts as soon as the Hatchery prompt can ship, even if the aggregate views come later.
