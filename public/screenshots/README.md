# Landing-page product tour screenshots

This folder feeds `ProductTour` on the public homepage and `HeroProductShot` beside the main headline. The active filenames and captions are defined in `src/data/product-tour.js` and `src/pages/Home.jsx`.

## Morph-matched captures, October 14, 2026

The current `*-matched.webp` assets were captured from the actual guest demo in Chrome. Every pictured animal uses the reviewed photo-and-trait registry in `src/data/demo-gecko-portraits.js`. Source records and the visual audit are documented in `public/demo-geckos/README.md`. The sample names, pedigrees, care records, and sales are fictional. Value estimates use the existing dated Geck Data snapshot or the sample asking price shown in the app.

| Slide | Desktop (1600 × 1000) | Phone (390 × 488) | Demo route |
|---|---|---|---|
| One record per gecko | `gecko-record-matched.webp` | `gecko-record-matched-phone.webp` | `/GeckoDetail?id=mock-gecko-4` |
| Genetics calculator | `genetics-calculator-matched.webp` | `genetics-calculator-matched-phone.webp` | `/calculator?sireGecko=mock-gecko-2&damGecko=mock-gecko-1` |
| Multi-generation lineage | `lineage-tree-matched.webp` | `lineage-tree-matched-phone.webp` | `/Lineage?geckoId=mock-gecko-4` |
| Breeding plans | `breeding-planner-matched.webp` | `breeding-planner-matched-phone.webp` | `/Breeding` |
| Collection value | `portfolio-matched.webp` | `portfolio-matched-phone.webp` | `/Portfolio` |

The hero uses `hero-gecko-record-matched.webp`, a 1040 × 844 crop of the same record capture. Older unreferenced screenshots remain historical assets; current references use new filenames so cached previews cannot retain the old mismatches.

## Capture guidance

- Desktop viewport: 1600 × 1000, dark theme, sidebar collapsed, tour and notice dismissed.
- Phone viewport: 390 × 844, cropped to 390 × 488 below the header. The lineage view uses 75% zoom with traits visible. Calculator and portfolio captures scroll to the populated photo rows.
- WebP at quality 85. Only mechanical cropping and compression, with no image retouching or replacement of screenshot content.
- When a portrait or morph label changes, refresh every affected desktop and phone slide plus the hero in the same change.
- A slide is requested only when `shipped: true`; add its assets and flag together. Dashboard, morph guide, Morph ID, breeder storefront, and photo timeline remain unshipped.
