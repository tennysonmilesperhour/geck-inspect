# STRATEGY.md - Geck Inspect

Last updated: 15 October 2026 (plan item E2 21 of `docs/planning/comprehensive-review-2026-10-14.md`). The May 2026 version is in git history.

Sources, newest first:

- The adversarial review of 14 October 2026, as reconciled in Part D of `docs/planning/comprehensive-review-2026-10-14.md` (the market-size correction below comes from its section 03).
- `docs/planning/competitive-landscape-2026-10.md` (5 October 2026): competitor facts with a source link for each. Read it for detail; this file keeps the conclusions.
- The May 2026 landscape deep dive (`/docs/landscape-analysis-vol1.docx` and `vol2.docx`). Where it disagrees with the two above, the newer sources win.

## The market in one paragraph

Geck Inspect sells record-keeping, lineage and pricing tools to people who breed and sell crested geckos. That is a niche, and it can be a good small business. The best count available is Geck Inspect's own listing data, in aggregate: about **970 sellers had active US crested gecko listings in a 45-day window**, of whom **279 had 10 or more listings**, 82 had 25 or more and 24 had 50 or more; the median seller had 4. Treat these as orders of magnitude, because the US listing feed has been unreliable since September. Built up from those counts, the paying candidates are **roughly 400 to 850 serious breeders**, plus 1,000 to 2,000 small sellers across North America and part of Europe. At realistic shares and today's prices ($2.99 and $5.99 a month) that is a ceiling of about **$7K to $36K a year**, or about $12K to $90K at value-based prices. Keepers who are not breeders have not paid so far (0 of 5 who said so), so they are users and future buyers of passported animals, not the revenue base.

### Figures from the May 2026 version that have no source

The May version said there were about 800,000 US households with a crested gecko (2022), 1.0 to 1.3 million worldwide, about 100,000 captive-bred crested geckos a year, and an addressable market of $850K to $1.2M a year. **None of these has a primary source**, and the household count would be about 13% of every US reptile-owning household (APPA's 2025 survey puts those at about 6 million). Do not quote them. The listing count of "about 6,300 crested geckos for sale on MorphMarket" is roughly consistent with the October research (6,700 or more listed in the US and Canada) and can stand as a supply figure, not a customer count.

## The competitive picture (October 2026)

What changed since May, in short (each point is sourced in `competitive-landscape-2026-10.md`, section 1):

1. **Breed Ledger launched on 15 May 2026 and is now multi-species and dog-heavy.** Free, Starter $29 a month, Professional $49 a month, clubs from $49. About 33 breeding programs reported.
2. **ReptiDex is in maintenance mode.** Development moved to Breed Ledger; the iPhone app had 2 ratings averaging 3.0; Android is still "coming soon".
3. **Geckistry runs on Breed Ledger**, so Dusty Mumphrey's three products are one stack.
4. **The Gold Standard Gecko Club registry went live on 13 June** and runs on Breed Ledger. Its conformation show ran at NRBE Daytona in August.
5. **MorphMarket is closing the tools gap**: husbandry reminders, label templates, sold prices, live events and auctions, on top of its free Animal Manager with QR labels and record transfer. It is where the buyers are.
6. **Live selling arrived.** Palmstreet (6.9% fee) carries some of the biggest crested breeders; MorphMarket answered with live events.
7. **AI morph ID is no longer rare.** Geckistry's is free; ReptiDex has a paid one; Crested Gecko ID (Android) and Cretti (Korea) offer photo ID or "AI pairing".
8. **HatchLedger roughly doubled its prices**: Free, $39, $79 and $179 a month.

Who matters, in order of threat:

1. **MorphMarket.** Owns the buyers, now bundles free records, reminders, QR labels and sold prices with the place breeders already sell. Weak spots: Trustpilot around 2 out of 5 (buyer protection, moderation, support), generic crested genetics.
2. **Breed Ledger, ReptiDex and Geckistry (Dusty Mumphrey).** Website builder, deposits through Stripe Connect, e-signed contracts, the GSGC registry, a strong comparison-page SEO machine. Weak spots: $29 is five times Geck Inspect's Breeder plan, attention is shifting to dogs, small user count, no keeper side.
3. **Husbandry.Pro, HerpTracker, The Reptile Keeper, HatchLedger, Cltch, Day56, Cretti** and smaller apps. Mostly multi-species or other-species; see the comparison table in the October research.

Free crested gecko calculators (IB Exotic, LM Reptiles, ReptiDex, MorphMarket, Breed Ledger) are everywhere. A calculator is no longer a differentiator on its own.

## Dusty Mumphrey's ecosystem

Still the closest competitor built by a crested gecko breeder, with one correction: the May version called him "one year in". His own bio claims 20 or more years breeding dogs and reptiles (with breed-club and Best in Show experience) and 9 or more years as a software engineer. Crested geckos are recent for him; registries and clubs are not. That is why GSGC runs on his platform.

Where he is exposed (these still hold): the genetics engine and morph identifier lean on one breeding program's animals; three products split his attention, now with dogs on top; and his entry price for a breeder website is $29 a month.

## Where Geck Inspect stands

**What still holds from May:**

- Geck Inspect is the only product built crested-gecko-first. Everyone else is multi-species or marketplace-first. This is the right **positioning**: a tight community, a specific vocabulary, credibility.
- But it is a positioning, not a moat (the adversarial review's point, which the comprehensive review accepts). A moat makes customers stay or competitors fail. The one feature shaped like a moat is the **passport, transfer and buyer packet**, because every sold animal carries the product to a new owner. On 14 October there were 5 passport codes and 2 transfers in total. Part E makes passports issued and claimed a headline number.

**Where it leads (October):** crested gecko depth in one place (a crested-specific genetics engine with reverse calculation and clutch odds, Morph Guide, Care Guide, growth bands, breeding readiness); Morph ID that admits uncertainty and asks for a second photo; the lowest paid prices among serious tools; waitlists with written deposit terms on a $5.99 plan.

**Where it is at parity:** pedigrees, calculators, care and morph guides, QR labels, husbandry logs, collaborators. These are category baseline now.

**Where it is behind:**

- No app in the stores (ReptiDex, MorphMarket, Husbandry.Pro and most keeper apps have one).
- Not where the buyers are (MorphMarket, Palmstreet, Facebook groups).
- No money handling (Breed Ledger takes deposits and e-signs contracts; Geck Inspect chose not to, decision 33).
- No custom-domain breeder site and no registry partnership (GSGC is on Breed Ledger). The breeder page and visual website editor shipped (`docs/WEBSITE_BUILDER.md`) but without a custom domain.
- Reliability is unproven, and lost records and silent reminders are the category's top complaint.
- Shipped since May and no longer gaps: Business Tools records sales and costs and shows profit by season and by pairing; the breeder page and website editor; vet records.

## Open opportunities, and the freeze

The May list of seven open opportunities still describes real gaps: structure and conformation grading, enclosure sensors (a Govee integration exists, metered), keeper tools, provenance certificates, live market analytics, education, and photo grading. Two October corrections:

- The market is small (above), so each of these multiplies surface area against a low ceiling. **None is to be started before decision day, 17 January 2027** (Part E, rules E0 and E6: no new pages, species, tiers, tools or integrations until weekly active breeders grow four weeks in a row).
- Provenance (passports and transfers) is already mostly built and is the one to finish, as the core of the product, not as an extra.

## Pricing context

| Product | Entry paid plan | Breeder plan | Top plan |
|---|---|---|---|
| Geck Inspect | Keeper $2.99 a month, $30 a year | Breeder $5.99 a month, $60 a year | Enterprise off sale |
| ReptiDex | $4.99 | $9.99 | |
| Breed Ledger | | Starter $29 | $49 |
| MorphMarket (seller memberships) | $3 to $5 | $11 to $19 | $45 to $125 |
| Husbandry.Pro | $4, $9 | $18 | $39, $99 |
| HatchLedger | | $39 | $79, $179 |

Two readings exist and Tennyson decides between them. The October research recommended keeping $2.99 and $5.99 and changing the packaging (annual first, a founding breeder offer). The adversarial review argued the prices are too low to matter to a breeder grossing about $12,500 a year and too complicated (about ten metered quotas, an overage, lifetime rows), and proposed two plans with Breeder at $12 to $15 a month. Part E's rule: no price change before five breeders have answered the $120 prepaid Founding Breeder offer; lower a price only if it comes up as the objection in 3 of 20 conversations.

## User sentiment patterns

What users complain about across the major platforms (Trustpilot, PissedConsumer, app store reviews, the MorphMarket forum; Reddit and Facebook could not be read in October):

1. **Reliability failures**: sync problems, lost records, reminders that do not fire. Spreadsheets are the fallback when apps fail.
2. **Pricing complaints**: paywalls on basics such as "more than 3 animals", subscription fatigue.
3. **Missing core features**: bulk logging for large collections, household sharing, feeder inventory.
4. **MorphMarket specifically**: refused buyer protection, scams by badged sellers, absent support, opaque bans. Room for a trust layer, which is what passports are.
5. **"What morph is this?"** is the most common crested gecko thread type, and breeders distrust confident AI labels. Honest uncertainty wins.

## Industry events

- NRBE Daytona: the most important crested gecko event of the year. 2026 was 15 to 16 August (GSGC show); next is August 2027.
- NARBC Tinley Park: twice a year; the October 2026 show (10 to 11 October) has passed.
- Repticon: about 23 regional shows from October to December 2026.
- Show Me Reptile Show (Missouri circuit) and Flora Fauna Conference (New York).

Expos matter for passports: the QR card on a deli cup is the advertisement.

## Established breeders worth knowing

Endorsements that matter, by approximate reach and reputation (counts are unverified search summaries):

- Tikis Geckos (GSGC founder, tied to Breed Ledger; skip for outreach)
- Altitude Exotics (axanthic specialty)
- BB's Crested Geckos (5.0 out of 5 on MorphMarket; sells live on Palmstreet)
- Fringemorphs (premium morph focus, 15+ years)
- ACR / Anthony Caponetto (20+ years)
- Lilly Exotics, Rockstar Geckos, Tara Leigh's Cresties, Austral Gecko, Tailspinz Geckos, Greeks Geckos, Kryptiles, Upside Down Geckos, Paradise Cresties

The outreach target in Part E (item 13) is mid-size breeders with 1,000 to 15,000 followers who sell on MorphMarket or Palmstreet and are not tied to GSGC or Breed Ledger.

## Reference content authorities

Published references the hobby treats as authoritative. Geck Inspect should align with them, not contradict them.

- Foundation Genetics by LMReptiles (genetics)
- The Gecko Geek (morph guide)
- Fringemorphs (morph guide)
- ReptiFiles (care guides)
- NEHERP (care)
- Pangea Reptile (diet brand and content)
- Repashy (diet brand and content)
- Tenny's Crested Geckos (market data). Not a sister site: an unrelated breeder who shares Tennyson's first name (see CLAUDE.md).

## What this means for product decisions

Before building anything, ask:

1. **Does it serve the 90-day question?** Will crested gecko breeders pay for records, passports and transfers (Part E, rule 1)? If not, and it does not close a hole that could hurt a member, it waits.
2. **Does it strengthen the crested-gecko-first identity?** Yes is good. No needs a written reason.
3. **Does it make passports and transfers more likely to travel with real sales?** That is the only moat-shaped part of the product.
4. **Would an established breeder respect it?** Reference authorities and honest uncertainty matter.
5. **Is it sized for the market?** A few hundred serious breeders, not a platform. Every new surface has to earn its place against that number.

If the answer to all five is no or unclear, do not build it.

A note on where this file lives: the comprehensive review recommends making the repository private (Part E, item 6, Tennyson's action), partly because this competitor analysis is public while the repository is.
