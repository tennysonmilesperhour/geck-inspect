# Pricing decision memo, 2026-07

Status: recommendation for review. Numbers are illustrative models, not
forecasts. No prices are changed by this memo; it proposes a change and a
migration path.

## 1. Current state

From `src/lib/stripe-config.js` and `src/lib/tierLimits.js` /
`PlanLimitChecker.jsx`:

| Tier | Monthly | Annual | Lifetime | Core unlocks vs the tier below |
|---|---|---|---|---|
| Free | $0 | $0 | $0 | 10 geckos, 1 pair, 5 other reptiles, 1 AI Morph ID/mo, 1 GB, forum, public profile |
| Keeper | $2.99 | $30 | $149* | 50 geckos, 5 pairs, 10 reptiles, 3 Morph IDs/mo, 10 GB, lineage tree, calendar, weight charts, CSV export |
| Breeder | $5.99 | $60 | $349* | Unlimited geckos/pairs/reptiles, 6 Morph IDs/mo, breeding analytics, MorphMarket sync, white-label certificates, featured breeder, shipping integration |
| Enterprise | $99.99 | $1,000 | n/a | 15 Morph IDs/mo, market intelligence, breeding ROI, AI image import |

*Lifetime price_ids are currently null in stripe-config, so lifetime is
not actually purchasable and is hidden in the UI (Phase 1.3).

## 2. Value-per-tier audit

What a paying tier gets that the tier below does not, and whether that
value is actually real today (several facade/gating bugs were fixed in
Phases 1 to 2, which is a precondition for charging more):

- **Keeper over Free:** 5x the collection, the lineage tree, feeding
  groups, weight charts, CSV export, 3x Morph IDs. All real and working.
  This is a genuine hobbyist upgrade.
- **Breeder over Keeper:** unlimited collection, MorphMarket CSV sync,
  white-label certificates, featured-breeder placement, shipping
  integration, breeding analytics. Status after recent fixes:
  - MorphMarket sync: now correctly included in Breeder (was mis-gated
    to Enterprise-only; fixed Phase 1.3). Real.
  - Certificates / featured breeder / breeding analytics: real.
  - Shipping integration: gated behind `shipzeros-proxy`, which is NOT
    deployed (Phase 2.1 guard). This Breeder feature does not work yet.
- **Enterprise over Breeder:** market intelligence, breeding ROI, image
  import. Status:
  - Market Analytics still renders labeled preview/sample data, not a
    live market feed (Phase 1.5 removed the dishonest upsell). So
    Enterprise's headline differentiator is not fully real yet.
  - Breeding ROI, image import: real.

**Precondition for any raise:** do not raise a tier whose new-money value
is a feature that does not work. Breeder is defensible to raise now (its
value is real bar shipping). Enterprise should NOT be pushed until the
market-intelligence data is live.

## 3. Market context (from STRATEGY.md)

The market has settled at: hobbyist $4.99 to $7.99/mo, serious breeder
$9.99 to $19/mo, pro/ops $49 to $99/mo. Direct comparables: ReptiDex
$4.99, The Reptile Keeper ~$10, HatchLedger $19 to $99, Breed Ledger
(launched 2026-05-15). Geck Inspect's Keeper ($2.99) and Breeder ($5.99)
both sit BELOW the market band. Breeder in particular is priced like a
hobbyist tier while delivering serious-breeder features.

## 4. Three scenarios with revenue math

Modeled at 100 / 500 / 2000 paying users, with an illustrative paid mix
of 65% Keeper, 33% Breeder, 2% Enterprise (monthly-equivalent; annual and
lifetime are ignored for simplicity). ARR = blended monthly ARPU x users
x 12.

**A. Keep current prices** (Keeper $2.99, Breeder $5.99, Ent $99.99)
Blended ARPU = 0.65(2.99) + 0.33(5.99) + 0.02(99.99) = **$5.92/mo**.
- 100 users: ~$592/mo, ~$7.1K ARR
- 500 users: ~$2,960/mo, ~$35.5K ARR
- 2000 users: ~$11,840/mo, ~$142K ARR

**B. Market-align both** (Keeper $4.99, Breeder $9.99, Ent $99.99;
grandfather existing subscribers)
Blended ARPU = 0.65(4.99) + 0.33(9.99) + 0.02(99.99) = **$8.54/mo**.
- 100 users: ~$854/mo, ~$10.2K ARR
- 500 users: ~$4,270/mo, ~$51K ARR
- 2000 users: ~$17,080/mo, ~$205K ARR

**C. Keep Keeper as a wedge, raise Breeder only** (Keeper $2.99,
Breeder $9.99, Ent $99.99; grandfather existing)
Blended ARPU = 0.65(2.99) + 0.33(9.99) + 0.02(99.99) = **$7.24/mo**.
- 100 users: ~$724/mo, ~$8.7K ARR
- 500 users: ~$3,620/mo, ~$43.4K ARR
- 2000 users: ~$14,480/mo, ~$174K ARR

Scenario C recovers ~85% of B's revenue lift while keeping the cheapest
possible entry price for the 80%-of-market keeper segment.

## 5. Recommendation: Scenario C

Keep **Keeper at $2.99** and raise **Breeder from $5.99 to $9.99**
(annual $60 to $100), grandfathering all existing subscribers.

Why:
1. **Keeper is an acquisition weapon at $2.99.** It undercuts ReptiDex
   ($4.99) and everything else, which matters because the strategy is
   keeper-first and 80%+ of the market are keepers, not breeders. A cheap
   wedge that converts free users is worth more than the marginal $2/mo.
2. **Breeder is badly underpriced at $5.99.** Breeders are the least
   price-sensitive segment and get the most value (unlimited collection,
   MorphMarket sync, certificates, analytics). $9.99 is still at the
   bottom of the $9.99 to $19 serious-breeder band, so it reads as a
   deal, not a gouge, and it roughly doubles Breeder ARPU.
3. **Enterprise stays $99.99 but is not marketed** until its
   market-intelligence data is live. Charging $100/mo for preview data is
   the exact trust risk Phase 1.5 addressed; do not undo it with a push.

Do NOT do full market-align (B) yet: raising Keeper to $4.99 sacrifices
the wedge advantage that is the whole keeper-first thesis, for a smaller
incremental gain than fixing Breeder delivers.

## 6. Migration plan

1. **Ship the value first.** Before raising Breeder, either deploy the
   `shipzeros-proxy` function so shipping integration works, or drop
   shipping from the advertised Breeder feature list. Do not raise a
   price on a feature list that includes a broken feature.
2. **Create new Stripe prices** for Breeder monthly ($9.99) and annual
   ($100). Do not edit the existing Stripe prices (that would change what
   current subscribers pay).
3. **Grandfather:** keep the old Breeder `price_id`s mapped so existing
   subscribers keep $5.99. New checkouts use the new price_ids. In
   `stripe-config.js`, point `TIER_PRICING.breeder` at the new prices;
   the webhook already writes `membership_tier`, so entitlement is
   unaffected.
4. **Announce** in-app and by email to the free/Keeper base a week ahead:
   "Breeder is becoming $9.99 on <date>. Lock in $5.99 for life by
   subscribing before then." This turns the raise into a conversion
   event.
5. **Monitor** RevenueCat/Stripe for 30 days: Breeder new-sub conversion,
   churn, and free to Keeper conversion (should be unaffected).

## 7. Open questions for Tennyson

- Is the 65/33/2 paid mix roughly right, or is the real base more
  keeper-heavy? (Shifts the ARR numbers, not the recommendation.)
- Should there be a mid tier between Breeder ($9.99) and Enterprise
  ($99.99)? The gap is large. A "Business" tier around $19 to $29 (the
  HatchLedger band) could catch small commercial breeders once the
  market-analytics data is real.
- Lifetime: re-enable it (add real price_ids) or retire the concept?
  Right now it is shown-then-hidden dead weight.
