# DRAFT: Crested gecko apps in 2026, an honest comparison

Status: **shelved 30 September 2026**, with all blog work, until Tennyson says otherwise. Do not edit, publish or build on it until then. Written 29 September 2026 and never published. When approved, this converts to one entry in `src/data/blog-posts.js` (fields below).

## Before publishing

**Fact-check list.** Every competitor claim, with where it came from. The sandbox that wrote this could not open competitor sites directly (blocked), so these come from search-result snippets of each company's own pages on 29 Sep 2026. Open each link and confirm before this goes live; prices change.

| Claim in the post | Source | Check |
|---|---|---|
| ReptiDex: iOS app and web, 137 species, Free up to 10 animals (100 weight records a year, 5 pairs), Pro $4.99/mo or $49.99/yr, Premium $9.99/mo or $99.99/yr; Pro adds QR codes, printable pedigrees, transfers and export | [App Store listing](https://apps.apple.com/us/app/reptidex/id6758026225), [reptidex.com](https://reptidex.com/) | [ ] |
| ReptiDex has a free crested gecko genetics calculator covering Cappuccino, Sable and Highway (32 alleles) | [reptidex.com/calculator/crested-gecko](https://reptidex.com/calculator/crested-gecko) | [ ] |
| ReptiDex, Breed Ledger and Geckistry share a founder (Dusty Mumphrey, Built By Dusty) | [builtbydusty.com/products/reptidex](https://www.builtbydusty.com/products/reptidex), [breedledger.co](https://breedledger.co/) | [ ] |
| Breed Ledger: multi-species breeder websites; Free (10 records, subdomain), Starter $29/mo (50 records, custom domain, waitlists, deposits, contracts, genetics), Professional $49/mo (unlimited); Stripe Connect payouts; the GSGC runs on it | [breedledger.co/for/reptile-breeders](https://breedledger.co/for/reptile-breeders), [Software Advice listing](https://www.softwareadvice.com/product/560018-Breed-Ledger/) | [ ] |
| Is Breed Ledger open to everyone yet, or still a waitlist? The snippets disagree | [breedledger.co](https://breedledger.co/) | [ ] |
| MorphMarket husbandry tools are free: collection manager, breeding plans, weight, feeding, shed and cleaning logs, bulk logging, QR labels | [MorphMarket blog, Nov 2024](https://www.morphmarket.com/blog/2024/11/13/morphmarket-husbandry/), [support article](https://support.morphmarket.com/article/302-animal-husbandry) | [ ] |
| HatchLedger: Free (10 animals, 2 pairs), Starter $39/mo, Pro $79/mo, Enterprise $179/mo; has a waitlist manager; its content leans to ball pythons. (STRATEGY.md said $19 to $99 in May; the prices may have changed) | [hatchledger.com/pricing](https://hatchledger.com/pricing/), [waitlist manager](https://hatchledger.com/bp-waitlist-manager/) | [ ] |
| The Reptile Keeper: UK-based, Free up to 5 animals, Plus £7.99/mo with the AI Shed Forecast, breeding and incubator tools. Phone apps on iOS and Android (STRATEGY.md; not reconfirmed) | [thereptilekeeper.com/pricing](https://thereptilekeeper.com/pricing) | [ ] |
| Geckistry: free AI morph identifier in beta, trained on images from its own breeding program | [geckistry.com/identify](https://geckistry.com/identify) | [ ] |
| Sable, Cappuccino and Highway are alleles of one incomplete-dominant gene | [MorphMarket Morphpedia: Sable](https://www.morphmarket.com/morphpedia/crested-geckos/sable/), Geck Inspect `/MorphGuide/cappuccino` | [ ] |

**Geck Inspect facts used** (checked against the code on 29 Sep): Free 10 geckos, Keeper $2.99/mo, Breeder $5.99/mo (`src/lib/stripe-config.js`); one free Morph ID per free account, 3 a month on Keeper, 6 on Breeder (`src/lib/tierLimits.js`); Morph ID eval run 20: breeder-tagged pattern in the top three 75.9% of the time, first answer 43.6% (VIP audit 2A); 18 g at 8 months is ahead of the typical 5.6 to 13.6 g (`src/lib/growthBand.js`); Lilly White x Lilly White loses 25% of eggs to the lethal super form (`/MorphGuide/lilly-white`, calculator pairing page); waitlists are Breeder-only and deposits are recorded, not processed (decision 33); no App Store app yet, the web app installs to the home screen.

**Tennyson, please decide:** the post names our own Morph ID accuracy. That is the honest version and it fits "sell with proof", but it is your call. If the Breeder price changes (decision 27), update the price table.

**Blog entry fields**
- slug: `crested-gecko-apps-2026`
- title (48 characters): Crested Gecko Apps in 2026: An Honest Comparison
- description (154 characters): Crested gecko apps compared for 2026: Geck Inspect, ReptiDex, Breed Ledger, MorphMarket, HatchLedger and more, judged on what each one knows about cresties.
- keyphrase: crested gecko app
- category: breeding
- tags: crested gecko app, crested gecko software, reptile breeding software, ReptiDex alternative, crested gecko records
- internal links: /MorphGuide/lilly-white, /MorphGuide/cappuccino, /GeneticsGuide, /CareGuide, /calculator, /blog/crested-gecko-weight-chart-by-age, /Membership
- external citations: the links in the fact-check table

---

## TL;DR

- Every app on this list can log a weight. The difference is what each one knows about crested geckos once the number is in.
- Geck Inspect is the only one built for crested geckos alone. ReptiDex, Breed Ledger, HatchLedger and The Reptile Keeper cover many species; MorphMarket is a marketplace with free record tools.
- For a breeder website that takes deposits by card today, Breed Ledger is ahead. For free logging next to your listings, MorphMarket. For crested gecko genetics, pricing from real listings and selling with a full record, Geck Inspect.
- Free tiers cluster around 10 animals. Paid plans run from $2.99 to $179 a month.
- Before you commit, export your data from the free tier and run one real pairing through two calculators.

---

Your Lilly White Harlequin is eight months old and weighs 18 grams. Every app on this list will draw that as a dot on a line. The question worth paying for is whether the app knows that 18 grams is ahead of the typical 5.6 to 13.6 grams for her age, and that pairing her to another Lilly White would cost you a quarter of the eggs.

So which apps actually know crested geckos, and which treat them as one species out of 137?

It matters because this is a long relationship. Crested geckos live 15 to 20 years ([care guide](/CareGuide)), and a breeder's records are what back up every sale: the weights a buyer asks for, the parents on the pedigree, the odds you quote before the eggs even drop. Moving years of records between apps later is the expensive part. Picking once, with your eyes open, is cheaper.

A note before the comparison. Geck Inspect publishes this blog, so weigh what we say about ourselves accordingly. Every competitor fact below comes from that company's own site as of September 2026, and we say plainly where each one is better than us.

## What each app is built around

The apps split by what they were built to do first, and that shapes everything else.

| App | Built around | Species | Where it runs |
|---|---|---|---|
| Geck Inspect | The business side of breeding: pricing, pairings, sales records | Crested geckos only | Web app that installs to your phone's home screen |
| ReptiDex | Husbandry and lineage records | 137 species | iOS app and web |
| Breed Ledger | A breeder website with waitlists, deposits and contracts, plus a registry for clubs | Dogs, reptiles, cats, livestock and more | Web |
| MorphMarket | The main reptile marketplace, with free record tools attached | Many species | Web and phone app |
| HatchLedger | Breeding operations for reptile facilities, up to multi-location | Many reptiles, with ball python content up front | Web |
| The Reptile Keeper | Care for keepers, with an AI shed forecast | Many species | Phone apps |
| Geckistry | A crested gecko breeder's free AI morph identifier (beta) | Crested geckos | Web |

ReptiDex, Breed Ledger and Geckistry come from the same founder, so they are built to work together. That is a real strength if you want one ecosystem, and worth knowing if you are comparing them as separate choices.

## Price, side by side

| App | Free tier | Paid plans |
|---|---|---|
| Geck Inspect | 10 geckos, one free Morph ID | Keeper $2.99/mo, Breeder $5.99/mo |
| ReptiDex | 10 animals, 100 weight records a year | Pro $4.99/mo, Premium $9.99/mo |
| Breed Ledger | 10 animal records, a subdomain site | Starter $29/mo, Professional $49/mo |
| HatchLedger | 10 animals, 2 breeding pairs | $39, $79 or $179/mo |
| The Reptile Keeper | 5 animals | Plus £7.99/mo |
| MorphMarket | Record tools are free | Selling has its own plans and fees |
| Geckistry | Morph identifier is free | Not a subscription |

The free tiers are close to identical, which makes them a good trial: ten animals is enough to find out whether an app fits how you work. The paid spread is wide because the products are different. Breed Ledger's price includes a website on your own domain; HatchLedger's top plan is built for multi-location facilities. Compare against the job you need done, not the number.

## Genetics: can it handle Cappuccino, Sable and Highway?

Crested gecko genetics has a trap that general tools get wrong. Sable, Cappuccino and Highway behave as versions of one incomplete-dominant gene, so a gecko carries at most two of them, and pairing two visuals can produce super forms with real health questions ([MorphMarket Morphpedia](https://www.morphmarket.com/morphpedia/crested-geckos/sable/), [our Cappuccino guide](/MorphGuide/cappuccino)). A calculator that treats them as separate genes will give you odds that cannot happen.

The good news is that crested gecko breeders have real options here. ReptiDex has a free crested gecko calculator that covers the Cappuccino complex, and MorphMarket has a free calculator of its own. Run the same pairing through two of them before you trust any one.

Geck Inspect's [calculator](/calculator) handles the complex, 66% and 50% possible hets, and the odds for a real two-egg clutch rather than a single egg. It also runs backwards: pick the gecko you want to hatch and it works out which pairings get you there. If your geckos are in your collection, it pulls both parents straight in, and every breeding plan shows what one egg is worth from the odds and current hatchling prices.

The pairing that shows why this matters is Lilly White x Lilly White: a quarter of the eggs are expected to be Super Lilly Whites that do not survive, for the same 50% Lilly White rate you get from pairing a Lilly White to a normal ([Lilly White guide](/MorphGuide/lilly-white), [genetics guide](/GeneticsGuide)). Any tool you use should say that before you pair, not after.

## Morph ID: free, and honest about misses

Two apps identify crested gecko morphs from a photo. Geckistry's identifier is free and in beta, trained on images from its own breeding program. Geck Inspect gives every free account one identification, then 3 a month on Keeper and 6 on Breeder.

Here is the number worth knowing. On our own test set of 220 geckos their breeders had already labeled, Geck Inspect's Morph ID puts the right pattern in its top three answers 75.9% of the time, and gets it first 43.6% of the time. Its most common misses are between close neighbors: Extreme Harlequin called Harlequin, and Pinstripe called Harlequin. And no photo can show a het.

So treat any photo ID, ours included, as a second opinion that narrows the list, not a label you can sell under. For photos, take both a fired-up and a fired-down shot; the same gecko can look like two different morphs.

## Records and daily care

For logging, the gap between apps is smaller than the marketing suggests. MorphMarket's free tools cover weights, feedings, sheds and cleanings, with bulk logging and QR labels for racks ([MorphMarket](https://www.morphmarket.com/blog/2024/11/13/morphmarket-husbandry/)). ReptiDex has a polished iOS app. The Reptile Keeper's paid plan adds an AI shed forecast.

What differs is whether the record knows the animal. Geck Inspect shades the healthy weight range for your gecko's age behind its weight chart, straight from the [care guide](/CareGuide), and says in plain words whether the last weigh-in is below, within or ahead of it (the numbers are in our [weight chart by age](/blog/crested-gecko-weight-chart-by-age)). A female gets a breeding-readiness badge from her weight and age, and the pairing screens warn you before you pair one who is not ready. Each gecko page also estimates the next shed window.

Where we are behind: there is no Geck Inspect app in the App Store yet. The web app installs to your home screen, works offline for your records and sends reminders, but if a native app is the deciding factor, ReptiDex and The Reptile Keeper have one today.

## Selling: where the money changes hands

This is where the apps differ most.

Breed Ledger is the strongest choice if you want your own breeder website with waitlists, deposits and contracts, and card payments paid out to you through Stripe. The Gold Standard Gecko Club runs on it, which matters if you show.

MorphMarket is where the buyers are: thousands of crested geckos are listed there at any time, and its record tools sit next to your listings.

Geck Inspect is built for the part before and after the listing: what a gecko is worth from thousands of crested gecko listings with the same traits, age and sex; which pairing is worth the eggs; what each season and pairing actually made after costs. When a gecko sells, you hand the buyer its passport, which transfers ownership with the full history, and a one-page buyer packet with weights, feedings, parents and fired-up and fired-down photos. Waitlists for a pairing show buyers the odds and record deposits under written terms, but we do not take card payments: buyers pay you directly.

## Our take: pick the app that knows the animal you sell

If crested geckos are your whole collection, pick the app that knows them. A multi-species app has to treat a Lilly White Harlequin and a banana ball python the same way, and the details that decide a sale (Cappuccino math, a lethal super, whether 18 grams is normal at eight months) are exactly where general tools thin out. That is the bet Geck Inspect makes, and it is why we do not add other species.

There are good reasons to disagree. If you keep ball pythons and leopard geckos alongside your cresties, one multi-species app beats three specialist ones, and ReptiDex or HatchLedger will serve you better. If you need a storefront that takes card deposits this month, Breed Ledger does that and we do not. And if all you want is free logging and you sell on MorphMarket anyway, MorphMarket's tools cost nothing.

## What to do this week

1. **Export before you commit.** On the free tier, add three geckos and export them. If the export is locked behind a plan, or missing weights and parents, that tells you how hard leaving will be.
2. **Run one real pairing through two calculators.** Use a pairing you are actually planning, with any possible hets. If the odds disagree, find out why before the eggs drop.
3. **Weigh everything and check it against age.** A number on a chart means little without the range for that age.
4. **Put deposit terms in writing.** Whatever app you use, write down what happens to a deposit if the pairing does not produce what the buyer asked for. Most deposit disputes start there.

## Back to the Lilly White Harlequin

Eighteen grams at eight months is a healthy, fast-growing gecko, and a pairing prospect once she reaches 40 grams and 18 months ([care guide](/CareGuide)). The right app tells you that without a search. It shows her growth against the range for her age, flags her as not ready to breed yet, warns you off a Lilly White x Lilly White pairing, and later hands her buyer the whole story in one link. Whichever app you choose, make it one that knows what she is.

## FAQ

**What is the best app for crested geckos?**
It depends on the job. For crested gecko genetics, pricing from real listings and selling with a full record, Geck Inspect is built for crested geckos only. For a breeder website with card deposits, Breed Ledger. For free logging next to your listings, MorphMarket. For a native iPhone app across many species, ReptiDex.

**Is there a free crested gecko app?**
Yes. Geck Inspect, ReptiDex and Breed Ledger each have a free tier of about 10 animals, MorphMarket's record tools are free, and Geckistry's morph identifier is free. The Reptile Keeper's free tier covers 5 animals.

**Does ReptiDex work for crested geckos?**
Yes. ReptiDex covers 137 species, crested geckos included, and has a free crested gecko genetics calculator that handles the Cappuccino, Sable and Highway complex. It is a general records app rather than one built only for crested geckos.

**Can an app identify my crested gecko's morph from a photo?**
Partly. Geckistry and Geck Inspect both identify morphs from photos, but no photo can show a het, and neighbors like Extreme Harlequin and Harlequin get mixed up. Geck Inspect puts the right pattern in its top three about three times in four. Use it as a second opinion.

**Which app handles Cappuccino and Sable genetics correctly?**
Geck Inspect and ReptiDex both have free crested gecko calculators that treat Cappuccino, Sable and Highway as one gene. MorphMarket has a free calculator too. Geck Inspect adds possible hets, two-egg clutch odds and a reverse mode that finds pairings for a target gecko.

**Can I take deposits through a crested gecko app?**
Breed Ledger takes card payments and pays them out to you. Geck Inspect's waitlists record deposits under written terms, with buyers paying you directly. MorphMarket handles sales on its own marketplace.
