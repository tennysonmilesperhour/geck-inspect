# Morph catalogue consolidation

Status: partial. First safe step done 2026-07-07 (KNOWN_MORPH_SLUGS now
derives from the morph guide). Full six-source consolidation is
deliberately staged, see "Why not a big-bang rewrite" below.

## The problem

Morph/trait domain data lives in six places. They overlap on the core
morph names but each was written for a different job, with its own id
scheme and its own extra fields, so they drift from each other silently.

| # | Source | Shape / id scheme | Job | Consumers |
|---|---|---|---|---|
| 1 | `src/data/morph-guide.js` (`MORPHS`, `INHERITANCE`, `MORPH_CATEGORIES`, `RARITY`, `PRICE_TIERS`) | slug ids (`extreme-harlequin`), rich content | The morph guide content + canonical identity | MorphDetail, MorphGuide, MorphTaxonomyHub, ProjectLineDetail, morphFaq, the CSV + llms-full build scripts |
| 2 | `src/lib/morphUtils.js` (`morphSlug`, `KNOWN_MORPH_SLUGS`, `pickBestMorphRecord`) | slugs | Slug helpers + cross-link slug list | MorphGuide, MorphDetail |
| 3 | `src/components/morph-id/morphTaxonomy.js` (`PRIMARY_MORPHS`, `GENETIC_TRAITS`, `SECONDARY_TRAITS`, `BASE_COLORS`, plus ML-only axes) | snake_case ids (`lily_white`), partly from the `crested-gecko-app` engine | AI recognition + training taxonomy | Recognition, Training, VisualSiblings |
| 4 | `src/lib/marketAnalytics/taxonomy.js` (`CANONICAL_MORPHS`, `HIGH_VALUE_COMBOS`, regions, age classes) | display names + `TRAIT_KINDS` | Market pricing / analytics | market-analytics components |
| 5 | `src/components/morph-visualizer/data/{traits,presets,genetics}.js` | visualizer trait ids | Rendering a morph preview | MorphVisualizer |
| 6 | `src/components/my-geckos/morphTagCatalog.js` (`MORPH_CATEGORIES`, `ALL_MORPHS`) | display-name tags | The add-gecko morph tag picker | MorphIDSelector |

### They genuinely diverge

This is not pure duplication. Each catalogue legitimately contains
morphs or fields the others do not:

- Market analytics (4) tracks market-relevant morphs like **Sable**,
  **Quad Stripe**, **Super Stripe**, **Empty Back**, **Reverse
  Pinstripe**, **Full Pinstripe** that have no morph-guide entry.
- The ML taxonomy (3) carries recognition-only axes (pattern intensity,
  white amount, fired state, photo angle, lighting, confidence) that
  have nothing to do with the guide.
- The vocabularies differ: the guide models Harlequin as
  `category: pattern` + `inheritance: polygenic`, while market analytics
  models it as `kind: PATTERN`. "Pattern" is a category in one and an
  inheritance-like "kind" in the other.

So there is no single flat table that all six are a view of; a
consolidation has to separate **shared identity** (name, slug, canonical
inheritance, category, aliases) from **per-surface extensions**
(guide prose, price tiers, ML axes, market premium tiers, visualizer
layers).

### Drift already happened

`KNOWN_MORPH_SLUGS` (source 2) was a hand-maintained copy of the guide's
slugs and had already fallen out of sync: it was missing `cream`, so the
`/MorphGuide/cream` page existed but was dropped from cross-linking. The
same `cream` morph was also being silently dropped by the old regex in
`build-morphs-csv.mjs` (fixed separately in Phase 2.4). The genetics
dimension is the one already protected: `scripts/check-genetics-consistency.mjs`
asserts sources 3 and 5 agree with the Foundation Genetics engine.

## Done in this pass (safe, zero-risk step)

`morphUtils.KNOWN_MORPH_SLUGS` now derives from `morph-guide.js`'s
`MORPHS` (`MORPHS.map(m => m.slug)`) instead of being a hand-maintained
list. This removes one duplicated source, fixes the `cream` drift, and
makes future drift impossible. Coupling is a non-issue: morphUtils is
imported only by MorphGuide and MorphDetail, which already import
morph-guide, and morph-guide has no imports (no cycle).

New tests (`src/data/__tests__/morph-guide.test.js`) lock the invariants:
every morph has a unique url-safe slug and a valid category / inheritance
/ rarity, each slug is consistent with its name via `morphSlug`, and
`KNOWN_MORPH_SLUGS` equals the guide's slug set.

## Why not a big-bang rewrite now

Full consolidation (one registry that sources 3, 4, 6 all derive from)
is rated large and was deliberately deferred, because:

1. The three id schemes (slug, snake_case, display name) and the
   diverging morph sets mean the rewrite is not mechanical; each
   consumer needs its output verified byte-for-byte to hit the
   "zero user-visible difference" bar.
2. The highest-value protection, catching drift, is largely achievable
   with cheaper consistency checks (this pass added one; more can follow)
   without touching the risky rendering paths.
3. The genetics dimension is already checked, so the remaining drift risk
   is naming/coverage, which changes rarely.

## Staged plan for the full consolidation

Do these in order, each its own PR, each fully verified before the next:

1. **Canonical registry.** Create `src/data/morphRegistry.js`:
   `{ id (snake_case, matching morphTaxonomy), displayName, slug
   (matching morphUtils), category, inheritance (from the engine where
   covered), aliases[] }`. Generate its initial content from the union of
   all six sources; where names disagree, the guide's display name wins
   and the others become aliases. Add a test that every registry entry
   with engine coverage matches the Foundation Genetics engine.
2. **Point source 2 fully at the registry** (slug list + slug helpers).
   Already half-done via KNOWN_MORPH_SLUGS.
3. **Derive source 6 (`morphTagCatalog`) identity from the registry**,
   keeping `MORPH_CATEGORIES` / `ALL_MORPHS` output identical (snapshot
   test the rendered tag set before/after).
4. **Derive source 3 (`morphTaxonomy`) morph/trait identity from the
   registry** while keeping the ML-only axes local and the snake_case ids
   stable (the recognition edge function and `taxonomy.ts` mirror depend
   on them). Bump `TAXONOMY_VERSION` in lockstep.
5. **Derive source 4 (`marketAnalytics`) morph identity from the
   registry**, keeping market-only morphs (Sable, Quad Stripe, ...) as
   registry entries flagged `marketOnly: true` so they have a home.
6. **Extend `check-genetics-consistency.mjs`** to also assert every
   registry entry with engine coverage matches, so drift fails CI.

Sources 1 (guide content) and 5 (visualizer layers) keep their
surface-specific data but import identity fields (name/slug/id/
inheritance) from the registry rather than restating them.
