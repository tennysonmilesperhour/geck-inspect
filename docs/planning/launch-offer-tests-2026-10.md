# Launch offer tests, October 2026

Written 20 October 2026, for the App Store launch. It turns what we learned from One Peak Creative's Format Finder funnel into tests for Geck Inspect: which promised outcome sells the plans, which comparisons earn sign-ups, counted proof, and a free taste before the sale. One Peak's own pages could not be read from the sandbox, so the lessons come from search-indexed copy, their comparison pages, their App Store listing and Trustpilot.

The homepage is not touched. The homepage A/B test (docs/planning/homepage-ab-test-2026-10.md) is still running, and its rules do not allow edits to either arm mid-run. Everything here runs on other surfaces.

## 1. Promised-outcome test (membership page and iPhone paywall)

**What changes.** The headline above the plans. Everything below it (plans, prices, trial, legal lines) is the same in every arm.

| Variant | Headline | What backs it |
| --- | --- | --- |
| `control` | "Plans for every crested gecko collection" (web) / "Geck Inspect membership" (iPhone) | current copy |
| `sell` | Sell every clutch with records buyers trust | waitlists with deposit terms and the MorphMarket CSV (Breeder), lineage |
| `price` | Price every hatchling from real market listings | Price Index value estimates; Keeper's estimated value on Morph ID |
| `pairings` | Plan pairings that produce the morphs you want | genetics calculator; Keeper 5 pairs, Breeder unlimited |
| `care` | Keep every gecko on track, from hatchling to breeder | growth band, logs, reminders; Keeper 50 geckos |

The copy lives in `src/lib/outcomePromise.js`. Each lead sentence names the plan that delivers the promise, and a test holds them to that (`src/lib/__tests__/outcomePromise.test.js`).

**Who is in it.** Visitors and free members on `/Membership`, on the web and in the iPhone app. Members who already pay, grandfathered members, the Stripe return screen, guests in the demo, and anyone without analytics consent are left out and see control without being counted. If PostHog gives no answer within 1.5 seconds, the visitor sees control and is not counted. Every arm waits the same way, so a slow connection does not favor one arm.

**Exposure and outcomes.**
- Exposure: PostHog's `$feature_flag_called` for `paywall-outcome-v1`, sent when the headline is on screen, plus `paywall_outcome_viewed` with `variant` and `surface` (`web` or `ios`).
- Web: `checkout_started` carries `paywall_outcome`; `checkout_completed` already exists.
- iPhone: new `native_purchase_started` and `native_purchase_completed` (with `tier`, `interval`, `paywall_outcome`).
- The flag's arm is also registered on the PostHog person, so later events carry it.

**Set it up in PostHog (Tennyson, about 3 minutes).** Until the flag exists, every visitor sees control and nothing is counted, so the code can ship first.

1. https://us.posthog.com/project/376510/experiments/new
2. Name: `Paywall promised outcome`. Feature flag key: `paywall-outcome-v1`.
3. Variants, 20% each: `control`, `sell`, `price`, `pairings`, `care`.
4. Release conditions: 100% of users. Leave "persist flag across authentication steps" on.
5. Primary metric: `checkout_started` (trend, unique users). Add `native_purchase_started` as a second primary metric.
6. Secondary metrics: `checkout_completed` and `native_purchase_completed`.
7. Exposure: the default (`$feature_flag_called`).
8. Launch.

**How to read it.** Traffic is small: 97 anonymous homepage visitors and 3 paying members in the last month. Five arms will not reach significance for months. Read it like this: after 4 complete weeks, look at which arm leads on `checkout_started` and how far behind the others are, then drop the clear losers and keep running two or three arms. Do not edit a headline while it is running. A changed headline is a new arm.

**App Store test with real traffic (Tennyson, after the app is live).** Apple's Product Page Optimization tests screenshots on the App Store page itself, which gets far more traffic than the paywall. It runs in App Store Connect, under the app, then Product Page Optimization. Use the same promises so the two tests agree:

| Treatment | Caption on the first screenshot |
| --- | --- |
| Original | current screenshots |
| A | Sell every clutch with records buyers trust |
| B | Price every hatchling from real market listings |
| C | Plan pairings that produce the morphs you want |

Apple allows up to 3 treatments and shows the winner by conversion to download. Keep the remaining screenshots identical across treatments, so only the promise differs.

## 2. Comparison pages

**What shipped.** `/compare` and six pages, one per comparison:

| Page | Who searches for it |
| --- | --- |
| `/compare/spreadsheet` | keepers and breeders still on Google Sheets or Excel |
| `/compare/morphmarket-animal-manager` | MorphMarket sellers |
| `/compare/breed-ledger` | breeders who saw Breed Ledger's comparison pages |
| `/compare/reptidex` | ReptiDex users, whose maker moved development to Breed Ledger |
| `/compare/husbandry-pro` | keepers of many species weighing a general app |
| `/compare/chatgpt-morph-id` | people asking a chatbot "what morph is this?" |

The copy lives in `src/data/comparisons.js` and the page is `src/pages/Compare.jsx`. Every page says where the other tool is the better pick, and every named product has a source link. Geck Inspect's prices are filled in from `stripe-config.js`, so they never go stale. The pages are in the sitemap, the prerender (with the table in the static HTML), the edge allowlist, `llms.txt` and the public footer.

**Before merging: recheck the competitor numbers.** They come from docs/planning/competitive-landscape-2026-10.md (search summaries from 5 October). The sandbox could not open the competitors' sites. Open each source link on its page and confirm the price and the claim. The iPhone column ("Web and iPhone" on the Husbandry.Pro page) assumes the app is live on the App Store.

**How the test works.** No flag is needed: each page is its own arm. Events:
- `compare_viewed` with `slug` (including `hub`)
- `content_cta_viewed` and `content_cta_clicked` with `cta` = `compare-<slug>` (hero button and the end-of-page panel)
- `signup_completed` is credited to the page through the existing signup attribution (`rememberSignupCta`)
- Weekly Gecko Notes sign-ups from the panel carry `source` = `compare-<slug>`

**Reading it after 6 to 8 weeks.** In PostHog: `compare_viewed` by `slug` (which comparisons people find), `content_cta_clicked` by `cta` (which ones persuade), and sign-ups by first-touch CTA. Search Console shows which queries each page ranks for. Grow the pages that earn clicks (more rows, a FAQ, links from guides). Leave the rest alone; deleting a page loses its search history.

## 3. Named method and counted proof

The Price Index is the named, countable method, the way "65+ proven formats" is for One Peak. A new line reads the live count from `/data/price-index.json`: "The Geck Inspect Price Index is built from 10,244 crested gecko asking prices in 4 markets, last checked 6 October 2026." It is on `/Membership` (all arms, so it does not bias the test) and on the comparison pages. It hides itself when the file is missing, has under 1,000 listings, or is more than 45 days old (`src/lib/priceIndexProof.js`). The Morph Guide count (47) is held true by a test.

Do not invent or round up member counts. When `landing_stats` passes a believable size, add it the same way.

## 4. Free taste before the sale

One Peak's free AI idea tool collects an email and hands over to a sales sequence. Our version needs two parts:

- **Shipped:** the comparison pages end with the account prompt and the Weekly Gecko Notes sign-up (double opt-in, already live on the guides).
- **Not shipped, needs a design first:** one Morph ID for a signed-out visitor, with the result sent by email. Today Morph ID needs an account (`recognize-gecko-morph` requires a signed-in token). Allowing it means anonymous sign-in or a new token path, spend caps, abuse limits and an RLS audit. That is a separate task with its own design document.

## 5. Pricing framing (suggestion, not built)

One Peak discounts the first month, pushes annual at 50% off, and puts a $97 tier on top to make the middle one look reasonable. Copying that here would backfire: a discount on $2.99 says nothing, and a fake top tier makes $5.99 look unserious (the reason Enterprise was taken off sale). What would work better:

1. **Anchor on what a gecko sells for, not on a bigger plan.** The US median asking price in the Price Index is $250. Breeder is $60 a year, under a quarter of one typical gecko. "Breeder costs less than a quarter of one typical crested gecko" is true, counted and specific to crested geckos, and no competitor can say it about their own data.
2. **Default to annual and show it per month.** "$60 a year, $5 a month" with annual pre-selected. The annual saving is 16 to 17% today; say the dollar amount, not the percentage.
3. **Put the free trial on annual only (iPhone).** In App Store Connect, set a 7-day free introductory offer on the two annual products and none on monthly. The trial then pulls people toward the plan that retains.
4. **Use lifetime as the web anchor.** Show Lifetime Breeder at $349 next to $60 a year. It makes annual look small without inventing anything.
5. **Real scarcity only.** The founding breeder offer from the landscape research (a free Breeder year for the first 20 crested breeders who list 10 geckos) is honest urgency. Show the real count left ("14 of 20 left") and stop when it reaches zero.
6. **Never contradict the refund terms.** One Peak's sales page shows a guarantee that its refund policy denies, and that is where most of its bad reviews come from. On iPhone, Apple handles refunds. On the web, the 7-day trial and cancel-anytime are the promise; say nothing stronger.

Decisions for Tennyson: 1, 2, 3 and 5. Point 3 is a setting in App Store Connect. The others are copy and layout changes to `/Membership` and the paywall. They should wait until the outcome test has picked its arms, because changing the price display mid-test would muddy it.
