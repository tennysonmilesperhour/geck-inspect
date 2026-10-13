# Ball python app: plan (13 Oct 2026)

Status: planned, nothing built yet. Decision 43 in `docs/DECISIONS.md`.

## What we are building

A ball python site that is built from this repo and deployed as its own Vercel project on its own subdomain. It shares the Supabase project, login and plan with Geck Inspect, so one account sees one collection. geckinspect.com stays crested gecko only: no ball python copy, nav or SEO on it.

The same approach later covers boas, bearded dragons and jeweled lacertas. Ball pythons go first because the market is the largest.

## Why one repo with a build-time species setting

- A monorepo with a shared package is the cleaner end state, but it means moving the shared code out of `src/` first (about 41 files read the `geckos` table, plus auth, billing and UI). That is weeks of refactor with nothing visible at the end.
- A build-time setting (`VITE_SITE_SPECIES`, default `crested`) gives each deploy its own brand, nav, landing page, sitemap and SEO from the same code. It can be split into packages later if the species code grows.
- The risk is that species code leaks into each other. The rule that prevents it: species-specific data and pages live in their own folders (`src/data/ball-python/`, `src/pages/ball-python/`), and shared pages read from a species config instead of hard-coding "gecko".

## What is already in place

- `geckos.species` exists (default `'Crested Gecko'`). Ball pythons can use the same table with `species = 'Ball Python'`. No new table for the animal itself.
- `other_reptiles` is a thin table with no breeding, lineage or weights. Its rows should be migrated into `geckos` with the right species once the ball python app exists, then the page retired.
- Sire and dam links, weights, feeding, photos, passports and transfers all hang off `geckos`, so they work for any species once the UI stops saying "gecko".

## What is crested-only today and must be gated

- Market data and value estimates (`trait_value_table`, Market page, Portfolio valuation). Decision 31: other species are never priced from crested listings. Ball pythons show cost basis or a manual value until they have their own data.
- Morph ID (trained on crested morphs), the genetics calculator, the morph guide, the genetics guide, the care guide.
- Landing page, SEO metadata, sitemap, llms files, prerender, the store stickers.

## Phases

### Phase 0: decisions (needs Tennyson)
1. Subdomain (`ballpython.geckinspect.com`, one login across apps) or its own domain (own SEO and brand, but a separate login or a sign-in handoff). Default assumed in this plan: subdomain.
2. Brand name for the ball python site.
3. Same plan and price across species, or a separate plan per species.

### Phase 1: the species setting (about 2 days, no visible change on geckinspect.com)
- `src/lib/siteConfig.js`: species key, display names ("animal", "ball python"), brand, domain, nav list, feature flags (market, morph ID, calculator).
- Replace hard-coded "gecko" strings in the shared shell (Layout, My Collection, empty states) with config values. Crested output must stay byte-identical.
- Make `build-sitemap`, `build-llms-full`, `prerender`, `build-vercel-json` and `seo-audit` read the species config so each deploy emits its own files.
- Second Vercel project pointing at this repo with `VITE_SITE_SPECIES=ball-python` and a "skip the build if nothing relevant changed" rule, so pushes to `main` do not rebuild everything twice.

### Phase 2: shared collection (about 1 week)
- Collection list, add and edit forms, photos, weights, feeding, lineage, passports and transfers work for `species = 'Ball Python'`.
- A species filter in the collection and a "This species / Whole collection" toggle on Portfolio and Breeding Season.
- Migrate `other_reptiles` rows into `geckos`.
- Top bar species switcher on desktop: links between the apps, hidden unless the member owns an animal in more than one species.

### Phase 3: ball python genetics (the long part, several weeks)
- Gene list with inheritance type: recessive (Albino, Piebald, Clown, Axanthic, Ghost), codominant (Pastel, Spider, Mojave, Lesser, Fire and the super forms), dominant, plus het and possible het handling.
- A calculator that handles super forms and the known lethal and wobble combinations (Spider, Champagne, Super Spider).
- A morph guide and a care guide written for ball pythons.
- Reuse the crested calculator's structure, but the gene model is different enough that it is a separate engine, not a config.

### Phase 4: market and Morph ID for ball pythons
- Only after phase 3 and only if the app has users. Needs its own listing data. Morph ID needs its own training set.

## Things that can go wrong

- **Login across domains.** Supabase stores the session in the browser per origin. Subdomains can share it with a cookie setup; separate domains cannot without extra work.
- **Mobile apps.** The iOS and Android apps stay crested only. Do not point Capacitor at the species build.
- **Stripe and RevenueCat.** One customer record per user, so the plan has to be readable from both apps. Decide before phase 2.
- **Build time and cost.** The build runs lint, tests, prerender and the SEO audit, so two projects roughly double deploy minutes.
- **Dilution.** Crested users should not see ball python UI unless they own a ball python.

## Done means

geckinspect.com is unchanged. The ball python site loads on its own domain, a member signs in once and sees their ball pythons, adds one with photos and weights, and the portfolio toggle shows crested only or the whole collection.
