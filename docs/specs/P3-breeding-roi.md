# P3 — Breeding ROI Dashboard

**Priority:** P3
**Dependencies:** P1 (Animal Passport), P2 (Market Pricing)
**Origin:** Original spec — unchanged

---

## What It Is

A financial planning tool for breeding projects. Select a pairing, enter expected morph outcomes and probabilities, enter costs — get a full projected P&L with cash flow timeline, break-even analysis, and actuals tracking as the season progresses.

This turns Geck Inspect from a recordkeeping app into a **business planning tool**. It's the feature serious breeders will pay for.

---

## Data Model

```
BreedingProject {
  id:                    UUID
  user_id:               UUID → User
  name:                  string
  status:                enum [planned, active, completed, cancelled]

  sire_animal_id:        UUID nullable → Animal
  sire_name:             string
  sire_morph:            string
  dam_animal_id:         UUID nullable → Animal
  dam_name:              string
  dam_morph:             string

  planned_start:         date
  planned_end:           date
  target_clutch_count:   integer

  acquisition_cost_sire: decimal
  acquisition_cost_dam:  decimal
  feeding_cost_monthly:  decimal
  incubation_cost:       decimal  (per clutch)
  housing_cost_monthly:  decimal
  other_costs:           decimal
  project_duration_months: integer

  actual_clutch_count:   integer nullable
  actual_total_revenue:  decimal nullable
  notes:                 text

  created_at:            timestamp
  updated_at:            timestamp
}

GeneticOutcomePrediction {
  id:                    UUID
  project_id:            UUID → BreedingProject
  morph_combination:     string
  probability:           decimal  (0.0–1.0, all rows must sum to 1.0)
  price_low:             decimal
  price_mid:             decimal
  price_high:            decimal
  expected_egg_count:    decimal  (auto-calc: total_eggs × probability)
  sort_order:            integer
}

Clutch {
  id:                    UUID
  project_id:            UUID → BreedingProject
  clutch_number:         integer
  laid_date:             date
  egg_count:             integer
  infertile_count:       integer nullable
  incubation_temp_f:     decimal
  expected_hatch_date:   date  (laid_date + 75 days — midpoint of 60–90 day range)
  actual_hatch_date:     date nullable
  status:                enum [incubating, hatched, failed]
  hatchling_animal_ids:  array of UUID → Animal
  notes:                 text
  created_at:            timestamp
}
```

---

## UI Spec

### Breeding Projects List (`/breeding`)

- **Table:** Name | Sire x Dam | Status | Dates | Proj. revenue | Actual revenue | ROI %
- Click row -> project ROI dashboard
- "+ New project" top right

### New Project Wizard (`/breeding/new`)

4-step wizard:

1. **Step 1:** Sire/dam selection (search animals or free text), project name (auto-suggest: "Dam x Sire — Year"), planned start/end dates
2. **Step 2:** Genetic outcome table — editable rows: Morph combination / Probability % / Expected eggs (auto-calc) / Price range (auto-loaded from market data, editable). Probability column must sum to 100% — live validation bar shown. **Note:** do NOT auto-calculate CG genetics. Breeders enter their own outcomes.
3. **Step 3:** Cost inputs — acquisition sire, acquisition dam, feeding/month, housing/month, incubation/clutch, other. Project duration (months).
4. **Step 4:** P&L preview (read-only) -> "Create project"

### Project ROI Dashboard (`/breeding/:id`)

**This is the centrepiece.** Full-page professional financial dashboard.

**Top row — 4 metric cards:**
Projected revenue | Projected costs | Projected profit (green if positive, red if negative) | ROI % (profit/costs x 100)

If costs > revenue: **red alert banner** at page top: "This project is projected to lose money at current market prices."

**Left panel (55% desktop) — Morph outcomes:**
- Horizontal stacked bar chart (morph probability distribution, sage color family)
- Table below: Morph / Probability / Expected # / Price range / Expected revenue
- Totals row

**Right panel (45% desktop) — Cost breakdown:**
- Donut chart by cost category
- Itemized table: Category / Monthly / Duration / Total
- Break-even callout box: "Sell X hatchlings at median price to break even" (formula: total_costs / average midpoint price, rounded up)

**Bottom — Cash flow chart (full width):**
- Monthly grouped bar chart: costs as downward bars (coral/red), revenue as upward bars (sage)
- Cumulative net as overlaid line chart (secondary axis)
- Revenue assumed to start 3 months before project end, spread over 2 months
- X-axis annotations: Pairing / First clutch / Expected hatch / Sales window
- Build with Chart.js

**Actuals tracker** (shown when status != planned):
- 3-column table: Metric / Projected / Actual (inline editable) / Variance %
- Charts rerender on any actual update

### Clutch Log (tab in project detail)

- **List:** Clutch # | Laid date | Eggs | Expected hatch | Status badge
- **"+ Log clutch" modal:** auto-increment number, laid date, egg count, incubation temp
- Expected hatch auto-calculated = laid_date + 75 days
- When status -> hatched: "+ Add hatchlings to collection" -> creates Animal records with sire_id and dam_id pre-populated from project, redirects to collection to name them

---

## Claude Code Prompt

```
Build the Breeding ROI Dashboard for Geck Inspect.

DESIGN SYSTEM: [PASTE GLOBAL DESIGN SYSTEM]

CONTEXT: Animal Passport (P1) and Market Pricing (P2) are already built.
Animals table exists with morph/lineage data. morph_price_entries exists with pricing.
This feature uses both.

DATABASE:
[PASTE BreedingProject, GeneticOutcomePrediction, Clutch models]

BUILD:
1. PROJECTS LIST (/breeding): table with all columns, status badges, "+ New project" button

2. WIZARD (/breeding/new): 4-step as specced. Step 2 genetic table must live-validate
   that probability column sums to exactly 100%. Show a colored progress bar
   (red if <100, green if exactly 100, warning if >100) above the table.
   Auto-load price ranges from morph_price_entries on base_morph match.

3. ROI DASHBOARD (/breeding/:id): full-page dashboard as specced.
   - 4 metric stat cards at top
   - Left/right panels (55/45 split on desktop, stacked on mobile)
   - Chart.js for all charts
   - Cash flow chart with annotation labels on x-axis
   - Actuals tracker with inline editable cells
   - Red alert banner if costs > revenue
   - All monetary values: $X,XXX.XX format
   - Zero state if no outcome rows: prompt to add them, no broken charts

4. CLUTCH LOG (tab in project detail): list, log modal, expected hatch auto-calc.
   "Add hatchlings" flow creates Animal records with sire/dam pre-filled from project.

INTEGRATION:
- Hatchlings created here must appear in /collection immediately
- Sale of a hatchling (P1 transfer, P2 sale log) should eventually be traceable
  back to this project (animal.breeding_project_id is a useful optional FK to add)
- PortfolioBanner (P2) should exclude animals with status sold/transferred

QUALITY: This must look like a financial tool, not a hobby tracker.
Label everything "projected" clearly. Never imply estimates are facts.
```
