# STRATEGY.md - Geck Inspect

Last updated: May 2026
Source: Landscape & Competitor Deep Dive (full doc in /docs/landscape-analysis-vol1.docx and /docs/landscape-analysis-vol2.docx)

## The market in one paragraph

Geck Inspect operates in the crested gecko software market. There are roughly 800,000 US households that own a crested gecko (2022 data) and an estimated 1.0-1.3 million households globally. The hobby produces roughly 100,000 captive-bred crested geckos per year. Approximately 6,300 crested geckos are listed for sale on MorphMarket at any given time. The total addressable market for a focused crested-gecko-first platform that captures 1% of keepers and 10% of breeders is roughly $850K-$1.2M ARR, with international upside doubling that ceiling.

## The competitive picture

There are seven serious competitors and a long tail of smaller tools. The serious ones:

1. Geck Inspect (this project)
2. Geckistry / ReptiDex / Breed Ledger - all built by Dusty Mumphrey, one connected ecosystem
3. MorphMarket - the marketplace incumbent with built-in animal management
4. Cltch.io - ball python only, not direct competition but a model for what serious looks like
5. HatchLedger - reptile-wide breeder operations, $19-$99/mo, financial P&L is their differentiator
6. The Reptile Keeper - UK-based, polished, AI shed prediction, native iOS+Android, REPTA-affiliated
7. ReptiDex (covered as part of the Dusty ecosystem above)

Smaller tools that exist but have less momentum: Husbandry.Pro, Reptile Buddy, ReptiWare, RepTool, Reptile Scan, HerpVille, HerpTracker, Clutchly, GeneticCalculator.com, SnakeKeeper, Lil Monsters Reptiles morph builder.

## The biggest threat: Dusty Mumphrey's ecosystem

This is the single most important strategic fact. One founder runs three connected products:

- **Geckistry** - his own crested gecko breeding business in Tyler, TX. Has free AI morph identifier in beta. Generates real production data.
- **ReptiDex** - iOS+web app for reptile records, $4.99/mo, supports 137 species, 73+ users in first 20 days.
- **Breed Ledger** - multi-species breeder website builder + genetics engine + breed registry platform. **Launches May 15, 2026.**

He is also publicly partnered with the Gold Standard Gecko Club (GSGC), the most prestigious crested gecko institution. GSGC runs entirely on Breed Ledger.

His weaknesses (which Geck Inspect can exploit):
- Started breeding crested geckos in May 2025. One year in. Established breeders have 10-25 years of experience.
- His genetics engine is multi-species. Crested gecko depth is limited by his one year of personal data.
- His morph identifier is trained on his own bloodlines (biased toward one breeder's aesthetic).
- He is spread across three products. Focused single-product competitors can ship faster.

## Where Geck Inspect leads

- The only product positioned as crested-gecko-FIRST. Everyone else is multi-species or marketplace-broad.
- AI morph identification as a flagship feature. Only Geckistry has parity, and theirs is a side tool.
- Modern stack (Next.js + Supabase + Vercel) means rapid iteration is possible.
- Verified community angle is differentiated.

## Where Geck Inspect is at parity

- Multi-gen pedigree tree, genetics calculator, care guides, morph guide, genetics guide. These are now category baseline.
- Web experience on mobile is functional but not native.

## Where Geck Inspect is behind

- No native iOS app. (ReptiDex has one. The Reptile Keeper has one. MorphMarket has one. Cltch has one.)
- No public-facing breeder website builder. (Breed Ledger's biggest pitch.)
- No registry partnership. (GSGC is locked up by Breed Ledger.)
- Smaller breeder operation behind the platform. (Geckistry generates real production data.)
- No financial / P&L tracking. (HatchLedger has this.)
- No genetic testing integration. (Cltch has this for ball pythons.)

## Where everyone is behind (open opportunities)

These are wide-open spaces. Whoever ships one of these owns it for at least 6 months.

1. **Conformation/structure AI grading** - GSGC judges geckos on body structure. No tool grades structure with AI. Highest defensibility opportunity.
2. **IoT/sensor integration** - Govee, SwitchBot, SmartThings APIs are public. No reptile platform integrates them yet. Easy technical lift, real value.
3. **Pet keeper-focused tools** - 80%+ of crested gecko owners are not breeders. Care reminders, vet records, growth tracking, simple morph ID. Doubles TAM.
4. **Provenance/authenticity certificates** - High-end geckos sell for $1,500+ with no chain-of-custody. A verifiable certificate would matter.
5. **Live market analytics** - MorphMarket has the data, no one exposes it as analytics. "What is a Lilly White Harlequin worth right now?"
6. **Education/mentorship marketplace** - No Masterclass-style platform for reptile education.
7. **Photo grading + auto-tagging + moodboarding** - Pinterest-for-breeders. Visual, shareable, useful.

## Pricing context

The market has settled at:
- Free tier: 3-20 animals depending on platform
- Hobbyist tier: $4.99-$7.99/month
- Serious breeder: $9.99-$19/month
- Pro/operations: $49-$99/month

Going meaningfully above this requires meaningful feature differentiation. Going below leaves money on the table.

## User sentiment patterns

What real users complain about across the major platforms (verbatim themes from Trustpilot, PissedConsumer, Reddit, and the HerpTracker founder's research):

1. **Reliability failures** - sync issues, data loss, notifications that don't fire, lost months of records. Spreadsheets are the fallback when apps fail.
2. **Pricing complaints** - users resent paywalls on basic features like "more than 3 animals."
3. **Missing core features** - bulk logging for large collections, family/household sharing, feeder inventory, breeding behind paywalls.
4. **MorphMarket specifically** - 2.7-star Trustpilot rating, complaints about buyer protection failures, biased moderation, no phone support. This creates room for a trust layer above MorphMarket.

## Industry events that matter

- **NRBE Daytona, August 15-16, 2026** - the most important crested gecko event of the year. 100,000 sq ft. GSGC competitions held here. Tikis, Altitude, BB's, Fringemorphs, ACR all vend.
- Tinley Park Reptile Expo (October, twice yearly)
- Repticon (regional, year-round)
- Show Me Reptile Show (Missouri-based circuit)
- Flora Fauna Conference (NY)

## Established breeders worth knowing

These are the people whose endorsement matters. Listed by approximate social-media reach and hobby reputation:

- Tikis Geckos (~14k IG, GSGC founder, partnered with Breed Ledger)
- Altitude Exotics (~11.7k FB, axanthic specialty)
- BB's Crested Geckos (5.0/5 on MorphMarket, 105 reviews)
- Fringemorphs (premium morph focus, 15+ years)
- ACR / Anthony Caponetto (20+ years, one of the oldest collections)
- Lilly Exotics, Rockstar Geckos, Tara Leigh's Cresties, Austral Gecko, Tailspinz Geckos, Greeks Geckos, Kryptiles, Upside Down Geckos

## Reference content authorities

These are the published references the hobby treats as authoritative. Geck Inspect should align with them, not contradict them.

- Foundation Genetics by LMReptiles (genetics)
- The Gecko Geek (morph guide)
- Fringemorphs (morph guide)
- ReptiFiles (care guides)
- NEHERP (care)
- Pangea Reptile (diet brand + content)
- Repashy (diet brand + content)
- Tenny's Crested Geckos (market data, sister site)

## What this means for product decisions

When evaluating any feature or direction, ask:
1. Does this strengthen the crested-gecko-first identity? (Yes is good. No needs justification.)
2. Does this work toward closing one of the four behind-gaps? (Mobile, website builder, registry, financial tracking.)
3. Or does this open one of the seven open-opportunity gaps? (Structure AI, IoT, keeper market, provenance, market analytics, education, photo grading.)
4. Would an established breeder respect this? (Reference content authorities matter.)
5. Does this respect price-sensitive users while delivering serious value? ($5/mo entry, $10/mo premium.)

If the answer to all five is no or unclear, deprioritize.
