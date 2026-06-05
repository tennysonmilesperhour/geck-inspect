# Market snapshot fix: geck-data → Business Tools analytics

Status: diagnosed, fix lives in the **geck-data** repo (not this one).

## Symptom

Business Tools → Market Analytics shows almost nothing. Arbitrage, Supply,
and Breeders are empty; Regional only has a US column; Overview and Combos
render thin, ask-price-only numbers for a handful of combos.

## What is actually happening

The in-app analytics is wired correctly and the pipeline is live. The
problem is the data the snapshot publishes, not the fetch.

The consumer (this repo) reads a JSON snapshot from
`https://geckintellect.geckinspect.com/data/market.json`
(see `MARKET_SNAPSHOT_URL` in `src/lib/constants.js`). The expected schema
is documented at the top of `src/lib/marketAnalytics/queries.js`.

As of this writing the live snapshot returns:

- ~23 transactions total (the DB has 9,000+ priced listings)
- every row `status: "listed"`, `sold_price: null`
- every row `region: "US"`, `breeder_id: "unknown"`,
  `age_class: "unknown"`, `lineage_tier: "unknown"`
- `breeders`, `supply_pipeline`, `demand_signals`, `market_events` all empty

So the generator is emitting a tiny sample and flattening every dimension
the charts depend on to "unknown". The data to fill these fields already
exists in the geck-data database; the generator just is not mapping or
including it.

## The data exists (geck-data Supabase, project `dhotmtgryuovkmsncdby`)

Two listing tables hold the source data. The generator currently appears to
read the sparser one.

`public.market_listings` (~9,295 rows)
- `current_status`: live = 9,214, sold = 81
- `price_usd_equivalent`: 9,084 priced
- `seller_id`: 314 distinct sellers; `seller_name`, `seller_location`
- `seller_location` present on 1,007 (format: "Iowa City, IA")
- `maturity` on 722 (values like "Baby", "Juvenile")
- `norm_traits` on 689 (space-joined tokens, e.g. "harlequin lavender")
- `bpg_tier`, `proven_breeder`, `birth_year/month/day`, `weight`,
  `first_seen_at`, `last_seen_at`, `first_listed_at`, `original_price`

`public.listings` (~9,373 rows) - richer for sold + traits
- sold (`sold_at is not null`) = **2,144**
- `trait_array` present on **6,037**
- `availability`: InStock 5,974, OutOfStock 116
- `seller_name`, `seller_slug`, `origin`, `maturity`, `weight_grams`,
  `birth_date`, `traits`, `price`, `currency`, `first_seen_at`,
  `last_seen_at`, `last_updated_at`

Supporting tables: `public.market_sellers` (~910, with `seller_location`,
`price_tier`, `morph_specialization`, `first_seen_listing`),
`public.combo_catalog` (12 combos with `tokens`),
`public.crested_morph_taxonomy` (42), `public.price_history` (~35k),
`public.listing_status_events` (status transitions),
`public.price_drops` (~2,122).

## Field mapping the generator should produce

Target shape per transaction (matches `queries.js`):

```
{ id, combo_id, combo_name, traits, primary_morph, region, age_class,
  lineage_tier, breeder_id, breeder_name, status, ask_price, sold_price,
  time_on_market_days, date, source_id }
```

| snapshot field        | source column / rule |
|-----------------------|----------------------|
| `id`                  | `'mm_' || morphmarket_key` (current pattern) |
| `status`              | `current_status`: `live` → `"listed"`, `sold` → `"sold"` (or `is_sold` / `sold_at` in `listings`) |
| `ask_price`           | `price_usd_equivalent` (fallback `original_price`) |
| `sold_price`          | `price_usd_equivalent` when sold, else `null` |
| `region`              | parse `seller_location`: trailing US state code → `"US"`; map known countries → `EU/UK/CA/AU/JP/SE/SEA`; else `"US"` for now |
| `age_class`           | lower(`maturity`): Baby → `baby`, Juvenile → `juvenile`, Sub-adult → `subadult`, Adult → `adult`; if `proven_breeder` then `proven_m`/`proven_f` |
| `lineage_tier`        | from `bpg_tier` / `market_sellers.price_tier`; default `"unknown"` |
| `breeder_id`          | `seller_id` (stop hardcoding `"unknown"`) |
| `breeder_name`        | `seller_name` |
| `traits` / `combo_id` / `combo_name` / `primary_morph` | tokenize `norm_traits` (or `listings.trait_array`), match against `combo_catalog.tokens` to resolve a combo; `primary_morph` = highest-tier token via `trait_tiers` |
| `time_on_market_days` | for sold rows: `sold_at - first_seen_at` in days (or via `listing_status_events`) |
| `date`                | `first_listed_at` (fallback `first_seen_at`) |
| `source_id`           | `external.morphmarket` for scraped, `internal.*` for manual |

Also populate the currently-empty top-level arrays:

- `breeders[]` from `market_sellers`: `{ id: seller_id, name: seller_name,
  tier: price_tier, region: <parsed seller_location>, active_since:
  first_seen_listing, specialties: morph_specialization }`. Without this,
  the Breeders view stays empty (the consumer filters out
  `breeder_id === 'unknown'` on purpose).
- `supply_pipeline[]`, `demand_signals{}`, `market_events[]`: forward-looking
  and lower priority. `demand_signals` could be derived from
  `likes_count` / `saved_count` trends or `user_events`; `supply_pipeline`
  from `breeding_pairs` / `clutches` once populated; `market_events` from
  `show_mentions`. Fine to ship these empty in a first pass.

## Priority order (highest impact first)

1. **Remove the row cap.** Emit all recent priced listings (thousands),
   not ~23. This alone transforms every Overview/Combos/Regional chart.
2. **Region** from `seller_location` (unlocks Regional + Arbitrage; the
   latter needs at least two regions with samples).
3. **Breeder** attribution from `seller_id`/`seller_name` plus the
   `breeders[]` array from `market_sellers` (unlocks Breeders view).
4. **status + sold_price** from `current_status`/`is_sold`. Prefer or join
   `public.listings` for its 2,144 sold rows and 6,037 trait rows rather
   than `market_listings` (81 sold, 689 traits). Confirm which table the
   generator currently reads and which is canonical.
5. **age_class** from `maturity`.
6. **Combo coverage** by tokenizing `listings.trait_array` against
   `combo_catalog`, not just `market_listings.norm_traits`.

## Reference query (transactions array, market_listings)

Starting point the generator can adapt. Region/age/combo mapping is shown
inline; move it to the generator code or SQL helper functions as preferred.

```sql
select
  'mm_' || morphmarket_key                              as id,
  case when current_status = 'sold' then 'sold' else 'listed' end as status,
  price_usd_equivalent                                  as ask_price,
  case when current_status = 'sold' then price_usd_equivalent end as sold_price,
  case
    when seller_location ~* ',\s*[A-Z]{2}$' then 'US'   -- US "City, ST"
    else 'US'                                           -- TODO country map
  end                                                   as region,
  lower(coalesce(maturity, 'unknown'))                  as age_class_raw,
  coalesce(seller_id, 'unknown')                        as breeder_id,
  coalesce(seller_name, 'Unknown')                      as breeder_name,
  norm_traits                                           as traits_raw,
  coalesce(first_listed_at, first_seen_at)              as date,
  'external.morphmarket'                                as source_id
from public.market_listings
where price_usd_equivalent is not null
  and last_seen_at > now() - interval '12 months';
```

Combo resolution (`combo_id`, `combo_name`, `primary_morph`) and the
`time_on_market_days` join are left to the generator so the combo catalog
and tier tables stay the single source of truth.

## Notes for the consumer side (this repo)

`src/lib/marketAnalytics/queries.js` already has fallbacks that lean on
`ask_price` when `sold_price` is missing and that hide `unknown` breeders,
so the views will improve automatically as the snapshot fills in, with no
change required here. One optional follow-up: the "Live data" banner
(`src/components/market-analytics/MarketAnalytics.jsx`) shows green even
when the snapshot is live-but-thin; it could surface a "limited data"
state so an empty chart does not read as a bug.
