# Competitive landscape and market research, October 2026

Written 5 October 2026. This updates STRATEGY.md (last written May 2026) and the competitor snapshot in docs/planning/vip-audit-2026-09-27.md. It covers who Geck Inspect competes with today, how Geck Inspect compares feature by feature, what the crested gecko community still asks for, what to charge, where users come from in this niche, and ten moves ranked for a solo founder.

## How this was researched, and what could not be checked

- Every competitor website was blocked by the sandbox's network filter for direct reading (breedledger.co, builtbydusty.com, morphmarket.com, community.morphmarket.com, tikisgeckos.com, dev.to). Facts below come from web search result summaries of those pages, App Store and Google Play listings, press releases and help center articles. Each claim has its source link. Search summaries can be stale or slightly wrong, so prices and counts should be rechecked on the live page before quoting them publicly.
- Reddit (r/CrestedGecko, r/Herpetoculture) and Facebook groups are not indexed by the search tool. Community sentiment comes from the MorphMarket community forum (titles and summaries), Trustpilot, app store reviews and earlier research already in this repo. Anything marked **(unverified)** could not be confirmed from a second source.
- Geck Inspect's own facts come from the repo (src/pages, src/lib/tierLimits.js, src/lib/stripe-config.js) and docs/planning/feature-completeness-audit-2026-09-29.md. Usage as of 5 October: 56 accounts with a login, 20 new in 30 days, 7 active in the last 7 days, 3 paying subscriptions.

## 1. What changed since STRATEGY.md (May 2026)

These are the corrections that matter most. STRATEGY.md should be updated with them.

1. **Breed Ledger launched on 15 May 2026, and it is no longer a reptile product first.** It now sells itself as breeder software for "dogs, reptiles, cats, livestock, and more", with dog-breeder comparison pages (Good Dog, BreederCloudPro) and kennel software articles. Reported adoption is small: the site said "33 responsible breeders are running their program on Breed Ledger" (date of that count unknown). Sources: [Breed Ledger home](https://breedledger.co/), [Breed Ledger vs BreederCloudPro](https://breedledger.co/compare/breedercloudpro), [Good Dog vs Breed Ledger](https://www.builtbydusty.com/blog/good-dog-vs-breed-ledger-comparison), [Software Advice listing](https://www.softwareadvice.com/product/560018-Breed-Ledger/).
2. **ReptiDex is in maintenance mode.** Search summaries of Dusty's own pages say "ReptiDex remains available as a standalone iOS app, but active development has moved to the Breed Ledger platform." The App Store listing had 2 ratings averaging 3.0, and Android is still "coming soon". Sources: [Breed Ledger for reptile breeders](https://breedledger.co/for/reptile-breeders), [ReptiDex on the App Store](https://apps.apple.com/us/app/reptidex/id6758026225), [reptidex.com](https://reptidex.com/).
3. **Geckistry now runs on Breed Ledger** (geckistry.breedledger.co), so the three products are one stack: Geckistry is the showcase breeder, Breed Ledger is the platform, ReptiDex is the legacy app. Source: [Geckistry on Breed Ledger](https://geckistry.breedledger.co/).
4. **STRATEGY.md undersells Dusty's experience.** His own bio claims 20+ years breeding dogs and reptiles (American Bully, ABKC Best in Show) and 9+ years as a software engineer. Crested geckos are recent for him, but "one year in" is the wrong framing; he has breed-club and registry experience from dogs, which is exactly what GSGC needed. Source: [About Dusty Mumphrey](https://www.builtbydusty.com/about) (via search summary).
5. **The Gold Standard Gecko Club registry went live on 13 June** (crested, leopard and gargoyle geckos), at members.goldstandardgeckoclub.com, free "for a limited time". Breed Ledger's breed-club page says a live gecko club "runs its whole registry and shows" on Breed Ledger. The GSGC conformation show ran at NRBE Daytona, 15 to 16 August 2026, and entries had to be registered. Sources: [MorphMarket forum announcement](https://community.morphmarket.com/t/gold-standard-gecko-clubs-online-registry-is-live-crested-leopard-and-gargoyle-geckos/62988), [GSGC registry post](https://www.goldstandardgeckoclub.com/post/gecko-registry-is-open-for-2026), [Breed Ledger for breed clubs](https://breedledger.co/for/breed-clubs).
6. **MorphMarket is closing the tools gap.** Its Spring/Summer 2026 update added husbandry alerts and reminders, enclosure label templates, selecting your own animals in the morph calculator, live events, scheduled auctions, actual sold prices, seller reviews on store pages and invoices. Its free Animal Manager already had QR labels that open a husbandry log. Sources: [Spring/Summer 2026 updates](https://community.morphmarket.com/t/spring-summer-2026-site-updates-features/62976), [Jan/Feb 2026 updates](https://www.morphmarket.com/blog/2026/03/03/janfeb-2026-site-updates-features/), [Label Creator](https://support.morphmarket.com/article/420-morphmarket-label-creator).
7. **Live selling arrived for crested geckos.** Palmstreet (a live-shopping app that started with plants) added reptiles with about 40 launch sellers. Tikis Geckos, BB's Crested Geckos and Paradise Cresties run live auctions and mystery boxes there. MorphMarket answered with its own live events. Sources: [Pet Age](https://www.petage.com/shopping-app-palmstreet-introduces-reptile-sales-from-40-sellers-to-live-marketplace/), [PR Newswire](https://www.prnewswire.com/news-releases/palmstreet-expands-offerings-beyond-plants-introducing-reptile-sales-to-its-nature-driven-marketplace-302305265.html), [BB's shop on Palmstreet](https://palmstreet.app/user/ZJBetDS8dbbtmKvvrnMFCb5mXi52), [Paradise Cresties](https://www.paradisecresties.com/).
8. **AI morph ID is no longer rare.** Geckistry's identifier is free (beta). ReptiDex has a paid multi-photo identifier. A separate Android app, Crested Gecko ID, does photo identification with user corrections (updated June 2026). Cretti (Korean, now in English on the App Store) advertises "AI pairing". Sources: [Geckistry identify](https://geckistry.com/identify), [ReptiDex App Store](https://apps.apple.com/us/app/reptidex/id6758026225), [Crested Gecko ID](https://play.google.com/store/apps/details?id=se.grasberg.gecko_morph_app), [Cretti on the App Store](https://apps.apple.com/ca/app/cretti/id6759623382).
9. **HatchLedger roughly doubled its prices**: now Free, $39, $79 and $179 a month (STRATEGY.md says $19 to $99). Source: [HatchLedger pricing](https://hatchledger.com/pricing/).

## 2. Competitor profiles

### Breed Ledger (Dusty Mumphrey)

- **Target user:** small-scale breeders of any species who want a website, records, waitlists and payments in one place; breed clubs and registries.
- **Core features:** breeder website from animal records (three templates, custom domain), five-generation pedigrees with cross-breeder links, genetics engine (the same code as Geckistry, with Lilly White x Lilly White lethal warnings), waitlists tied to an animal, litter or morph combo, deposits through Stripe Connect, e-signed contracts in the message thread, a "Find a Breeder" directory, and club tools (members, dues, registrations, show entries).
- **Pricing:** Free (subdomain site, inquiry form, directory listing; one listing says unlimited records, another says 10 animals: **unverified**), Starter $29/mo (waitlists, deposits, custom domain, 3 contracts a month; one source says 50 animals), Professional $49/mo (unlimited contracts, analytics, priority support), clubs from $49/mo. Annual saves two months. Launch offer: first 50 signups got 6 months free.
- **Platforms:** web. ReptiDex is the iOS app and can sync to Breed Ledger.
- **Strengths:** payments and contracts (nobody else in reptiles has deposits plus e-sign in one thread); the GSGC registry and show; a breeder's own domain; strong SEO content machine (dozens of "honest review" comparison pages).
- **Weaknesses:** $29 is 5x Geck Inspect's Breeder plan and well above what crested hobby breeders pay; multi-species and now dog-heavy, so crested depth is a shrinking share of attention; small user count (33 programs reported); no keeper side; no native Breed Ledger app.
- **Sentiment:** Software Advice scores 4.6 to 4.8 out of 5, from an unknown and probably small number of reviews. No Reddit or Facebook discussion found.
- Sources: [pricing](https://breedledger.co/pricing), [features](https://breedledger.co/features), [Software Advice](https://www.softwareadvice.com/product/560018-Breed-Ledger/), [reptile breeders page](https://breedledger.co/for/reptile-breeders).

### ReptiDex (Dusty Mumphrey)

- **Target user:** reptile breeders who want records on the phone.
- **Core features:** collection records, weights, pairings, five-generation pedigrees, QR code per animal with a public record, record transfer to a buyer's account, multi-photo AI morph ID (Pro and Premium), free web genetics calculator (32 crested gecko alleles, 33 named morphs).
- **Pricing:** Free to 10 animals and 5 pairs (1 GB); Pro $4.99/mo or $49.99/yr (unlimited, 3 collaborators, 10 GB); Premium $9.99/mo or $99.99/yr (unlimited collaborators and storage). 7-day trial.
- **Platforms:** iOS and web. Android "coming soon" since launch.
- **Strengths:** native iPhone app; early traction (50 paid subscribers in 9 days, by its own account); the transfer and QR flow buyers like.
- **Weaknesses:** development moved to Breed Ledger; 3.0 stars from 2 ratings; one review asks for more species.
- Sources: [App Store](https://apps.apple.com/us/app/reptidex/id6758026225), [reptidex.com](https://reptidex.com/), [ReptiDex product page](https://www.builtbydusty.com/products/reptidex).

### Geckistry (Dusty Mumphrey)

- **Target user:** crested gecko buyers; hobbyists who want a free morph check.
- **What it is:** Dusty's crested gecko (and leachianus) breeding business in Tyler, Texas, now hosted on Breed Ledger, plus a free beta AI morph identifier "trained on thousands of labeled crested gecko images from the breeding program, covering 30 alleles, 17 characteristics and 19 combo morphs".
- **Strengths:** free, no friction, credible because a real breeder is behind it.
- **Weaknesses:** trained mostly on one breeder's animals; one search summary of the page showed "average accuracy 0.00%" on the beta (probably an empty stat, **unverified**); results "may vary for rare morphs".
- Sources: [Geckistry identify](https://geckistry.com/identify), [what morph is it](https://geckistry.com/blog/what-morph-is-it).

### MorphMarket

- **Target user:** everyone who buys or sells reptiles in the US, Canada, the UK, the EU and beyond. 6,700+ crested geckos listed in the US and Canada and 7,900+ worldwide at the time of the search.
- **Core features:** marketplace, store pages and ratings, free Animal Manager (collection, lineage, husbandry log, transfer of husbandry history with a sold animal), QR enclosure labels with a quick log, genetics calculators for many species, Morphpedia (500+ articles), community forum, MorphPay, live events and auctions, shipping labels (including Lacey Act labels), and since mid 2026 husbandry reminders and sold prices.
- **Pricing (US and Canada):** Free; Hobbyist $3/mo annual or $5 monthly; Basic $11 or $19; Premium $45 or $80; Pro $70 or $125. MorphPay 0.5% of annual sales. Live events $10 per hour plus $5 per live auction; extra traditional auctions $25 each.
- **Platforms:** web, iOS, Android.
- **Strengths:** the buyers are there; free tools bundled with listings; fast feature pace in 2026.
- **Weaknesses:** Trustpilot TrustScore about 2 out of 5, with recurring complaints about refused buyer protection, scams by badged sellers, rude or absent support and opaque bans. Its crested gecko genetics are generic, and the community itself says crested morphs do not fit a simple calculator.
- Sources: [pricing](https://www.morphmarket.com/us/pricing/), [live events guide](https://support.morphmarket.com/article/488-live-events), [Trustpilot](https://www.trustpilot.com/review/www.morphmarket.com), [crested gecko listings](https://www.morphmarket.com/us/c/reptiles/lizards/crested-geckos), [MorphPay](https://community.morphmarket.com/t/morphpay-feedback-welcome/39745).

### Palmstreet

- **Target user:** sellers who want live-stream auctions; impulse buyers.
- **Core features:** live shows, auctions, purges, mystery boxes, giveaways, guaranteed live arrival through partnered animal shippers.
- **Pricing:** 6.9% selling fee, no monthly fee, plus Stripe 2.9% + $0.30.
- **Platforms:** iOS, Android, web.
- **Relevance:** not a records tool, but it is where some of the biggest crested breeders now sell, and Geck Inspect's Settings once had a "Sync with PalmStreet" switch that did nothing (removed 2 October).
- Sources: [fees](https://palmstreet.app/blog/fees-on-palmstreet), [sell](https://palmstreet.app/sell), [Pet Age](https://www.petage.com/shopping-app-palmstreet-introduces-reptile-sales-from-40-sellers-to-live-marketplace/).

### Husbandry.Pro

- **Target user:** serious and commercial keepers of any species, rescues, zoos and labs.
- **Core features:** husbandry logs, weight charts tied to feedings, per-animal reminders, QR "Flow Codes" and NFC tags, custom genetics tables, breeding plans, public sales listings, MorphMarket CSV export, thermostat integration (Spyder Robotics, per earlier research).
- **Pricing:** Personal free (5 animals), Hobbyist $4/mo or $32/yr (50), Collector $9 or $75 (200), Breeder $18 or $149, Commercial $39 or $315, Institution $99/mo.
- **Platforms:** iOS, Android and desktop ("Next" v2 rebuild, 2026).
- **Strengths:** mature, deep, cross-platform, NFC.
- **Weaknesses:** generic multi-species; no crested gecko genetics, guides or ID; busy interface for a pet keeper.
- Sources: [husbandry.pro](https://husbandry.pro/), [Next on the App Store](https://apps.apple.com/us/app/husbandry-pro-v2-next/id6761425491), [download](https://husbandry.pro/download).

### iHerp

- **Target user:** long-time keepers with small collections.
- **Core features:** husbandry tracking, classifieds, animal transfers, iHerp Answers, breeding loans.
- **Status:** still mentioned by MorphMarket forum members as "a community favorite for smaller collections, not convenient for larger ones". No 2026 activity, pricing or app update could be confirmed (**unverified**; treat as legacy).
- Sources: [MorphMarket forum: what does everybody use](https://community.morphmarket.com/t/what-does-everybody-use-for-record-keeping/8836?page=2), docs/research/iherp-competitive-analysis.md.

### HatchLedger

- **Target user:** ball python and other high-volume reptile hatcheries.
- **Features:** clutch and pip alerts, buyer packets, waitlists and deposits, P&L, rack planner, free calculators. Claims 300+ hatcheries.
- **Pricing:** Free (10 animals, 2 pairs), Starter $39, Pro $79, Enterprise $179 a month.
- Sources: [pricing](https://hatchledger.com/pricing/), [300 hatcheries press](https://nationaltoday.com/us/ca/los-angeles/news/2026/03/09/over-300-reptile-hatcheries-adopt-hatchledger-breeding-platform/).

### Other reptile collection apps

| App | Who it is for | Price | Platforms | Note |
|---|---|---|---|---|
| The Reptile Keeper (UK) | keepers | Free to 5; Plus £7.99/mo | iOS, Android | AI shed forecast, UV bulb reminders ([pricing](https://thereptilekeeper.com/pricing)) |
| HerpTracker | keepers, families | Free to 3; $4.99; Pro $9.99 with team roles | iOS, Android | Quick-Log, shared workspaces ([site](https://herptracker.app/)) |
| Exotic Reptile Care | pet keepers | Free to 5; $5.99/mo or $29.99/yr | iOS | 24 care guides, crested gecko included ([App Store](https://apps.apple.com/us/app/exotic-reptile-care/id6753999852)) |
| Reptile Records (AU) | keepers and small breeders | Free to 3; Pro about $25 AUD/yr | web, apps | expense tracking ([pro](https://reptilerecords.app/pro)) |
| Reptile Buddy | keepers | free with premium | iOS (pulled from Google Play in 2023) | 4.1 stars from 136 ratings ([App Store](https://apps.apple.com/us/app/reptile-buddy/id1508892560)) |
| Cltch | ball python breeders | Free; Keeper $9/mo | web, apps | in-app shed DNA tests through Rare Genetics ([pricing](https://cltch.io/pricing/)) |
| Day56 | ball python breeders | free to start | web | waitlist pages, 236 breeders, imports from MorphMarket, Cltch, Husbandry.Pro ([site](https://www.day56.com/)) |
| Gecko keeper | leopard gecko keepers | free, no account, data on device | iPhone | shows the "no account" niche ([App Store](https://apps.apple.com/tt/app/gecko-keeper/id6769392687)) |
| Cretti (Korea) | crested gecko keepers | free | iOS, Android | registry, lineage with inbreeding check, AI pairing, social feed; English listing on the App Store ([App Store](https://apps.apple.com/ca/app/cretti/id6759623382)); see docs/planning/cretti-briefing.md |
| Crested Gecko ID | crested keepers | free (**unverified** whether paid tiers exist) | Android | photo morph ID with user corrections ([Google Play](https://play.google.com/store/apps/details?id=se.grasberg.gecko_morph_app)) |

Free crested gecko calculators also exist (IB Exotic, LM Reptiles' interactive morph guide). Calculators are commodity now. Sources: [IB Exotic](https://www.ibexotic.com/crested-gecko-morph-calculator), [LM Reptiles](https://lmreptiles.com/cg-img/).

Note: a Base44 template page titled "Geck Inspect" is publicly listed at [base44.com/templates/view/geck-inspect](https://base44.com/templates/view/geck-inspect) and shows up in searches for crested gecko morph ID apps. It is probably the old prototype. Worth checking whether it should be taken down, since it competes with the real site for the brand name.

## 3. What keepers and breeders complain about and ask for

Evidence quality: MorphMarket forum and Trustpilot are direct; Reddit and Facebook could not be read (see the method note).

**Keepers (about 80% of owners)**
- "What morph is this?" is the single most common crested gecko thread type. The MorphMarket forum has many threads with that title, and there is a Facebook page just for it ([Crestie Morph Identifier](https://www.facebook.com/crestiemorphidentifier/)). Breeders are openly skeptical of AI answers because most crested "morphs" are polygenic visual descriptors, fired up and fired down color differs, and one photo is not enough ([forum thread](https://community.morphmarket.com/t/crested-gecko-traits-morphs-help/50339)). The winning answer is honest uncertainty, not a confident label.
- "How much is my gecko worth?" ([forum](https://community.morphmarket.com/t/morph-what-does-my-gecko-cost/43969), [forum](https://community.morphmarket.com/t/i-need-help-how-much-do-you-think-she-s-worth/31611)).
- Sexing (pores from about 5 to 7 months), weight and growth ("is this normal?"), floppy tail, not eating, tail loss. These are care-guide questions, not tracker features, but they drive search traffic ([NEHERP care sheet](https://www.neherpetoculture.com/gargscrestiescaresheet)).
- App frustrations: free tiers that cap at 2 reminders or 3 to 5 animals, subscription fatigue, sync bugs, apps that need force-closing ([Exotic Reptile Care review](https://apps.apple.com/us/app/exotic-reptile-care/id6753999852), [Reptile Rocket complaints summarized](https://play.google.com/store/apps/details?id=com.zorbsoft.reptile_rocket)). The "no account, works offline" niche keeps reappearing (Gecko keeper, CareTrack).

**Breeders**
- Records live in a spreadsheet, husbandry in notes, website on Wix, deposits on PayPal and the waitlist in DMs (Breed Ledger's own framing, and it matches the forum thread [what does everybody use for record keeping](https://community.morphmarket.com/t/what-does-everybody-use-for-record-keeping/8836?page=3)).
- Trust: MorphMarket buyer protection and moderation complaints ([Trustpilot](https://www.trustpilot.com/review/www.morphmarket.com), [PissedConsumer](https://morphmarket.pissedconsumer.com/review.html)).
- Ethics and genetics clarity: Super Cappuccino is banned on MorphMarket over nostril and spectacle-eye problems; Lilly White x Lilly White is lethal; breeders want tools that warn them ([Rockstar Geckos stance](https://www.rockstargeckos.com/single-post/cappuccinocrestedgeckos), [Pangea on Cappuccino](https://www.pangeareptile.com/blogs/blog/cappuccino-frappuccino-melanistic)).
- Market softness: lots of supply (6,700+ listed in the US and Canada), common Harlequins and Flames at $75 to $150, so breeders care about standing out and about costs (sources are breeder marketing pages, **partly unverified**: [CB Reptile](https://www.cbreptile.com/top-crested-gecko-breeder/)).

## 4. Feature comparison against Geck Inspect

Key: Yes = shipped and working; Part = partial or built but not yet deployed or verified; No = absent. Geck Inspect status comes from the feature audit (29 September, with 2 to 3 October status lines). Many October items are built but wait on deploys (docs/planning/deploy-queue-2026-10-03.md) and none were clicked through in a real browser yet.

| Feature | Geck Inspect | Breed Ledger | ReptiDex | MorphMarket | Husbandry.Pro | Others |
|---|---|---|---|---|---|---|
| Crested-gecko-first design and content | **Yes** | No (multi-species, dog-heavy) | No | No | No | Cretti |
| Native iOS app | Part (shell 55%, not in store) | No | Yes | Yes | Yes | most |
| Native Android app | Part | No | No | Yes | Yes | most |
| Free animal limit | 10 | 10 or unlimited (unclear) | 10 | unlimited (Animal Manager) | 5 | 3 to 5 |
| Husbandry log (feed, weight, shed) | Yes | weights only | Yes | Yes | Yes | Yes |
| Reminders with the app closed | Yes (email, web push; native push missing) | No | Unknown | Yes (2026) | Yes | Yes |
| Healthy growth band on weight chart | **Yes** | No | No | No | No | No |
| Breeding readiness check (40 g, 18 months) | **Yes** | No | No | No | No | No |
| Fast rack logging (Field Mode, batch) | Yes; offline queue Part | No | No | QR quick log | QR and NFC | HerpTracker |
| QR labels and printable rack sheet | Yes | QR records | Yes | Yes | Yes | |
| Multi-generation pedigree | Yes | Yes (5 gen) | Yes (5 gen) | Yes | Part | Cretti |
| Record transfer to buyer with history | Part (built, needs real test) | Part (records tied to buyer) | Yes | Yes | No | iHerp |
| Crested genetics calculator | **Yes** (reverse calc, Clutch Lab, possible hets) | Yes (same engine as Geckistry) | Yes (free web) | generic | custom tables | free calcs |
| Lethal and ethics warnings (Lilly White, Super Cappuccino) | Part (check engine coverage) | Yes | Yes | Super Capp banned | No | |
| AI morph ID | Yes (two-photo, evidence-based; 1 free try) | via Geckistry, free | Yes (paid, multi-photo) | No | No | Crested Gecko ID, Cretti |
| Morph Guide, care guide, genetics guide | **Yes** (deepest crested content) | No | genetics pages | Morphpedia (generic) | No | Exotic Reptile Care |
| Breeder public page / website | Part (breeder page on geckinspect.com, no custom domain) | **Yes** (custom domain, templates) | No | store page | public listings | Day56 |
| Waitlists | Yes (terms, refunds; Breeder plan) | Yes | No | No | No | Day56, HatchLedger |
| Deposits taken online | No (by decision 33) | **Yes** (Stripe Connect) | No | MorphPay | No | HatchLedger |
| E-signed contracts | No | **Yes** | No | No | No | |
| Marketplace | Part (own small marketplace) | directory | No | **Yes** (dominant) | listings | Palmstreet |
| Price data and market feed | Part (Market page; MorphMarket feed paused) | No | No | sold prices (2026) | No | |
| MorphMarket export | Part (CSV not tested on importer) | No | No | n/a | Yes | Day56 import |
| Registry or club tools | No | **Yes** (GSGC) | No | No | No | Cretti registry |
| Collaborators | Yes (Free 1, Keeper 5, Breeder unlimited) | Unknown | Yes | Unknown | seats | HerpTracker |
| Community forum | Yes (small, 13 posts) | No | No | **Yes** (large) | No | Cretti feed |
| Expense or P&L tracking | Part (sales stats, cost tracking) | analytics | No | invoices | No | HatchLedger, Reptile Records |
| Vet records | Yes (2 Oct) | health tests | Yes | Unknown | Yes | |
| Live selling | No | No | No | Yes | No | Palmstreet |

### Where Geck Inspect clearly wins

1. **Crested gecko depth in one place.** Nobody else combines a crested-specific genetics engine with reverse calculation and clutch odds, a real Morph Guide, a care guide, growth bands, breeding readiness and evidence-based Morph ID. Breed Ledger is moving toward dogs; MorphMarket and Husbandry.Pro are generic.
2. **Keeper-friendly price.** Keeper $2.99 and Breeder $5.99 are the lowest paid tiers among serious tools. Breed Ledger's cheapest paid plan is $29.
3. **Waitlists without the $29 tier.** Waitlists with written deposit terms come with a $5.99 plan.
4. **Morph ID that admits uncertainty** (asks for two photos, fire state, explains evidence). That fits the community's real objection to AI ID better than a single confident label.

### Where Geck Inspect loses

1. **No app in the stores.** Every serious competitor except Breed Ledger has one, and "it keeps me on schedule" with phone reminders is the most praised thing in keeper app reviews.
2. **Not where the buyers are.** MorphMarket owns buyers; Palmstreet owns live auctions; Facebook owns morph ID questions. Geck Inspect has 56 accounts.
3. **No money handling.** Breed Ledger takes deposits and e-signs contracts; MorphMarket has MorphPay and invoices.
4. **No custom-domain breeder site and no registry.** GSGC and its show sit inside Breed Ledger.
5. **Reliability is unproven.** A large amount shipped on 2 to 3 October with no real-browser test, and the category's number one complaint is apps that lose records or miss reminders.

## 5. Unmet needs nobody serves well

1. **Honest crested trait confidence.** Every calculator and ID tool talks about crested "morphs" as if they were simple genes. A tool that labels each trait as proven gene, line-bred or visual descriptor, and shows confidence, is what experienced breeders respect. Geck Inspect's MORPH_CALCULATOR_PLAN already describes this; nobody has shipped it publicly.
2. **Crested price discovery.** "What is my Lilly White Harlequin worth?" has no good answer. MorphMarket just started showing sold prices but does not turn them into a price guide by trait, age and sex.
3. **Chain of custody for expensive animals.** Transfer with full history exists (ReptiDex, MorphMarket, iHerp), but nothing ties it to verified sales, reviews from real buyers and a printed passport. Geck Inspect has most of the pieces (passport, claim, reviews only from claimed transfers).
4. **Structure and conformation grading.** GSGC judges structure; no tool helps a breeder score head, crests, tail base and body against a standard. Photo-based scoring is a defensible crested-only feature (STRATEGY.md open opportunity 1 still holds).
5. **A keeper app that is simple and works offline.** Low commitment, no account to start, reminders that fire, a weight band that answers "is this normal?". Small single-purpose apps keep appearing because the big tools are built for breeders.
6. **Genetic testing.** No commercial DNA test exists for crested gecko traits or sex (searches found none; **unverified** that none exist). The crested gecko genome was published in 2024 to 2025 ([PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11797025/)). This is a long-term opening, not a near-term feature.

## 6. Pricing benchmarks and recommendation

| Product | Free tier | Hobby tier | Breeder tier | Top tier |
|---|---|---|---|---|
| Geck Inspect | 10 geckos, 1 Morph ID ever | Keeper $2.99/mo, $30/yr | Breeder $5.99/mo, $60/yr | Enterprise $99.99/mo (coming soon) |
| ReptiDex | 10 animals | Pro $4.99, $49.99/yr | Premium $9.99, $99.99/yr | |
| Breed Ledger | free site and directory | | Starter $29 | Professional $49; clubs from $49 |
| MorphMarket (ads) | Free | Hobbyist $3 to $5 | Basic $11 to $19 | Premium $45 to $80, Pro $70 to $125 |
| Husbandry.Pro | 5 animals | $4 (50), $9 (200) | $18 | $39, $99 |
| HerpTracker | 3 animals | $4.99 | $9.99 | |
| HatchLedger | 10 animals | | $39 | $79, $179 |
| The Reptile Keeper | 5 animals | £7.99 | | |
| Exotic Reptile Care | 5 animals | $5.99/mo, $29.99/yr | | |
| Cltch | Free | $9 | | |
| Palmstreet | | | 6.9% of sales | |

**Recommendation.** Keep Keeper at $2.99 and Breeder at $5.99. Tennyson rejected a Breeder raise on 9 July (DECISIONS.md: the low price is the point), and the research supports that: with 3 paying members, price is not the constraint; activation and trust are. Change the packaging instead:

1. **Lead with annual** on the Membership page ($30 and $60 a year read as "less than one cricket order a month").
2. **Retire the $99.99 Enterprise card** until there is something behind it. It is 3x Breed Ledger's top breeder plan and it makes the whole page look unserious next to $5.99.
3. **Add one optional step-up later, not now:** a "Storefront" add-on or tier at about $12 to $15 a month (custom domain on the breeder page, waitlist deposits if decision 33 is ever revisited). That still costs less than half of Breed Ledger's $29 Starter. Only build it once five breeders ask for a custom domain.
4. **Founding breeder offer:** a free Breeder year for the first 20 crested breeders who list at least 10 geckos and keep "Powered by Geck Inspect" on their page. Breed Ledger used the same lever (6 months free for its first 50).
5. **Make the free Morph ID try visible and generous enough to be shared** (see move 2). Geckistry's is free with no limit; one try ever is fine if the result is good and shareable.

## 7. Acquisition channels in this niche

Ranked by how much the crested gecko market seems to use them, based on what the competitors and the big breeders do.

1. **Facebook groups and breeder pages.** Where morph ID questions, sales and breeder reputations live. Top crested breeder pages have roughly 10,000 to 26,000 followers (Altitude Exotics, Tikis Geckos, Corch Geckos, Flawless; counts from a breeder ranking site and **unverified**: [CB Reptile](https://www.cbreptile.com/best-crested-gecko-breeders/)). Answering "what morph is this?" with a useful, shareable Morph ID card is the natural fit.
2. **Instagram.** Tikis Geckos is the largest crested account (reported 78,800 followers, **unverified**); most mid-size breeders have 5,000 to 25,000. Breeders post availability and pairings; a shareable pairing odds card or passport card is native content.
3. **MorphMarket.** Every breeder is there. The forum is the most searchable crested community. The bridge (export CSV, import from Animal Manager) is how breeders try another tool without leaving.
4. **Expos.** Repticon runs about 23 shows from October to December 2026 (Houston, Charlotte, Denver, Atlanta, Tampa, Costa Mesa, Orlando, Dallas and more; [calendar](https://repticon.com/calendar/)). NARBC Tinley Park is **10 to 11 October 2026**, with 291+ vendors ([NARBC](https://www.narbc.com/shows/tinley-park/october-2026/)). Next NRBE Daytona is August 2027. Expos are where QR passport cards on deli cups and tub labels get scanned by buyers.
5. **TikTok and YouTube.** #crestedgecko has about 160,000 posts on TikTok ([tag](https://www.tiktok.com/tag/crestedgecko?lang=en)); creators such as Omni Geckos post Highway and Cappuccino content. Short videos of Morph ID results, pairing odds and "is my gecko a healthy weight?" are cheap to make from the app itself.
6. **Live selling (Palmstreet, MorphMarket live).** Not an acquisition channel for software directly, but sellers there need fast lineage and passport links to show on stream.
7. **Search.** Breed Ledger and Dusty publish many "honest review" comparison pages and rank for "gecko breeding software". Geck Inspect's guides, calculator and Morph ID pages are its search surface. (Blog posts and articles are shelved; this means the existing tool and guide pages, not new posts.)

## 8. Ten moves, ranked by expected impact for a solo founder

1. **Make the daily loop reliable before anything else (impact: highest, size M).** Apply the deploy queue, then click through the core loop on a real phone: sign up, quick add with photo, log a feeding in Field Mode, get the reminder with the app closed, run Morph ID, claim a transfer (feature audit section 8). The category's number one complaint is lost records and silent reminders; with 7 weekly actives, one bad first week loses most of them.
2. **Turn Morph ID into a shareable front door (high, S to M).** No sign-up needed to see a first result; finish with a result card (photo, likely traits, confidence, "what this means") that people can post into a Facebook group "what morph is this?" thread, with a link back. Keep the honest framing: two photos, fire state, "visual traits, not proven genes". This competes directly with Geckistry's free tool on the thing breeders actually distrust.
3. **Hand-onboard 10 to 20 mid-size crested breeders (high, ongoing).** Skip Tikis (tied to GSGC and Breed Ledger). Target breeders with 1,000 to 15,000 followers who sell on MorphMarket or Palmstreet. Offer the founding breeder year, import their spreadsheet or MorphMarket CSV for them, and ask for one thing: put the Geck Inspect passport QR on every animal they sell. Each sale then brings a keeper into the app through the claim flow.
4. **Ship the iPhone app (high, L).** Finish native push, app links and the store listing (feature audit step 9). ReptiDex's main draw was the iPhone app; reminders on the lock screen are what keepers praise most. Android can follow, since ReptiDex still has none.
5. **Package the breeder page as "your crested gecko website for $5.99" (medium-high, S).** It mostly exists: breeder page, available geckos, waitlist with terms, verified badge, reviews from real transfers, inquiries inbox. Give it a clean URL, a "Powered by Geck Inspect" footer and a one-page explainer that compares it with a $29 website plan without naming anyone. That answers Breed Ledger's biggest pitch at a fifth of the price.
6. **Prove the MorphMarket bridge (medium, S).** Run the two-row Bulk Import test (feature audit step 19) and add an import from a MorphMarket Animal Manager export. Position Geck Inspect as "keep selling on MorphMarket, keep your crested records here". MorphMarket's new reminders make this more urgent: once breeders log there, switching cost rises.
7. **Show up at expos cheaply (medium, S each).** Tinley Park (10 to 11 October) is too soon to vend, but printed passport cards and rack label sheets can go home with partner breeders who vend there and at the Repticon shows through December. A table is not needed; the QR on the deli cup is the ad.
8. **Short video from the product itself (medium, S each).** Screen recordings of Morph ID results, Clutch Lab odds for a Lilly White pairing (with the lethal warning), the growth band answering "is 18 g normal at 8 months?". Post to TikTok, Instagram Reels and YouTube Shorts. These are not blog posts and do not touch the shelved blog pipeline.
9. **Ship one "only Geck Inspect" crested feature: trait confidence or a price guide (medium, M).** Either per-trait confidence labels (proven gene, line-bred, descriptor) across the calculator, Morph ID and gecko record, or a simple price guide by trait, age and sex once the market feed is back. Both answer top community questions and neither fits a multi-species tool.
10. **Clean up the pricing page and brand footprint (low-medium, S).** Annual first, Enterprise card hidden, founding breeder offer visible, and check whether the public Base44 "Geck Inspect" template page should come down. Update STRATEGY.md with section 1 of this document so future decisions start from current facts.

What not to do: chase Breed Ledger's deposits, contracts and club tooling (they need payments compliance and a club partner, and GSGC is taken), or add more species. Both dilute the crested-first position for little gain.

## Sources

Competitors: [Breed Ledger](https://breedledger.co/), [Breed Ledger pricing](https://breedledger.co/pricing), [Breed Ledger features](https://breedledger.co/features), [Breed Ledger reptile page](https://breedledger.co/for/reptile-breeders), [Breed Ledger vs MorphMarket](https://breedledger.co/compare/morphmarket), [Software Advice: Breed Ledger](https://www.softwareadvice.com/product/560018-Breed-Ledger/), [builtbydusty reptile stack](https://www.builtbydusty.com/reptile-software), [builtbydusty: best gecko breeding software 2026](https://www.builtbydusty.com/blog/best-gecko-breeding-software-2026), [ReptiDex](https://reptidex.com/), [ReptiDex App Store](https://apps.apple.com/us/app/reptidex/id6758026225), [Geckistry identify](https://geckistry.com/identify), [Geckistry on Breed Ledger](https://geckistry.breedledger.co/), [MorphMarket pricing](https://www.morphmarket.com/us/pricing/), [MorphMarket Spring/Summer 2026](https://community.morphmarket.com/t/spring-summer-2026-site-updates-features/62976), [MorphMarket live events](https://support.morphmarket.com/article/488-live-events), [MorphMarket Trustpilot](https://www.trustpilot.com/review/www.morphmarket.com), [Palmstreet fees](https://palmstreet.app/blog/fees-on-palmstreet), [Husbandry.Pro](https://husbandry.pro/), [HatchLedger pricing](https://hatchledger.com/pricing/), [The Reptile Keeper pricing](https://thereptilekeeper.com/pricing), [HerpTracker](https://herptracker.app/), [Cltch pricing](https://cltch.io/pricing/), [Day56](https://www.day56.com/), [Cretti](https://apps.apple.com/ca/app/cretti/id6759623382), [Crested Gecko ID](https://play.google.com/store/apps/details?id=se.grasberg.gecko_morph_app), [Exotic Reptile Care](https://apps.apple.com/us/app/exotic-reptile-care/id6753999852), [Reptile Records](https://reptilerecords.app/pro), [Reptile Buddy](https://apps.apple.com/us/app/reptile-buddy/id1508892560).

Community and market: [GSGC registry forum post](https://community.morphmarket.com/t/gold-standard-gecko-clubs-online-registry-is-live-crested-leopard-and-gargoyle-geckos/62988), [GSGC registry](https://www.goldstandardgeckoclub.com/post/gecko-registry-is-open-for-2026), [MorphMarket forum: record keeping](https://community.morphmarket.com/t/what-does-everybody-use-for-record-keeping/8836?page=3), [MorphMarket forum: collection apps](https://community.morphmarket.com/t/collection-breeding-apps/48836), [MorphMarket forum: what does my gecko cost](https://community.morphmarket.com/t/morph-what-does-my-gecko-cost/43969), [MorphMarket crested listings](https://www.morphmarket.com/us/c/reptiles/lizards/crested-geckos), [Rockstar Geckos on Cappuccino](https://www.rockstargeckos.com/single-post/cappuccinocrestedgeckos), [Pet Age on Palmstreet](https://www.petage.com/shopping-app-palmstreet-introduces-reptile-sales-from-40-sellers-to-live-marketplace/), [Repticon calendar](https://repticon.com/calendar/), [NARBC Tinley Park](https://www.narbc.com/shows/tinley-park/october-2026/), [TikTok #crestedgecko](https://www.tiktok.com/tag/crestedgecko?lang=en), [CB Reptile breeder rankings](https://www.cbreptile.com/best-crested-gecko-breeders/).
