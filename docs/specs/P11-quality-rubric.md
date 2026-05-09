# P11: Quality Scale (Geck Inspect Standard)

**Priority:** P11
**Dependencies:** P1 Animal Passport (built), P2 Market Pricing (built)
**Origin:** The `pattern_grade` field on `morph_price_entries` is self-reported with zero rubric. Sellers don't know which bucket their gecko belongs in, so price data is noisy and Free users get no help understanding what their gecko is worth.

---

## What it is

A public, free rubric that lets a keeper or breeder evaluate their crested gecko on a 10-point scale across body structure, head and face, dorsal pattern, lateral pattern, color saturation, contrast, crests, tail, base color, and overall presence. The score maps to one of four grade tiers (pet, breeder, high-end, investment) which feed directly into the existing `MarketValueCard` price band on the Animal Passport.

The rubric is the **Geck Inspect Standard**. It is modeled on, and gives credit to, the work the Gold Standard Gecko Club (GSGC) has done in publicly setting judging criteria for crested geckos. We are not reusing GSGC's name, score sheets, or assets without permission. The standard is ours and the framework is informed by their public rules.

---

## Why a separate, internal standard

Three reasons:

1. **Brand neutrality.** Anchoring an in-product feature to a single named breeder (Tiki's Geckos) or a single private organization (GSGC) creates trademark exposure and signals "fan project" instead of neutral platform. Geck Inspect's competitive position is being the species-first standards body for the hobby. The rubric carries the Geck Inspect name.
2. **Licensing path stays open.** If GSGC ever wants to formally co-brand or license their score sheets to us, the framework is already in place to swap in the licensed standard without a rewrite. Until then, our standard cites theirs as inspiration with linked sources, the same way a textbook cites prior art.
3. **Rubric stability.** A self-owned standard can be revised on our schedule (new morphs, hobby drift, market shifts) without coordinating with an outside organization.

---

## Public references this standard draws on

All verified, public, and linked from the live page footer.

- Gold Standard Gecko Club, official site: `https://www.goldstandardgeckoclub.com/`
- GSGC Rules and Regulations: `https://www.goldstandardgeckoclub.com/general-5`
- GSGC Species Standard: `https://www.goldstandardgeckoclub.com/single-project`
- GSGC Forum: `https://www.goldstandardgeckoclub.com/forum`
- GSGC YouTube playlist (judging videos): `https://www.youtube.com/playlist?list=PLBYqDmT358pxaK8t9Taz6OyauOBpxRCtw`
- GSGC Facebook: `https://www.facebook.com/goldstandardgeckos/`
- Tiki's Geckos (founders of GSGC): `https://tikisgeckos.com/`
- August 2025 GSGC registration announcement (lists active categories): `https://tikisgeckos.com/blogs/the-tikisgeckos-experience/gold-standard-gecko-club-registration-is-open-for-august-2025`
- Reptiles Magazine founder interview (Danny Utrera and Manny Durand): `https://reptilesmagazine.com/danny-utrera-and-manny-durand-of-tikis-geckos/`

GSGC contact for licensing or partnership conversations: `info@goldstandardgeckoclub.com`.

---

## Eligibility floor

A gecko is only eligible to be scored on the full structure point if it meets the floor. This mirrors GSGC's published thresholds because they reflect community consensus on when a crestie is structurally mature enough to grade.

| Criterion | Threshold |
|-----------|-----------|
| Age | 18 months or older |
| Weight, full tail | 45 g or more for full structure point, 40 g minimum to enter |
| Weight, no tail | 40 g or more for full structure point, 35 g minimum to enter |
| Health | No active illness, no untreated mites, no open wounds |

Animals under the floor can still be scored on color, pattern, and head traits, but the structure point is reduced or withheld. The page makes this explicit so users don't think a 6-month-old hatchling failed the rubric.

---

## The 10-point rubric

Each criterion is worth 1 point. Points are continuous, not binary, so a judge or self-evaluator can award 0.5 for partial credit. Total: 10.

| # | Criterion | What earns full credit |
|---|-----------|------------------------|
| 1 | **Body structure** | Robust, symmetrical body. Adult weight at or above the structure threshold. No kinks, no scoliosis, no MBD signs. Healthy hips, straight spine. |
| 2 | **Head shape** | Wide, prominent, well-proportioned head. Clear sexual dimorphism in adult males. Strong jaw line. Not pinched or undersized for body. |
| 3 | **Eye quality** | Clean, alert eyes. Not bulging or sunken. No cloudiness. Color appropriate to morph. (GSGC explicitly downgrades "buggy" eyes.) |
| 4 | **Crown crests** | Full, even, well-formed crests around the orbital rim. No bald patches. Symmetrical between left and right. |
| 5 | **Dorsal crests and stripe** | Continuous crest line from head to tail base. Dorsal stripe (when relevant to morph) is clean and well-defined. |
| 6 | **Pattern coverage** | Pattern matches the morph standard for the category. Harlequins reach the upper laterals; extreme harlequins connect dorsal to lateral; pinstripes have full bilateral pin coverage; dalmatians show appropriate spot density. |
| 7 | **Pattern quality** | Clean lines, no muddiness, no stress-broken pattern. Edges are crisp. Bilateral symmetry where the morph calls for it. |
| 8 | **Color saturation** | Strong, fully expressed base color. No washed-out or "fired-down" appearance during evaluation. |
| 9 | **Contrast** | Strong tonal break between dorsal and lateral, or between base and pattern. Especially weighted for harlequin and extreme harlequin categories. |
| 10 | **Overall presence and breeding suitability** | Active, alert, well-conditioned animal that represents its morph category cleanly. No disqualifying traits (severe floppy tail syndrome, missing tail base, deformities). |

---

## Score-to-grade mapping

| Score | Grade tier | Maps to existing `pattern_grade` |
|-------|------------|----------------------------------|
| 0.0 to 4.9 | Pet | `pet` |
| 5.0 to 6.9 | Breeder | `breeder` |
| 7.0 to 8.4 | High-end | `high_end` |
| 8.5 to 10.0 | Investment | `investment` |

When a user finishes the worksheet, the resulting tier writes to the gecko's `pattern_grade` field and the `MarketValueCard` on the Animal Passport refreshes with the corresponding price band from `morph_price_entries`.

---

## Per-category morph standards

The rubric weights are universal but the **interpretation** of pattern coverage, contrast, and color shifts by category. The page launches with these categories, mirroring GSGC's August 2025 list so anyone familiar with GSGC sees an obvious mapping:

1. Harlequin
2. Extreme Harlequin
3. Pinstripe
4. Lilly White
5. Yellow Base
6. Red Base
7. Dalmatian
8. Phantom
9. Axanthic
10. Cappuccino (any base morph)

Each category gets a dedicated section on the live page with:

- A 2-3 sentence description of what the category means
- The 3 traits weighted heaviest for that category (e.g., harlequin = pattern coverage, contrast, lateral reach)
- A reference photo plate (placeholder until acquired) showing pet / breeder / high-end / investment exemplars

---

## UX flow

**Read-only landing page (ships day 1):**

`/QualityScale` is a public, indexable page. A cold visitor lands on it, reads what the standard is, scrolls through the 10-point rubric, then through the per-category sections. Each category has placeholder slots that say "Reference photos coming over the next few weeks."

**Interactive worksheet (ships phase 2):**

A "Score your gecko" button on each Animal Passport opens a worksheet modal:

1. Step 1: Confirm category (pre-filled from the gecko's existing morph tags).
2. Step 2: 10 sliders, one per criterion, with the rubric description visible per slider.
3. Step 3: Optional photo upload for self-record.
4. Step 4: Submit. The total score writes to `geckos.quality_score` and `geckos.pattern_grade`.

Submitted scores are private to the owner unless they explicitly publish them with a sale entry.

---

## Database changes

Phase 2 only. Phase 1 is content only.

```sql
ALTER TABLE geckos
  ADD COLUMN quality_score numeric(3,1) CHECK (quality_score >= 0 AND quality_score <= 10),
  ADD COLUMN quality_scored_at timestamptz,
  ADD COLUMN quality_score_breakdown jsonb;
```

`quality_score_breakdown` stores the 10 criterion scores as `{ body_structure: 0.8, head_shape: 0.9, ... }` so the worksheet can re-open and the user can revise.

---

## Reference image acquisition plan

We need 4 photos per category (pet, breeder, high-end, investment) across 10 categories: 40 photos total. Sources, in order of preference:

1. **Tennyson's own breeding operation.** Photograph against a neutral backdrop with consistent lighting. Investment-tier exemplars likely need to be bought-in or borrowed.
2. **Community submissions.** Reuse the P10 photo submission flow. Solicit category-specific submissions with a short writeup of why the animal exemplifies its tier.
3. **Permissioned partner photos.** Reach out to recognized breeders (Pangea, AC Reptiles, Altitude Exotics, Fringemorphs, Tiki's Geckos themselves) for one or two reference plates each, with attribution and a link back to their site or storefront.
4. **Stock placeholders during the gap.** A neutral silhouette + caption "Reference photo coming" so the page is complete UX from day 1.

Do **not** scrape competitor breeder sites or MorphMarket for reference photos. Every photo on the live page must be one we own, were given permission to use, or were submitted to us under the existing photo-submission terms.

---

## Out of scope

- **Automated scoring from a photo.** That's a future ML project, not this spec. Phase 2 is human-driven worksheet only.
- **Public leaderboards.** Score visibility is private by default.
- **Verified appraisals.** No human judge at Geck Inspect signs off on a user's self-score in phase 1 or 2. A "verified appraisal" tier (paid, human-reviewed, with optional certificate PDF) is a phase 3 idea.

---

## Rollout

| Phase | Ships | Scope |
|-------|-------|-------|
| 1 | Now | `/QualityScale` landing page with rubric, score-to-grade table, eligibility floor, per-category cards with image placeholders, footer crediting GSGC and Tiki's Geckos with linked sources. |
| 2 | After phase 1 has 4 weeks of traffic data | Worksheet modal on Animal Passport, `quality_score` columns, `MarketValueCard` integration. |
| 3 | If demand warrants | Verified appraisal tier (paid, human-reviewed) and optional licensing conversation with GSGC if their score sheets become available to us. |

---

## Notes for future Claude sessions

- If GSGC publishes their full point breakdown publicly, **do not lift it verbatim**. Cite it. Our rubric stays our rubric.
- If a partnership with GSGC ever lands, the language on the live page changes from "modeled on" to "officially follows the GSGC standard, used under license" and the rubric definitions can be replaced. Keep the schema column names neutral (`quality_score`, `pattern_grade`) so the underlying data doesn't need to migrate.
- The "Investment" grade label exists for parity with the existing `pattern_grade` enum. If the hobby drifts and the term gets cringey, rename the **label** in UI without renaming the enum value.
