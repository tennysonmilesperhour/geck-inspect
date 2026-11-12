# P2: Market Pricing Intelligence

> **Status, 11 November 2026: Partly built, and Dated.** Prices now come from asking-price listings (the trait value table), not from seeded guide data. The seed price table in this spec was deleted from the database on 28 September; do not use or re-seed it, and the guide it names belongs to an unrelated breeder. The portfolio banner and price alerts were never built. What shipped: `/Market`, `src/pages/MarketPricing.jsx`, `src/pages/Portfolio.jsx`, the value card on the gecko record. The paste-ready build prompt that ended this file was removed on 12 November 2026 (git keeps it).

> **Design note (15 October 2026, shortened 12 November 2026):** this spec was written for a set of fonts and a green colour palette that never shipped. The lines that set them out were in the build prompt, which has been removed. Any colour name still in the text below (sage, forest, ember gold) comes from that palette: ignore it. Use `docs/specs/DESIGN-SYSTEM.md`, which describes the shipped theme tokens.

**Priority:** P2
**Dependencies:** P1 (Animal Passport, animals must exist)
**Origin:** Original spec, enhanced by iHerp analysis (transfer -> sale price contribution loop)

---

## What It Is

A live pricing layer showing what morphs are selling for and how values trend over time. Breeders can see market comps for their animals, track portfolio value, log actual sale prices, and set for-sale prices with market context visible.

Data comes from two sources:
1. **User-submitted actual sale prices** (anonymized, opted-in)
2. **Curated price guide data** (from an unaffiliated third-party investment guide, linked under external references in docs/CONTEXT.md)

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
- If <3 comps: "Not enough data yet, be the first to log a sale"

### Portfolio Value Banner (component embedded in collection page)

`<PortfolioBanner userId={id} />`

- Total estimated collection value, donut chart by morph category, month-over-month delta
- "Update valuation" button

### Log a Sale Modal

- Animal select (own animals) or manual entry, morph/sex/age auto-populated
- Sale price, date, buyer location, anonymous contribution checkbox (default ON)

---

The build prompt that stood here was removed on 12 November 2026 because its fonts, colours and routes were never shipped. Design is `docs/specs/DESIGN-SYSTEM.md`.
