# P2 — Market Pricing Intelligence

**Priority:** P2
**Dependencies:** P1 (Animal Passport — animals must exist)
**Origin:** Original spec, enhanced by iHerp analysis (transfer -> sale price contribution loop)

---

## What It Is

A live pricing layer showing what morphs are selling for and how values trend over time. Breeders can see market comps for their animals, track portfolio value, log actual sale prices, and set for-sale prices with market context visible.

Data comes from two sources:
1. **User-submitted actual sale prices** (anonymized, opted-in)
2. **Curated price guide data** (from tennyscrestedgeckos.com investment guide)

**Key integration from iHerp analysis:** When a transfer is completed (P1), prompt user to contribute sale price to market data. This closes the loop between the two features.

---

## Data Model

```
MorphPriceEntry {
  id:               UUID
  base_morph:       string
  morph_traits:     array of strings
  pattern_grade:    enum [pet, breeder, high_end, investment]
  sex:              enum [male, female]
  age_category:     enum [hatchling, juvenile, subadult, adult]
  sale_price:       decimal
  sale_date:        date
  source:           enum [user_submitted, curated_guide]
  submitted_by:     UUID nullable → User
  is_anonymous:     boolean
  verified:         boolean  (admin flag for curated entries)
  notes:            text
  created_at:       timestamp
}

PriceAlert {
  id:               UUID
  user_id:          UUID → User
  morph_query:      string
  target_price:     decimal
  direction:        enum [above, below]
  is_active:        boolean
  last_triggered:   timestamp nullable
  created_at:       timestamp
}

CollectionValuation {
  id:               UUID
  user_id:          UUID → User
  snapshot_date:    date
  total_value:      decimal
  animal_valuations: JSONB  (map of animal_id → estimated_value)
  created_at:       timestamp
}
```

### Seed Data

| Category | Price Range |
|----------|------------|
| Pet grade hatchling | $50-150 |
| Breeder juvenile | $150-400 |
| High-end Harlequin adult female | $400-1,200 |
| Investment Extreme Harlequin | $800-3,000 |
| Lilly White hatchling | $300-800 |
| Lilly White adult | $600-2,000+ |
| Axanthic (grade/age dependent) | $200-600 |

---

## UI Spec

### Market Overview Page (`/market`)

- **4 stat cards:** Median price (all, 90 days) / Most active morph / Highest avg sale / 90-day trend (up/down arrow + %)
- **Filterable price table:** Morph | Grade | Low | Median | High | Sales | Trend sparkline
- Click row: expands to price histogram + 5 recent anonymized sales
- **Filters:** sex, age, pattern grade
- **"Log a sale" button** (Sage accent)

### Animal Valuation Card (component embedded in passport)

`<MarketValueCard animalId={id} />`

- Estimated value range (low-high), 3 comparable sales, asking vs market gap
- 6-month trend chart for this morph/grade/sex/age combination
- If <3 comps: "Not enough data yet — be the first to log a sale"

### Portfolio Value Banner (component embedded in collection page)

`<PortfolioBanner userId={id} />`

- Total estimated collection value, donut chart by morph category, month-over-month delta
- "Update valuation" button

### Log a Sale Modal

- Animal select (own animals) or manual entry, morph/sex/age auto-populated
- Sale price, date, buyer location, anonymous contribution checkbox (default ON)

---

## Claude Code Prompt

```
Build the Market Pricing Intelligence feature for Geck Inspect.

DESIGN SYSTEM: [PASTE GLOBAL DESIGN SYSTEM]

CONTEXT: Animal Passport (P1) is already built. The animals table exists with morph,
pattern_grade, sex, and care log data. This feature adds market pricing on top.
When a transfer is completed (P1 flow), there is already a prompt asking the user
to contribute the sale price to market data — that contribution lands in morph_price_entries.

DATABASE — create these tables:
[PASTE MorphPriceEntry, PriceAlert, CollectionValuation models]

BUILD:
1. MARKET PAGE (/market): 4 stat cards, filterable morph price table with sparkline trend
   column, expandable rows showing price histogram + recent anonymized sales.
   "Log a sale" button top right.

2. MarketValueCard COMPONENT: embed in passport page (P1). Shows value range, 3 comps,
   asking vs market gap, 6-month trend chart. Graceful empty state if <3 comps.

3. PortfolioBanner COMPONENT: embed at top of collection page. Total value, donut chart
   by morph category, month-over-month delta, "Refresh valuation" button.

4. LOG A SALE MODAL: animal select or manual, auto-populate morph/sex/age,
   sale price + date + location, anonymous checkbox (default ON).

5. PRICE ALERTS (/settings/alerts): list of user alerts, "Add alert" form (morph,
   price, above/below direction), active toggle per alert.

QUALITY: Price table must be scannable — breeders compare morphs at a glance.
Trend indicators: green arrow >5% up, red arrow >5% down, gray dash +/-5%.
All prices in USD $X,XXX.XX format. Charts handle sparse data gracefully.
Anonymous means anonymous — never expose submitted_by on any public view.
```
