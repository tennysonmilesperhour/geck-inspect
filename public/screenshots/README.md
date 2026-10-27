# Landing-page product tour screenshots

This folder feeds `ProductTour` on the public homepage and `HeroProductShot` beside the main headline. The active filenames and captions are defined in `src/data/product-tour.js` and `src/pages/HomeControl.jsx`.

## Morph-matched captures, October 14, 2026

The original `*-matched.webp` assets were captured from the actual guest demo in Chrome. Every pictured animal uses the reviewed photo-and-trait registry in `src/data/demo-gecko-portraits.js`. Source records and the visual audit are documented in `public/demo-geckos/README.md`. The sample names, pedigrees, care records, and sales are fictional. Value estimates use the existing dated market snapshot or the sample asking price shown in the app.

| Slide | Desktop (1600 × 1000) | Phone (390 × 488) | Demo route |
|---|---|---|---|
| One record per gecko | `gecko-record-market.webp` | `gecko-record-matched-phone.webp` | `/GeckoDetail?id=mock-gecko-4` |
| Genetics calculator | `genetics-calculator-matched.webp` | `genetics-calculator-matched-phone.webp` | `/calculator?sireGecko=mock-gecko-2&damGecko=mock-gecko-1` |
| Multi-generation lineage | `lineage-tree-matched.webp` | `lineage-tree-matched-phone.webp` | `/Lineage?geckoId=mock-gecko-4` |
| Breeding plans | `breeding-planner-matched.webp` | `breeding-planner-matched-phone.webp` | `/Breeding` |
| Collection value | `portfolio-market.webp` | `portfolio-market-phone.webp` | `/Portfolio` |

The hero uses `hero-gecko-record-market.webp`, a 1040 × 844 crop of the same record capture. Unaffected screenshots retain their existing filenames. Refreshed images use new filenames so cached previews cannot retain old labels.

## Source-neutral refresh, October 26, 2026

The record, hero, and portfolio images now use `*-market.webp` filenames, captured from the updated guest demo. These replace all historical captures containing data-collector badges. Fresh filenames prevent cached previews from retaining the old labels. The portfolio phone image is a 390 × 488 crop below the header.

## Capture guidance

- Desktop viewport: 1600 × 1000, dark theme, sidebar collapsed, tour and notice dismissed.
- Phone viewport: 390 × 844, cropped to 390 × 488 below the header. The lineage view uses 75% zoom with traits visible. Calculator and portfolio captures scroll to the populated photo rows.
- WebP at quality 85. Only mechanical cropping and compression, with no image retouching or replacement of screenshot content.
- When a portrait or morph label changes, refresh every affected desktop and phone slide plus the hero in the same change.
- A slide is requested only when `shipped: true`; add its assets and flag together. Dashboard, morph guide, Morph ID, breeder storefront, and photo timeline remain unshipped.
