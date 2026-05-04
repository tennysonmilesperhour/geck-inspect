# Kaleidoscope Model Integration — Claude Code Handoff

**Project:** Geck Inspect (`tennysonmilesperhour/geck-inspect`)
**Local path:** `/Users/tennyson/dyad-apps/geck inspect`
**Stack:** React + Vite, Supabase (Postgres + Auth + Storage), Vercel, Stripe
**Date created:** 2026-05-04

---

## What this document is

This is a supplemental brief for integrating the **Kaleidoscope Model of Inheritance** (Foley & Donaldson, Scaled Life LLC, 2025) into Geck Inspect. The Kaleidoscope Model is a new, scientifically-grounded framework for crested gecko genetics that proposes:

1. Three independent base color genes (Yellow, Red, Black) with polygenic interaction, expressed via chromatophore layering.
2. Two pattern-force genes (Tiger and Pinstripe) with antagonistic incomplete-dominant inheritance.
3. A "Coverage Gene" (CvG) that is tightly linked to Harlequin and explains the Phantom phenotype as the *absence* of CvG, replacing the older "Phantom is recessive" model.

**This is a model, not validated lab science.** The authors are explicit about that. We integrate it as one of two models the app supports (the other being the LIL Monsters / Foundation Genetics framework), letting users record their breeding outcomes against both.

## What's already built (do not duplicate)

Per prior audits and migration notes:

- **Genetics Calculator** exists and handles Lilly White (incomplete dominant), axanthic (recessive), Phantom (current model treats as recessive), Cappuccino/Sable/Frappuccino allelic series, and polygenic patterning.
- **Morph Guide** page exists but is currently parked/disabled, with a known RLS bug (read rule restricted to creator).
- **Genetics Guide** page exists but is parked/disabled.
- **Headless "Foundation Genetics" TypeScript module** exists as a canonical traits/inheritance source. Integration into the app is pending — not a drop-in.
- Traits taxonomy entity exists in Supabase as the "genetic truth layer."
- Pedigree, clutch, breeding pair, and gecko entities exist with parent foreign keys.

**The job here is to extend, not replace.** Wherever the existing system already does something well, we add Kaleidoscope as a layer on top, not as a substitute.

---

## Integration plan — five workstreams

These are listed in dependency order. Workstream 1 is foundational and must be done before 2-5.

### Workstream 1: Database schema additions

Add Kaleidoscope-specific fields to the existing geckos table (or a linked `gecko_genotype` table — see Decision Point 1.A below) without breaking any existing morph-tag or trait fields.

**Decision Point 1.A:** Whether to add columns directly to the `geckos` table or create a new linked `gecko_genotype` table with a 1:1 relationship.

- *Recommended:* New `gecko_genotype` table. Keeps the geckos table lean, makes the genotype fields optional (a free-tier user might not fill them in), and lets us version the genotype model independently.

**New table: `gecko_genotype`**

```sql
create table gecko_genotype (
  id uuid primary key default gen_random_uuid(),
  gecko_id uuid not null references geckos(id) on delete cascade,
  
  -- Kaleidoscope base color (Y/R/B triplet)
  yellow_alleles smallint check (yellow_alleles between 0 and 2),
  red_alleles smallint check (red_alleles between 0 and 2),
  black_alleles smallint check (black_alleles between 0 and 2),
  base_color_confidence text check (base_color_confidence in (
    'confirmed_by_breeding', 'phenotype_estimate', 'lineage_estimate', 'unknown'
  )) default 'unknown',
  
  -- Kaleidoscope pattern
  tiger_alleles smallint check (tiger_alleles between 0 and 2),
  pinstripe_alleles smallint check (pinstripe_alleles between 0 and 2),
  pattern_confidence text check (pattern_confidence in (
    'confirmed_by_breeding', 'phenotype_estimate', 'lineage_estimate', 'unknown'
  )) default 'unknown',
  
  -- Kaleidoscope coverage
  harlequin_alleles smallint check (harlequin_alleles between 0 and 2),
  cvg_status text check (cvg_status in (
    'absent', 'linked_to_one_harlequin', 'linked_to_both_harlequin', 'unknown'
  )) default 'unknown',
  coverage_confidence text check (coverage_confidence in (
    'confirmed_by_breeding', 'phenotype_estimate', 'lineage_estimate', 'unknown'
  )) default 'unknown',
  
  -- Allele expression quality scores (1-10 scale, polygenic gene-stacking)
  yellow_expression_score smallint check (yellow_expression_score between 1 and 10),
  red_expression_score smallint check (red_expression_score between 1 and 10),
  black_expression_score smallint check (black_expression_score between 1 and 10),
  tiger_expression_score smallint check (tiger_expression_score between 1 and 10),
  pinstripe_expression_score smallint check (pinstripe_expression_score between 1 and 10),
  cvg_expression_score smallint check (cvg_expression_score between 1 and 10),
  
  -- Model versioning (so we can migrate cleanly when Kaleidoscope updates)
  genetic_model_version text default 'kaleidoscope_v1.0',
  
  -- Audit
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id),
  
  unique(gecko_id)
);

create index idx_gecko_genotype_gecko_id on gecko_genotype(gecko_id);
```

**RLS policies for `gecko_genotype`:**

- Read: gecko owner, or admin, or the gecko's `is_public` flag is true.
- Write: gecko owner only, or admin.
- Match the same RLS pattern used on the `geckos` table to stay consistent.

**Migration safety:**

- Do not modify existing `geckos` table morph tag fields. Leave them as-is.
- Backfill: leave `gecko_genotype` empty for existing geckos. Users opt in by filling in the new fields via the UI.
- The Kaleidoscope notation is a *layer over* existing morph tags, not a replacement. A gecko can have both a "Harlequin" tag and a Kaleidoscope genotype.

### Workstream 2: Genetics Guide page (currently parked)

Re-enable the parked Genetics Guide page (`/genetics` or whatever path is set in PageConfig) and populate it with Kaleidoscope content as the primary educational module.

**Page structure:**

1. **Introduction** — what is the Kaleidoscope Model, who created it, why it matters. Short. Link to the source PDF.
2. **The four trait categories** — Pattern, Color, Coverage, Structure. Visual diagram showing how they layer.
3. **Color: Y/R/B base system** — the triplet notation (0/0/0 to 2/2/2), chromatophore layering (Yellow on top, Red middle, Black bottom), polygenic inheritance, the 27-combination Punnett square.
4. **Pattern: Tiger and Pinstripe forces** — incomplete dominance, vertical vs. horizontal influence, the antagonistic interaction, the nine-combination two-gene Punnett, why "breaks" in pinstripe indicate Tiger presence.
5. **Coverage: the Harlequin/CvG hypothesis** — Phantom as wild-type, Coverage as a derived gene, the linked-genes mechanism, why some non-phantoms can directly produce phantoms and others cannot, the (2/2/0) edge case.
6. **The "Perfect Recipe" 2/0/2** — why Tri-Colors come from this genotype.
7. **Lavender reframed** — explanation of why Lavender is likely a base color combination phenotype, not a "Hypo Black."
8. **True Hypo base colors** — selective breeding history, 0/0/0 pale cream, pink (0/1/0), hypo yellow (1/0/0).
9. **Comparison to Foundation Genetics (LIL Monsters) framework** — side-by-side, honest about disagreements (especially on Phantom).
10. **How to use this in your breeding program** — links to the calculator, the genotype editor, the prediction tool.

**Content sourcing:**

- Primary source: the Kaleidoscope PDF at `https://www.crestedgeckokaleidoscope.com/_files/ugd/4dc19b_3f80e7b6c4414889bf28ff996544183e.pdf`
- Secondary source: `https://lmreptiles.com/foundation-genetics/`
- All quotes must be ≤ 15 words and properly attributed. Most content should be paraphrased.

**Decision Point 2.A:** Whether to write this content as static markdown files in the repo or as records in a `genetics_guide_section` table in Supabase (so it can be edited via admin UI without redeploys).

- *Recommended:* Supabase records. The content will need updates as the Kaleidoscope team publishes the Coverage and Structure pages (currently "coming soon" on their site).

### Workstream 3: Genotype editor UI

Add a Kaleidoscope genotype editor to the gecko detail/edit page. This is a new tab or section, not a replacement for the morph tag editor.

**UX requirements:**

- Section title: "Kaleidoscope Genotype (advanced)"
- Collapsed by default. Free-tier users see it but can't save (upsell to Keeper or Breeder tier).
- Three subsections matching the Kaleidoscope categories: Color, Pattern, Coverage.
- For each gene field, a 0/1/2 selector with a tooltip explaining what each value means.
- A confidence dropdown next to each section: confirmed by breeding, phenotype estimate, lineage estimate, unknown.
- Expression scores hidden behind an "Advanced" toggle. Default to 5 (mid-range) when not set.
- Live-preview chip showing the Kaleidoscope notation string (e.g., `1/2/1, T1, P0, Hq2, CvG2`).
- "Estimate from photos" button that opens a placeholder for future ML integration (out of scope for this workstream, but the button reserves the affordance).

**Tier gating:**

- **Free:** View only. Cannot edit.
- **Keeper:** Edit color and pattern fields. Cannot edit coverage or expression scores.
- **Breeder:** Edit everything.
- **Enterprise:** Edit everything plus access to bulk genotype import/export.

### Workstream 4: Breeding calculator extension

Extend the existing Genetics Calculator to support Kaleidoscope predictions. Do not break the existing recessive/incomplete-dominant logic for Lilly White, axanthic, Cappuccino/Sable/Frappuccino, etc.

**New calculator mode:** Toggle between "Classic" (existing) and "Kaleidoscope" modes.

**Kaleidoscope mode logic:**

For each pairing, given sire and dam genotypes:

1. **Per-gene Mendelian inheritance.** For each of the 6 Kaleidoscope genes (Y, R, B, Tiger, Pinstripe, Harlequin), enumerate the 4 possible offspring allele combinations and assign 25% probability each. (If a parent is homozygous, that gene contributes deterministically.)
2. **Independent assortment.** Combine per-gene probabilities multiplicatively to enumerate all possible offspring genotypes. With 6 genes, max combinations = 4^6 = 4,096, but most pairings collapse to far fewer because of homozygosity.
3. **CvG inheritance.** Treat CvG as completely linked to one or both Harlequin alleles per parent's `cvg_status`. So a `linked_to_one_harlequin` parent passes CvG with the Harlequin allele 50% of the time; `linked_to_both_harlequin` always passes CvG when Harlequin is passed.
4. **Edge case: (2/2/0) cannot directly produce phantoms.** When sire AND dam are both `yellow=2 AND black=2 AND red=0 AND harlequin>=1`, set phantom probability to 0 in the output, with an info note: "Per the Kaleidoscope Model, 2/2/0 genotypes cannot directly produce phantoms."
5. **Phenotype clustering.** Group offspring genotypes into phenotype labels (e.g., "Red-based Harlequin," "Pure Phantom Red," "Tri-Color"). Sum probabilities within each cluster.
6. **Expression scoring.** If both parents have expression scores filled in, compute the expected offspring expression score as the average of the parent scores per gene. Surface this as a "Predicted expression strength" label (low / medium / high).

**Output panel:**

- A probability bar chart showing the top 5-8 phenotype clusters.
- Each cluster expandable to show underlying genotype combinations.
- A "Save this prediction" button that stores the prediction record so the user can compare it against actual offspring later (data flywheel for the model itself).
- A "Compare to Foundation Genetics model" button (Workstream 5).

### Workstream 5: Dual-model tracking (data flywheel)

This is what makes Geck Inspect genuinely useful to the breeding community: track which inheritance model's predictions match actual outcomes, building a community dataset.

**New table: `clutch_prediction`**

```sql
create table clutch_prediction (
  id uuid primary key default gen_random_uuid(),
  clutch_id uuid not null references clutches(id) on delete cascade,
  model_name text not null check (model_name in ('kaleidoscope_v1', 'foundation_genetics_v1', 'classic_morph_tags')),
  prediction_payload jsonb not null,
  created_at timestamptz default now(),
  unique(clutch_id, model_name)
);
```

When offspring hatch and are recorded, a "Score predictions" function compares each model's predicted probability distribution against the actual offspring phenotypes and computes a Brier score (a standard probabilistic prediction accuracy metric). Aggregate scores over time and across users tell us which model predicts crested gecko genetics most accurately.

**Privacy note:** Aggregate scoring should anonymize user data. Surface results as "Across 1,247 clutches recorded in Geck Inspect, the Kaleidoscope Model predicted 73% of phenotype outcomes correctly vs. 68% for the Classic Morph Tags model" — never per-user.

This is the kind of feature that gets you written about in the breeder community.

---

## Things to NOT do

- **Do not delete or modify the existing morph tag system.** Keep both alongside.
- **Do not assume the Kaleidoscope Model is correct.** Always present it as one of multiple frameworks. The Phantom-is-recessive vs. Phantom-is-no-CvG debate is unresolved.
- **Do not inline the genetics math into UI components.** Keep all inheritance logic in the headless TypeScript "Foundation Genetics" module. Add a parallel `kaleidoscope` module if cleaner.
- **Do not ship genotype data publicly without owner consent.** The `gecko_genotype` table should follow the same public/private flag as the parent `geckos` record.
- **Do not paywall the Genetics Guide content.** Education is free tier. Only the prediction tools and bulk import paywall.

## Acceptance criteria (per workstream)

**Workstream 1:**
- `gecko_genotype` table exists in Supabase with correct schema, constraints, and RLS.
- A test gecko record can be created and have its genotype edited via Supabase Studio without RLS errors.
- Migration is reversible (schema-only, no data destruction).

**Workstream 2:**
- Genetics Guide page is enabled in PageConfig and routed.
- All 10 sections of content are populated.
- Page is publicly readable (RLS open) but only admin-writable.
- All claims sourced from the Kaleidoscope PDF or LIL Monsters site, properly attributed.
- No quote exceeds 15 words; predominantly paraphrased.

**Workstream 3:**
- Gecko edit page has a Kaleidoscope Genotype section.
- Tier gating works correctly (test as Free, Keeper, Breeder).
- Live notation preview updates as fields change.
- Saved data round-trips correctly (refresh page, data persists).

**Workstream 4:**
- Calculator has a working Kaleidoscope mode toggle.
- Test case: Sire 2/0/0 T2 P0 Hq2 CvG=both × Dam 0/0/2 T0 P2 Hq0 should produce predicted offspring with Tri-Color (2/0/2 pattern intermediate) genotypes and intermediate Tiger/Pinstripe expression. Verify against the Kaleidoscope paper's worked examples.
- Test case: (2/2/0, Hq=1) × (2/2/0, Hq=1) shows zero phantom probability.
- Save Prediction creates a clutch_prediction record.

**Workstream 5:**
- `clutch_prediction` table exists with RLS.
- When offspring records are added to a clutch, predictions are scored.
- Aggregate model accuracy is queryable (admin-only initially; surface to users in v2).

---

## Source materials (for Claude Code reference)

1. **Kaleidoscope Model PDF (primary source):**
   `https://www.crestedgeckokaleidoscope.com/_files/ugd/4dc19b_3f80e7b6c4414889bf28ff996544183e.pdf`
   44 pages. Sections: Harlequin & Pinstripe, Base Color, Coverage, Harlequin & CvG, Insights Gained, Terms, Citations.

2. **Kaleidoscope website navigation:**
   - Home: `https://www.crestedgeckokaleidoscope.com/`
   - Traits overview: `https://www.crestedgeckokaleidoscope.com/traits`
   - Color page: `https://www.crestedgeckokaleidoscope.com/copy-of-pattern`
   - Pattern page: `https://www.crestedgeckokaleidoscope.com/pattern`
   - Model poster: `https://www.crestedgeckokaleidoscope.com/kaleidoscope-model`

3. **Foundation Genetics (LIL Monsters):**
   `https://lmreptiles.com/foundation-genetics/`
   PDF version: `https://lmreptiles.com/wp-content/uploads/2023/04/Crested-Gecko-Foundation-Genetics_v0.7.pdf`

4. **Existing internal reference:**
   `https://tennyscrestedgeckos.com/crested-gecko-investment-guide-2025/`
   Used elsewhere in the app as the canonical pricing/morph reference.

## Recommended order of operations for Claude Code

1. Read this entire document.
2. Read `CONTEXT.md`, `INTENT.md`, `ARCHITECTURE.md`, `DECISIONS.md` in the repo root if they exist. Cross-reference against this brief.
3. Examine the existing headless "Foundation Genetics" TypeScript module to understand its API surface and avoid duplication.
4. Examine the existing Genetics Calculator to understand its current shape.
5. Propose a schema migration file for Workstream 1. Get user approval before running.
6. Build Workstream 1, then 2, then 3, then 4, then 5 in sequence. Do not skip ahead.
7. After each workstream, write a short summary in `DECISIONS.md` of what was built and any choices made that diverged from this brief.

## Open questions for the user (Tennyson)

These should be raised before starting Workstream 1, not assumed:

1. Confirm whether `gecko_genotype` should be a separate table or columns on `geckos`. (Brief recommends separate.)
2. Confirm whether Genetics Guide content lives as markdown files or as Supabase records. (Brief recommends Supabase.)
3. Confirm tier gating for the genotype editor matches current Stripe plan structure (Free / Keeper $4 / Breeder $9 / Enterprise).
4. Confirm whether the existing Foundation Genetics TS module should be extended with Kaleidoscope logic, or a parallel `kaleidoscope` module should be created.
5. Confirm whether the Phantom inheritance toggle in the calculator should default to Kaleidoscope or Classic, since these models give different predictions.
