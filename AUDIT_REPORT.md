# Geck Inspect — Pre-Integration Audit

**Repo:** `geck-inspect/` (root) on branch `claude/audit-geck-inspect-qw2Ua`, working tree clean (this audit creates one new untracked file: `AUDIT_REPORT.md`).
**Most recent commits** (top of `git log --oneline`):

```
40108d2 Tutorial: pin card, fill blurb gaps, add migration path
8d49b5c Landing: drop Featured Morphs, add second feature grid
bb9964a Populate guest mode with mock data and a yellow demo disclaimer
3a772fa Add guest mode with view-only access and align landing page to app theme
11cf9d7 Multi-photo submissions + auto-advancing slideshow
0bbe4ae Fix Vercel schema rejection: drop _comment from generated vercel.json
6b18d3f Switch recognize-gecko-morph from Replicate to Claude vision
```

This audit is read-only; nothing in the codebase was modified, no installs were run, no build/test was executed. Where a question can't be answered without runtime introspection, that limitation is called out.

---

## 1. Repo Overview

### Stack

| Concern | Choice |
|---|---|
| Framework | React 18.2 (`react`, `react-dom` ^18.2.0) |
| Build tool | Vite 6.1 (`vite.config.js`) — uses `@vitejs/plugin-react` and `@base44/vite-plugin` (still in the plugin list) |
| Routing | `react-router-dom` ^6.26.0 (`BrowserRouter`, `Routes`) |
| State / data | `@tanstack/react-query` ^5.84 + ad-hoc `useState`/`useEffect` per page; auth via a custom React `AuthContext` (`src/lib/AuthContext.jsx`) |
| Forms | `react-hook-form` + `@hookform/resolvers` + `zod` |
| CSS | Tailwind 3.4 (`tailwind.config.js`, `tailwindcss-animate`) + shadcn/ui-style `@radix-ui/*` primitives in `src/components/ui/` |
| SEO / SSR | `react-helmet-async`; static prerender via `scripts/prerender.mjs` (runs in `npm run build`) |
| Analytics | PostHog (`posthog-js`) wrapped in `src/lib/posthog.js` + `src/lib/PostHogPageTracker.jsx` |
| PDF / charts | `recharts`, `jspdf`, `html2canvas` (split into vendor chunks in `vite.config.js`) |
| Drag & drop | `@hello-pangea/dnd` |

### Hosting / deployment

- **Vercel** — `vercel.json` is a 17 KB hand-curated rewrite list with `cleanUrls: true`, plus a generator at `scripts/build-vercel-json.mjs` that runs in the `build` script.
- No Vercel **edge functions** in this repo. Server-side logic lives in **Supabase Edge Functions** under `supabase/functions/`:
  - `recognize-gecko-morph/` — Claude vision morph identifier (`taxonomy.ts`, `index.ts`, `README.md`)
  - `embed-gecko-image/` — generates SigLIP-style embeddings (per migration comment)
  - `export-training-corpus/`
  - The Membership flow also calls `supabase.functions.invoke('stripe-checkout', …)` (`src/pages/Membership.jsx:175`) and there is a separate `invoke-llm` edge function expected by `src/lib/invokeLlm.js:27` — neither is present in this repo. They live in the Supabase project only.
- **Supabase project** is hard-coded as a default in `src/lib/supabaseClient.js:5` (`https://mmuglfphhwlaluyfyxsp.supabase.co`) with the anon key inlined as a default. `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` override at build time.
- A second, *legacy* Supabase project — Base44's `qtrypzzcjebvfcihiynt.supabase.co` — is still referenced in `src/lib/constants.js:12` and `src/lib/organization-schema.js:29` for the `Inspect.png` logo asset.

### Package manager

Both `package-lock.json` (377 KB) **and** `pnpm-lock.yaml` (261 KB) are committed. `package.json` is named `"base44-app"`. Build history (the `prerender` script and Vercel deploys) suggests **npm** is the active tool, but the presence of both lockfiles is a hazard: whichever the next dev runs first wins. There's no `packageManager` field pinning a choice.

### Folder structure (2 levels)

```
geck-inspect/
├── base44/                  Vendored snapshot of the original Base44 app.
│   ├── entities/            JSONC schemas for Gecko, MorphGuide, ForumPost, ...
│   └── functions/           Deno entry.ts files for each Base44 backend function.
├── docs/                    Internal product specs.
│   ├── research/            iherp-competitive-analysis.md
│   └── specs/               P1–P10 feature specs + DESIGN-SYSTEM, FEATURE-PRIORITY-MAP
├── public/                  Static assets served as-is.
├── scripts/                 Build-time generators (sitemap, llms.txt, morphs CSV, vercel.json,
│                            prerender, geo-followup PDF builder, deploy-morph-id, check-morph-id)
├── src/
│   ├── api/                 base44Client.js, supabaseEntities.js, entities.js, integrations.js
│   ├── assets/              Static React-imported assets
│   ├── components/          ~30 feature-folders + ui/ (Radix-based primitives)
│   ├── data/                Local-only content: morph-guide.js, care-guide.js,
│   │                        genetics-glossary.js, genetics-jsonld.js, genetics-sections.jsx
│   ├── entities/            Base44-style entity wrappers, all backed by Supabase via all.js
│   ├── functions/           Client wrappers for old Base44 functions (most still call
│   │                        base44.functions.invoke; several have local Supabase replacements)
│   ├── hooks/               useBreedingSimulator, useGeckoFilters, useGeckoPassport,
│   │                        usePageSettings, useWeightHealthScore, use-mobile
│   ├── integrations/        Core.js (InvokeLLM/UploadFile shims), ShipZeros.js
│   ├── lib/                 Supabase client, AuthContext, guestMode, posthog, morphUtils,
│   │                        marketAnalytics/, plus assorted helpers
│   ├── pages/               64 page components, one per route
│   ├── styles/              Plain CSS (layout-theme.css)
│   └── utils/               index.ts (createPageUrl etc.)
└── supabase/
    ├── functions/           recognize-gecko-morph, embed-gecko-image, export-training-corpus
    └── migrations/          21 SQL files (8 are empty "remote-only snapshot placeholders");
                             real schema lives in the remote project
```

---

## 2. Data Model — Geckos and Morphs Today

### Where animal data lives

**Supabase, in tables that mirror the original Base44 entity names.** The translation is centralised in `src/api/supabaseEntities.js:21` (the `TABLE_MAP` constant), e.g. `Gecko → 'geckos'`, `MorphGuide → 'morph_guides'`, `MorphTrait → 'morph_traits'`, `MorphReferenceImage → 'morph_reference_images'`, `User → 'profiles'`. 60+ entities are mapped.

A compatibility layer at `src/api/base44Client.js:67` `Proxy`-wraps `base44.entities` so every page that still imports `{ base44 } from '@/api/base44Client'` and calls `base44.entities.Gecko.filter(...)` is transparently rerouted to `supabaseEntities.js`. The `base44.auth` namespace is similarly proxied to Supabase Auth (`base44Client.js:34`). This is why pages still look like Base44 code on the surface but talk to Supabase under the hood.

The original Base44 entity schemas are still on disk in `base44/entities/*.jsonc` and useful as documentation of intended shapes, even though Base44 itself is dead.

### Gecko record shape (current canonical schema)

The actively used schema is inferred from `base44/entities/Gecko.jsonc` plus all the migrations in `supabase/migrations/20260413_p1_animal_passport.sql` and later. The Base44 file declares (file: `base44/entities/Gecko.jsonc:1-215`):

| Field | Type | Notes |
|---|---|---|
| `name` | string (required) | display name |
| `species` | enum | Crested, Gargoyle, Leachianus, Chahoua, Mourning, Pictus, Tokay, Leopard, AFT, Other |
| `sex` | enum (required) | Male, Female, Unsexed |
| `hatch_date` | date | |
| `sire_id`, `dam_id` | string | parent gecko ids in same collection |
| `sire_name`, `dam_name` | string | free-text fallback when parent isn't in collection |
| `morphs_traits` | string | **legacy free-text** description of morphs |
| `morph_tags` | array<string> | **structured tags** from `MorphIDSelector` |
| `notes` | string | |
| `status` | enum | Pet, Future Breeder, Holdback, Ready to Breed, Proven, For Sale, Sold |
| `image_urls` | array<string> | |
| `gecko_id_code` | string | breeder-assigned code |
| `display_order` | number | |
| `asking_price` | number | |
| `weight_grams` | number | |
| `market_price_estimate` | object | `{ low, high, average, last_updated }` |
| `morphmarket_id` / `_url`, `palm_street_id` / `_url` | string | external listing links |
| `marketplace_description` | string | |
| `is_public`, `gallery_display`, `archived` | boolean | |
| `image_crop_data` | object | URL → crop metadata |
| `incubation_days` | number | |
| `archive_reason` | enum | death, sold, other |
| `feeding_group_id` | string | FK to FeedingGroup |
| `is_gravid`, `gravid_since`, `egg_drop_date` | boolean/date | breeding state |

Base44 RLS (informational): public read, write only when `created_by == user.email`. Supabase mirrors this — `geckos` rows carry `created_by` (email string) and `created_date`/`updated_date` set in `supabaseEntities.js:201-204`.

The P1 migration (`supabase/migrations/20260413_p1_animal_passport.sql:5-15`) **adds** these columns to the live `geckos` table:
`passport_code` (UNIQUE), `pattern_grade` (`pet|breeder|high_end|investment`), `genetics_notes`, `breeder_name`, `breeder_user_id` (FK to `auth.users`), `hatch_facility`, `is_public` (default true), `listing_price`, `estimated_hatch_year`.

Note the legacy issue called out in `supabase/migrations/20260417000006_fix_review_gecko_image_text_id.sql`: **`gecko_images.id` is `TEXT` in production, not `UUID`**. The same is implicit elsewhere — Base44 used string ids and the prod DB still has them. Several P1+ migrations reference `geckos(id)` as `UUID`; the foreign-key compatibility of that against legacy text ids is uncertain from migrations alone and would need a runtime check.

### How morphs are represented on an animal

**Three coexisting representations:**

1. **`morphs_traits`** — free-text string. Legacy. Still set by some flows.
2. **`morph_tags`** — `array<string>`, the structured tag set chosen via the `MorphIDSelector` component (`src/components/my-geckos/MorphIDSelector.jsx`). The list of allowed values is hard-coded in that component (see Section 7).
3. **`primary_morph`** + secondary trait arrays — used by the recognition / training / Animal Passport pipeline (see `src/lib/guestMockData.js:355-357` for an example record carrying all three: `primary_morph: 'Cappuccino'`, `morphs_traits: 'Cappuccino, Dark Base'`, `morph_tags: ['Cappuccino']`).

There is **no relational reference** from a gecko to a `morph_guides` row. Tags are loose strings; the canonical morph data and the per-gecko tags are two unrelated dictionaries.

### Morph / trait tables

- **`morph_guides`** (Supabase) — the user-contributed morph guide entries. Per `src/lib/morphUtils.js:1-9`, multiple rows can describe the same morph (a side-effect of Base44 letting any user add their own version), so `pickBestMorphRecord()` and `indexMorphsBySlug()` exist to dedupe at render time. Schema (from `base44/entities/MorphGuide.jsonc`): `morph_name`, `description`, `key_features[]`, `example_image_url`, `rarity` (common/uncommon/rare/very_rare), `breeding_info`. Row count is unknown without running the app.
- **`morph_traits`** (Supabase) — table mapped at `supabaseEntities.js:51` but I found no caller in the JS codebase using `MorphTrait.filter/list`. Likely an unused or sparsely-used Base44 holdover.
- **`morph_reference_images`** (Supabase) — referenced by training and morph-detail pages.
- **`morph_price_cache`** + **`morph_price_entries`** — price aggregates.
- **Local catalogue** (not a DB table): `src/data/morph-guide.js` is a hand-maintained 973-line dataset of 32 morphs with full inheritance/category/rarity/priceTier metadata, helpers (`getMorph`, `morphsByCategory`, `searchMorphs`), and a `KNOWN_MORPH_SLUGS` list duplicated in `src/lib/morphUtils.js:97-130`. This is the closest thing to a "Foundation Genetics" model already in the codebase.

### Breeding / pairing / clutch model

- **`breeding_plans`**, **`breeding_projects`**, **`future_breeding_plans`**, **`clutches`**, **`eggs`**, **`gecko_events`**, **`reptile_events`**, **`weight_records`** are all mapped through `supabaseEntities.js`.
- **Offspring prediction** is computed client-side in two places that are *intentionally kept in sync* (per the comments):
  - `src/components/breeding/GeneticCalculator.jsx:5-49` — Punnett squares for a `CO_DOM_TRAITS` set: `Lilly White, Axanthic, Cappuccino, Soft Scale, Moonglow, Empty Back, White Wall`. Every other trait is treated as presence/absence (`DOM_TRAITS`).
  - `src/hooks/useBreedingSimulator.js:11-44` — Monte Carlo simulator using the same `CO_DOM_TRAITS` list for repeated virtual clutches.
- **Genetics calculator UI** is `src/pages/GeneticCalculatorTool.jsx` (public marketing page) wrapping `src/components/breeding/GeneticCalculatorTab.jsx`.
- **There is no shared rules engine** — the trait set and inheritance treatment are duplicated across `GeneticCalculator.jsx`, `useBreedingSimulator.js`, `morph-guide.js`, `genetics-sections.jsx`, `morphTaxonomy.js`, and `marketAnalytics/taxonomy.js`. They disagree (see Section 3).

### Existing genetics logic — file map

| File | What it does |
|---|---|
| `src/components/breeding/GeneticCalculator.jsx` | Punnett UI + math for incomplete-dom traits |
| `src/components/breeding/GeneticCalculatorTab.jsx` | Container that mounts the above in a tab |
| `src/components/breeding/GeneticsModal.jsx` | Modal version of the calculator |
| `src/components/genetics/GeneticsDiagrams.jsx` | Educational SVG diagrams |
| `src/components/genetics/GeneticsHelpers.jsx` | Shared formatting helpers |
| `src/hooks/useBreedingSimulator.js` | Monte Carlo clutch simulator |
| `src/data/morph-guide.js` | Canonical local morph catalogue (32 entries) |
| `src/data/genetics-glossary.js` | Glossary terms used on `/GeneticsGuide` |
| `src/data/genetics-sections.jsx` | Long-form educational sections |
| `src/data/genetics-jsonld.js` | JSON-LD structured data for SEO |
| `src/lib/morphUtils.js` | `morphSlug`, `pickBestMorphRecord`, `KNOWN_MORPH_SLUGS` |
| `src/lib/morphFaq.js` | Per-morph FAQ snippets |
| `src/lib/marketAnalytics/taxonomy.js` | A *separate* canonical morph list keyed for pricing |
| `src/components/morph-id/morphTaxonomy.js` | A *third* canonical morph list keyed for ML training (snake_case ids) |
| `src/components/morph-id/normalizeMorphText.js` | Free-text → taxonomy id mapper |
| `src/components/morph-visualizer/data/{traits,presets,genetics}.js` | A *fourth* trait dataset, this one for the visual SVG renderer |
| `src/components/morph-visualizer/engine/compose.js` | Layered render composition for the visualizer |
| `src/pages/GeneticCalculatorTool.jsx`, `GeneticsGuide.jsx` | Public-facing genetics pages |

The proliferation of "trait list" sources is the single biggest signal of how much the integration session will need to consolidate.

---

## 3. Genetics Content — Factual-Accuracy Catalogue

This section catalogues every place a contestable genetics claim lives. **No corrections are proposed here.** The integration session will reconcile against the Foundation Genetics module.

### Cappuccino — codominant vs incomplete-dominant vs recessive

The codebase contradicts itself across at least four files. Quotes are exact.

| File:line | Inheritance label used |
|---|---|
| `src/data/morph-guide.js:555` | `inheritance: 'incomplete-dominant'` |
| `src/data/morph-guide.js:562` | "Cappuccino is a proven incomplete-dominant trait …" |
| `src/data/genetics-glossary.js:90` | "Incomplete-dominant morph with dark coffee-brown coloration …" |
| `src/data/genetics-jsonld.js:111` | "An incomplete-dominant crested gecko morph producing dark coffee coloration …" |
| `src/data/genetics-sections.jsx:71` | "MOST proven crested gecko morphs work this way — Lilly White, Cappuccino, Soft Scale, and White Wall are all incomplete dominants." |
| `src/data/genetics-sections.jsx:274` | "Inheritance: INCOMPLETE DOMINANT. Single copy = Cappuccino … Two copies = Super Cappuccino, commonly called FRAPPUCCINO …" |
| `src/components/morph-id/morphTaxonomy.js:55` | `inheritance: 'codominant (proto)'` |
| `src/lib/marketAnalytics/taxonomy.js:38` | `kind: TRAIT_KINDS.RECESSIVE` |
| `src/components/breeding/GeneticCalculator.jsx:7-10` | included in `CO_DOM_TRAITS` (treated by the Punnett-square code as incomplete-dominant) |
| `src/hooks/useBreedingSimulator.js:13-16` | included in `CO_DOM_TRAITS` |
| `src/pages/GeneticCalculatorTool.jsx:130` | "**recessive traits (Cappuccino, Axanthic)**" *(public marketing copy)* |
| `src/pages/GeneticCalculatorTool.jsx:137` | "**Cappuccino** — recessive; two het carriers produce ~25% visible cappuccino offspring." *(public marketing copy)* |
| `src/components/morph-visualizer/data/traits.js:102` | "Incomplete dominant. One copy = visual Cappuccino with a connected dorsum and coffee-brown body. Two copies = Frappuccino with a fully patternless cream dorsum." |

Net: the **calculator math, glossary, JSON-LD, and morph-guide all treat Cappuccino as incomplete-dominant**, but the **public Genetic Calculator landing page tells visitors it's recessive**, and the **market-analytics + ML-training taxonomies tag it as recessive / codominant-proto** respectively.

### Lilly White — inheritance, lethality, name spelling

Lethality of the super form is consistently flagged across the canonical content:

- `src/data/morph-guide.js:608-626` — "Proven incomplete-dominant trait … the super form is lethal" + "Never pair two visual lilly whites unless you accept that roughly 1/4 of eggs will fail to develop".
- `src/data/genetics-glossary.js:87-88, 122` — Lilly White and Super Lilly White definitions both call out embryonic lethality.
- `src/data/genetics-jsonld.js:109, 115, 130-133` — JSON-LD definitions and FAQ confirm "Super Lilly White … embryonic-lethal".
- `src/data/genetics-sections.jsx:237-249, 470-484` — Dedicated "Lilly White (LW)" section + "Super Lilly White — Confirmed Lethal" section with explicit warnings.
- `src/pages/GeneticCalculatorTool.jsx:31, 91, 130, 136` — Lethality flagging is mentioned in marketing copy: "Lilly White lethal-super flagging", "Lilly White (co-dominant, lethal super)".
- `src/pages/About.jsx:97` — "Lilly White (co-dominant, lethal super)".

**Inheritance label drift:** the canonical files say "incomplete-dominant"; `GeneticCalculatorTool.jsx`, `About.jsx`, and `morphTaxonomy.js` say "co-dominant" / "codominant"; the calculator code treats them all the same way mechanically.

**Spelling drift:**

| File:line | Spelling |
|---|---|
| `src/data/morph-guide.js`, glossary, JSON-LD, sections, calculator, MorphIDSelector, marketAnalytics, breedingSimulator, all guest mock data | `Lilly White` (canonical) |
| `src/components/morph-id/morphTaxonomy.js:52` | `id: 'lily_white', label: 'Lily White'` *(one `l`)* |
| `src/components/morph-id/normalizeMorphText.js:44` | `lily_white: ['lily white', 'lilly white', 'lily-white', 'lilly-white', 'lily', 'lw']` — accepts both spellings, normalises to `lily_white` |

The ML-training pipeline therefore stores rows as `lily_white` while every UI surface displays `Lilly White`. The integration session will need to pick one canonical id.

### Phantom — Bicolor / Patternless / Buckskin as "morphs"?

The codebase **does** treat Bicolor, Patternless and Buckskin as catalogued morph entries:

- `src/data/morph-guide.js:927-944` — `bicolor` (category `combo`, polygenic, common)
- `src/data/morph-guide.js:681-700` — `patternless` (category `color`, line-bred, common)
- `src/data/morph-guide.js:865-883` — `buckskin` (category `base`, polygenic, common)
- `src/components/morph-id/morphTaxonomy.js:22, 43, 147` — same three appear, with notes calling out that buckskin is treated as a base color
- `src/components/my-geckos/MorphIDSelector.jsx:71-75, 113` — UI tag list includes "Bicolor", "Patternless", "Buckskin Base"

**Phantom Pinstripe** is explicitly flagged as **not a proven recessive** in `src/data/genetics-sections.jsx:311-316`: *"Despite the name, Phantom Pinstripe is NOT a proven recessive morph. It's a pattern-expression style within the pinstripe family… If you're buying an animal marketed as 'het phantom,' ask for the pairing documentation and manage your expectations — the outcome is not predictable by Punnett square."* The glossary echoes that at `genetics-glossary.js:101`.

A separate **`Phantom`** trait (no "pinstripe" suffix) appears as a colour/contrast modifier:
- `src/components/morph-id/morphTaxonomy.js:107` — `id: 'phantom', label: 'Phantom (no warm tones)', group: 'contrast'`
- `src/components/morph-visualizer/data/traits.js:306-307`, `presets.js:139, 184` — "Phantom" preset, used in compose layer
- `src/components/breeding/GeneticCalculator.jsx:23` and `MorphIDSelector.jsx:73` — both list "Phantom" as a base-pattern tag

So Phantom is sometimes a *colour modifier*, sometimes a *base pattern* — depending on which file is read.

### Super Cappuccino / Melanistic — health warnings

- **Super Cappuccino / Frappuccino**: viability concerns are explicitly hedged in `src/data/genetics-sections.jsx:276, 489-494`: *"Frappuccinos exist and are bred, but there is ongoing debate about sublethal effects — some breeders report reduced clutch sizes or health issues from Cappuccino × Cappuccino pairings"* and a dedicated section "Super Cappuccino (Frappuccino) — Viability Debated". Same caveat at `genetics-glossary.js:91` and `genetics-jsonld.js:170-173`. `morph-guide.js:578-597` describes Frappuccino without mentioning viability concerns.
- **Melanistic**: appears only as `src/components/morph-id/morphTaxonomy.js:63` — `inheritance: 'proto', notes: 'Excess dark pigment, very dark animal.'` — and as a free-text alias in `normalizeMorphText.js:55`. **No health warnings anywhere.**

### XXX / Extreme Harlequin

The token `XXX` only appears as a passport-code template marker (`src/lib/passportUtils.js:6,7`) — *not* as a morph. Extreme Harlequin is treated as a polygenic pattern morph throughout (`src/data/morph-guide.js:182-211`, `morphTaxonomy.js:26`, `marketAnalytics/taxonomy.js:50`). Nothing labels it as marketing-only or genetic — both treatments coexist (the morph-guide entry calls it "the highest expression of the harlequin polygenic trait").

### Albino — does the codebase claim it exists?

**Yes.** Three places present Albino as a current crested-gecko morph:

| File:line | Quote |
|---|---|
| `src/components/my-geckos/MorphIDSelector.jsx:27` | listed under **"Proven Genetics (Incomplete Dominant)"** alongside Lilly White, Axanthic, Cappuccino |
| `src/components/my-geckos/MorphIDSelector.jsx:54` | `"Het Albino", "Possible Het Albino"` under "Het Status" |
| `src/pages/MarketplaceBuy.jsx:145` | included in the marketplace morph filter list |
| `src/components/changelog/ChangeLogModal.jsx:35` | changelog string: `'Albino morph added to the morph ID tag selector and marketplace filters'` |

Albino is not in `src/data/morph-guide.js`, not in `morphTaxonomy.js`, not in `marketAnalytics/taxonomy.js`, not in the genetics calculator's `CO_DOM_TRAITS`. Per project owner: the first albino crested gecko has recently been produced, so the tag should remain — but the integration session will want to add a proper catalogue entry (with accurate inheritance notes, a "very rare / newly proven" flag, and presumably the relevant line attribution) rather than leaving it as an orphan tag in `MorphIDSelector` and the marketplace filter.

---

## 4. UI Components Affected by Integration

### Components that *render* morph info

| File | Role |
|---|---|
| `src/pages/MorphGuide.jsx` | Top-level browsable morph catalogue index |
| `src/pages/MorphDetail.jsx` | Single morph detail page (per-slug route) |
| `src/pages/MorphTaxonomyHub.jsx` | Programmatic SEO hubs `/MorphGuide/category/<id>` and `/MorphGuide/inheritance/<id>` |
| `src/pages/GeneticsGuide.jsx` | Long-form genetics encyclopedia (renders `genetics-sections.jsx`) |
| `src/pages/GeneticCalculatorTool.jsx` | Public marketing wrapper around the calculator |
| `src/components/morph-guide/MorphCard.jsx` | List card |
| `src/components/morph-guide/MorphDetail.jsx` | Detail body |
| `src/components/morph-guide/CommentSection.jsx` | Per-morph comments |
| `src/components/morphguide/RotatingMorphImage.jsx` | Featured image rotator (note: separate `morphguide/` folder) |
| `src/pages/GeckoDetail.jsx` | Per-gecko profile (renders morph tags + breeding info) |
| `src/pages/AnimalPassport.jsx` | Public animal passport — surfaces morph tags |
| `src/pages/PassportQR.jsx` | Public QR landing page for passport |
| `src/pages/Pedigree.jsx` | Lineage tree, surfaces parent morph tags |
| `src/pages/Lineage.jsx` | Editor/viewer for lineage placeholders |
| `src/pages/Marketplace.jsx`, `MarketplaceBuy.jsx`, `MarketplaceSell.jsx`, `MarketplaceSalesStats.jsx`, `MyListings.jsx`, `BreederStorefront.jsx` | Marketplace cards + filters keyed on morph tags |
| `src/pages/MarketPricing.jsx` | Market analytics page |
| `src/components/innovations/MorphPriceIndex.jsx` | Price-index widget |
| `src/pages/Gallery.jsx`, `LikedGeckos.jsx`, `Giveaways.jsx`, `CommunityConnect.jsx` | Public gecko grids; render morph tags on cards |
| `src/pages/MyGeckos.jsx` | Owner's gecko collection list |
| `src/pages/MorphVisualizer.jsx` | Hosts the SVG morph visualizer |
| `src/components/morph-visualizer/render/{GeckoCanvas,GeckoCanvasSide,GeckoCanvasTop}.jsx` and `layers/{Cappuccino,LillyWhite,Dorsum,Pinstripe}.jsx` | SVG renderer reading from `morph-visualizer/data/traits.js` |
| `src/components/morph-visualizer/panels/MorphGenotypePanel.jsx`, `PatternIntensityPanel.jsx`, etc. | Visualizer side-panel controls |
| `src/components/morph-id/MorphPicker.jsx`, `TraitPicker.jsx`, `MorphCorrectionPanel.jsx`, `SimilarGeckosStrip.jsx` | Recognition-result UI (renders model output) |
| `src/components/recognition/AnalysisResultDisplay.jsx`, `AnnotatedImage.jsx`, `AnnotationEditor.jsx` | Recognition result + annotation overlay |
| `src/components/breeding/{GeneticCalculator,GeneticCalculatorTab,GeneticsModal,Hatchery,EggCard,EggDetailModal,PlanDetails,BreedingPlanCard}.jsx` | Breeding flows that read/display morph genotypes |
| `src/components/genetics/GeneticsDiagrams.jsx`, `GeneticsHelpers.jsx` | Diagrams referenced from `GeneticsGuide.jsx` |
| `src/pages/MorphGuideSubmission.jsx` | User-contributed morph guide submission |

### Components that *capture* morph info from users

| File | Role |
|---|---|
| `src/components/my-geckos/MorphIDSelector.jsx` | **Primary** chip-style multi-select used in the gecko create/edit form. Hard-coded `MORPH_CATEGORIES` is the source of truth for tags written into `geckos.morph_tags`. |
| `src/pages/MyGeckos.jsx` | Hosts the gecko-create dialog that mounts `MorphIDSelector` |
| `src/pages/GeckoDetail.jsx` | Edit dialog for a single gecko |
| `src/pages/MarketplaceSell.jsx` | Sale-listing form (lets seller tag morphs) |
| `src/pages/ClaimAnimal.jsx` | Passport claim flow — captures morph tags for the new owner |
| `src/pages/MorphGuideSubmission.jsx` | Form that writes a `morph_guides` row |
| `src/components/morph-id/{ConfidenceSlider,ExpertContributionForm,GeneticsContextInputs,MorphCorrectionPanel,MultiPhotoUploader,PhotoQualityInputs,WebImportPanel,TraitPicker,MorphPicker}.jsx` | Recognition contribution + correction form |
| `src/components/training/{ManualClassification,ClassificationForm,ImageUploadZone}.jsx` | Expert-reviewer training pipeline UI |
| `src/components/breeding/GeneticCalculator.jsx`, `GeneticCalculatorTab.jsx` | Trait/super selectors for the Punnett calculator |
| `src/components/morph-visualizer/TraitSelector.jsx` | Visualizer trait selector |

### AI-powered features

| Feature | File | LLM / model |
|---|---|---|
| Morph identifier from photo | `src/pages/Recognition.jsx` → `src/functions/recognizeGeckoMorph.js` → Supabase edge fn `recognize-gecko-morph` | **Claude vision** (per `src/functions/recognizeGeckoMorph.js:4` and the recent commit `6b18d3f Switch recognize-gecko-morph from Replicate to Claude vision`). The taxonomy fed to Claude lives in `supabase/functions/recognize-gecko-morph/taxonomy.ts` (separate from the JS taxonomies). |
| Breeder Consultant chatbot | `src/pages/BreederConsultant.jsx` | Calls `InvokeLLM` (`@/integrations/Core` → `src/lib/invokeLlm.js` → Supabase edge fn `invoke-llm`, which proxies Anthropic's Messages API per the file header). System prompt names it "GeckoGenius AI". |
| Train-model evaluation | `src/pages/TrainModel.jsx` | Calls both `recognizeGeckoMorph` and `InvokeLLM` (line 121) |
| Mass-message generator | `src/components/admin/MassMessaging.jsx` | `InvokeLLM` |
| Changelog generator | `src/components/admin/ChangeLogManager.jsx` | `InvokeLLM` |
| Image embedding | Supabase edge fn `embed-gecko-image` (no client wrapper found) | SigLIP-style embeddings stored in `gecko_images` (per migration `20260417000005_gecko_image_embeddings.sql`) |

### Image upload components (relevant for future morph-id)

| File | Notes |
|---|---|
| `src/lib/uploadFile.js` | Single source of truth — writes to Supabase Storage bucket `geck-inspect-media`, returns `{ file_url, path }`. Public API matches the old Base44 contract. Validates MIME (no SVG), 10 MB cap, namespaces by user UUID. |
| `src/integrations/Core.js` | Re-exports `uploadFile` as `UploadFile` for backwards compatibility |
| `src/components/morph-id/MultiPhotoUploader.jsx` | Multi-photo (up to 5) submission for recognition |
| `src/components/morph-id/PhotoSlideshow.jsx`, `PhotoTipsCard.jsx` | Capture UX |
| `src/components/training/ImageUploadZone.jsx` | Training-corpus uploader |
| `src/pages/Lineage.jsx:808` | Still calls `base44Client.integrations.Core.UploadFile(...)` — see Section 5 |

---

## 5. Base44 Residue Audit

The migration is **partially** complete. The `base44.entities` and `base44.auth` namespaces are intercepted by `Proxy` shims in `src/api/base44Client.js` and routed to Supabase, so most code still *imports* from Base44 but actually *talks* to Supabase. There is no active Base44 backend — the company is shut down per multiple comments. Below: every occurrence I found, classified as **Active** (executes against the proxy shim at runtime), **Stale** (string/comment/dead env var only), or **Uncertain** (can't tell without a runtime test).

### `package.json` dependencies

| Line | Item | Bucket |
|---|---|---|
| `package.json:2` | `"name": "base44-app"` | Stale (cosmetic) |
| `package.json:20` | `"@base44/sdk": "^0.8.26"` | **Active** — imported by `src/api/base44Client.js:1` and used to instantiate the proxy target |
| `package.json:21` | `"@base44/vite-plugin": "^1.0.7"` | **Active** — used in `vite.config.js:1, 30-34` |

### Vite / build config

| File:line | Item | Bucket |
|---|---|---|
| `vite.config.js:1` | `import base44 from "@base44/vite-plugin"` | **Active** |
| `vite.config.js:30-34` | `base44({ legacySDKImports: ... })` plugin in plugin list | **Active** |
| `vite.config.js:10-25` | `fixAtAliasPlugin` — comment notes it's there to undo a `@/` alias bug introduced *by* the base44 plugin | **Active** workaround |
| `vite.config.js:33` | `process.env.BASE44_LEGACY_SDK_IMPORTS` env var read | **Active** (build-time gate) |

### Auth proxy / SDK shims

| File:line | Item | Bucket |
|---|---|---|
| `src/api/base44Client.js:1-79` | Whole file: creates a Base44 SDK client, hard-coded `appId='68929cdad944c572926ab6cb'`, proxies `auth` and `entities` to Supabase | **Active** (load-bearing — every page imports `base44` from here) |
| `src/api/base44Client.js:9` | `const BASE44_SERVER = 'https://base44.app'` (default `serverUrl`) | Stale URL — Base44 is dead, but the SDK constructor needs *some* string |
| `src/api/base44Client.js:30` | `export const base44RawEntities = base44.entities` (pre-proxy reference, "used by AdminMigration") | Stale — `AdminMigration.jsx:35` says the migration has been retired, so nothing actually reads this |
| `src/api/entities.js:1-9` | `import { base44 }` then re-exports `Query` and `User` | **Active** (re-exported helpers) |
| `src/api/integrations.js:6-17` | Re-export shim for `InvokeLLM`, `UploadFile`, etc. — comment "Legacy integrations shim … so older code paths that imported `@/api/integrations` keep working after the Base44 shutdown" | **Active** (shim is exercised) |
| `src/integrations/Core.js:4-22` | Header comment: "Base44's hosted integrations … are no longer live"; `notImplemented(name)` throws "The Base44 integration shut down" | **Active** (called by `BreederConsultant`, `ChangeLogManager`, `MassMessaging`, `TrainModel`) |
| `src/lib/invokeLlm.js:4-9` | Header comment: "Replaces the Base44 `base44.integrations.Core.InvokeLLM` API (which is dead because Base44 shut down)" | **Active** replacement |
| `src/lib/uploadFile.js:4-18` | Header comment: "Replaces the dead Base44 `UploadFile` shim" | **Active** replacement |

### Env vars / app params

| File:line | Item | Bucket |
|---|---|---|
| `src/lib/app-params.js:13` | `const storageKey = \`base44_${toSnakeCase(paramName)}\`` (writes to `localStorage` with `base44_` prefix) | **Active** — every load runs this; the keys persist Base44-flavoured state in users' browsers |
| `src/lib/app-params.js:39` | `defaultValue: import.meta.env.VITE_BASE44_APP_ID` | **Active** — read at startup |
| `src/lib/app-params.js:40` | `defaultValue: import.meta.env.VITE_BASE44_BACKEND_URL` | **Active** — read at startup |
| `src/api/base44Client.js:12` | `import.meta.env.VITE_BASE44_APP_BASE_URL` | **Active** |
| `vite.config.js:33` | `process.env.BASE44_LEGACY_SDK_IMPORTS` | **Active** |
| `base44/functions/*/entry.ts` (10 files: `importGeckosFromCSV`, `recognizeGeckoMorph`, `generateCSVTemplate`, `syncWithPalmStreet`, `shareToSocial`, `getMorphPrices`, `scrapeAndCacheMorphPrices`, `syncWithMorphMarket`, `sendTestNotification`) | `Deno.env.get('BASE44_APP_ID')` | Stale — these files are vendored snapshots in `base44/`, not deployed anywhere from this repo |

There is no `.env.example` file in the repo to update. Whatever env doc exists lives in deploy configuration outside the repo.

### Pages / components that still call `base44.*` at runtime

All of these go through the proxy in `base44Client.js` and ultimately hit Supabase. They are technically "active Base44 imports" but functionally Supabase calls.

| File:line | Call | Bucket |
|---|---|---|
| `src/App.jsx:17, 95` | `base44.entities.PageConfig.list()` | **Active** (proxied → Supabase) |
| `src/Layout.jsx:6, 161, 228, 274, 295-297, 329, 404` | Notification, DirectMessage, PageConfig, Gecko, GeckoImage, ForumPost reads + Notification update | **Active** (proxied) |
| `src/lib/NavigationTracker.jsx:4, 43` | `base44.appLogs.logUserInApp(pageName).catch(() => {})` | **Uncertain** — `appLogs` is *not* in the proxy override; if the SDK still exposes `appLogs`, the call now hits a dead `https://base44.app` endpoint. The `.catch(() => {})` swallows the error silently. |
| `src/lib/PageNotFound.jsx:2, 15` | `base44.auth.me()` | **Active** (proxied → Supabase) |
| `src/pages/Subscription.jsx:2, 73, 94, 122` | `base44.auth.me()`, `base44.auth.updateMe(...)` | **Active** (proxied) |
| `src/pages/AdminMigration.jsx:7, 35` | Page header text: "The Base44 → Supabase migration tool has been retired." Page body explains the migration is done. | Stale page (still routed in `App.jsx:64`) |
| `src/pages/{Breeding,CommunityConnect,Dashboard,Gallery,GeckoDetail,GeneticCalculatorTool,LikedGeckos,MarketplaceBuy,MarketplaceSalesStats,MyGeckos,OtherReptiles}.jsx` | `base44.auth.me()` and `base44.entities.*` calls | **Active** (proxied) |
| `src/pages/Lineage.jsx:5, 521, 808` | imports `base44 as base44Client`; `base44Client.auth.me()` (proxied) and **`base44Client.integrations.Core.UploadFile({ file })`** | **Active**, but the `integrations.Core.UploadFile` path is *not* proxied — line 808 will hit the SDK's built-in `integrations.Core.UploadFile`, which (per the comments in `Core.js`) is the dead Base44 endpoint. **This call is likely broken.** Other upload sites use the new `uploadFile()` from `@/lib/uploadFile`. |
| `src/components/changelog/ChangeLogModal.jsx:2, 91` | `base44.entities.ChangeLog.filter(...)` | **Active** (proxied) |
| `src/components/admin/ChangeLogManager.jsx:27, 29` | Comment: "drops the dead `base44.integrations.Core.InvokeLLM` call" + switches to Supabase `ChangeLog` entity | Stale comment; code is Active using the replacement |
| `src/components/admin/MassMessaging.jsx:37` | Comment about replacing `InvokeLLM` | Stale comment |
| `src/components/project-manager/FeedingGroupManager.jsx:72-73` | Dynamic `await import('@/api/base44Client')` then `base44.auth.me()` | **Active** (proxied) — note this is the only dynamic import of `base44Client`; might be a leftover micro-optimisation |
| `src/functions/{createGeckoFromEgg,generateCalendarEvent,generateLineageCertificate,syncWithMorphMarket,syncWithPalmStreet}.js` | Single-line shim: `(...args) => base44.functions.invoke('NAME', ...args)` | **Uncertain / Broken** — `base44.functions.invoke` is **not proxied**, so these go to the dead SDK endpoint at runtime. Whether they're called from any page would need a runtime check; the imports are present in some pages. |
| `src/functions/{generateCSVTemplate,importGeckosFromCSV,recognizeGeckoMorph}.js` | Header comments call out they "replace dead Base44 backend function" with client-side / Supabase code | Stale comments; code is Active |

### Asset URLs pointing to Base44 CDNs

| File:line | URL | Bucket |
|---|---|---|
| `src/lib/constants.js:11-12` | `https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68929cdad944c572926ab6cb/2ba53d481_Inspect.png` (with TODO comment to migrate) | **Active** — used as `APP_LOGO_URL` everywhere |
| `src/lib/organization-schema.js:29` | Same logo URL, hard-coded again | **Active** — used in JSON-LD |

The Base44 Supabase project is presumably still alive and serving assets. If/when it goes down, the logo breaks site-wide.

### Other comments / strings (Stale)

| File:line | What |
|---|---|
| `src/lib/morphUtils.js:5` | "the result of Base44 letting different users add their own versions" |
| `src/lib/breederUtils.js:4` | "Base44 stored the breeder a gecko came from as free-text in …" |
| `src/api/supabaseEntities.js:3, 252` | Header + "Named entity exports (same names as Base44)" |
| `src/entities/all.js:4` | "Data was migrated from Base44 via /AdminMigration." |
| `src/lib/constants.js:8` | TODO: migrate logo to own bucket |
| `supabase/migrations/20260417000004_classification_votes.sql`, `20260417000006_fix_review_gecko_image_text_id.sql`, `20260417000007_align_types_with_base44_schema.sql` | Migration headers reference Base44 schema legacy (e.g. "gecko_images.id is TEXT in prod (Base44 legacy)") |

### Auth flows that route through Base44

None at runtime. `src/lib/AuthContext.jsx` uses Supabase Auth exclusively; the only "Base44 auth" calls (`base44.auth.me/logout/loginWithRedirect/updateMe`) are intercepted by the proxy in `base44Client.js:34-63` and rewritten to Supabase.

### Summary

- **Load-bearing Base44 code**: the SDK + proxy shim in `base44Client.js`, the Vite plugin, and the `app-params.js` startup helper. Removing them requires rewriting every `base44.entities.*` import call site (~25 pages/components) and every `base44.auth.me()` call (~15 pages/components) to use Supabase directly — *or* keeping the shim indefinitely.
- **Probably-broken**: `src/functions/{createGeckoFromEgg,generateCalendarEvent,generateLineageCertificate,syncWithMorphMarket,syncWithPalmStreet}.js` (each calls `base44.functions.invoke` which has no proxy override), and `src/pages/Lineage.jsx:808` (`base44Client.integrations.Core.UploadFile`). These need runtime testing or grep-and-replace before integration.
- **Vendored**: the entire `base44/` top-level directory (entities + functions) is dead snapshot data — kept presumably for reference. ~30 files. Not imported anywhere outside `base44/`.
- **Cosmetic**: `package.json` name, the `Inspect.png` URL on the legacy bucket, `localStorage` keys prefixed `base44_`, scattered code comments.

---

## 6. Authentication and Data Layer

### Auth

- **Supabase Auth** is the only live auth provider. Hard-coded fallback URL + anon key in `src/lib/supabaseClient.js:3-9`.
- React state lives in `src/lib/AuthContext.jsx` (`AuthProvider`, `useAuth`). On mount it calls `supabase.auth.getSession()` then enriches with a row from the `profiles` table (`AuthContext.jsx:11-21, 31-44`). It also subscribes to `supabase.auth.onAuthStateChange`.
- A **Guest Mode** toggle (`src/lib/guestMode.js` + `src/lib/guestMockData.js`) lets unauthenticated visitors browse with synthetic data. The `base44.auth.me()` proxy returns `GUEST_USER` in that mode (`base44Client.js:39-42`), and the entity proxy returns mock fixtures or empty arrays (`supabaseEntities.js:153-158`). The yellow "demo" disclaimer was added in commit `bb9964a`.
- The `base44.auth` namespace is preserved as a compatibility shim only — every method is rewritten to Supabase (`base44Client.js:34-63`). The login route is `/AuthPortal` (`src/pages/AuthPortal.jsx`).

### Where data is stored

| Data | Storage |
|---|---|
| User identity + session | Supabase Auth (`auth.users`) |
| User profile (display name, membership tier, sidebar prefs, role) | Supabase `profiles` table, keyed on `email` (`AuthContext.jsx:14`, `entities/all.js:10-51`) |
| Geckos | Supabase `geckos` table, owner identified by `created_by` (email) and `breeder_user_id` (UUID) |
| All other entities | Supabase tables enumerated in `src/api/supabaseEntities.js:21-97` |
| Images / assets | Supabase Storage bucket `geck-inspect-media` (`src/lib/uploadFile.js:22`); legacy logo still on Base44's bucket |
| ML embeddings | `gecko_images.embedding` (per migration `20260417000005`) |

### Stripe / payments

- Membership flow (`src/pages/Membership.jsx:175-189`) calls `supabase.functions.invoke('stripe-checkout', { body: { tier, returnUrl } })` and redirects to the returned `data.url`. The edge function is **not in this repo** — it lives in the Supabase project. Failure path shows a toast "Stripe is not set up yet. Reach out if you want early access." which suggests the integration may still be inactive in some environments.
- Two related Supabase tables are mapped: `payment_events` (`PaymentEvent`) and `stripe_webhook_logs` (`StripeWebhookLog`) — `supabaseEntities.js:55, 59`. No client code reads them; they're presumably written by the webhook edge function.
- A grandfathered-membership flag (`isGrandfathered`) bypasses checkout (`Membership.jsx:165-171`).
- No `STRIPE_*` env vars in client code (correct — keys belong server-side).

### Access control / RLS

- All migrations from P1 onward `ALTER TABLE … ENABLE ROW LEVEL SECURITY` and add policies. Example from `supabase/migrations/20260413_p1_animal_passport.sql:104-133`:
  - Public `SELECT` policies: `Public can read ownership records`, `… feeding records`, `… shed records`, `… vet records`, `… transfer requests`.
  - Write policies: `Users manage own ownership records ON ownership_records FOR ALL USING (created_by = auth.jwt()->>'email')`, repeated for the other tables.
- The pattern is **email-based ownership** (`created_by` text column = `auth.jwt() ->> 'email'`), inherited from Base44.
- RLS for the legacy core tables (`geckos`, `morph_guides`, etc.) is **not in any committed migration** — those tables are part of the "remote-only snapshot placeholders" (`20260410…remote_snapshot.sql` files are empty stubs). Their RLS lives only in the Supabase project. This is a meaningful blind spot for an audit done from the repo alone.
- The `review_gecko_image` RPC (`migrations/20260417000007`) enforces role-based access at the function level: it reads `auth.jwt() ->> 'email'`, looks up `profiles.role`, and only proceeds if the role is `admin` or `expert_reviewer` (`SQL lines 36-44`).

---

## 7. Existing Morph / Trait List

There is no single source of truth. Every list below is presented separately; the integration session needs to pick a master and reconcile.

### 7a. `src/data/morph-guide.js` — canonical local catalogue (32 entries, 973 lines)

Schema per entry: `slug, name, aliases[], category, inheritance, rarity, priceTier, priceRange, summary, description, keyFeatures[], visualIdentifiers[], history, combinesWith[], notes`. Categories are `base | color | pattern | structure | combo`. Inheritances are `recessive | co-dominant | incomplete-dominant | dominant | polygenic | line-bred`.

| slug | name | category | inheritance | rarity |
|---|---|---|---|---|
| harlequin | Harlequin | pattern | polygenic | common |
| extreme-harlequin | Extreme Harlequin | pattern | polygenic | uncommon |
| pinstripe | Pinstripe | pattern | polygenic | common |
| phantom-pinstripe | Phantom Pinstripe | pattern | polygenic | rare |
| dalmatian | Dalmatian | pattern | polygenic | common |
| super-dalmatian | Super Dalmatian | pattern | polygenic | uncommon |
| flame | Flame | pattern | polygenic | common |
| tiger | Tiger | pattern | polygenic | uncommon |
| brindle | Brindle | pattern | polygenic | uncommon |
| extreme-brindle | Extreme Brindle | pattern | polygenic | rare |
| tiger-brindle | Tiger / Brindle | pattern | polygenic | uncommon |
| soft-scale | Soft Scale | structure | incomplete-dominant | uncommon |
| super-soft-scale | Super Soft Scale | structure | incomplete-dominant | rare |
| white-wall | White Wall | structure | incomplete-dominant | rare |
| white-wall-white-spot | White Wall White Spot | structure | incomplete-dominant | rare |
| cappuccino | Cappuccino | structure | incomplete-dominant | uncommon |
| frappuccino | Frappuccino | structure | incomplete-dominant | rare |
| lilly-white | Lilly White | structure | incomplete-dominant | uncommon |
| axanthic | Axanthic | color | recessive | rare |
| hypo | Hypo (Hypomelanistic) | color | line-bred | rare |
| patternless | Patternless | color | line-bred | common |
| moonglow | Moonglow | color | line-bred | rare |
| translucent | Translucent | color | line-bred | rare |
| red-base | Red Base | base | polygenic | uncommon |
| orange-base | Orange Base | base | polygenic | uncommon |
| yellow-base | Yellow Base | base | polygenic | common |
| olive | Olive | base | polygenic | uncommon |
| chocolate | Chocolate | base | polygenic | uncommon |
| lavender | Lavender | base | polygenic | rare |
| buckskin | Buckskin | base | polygenic | common |
| cream | Cream | combo | polygenic | uncommon |
| tricolor | Tricolor | combo | polygenic | uncommon |
| bicolor | Bicolor | combo | polygenic | common |

### 7b. `src/lib/morphUtils.js:97-130` — `KNOWN_MORPH_SLUGS`

A duplicated 32-slug list used by sitemap generation and cross-linking. Matches 7a slug-for-slug.

### 7c. `src/components/my-geckos/MorphIDSelector.jsx` — UI tag picker (~120 tags)

Hard-coded `MORPH_CATEGORIES` (full content quoted from the file):

- **Proven Genetics (Incomplete Dominant)**: Lilly White, Super Lilly White, Axanthic, **Albino**, Cappuccino, Super Cappuccino, Soft Scale, Super Soft Scale, Moonglow, Empty Back, Super Empty Back, White Wall.
- **Combo Morphs**: Frappuccino, Cappuccino Lilly White, Axanthic Lilly White, Axanthic Cappuccino, Soft Scale Lilly White, Soft Scale Cappuccino, Moonglow Lilly White.
- **Het Status**: Het / Possible Het variants of LW, Axanthic, **Albino**, Cappuccino, Soft Scale, Moonglow, Empty Back.
- **Base Patterns**: Flame, Chevron Flame, Harlequin, Extreme Harlequin, Pinstripe, Full Pinstripe, Phantom Pinstripe, Tiger, Brindle, Extreme Brindle, Patternless, Bicolor, Tricolor, Phantom, Whiteout.
- **Harlequin Variants**: Red Harlequin, Extreme Red Harlequin, Yellow Harlequin, Cream Harlequin, Orange Harlequin, Halloween Harlequin.
- **Pinstripe Variants**: Partial Pinstripe, Dashed Pinstripe, Reverse Pinstripe, Quad Stripe, Super Stripe.
- **Base Colors**: Red Base, Dark Red Base, Orange Base, Yellow Base, Bright Yellow Base, Cream Base, Pink Base, Olive Base, Dark Olive Base, Green Base, Tan Base, Brown Base, Dark Brown Base, Chocolate Base, Buckskin Base, Lavender Base, Near Black Base.
- **Color Traits**: Hypo, Translucent, High White, High Contrast.
- **Dalmatian & Spots**: Dalmatian, Super Dalmatian, Ink Spots, Oil Spots, Red Spots, Confetti, Spots on Head, Dalmatian Tail.
- **Structure & Texture**: Furred, Crowned.
- **Body Markings**: White Fringe, Kneecaps, Portholes, Drippy Dorsal, White Tipped Crests, Colored Crests, Side Stripe, Tiger Striping, Banded, Broken Banding, Chevron Pattern, Diamond Pattern, Reticulated, Mottled, Speckled.
- **Display State**: Fired Up, Fired Down, Full Tail, Tailless.

### 7d. `src/components/morph-id/morphTaxonomy.js` — ML training taxonomy (snake_case)

`PRIMARY_MORPHS` (24): patternless, flame, chevron_flame, harlequin, extreme_harlequin, super_harlequin, pinstripe, full_pinstripe, partial_pinstripe, phantom_pinstripe, reverse_pinstripe, quad_stripe, super_stripe, tiger, super_tiger, brindle, extreme_brindle, dalmatian, super_dalmatian, red_dalmatian, ink_spot, bicolor, tricolor.

`GENETIC_TRAITS` (12): **lily_white** (one l), axanthic_vca, axanthic_tsm, cappuccino, frappuccino, moonglow, soft_scale, whiteout, empty_back, white_wall, hypo, melanistic.

`SECONDARY_TRAITS` (~30): pinstripe-family modifiers, banding, dorsal patterns, spots, white placement, contrast, structural, fired-state. Includes `phantom` as a *contrast* trait.

`BASE_COLORS` (23): red, dark_red, crimson, orange, burnt_orange, yellow, bright_yellow, buttery, cream, pink, coral, olive, dark_olive, green, tan, buckskin, brown, dark_brown, chocolate, mahogany, lavender, charcoal, near_black.

Plus enums for `PATTERN_INTENSITIES`, `WHITE_AMOUNTS`, `FIRED_STATES`, `AGE_STAGES`, `SEX_OPTIONS`, `PHOTO_ANGLES`, `LIGHTING_OPTIONS`, `IMAGE_QUALITY_FLAGS`, `CONFIDENCE_PRESETS`, `PROVENANCE`, and a `COMMONLY_CONFUSED` adjacency map.

### 7e. `src/components/morph-id/normalizeMorphText.js` — free-text → id aliases

The `ALIASES` map is the closest thing to a synonym dictionary the codebase has. Every primary morph + genetic trait gets a list of acceptable spellings (e.g. `extreme_harlequin: ['extreme harlequin', 'ext harle', 'ext harley', 'ehr', 'ehq', 'e-harle']`). It's the right shape for a Foundation Genetics lookup.

### 7f. `src/lib/marketAnalytics/taxonomy.js` — pricing taxonomy (24 entries)

`CANONICAL_MORPHS` with `kind` ∈ `{COLOR, PATTERN, STRUCTURAL, RECESSIVE, CODOMINANT, POLYGENIC}` and `premium_tier` ∈ `{flagship, premium, mid, entry}`. Includes a `Sable` entry that doesn't appear in any other taxonomy. Tags Cappuccino, Frappuccino as RECESSIVE (contradicts 7a).

`HIGH_VALUE_COMBOS` (12 named pairings) used by the analytics module.

### 7g. `src/components/breeding/GeneticCalculator.jsx`

`CO_DOM_TRAITS = { Lilly White, Axanthic, Cappuccino, Soft Scale, Moonglow, Empty Back, White Wall }` — these are the only seven traits the Punnett-square code does math on.

`DOM_TRAITS` (~80 entries) — every other tag the calculator displays as presence/absence.

### 7h. `src/components/morph-visualizer/data/{traits,presets,genetics}.js`

A *fourth* parallel dataset, structured for the SVG renderer rather than the catalogue. Includes per-trait `visual: { layer: '…' }` hints and rendering presets like "Hypothetical moonglow aesthetic" (`presets.js:133`).

---

## 8. Known Issues and TODOs

### TODO / FIXME / HACK comments

A repo-wide grep on `TODO|FIXME|HACK` over `src/` returns only **two** matches:

| File:line | Comment |
|---|---|
| `src/lib/constants.js:8` | `// Logo hosted on the Base44 Supabase bucket. TODO: migrate to own bucket (mmuglfphhwlaluyfyxsp) or self-host in /public to eliminate the external dependency.` |
| `src/pages/Messages.jsx:138` | `// TODO: Replace with Supabase Realtime channel for instant updates.` |

(`XXX` as a comment marker isn't used; the only `XXX` in the codebase is the passport-code placeholder in `src/lib/passportUtils.js:6`.)

### Backup / deprecated files

`find` for `*-old.*`, `*-deprecated.*`, `*-backup.*`, `*.bak` over the whole repo: **no matches.**

### Probable broken / dead code worth flagging

Not surfaced by TODO comments, but found incidentally during the audit:

- **`src/pages/AdminMigration.jsx`** — UI tells the user the migration tool has been retired; route is still wired (`src/App.jsx:64`). Whole file could be deleted.
- **`src/functions/createGeckoFromEgg.js`, `generateCalendarEvent.js`, `generateLineageCertificate.js`, `syncWithMorphMarket.js`, `syncWithPalmStreet.js`** — each is a one-line `base44.functions.invoke('NAME', ...)` shim with no Supabase replacement. Will hit dead Base44 endpoints at runtime.
- **`src/pages/Lineage.jsx:808`** — `base44Client.integrations.Core.UploadFile({ file })` call when adding a placeholder image. Uses the dead Base44 path while every other upload site has been migrated to `@/lib/uploadFile`.
- **`src/lib/NavigationTracker.jsx:43`** — `base44.appLogs.logUserInApp(pageName).catch(() => {})` — silenced; likely throwing on every page load.
- **Two committed lockfiles**: `package-lock.json` (377 KB) and `pnpm-lock.yaml` (261 KB). Whichever the next dev runs first wins.
- **`base44/` top-level directory** (entities + functions, ~30 files) — vendored snapshot, not imported anywhere outside itself.
- **`MorphTrait` entity** is mapped at `supabaseEntities.js:51` but no caller in the app actually queries it. May be a dormant table.
- **Eight empty migration files** (`*_remote_snapshot.sql`) under `supabase/migrations/` are placeholders only — meaning the schema audit from this repo is incomplete; the real DDL for `geckos`, `profiles`, `morph_guides`, etc. lives only in the Supabase project.
- **Console-logged errors** (not flagged as bugs but indicative of paths that fail silently): `console.error` / `console.warn` are used as ordinary error handlers in `AuthContext.jsx:18, 25`, `entities/all.js:25, 44`, `Membership.jsx:185`, etc. None look like leftover debugging.

I did not find any large commented-out code blocks during the audit, but I did not exhaustively scan for them.

### Things I could not determine without runtime testing

- Whether `base44.appLogs.logUserInApp(...)` throws or silently no-ops with the current `@base44/sdk` version.
- Whether `base44.functions.invoke(...)` for the five non-replaced functions in `src/functions/` returns an error to callers that surfaces as a user-visible issue.
- Whether the `geckos.id` / `gecko_images.id` text-vs-UUID mismatch causes any FK breakage at runtime in P1 tables that declared `geckos(id) REFERENCES … UUID`.
- The actual row count and content of the `morph_guides` and `morph_traits` tables.

---

## 9. Integration Readiness Assessment

### Recommended option: **C — Hybrid**

- **Why not A (import the module as a dependency, refactor into its types):** Geck Inspect's data layer is already heavily denormalised — `morph_tags` is `array<string>`, every page stringly-types its trait names, the calculator and simulator each carry their own `CO_DOM_TRAITS` literal, and the marketplace filter, the SEO sitemap, the morph guide, the visualizer, and the ML pipeline each use a different naming convention (Title Case strings, snake_case ids, kebab-case slugs). Forcing all of them onto the new module's typed model means rewriting every form, every filter, every page query, plus a data migration to back-fill `morph_tags` rows that don't match the new ids (e.g. `'Lily White'` vs `'lilly-white'` vs `'Lilly White'`). Big surface area, big regression risk.
- **Why not B (port seed data and logic in-place):** Means re-doing the consolidation work the standalone module already solved, and having no shared truth between the two repos going forward — the next genetics fact change would have to be made twice.
- **Why C:** the standalone module is imported as the calculator + validator + canonical trait dictionary, and Geck Inspect keeps its existing UI components. A thin adapter layer (`src/lib/genetics/`) translates between the module's typed objects and the loose strings the UI passes around. Each consumer (calculator, simulator, MorphIDSelector, marketplace filter, recognition pipeline) is migrated individually, behind a feature switch if needed. The `morph_tags` field stays a text array for now; a slug-normalisation pass turns existing tags into the new ids on read.

### Estimated complexity: **Medium** (skewing large at the data layer)

- The genetics math itself is small — replacing `useBreedingSimulator` and `GeneticCalculator` is a few hundred lines.
- The hard part is the **dictionary reconciliation**: there are at least seven trait lists (Section 7) that disagree on capitalisation, slug format, and inheritance label. Mapping each onto the new module's canonical ids — and deciding what to do about non-canonical entries like `Albino`, `Sable`, `Halloween Harlequin`, `Whiteout`, `Empty Back` — is the bulk of the work.
- A second cost driver is that **a lot of UI is hard-coded** to specific inheritance strings (e.g. the public marketing page reads "recessive (Cappuccino, Axanthic)" as JSX text). Each of those needs to become a reference into the new module so future fact changes propagate.

### Things that should happen BEFORE integration

1. **Pick a package manager.** Delete the loser of `package-lock.json` vs `pnpm-lock.yaml` and add a `packageManager` field to `package.json`. Otherwise the integration session risks installs that diverge.
2. **Decide whether to keep the `base44.entities` / `base44.auth` proxies** (`src/api/base44Client.js`) or rip them out. If keeping, the new module can remain agnostic. If ripping, every `import { base44 } from '@/api/base44Client'` becomes its own change. Recommended: keep the proxy for now — it's working, it's small, and removing it is orthogonal to the genetics integration.
3. **Fix or delete the broken Base44 function shims** (`src/functions/{createGeckoFromEgg,generateCalendarEvent,generateLineageCertificate,syncWithMorphMarket,syncWithPalmStreet}.js`) and the `Lineage.jsx:808` upload call. Don't carry dead calls into the integration session.
4. **Migrate the `Inspect.png` asset** to the new Supabase bucket or `/public/` and update `src/lib/constants.js:11` and `src/lib/organization-schema.js:29`. The legacy Base44 bucket is a single point of failure for the site logo and JSON-LD.
5. **Snapshot the live `geckos.morph_tags` distribution** from production. Without a histogram of actual tag values, planning the slug-normalisation pass is guesswork. (E.g. how many rows still have `'Lily White'` vs `'Lilly White'`? Any `'Albino'` rows?)
6. **Pull the live RLS policies for `geckos`, `morph_guides`, `morph_traits`, `morph_reference_images`, `profiles`** out of the Supabase project and commit them as migrations. Right now the repo can't tell you what RLS you have on the core tables.
7. **Rename the package.** `"base44-app"` is misleading — `geck-inspect` matches everything else.
8. **Reconcile the public Cappuccino claim.** Even before integration, the public Genetic Calculator landing page (`src/pages/GeneticCalculatorTool.jsx:130, 137`) calls Cappuccino "recessive" while the calculator itself treats it as incomplete-dominant. This is a self-evident bug regardless of the Foundation Genetics module's verdict.

### Risks / blockers

- **Schema is partially undocumented in the repo.** The eight `*_remote_snapshot.sql` placeholder migrations mean the canonical DDL for the most-touched tables (`geckos`, `morph_guides`, `profiles`) lives only in Supabase. Integration planning that assumes those migrations are authoritative will be wrong.
- **Text vs UUID id mismatch.** `gecko_images.id` is `TEXT` in prod (per `migrations/20260417000006`) while the P1 migration declares `geckos(id)` foreign keys as `UUID`. Whether `geckos.id` is also `TEXT` in prod is not knowable from the repo. This may bite during data migrations.
- **Claude vision recognizer has its own taxonomy** in `supabase/functions/recognize-gecko-morph/taxonomy.ts` — separate from all four JS taxonomies. Integration must update this file too or the model will keep returning labels that don't match the new canonical ids.
- **Hard-coded Supabase project URL + anon key.** `src/lib/supabaseClient.js:5-9` ships a default project URL and anon key in the bundle. Not a security issue (anon keys are designed to be public), but it means anyone who clones the repo connects to the production database by default. Worth flagging.
- **Twin lockfiles** (`package-lock.json` + `pnpm-lock.yaml`) — see "before integration" #1.
- **The `base44/vite-plugin` runs at build time** and can mutate the Vite config; `vite.config.js:14-25` exists specifically to undo one of its mutations. Removing the Base44 SDK without removing the plugin (or vice versa) can break the build.

### Files to back up before any integration work

These are the files most likely to be rewritten and worth keeping a snapshot of:

- `src/data/morph-guide.js` (973 lines — the closest existing analogue of the Foundation Genetics dataset; useful as a comparison reference even after replacement)
- `src/data/genetics-glossary.js`, `src/data/genetics-jsonld.js`, `src/data/genetics-sections.jsx` (long-form public content; SEO-load-bearing)
- `src/components/my-geckos/MorphIDSelector.jsx` (the tag list users see)
- `src/components/morph-id/morphTaxonomy.js` (training labels — changing ids breaks model checkpoints)
- `src/components/morph-id/normalizeMorphText.js` (synonym dictionary)
- `src/lib/marketAnalytics/taxonomy.js` (pricing taxonomy)
- `src/components/breeding/GeneticCalculator.jsx` and `src/hooks/useBreedingSimulator.js` (the calculator/simulator math)
- `src/components/morph-visualizer/data/{traits,presets,genetics}.js` (the SVG visualizer dataset)
- `supabase/functions/recognize-gecko-morph/taxonomy.ts` (Claude vision taxonomy — outside `src/`)
- `src/lib/morphUtils.js` (slug helpers + `KNOWN_MORPH_SLUGS`)
- The current `morph_guides` and `morph_traits` table contents (production export, not a file in the repo)

`git` itself is the backup mechanism — committing the current `main` to a tagged `pre-foundation-integration` ref before the integration session begins is sufficient.





