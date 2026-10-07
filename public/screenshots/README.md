# Landing-page product tour screenshots

This folder feeds the `<ProductTour />` slideshow on the public landing page (`src/components/landing/ProductTour.jsx`) and the product shot beside the landing headline on laptops (`hero-gecko-record.webp`, used in `src/pages/Home.jsx`). The slide list and captions are defined in `src/data/product-tour.js`. A slide is only requested once it has `shipped: true`, so commit the image and flip the flag in the same change.

## Current captures

The record, lineage, and breeding slides were refreshed in October 2026 from the interactive guest demo with real gecko photographs. The photos are bundled under `public/demo-geckos/` so captures and the demo do not depend on external image redirects. See that folder's README for the public source records. Demo records and family relationships are fictional; photographs do not verify their listed traits. The slideshow footer and guest notice identify the sample data.

These are captures of the actual app, with no composited UI or generated geckos. Value estimates use the demo's Geck Data snapshot. The calculator, portfolio, and hero value-panel captures remain unchanged.

| Slide | Laptop file (1600 x 1000) | Phone file (4:5) | Demo page |
|---|---|---|---|
| One record per gecko | `gecko-record-real.webp` | `gecko-record-real-phone.webp` | `/GeckoDetail?id=mock-gecko-4` |
| Genetics calculator | `genetics-calculator.webp` | `genetics-calculator-phone.webp` | `/calculator?sireGecko=mock-gecko-2&damGecko=mock-gecko-1` |
| Multi-generation lineage | `lineage-tree-real.webp` | `lineage-tree-real-phone.webp` | `/Lineage?geckoId=mock-gecko-4` |
| Breeding plans | `breeding-planner-real.webp` | `breeding-planner-real-phone.webp` | `/Breeding` |
| Collection value | `portfolio.webp` | `portfolio-phone.webp` | `/Portfolio` |

Additional slides awaiting capture and review: dashboard, morph guide, AI morph ID, breeder storefront, and photo timeline.

## Capture tips

- Use the populated guest collection, dark theme, collapsed sidebar, and dismiss the optional demo tour and notice using their controls.
- Laptop: 1600 x 1000 viewport. Wait for all photos and value panels to load.
- Refreshed phone slides: capture a 390 x 844 viewport and crop a 390 x 488 section of actual content, below the header and above the bottom navigation. The record crop starts at y=180. For lineage, hide the detail strip and select 75% zoom, then crop from y=200. For breeding, scroll until the search field sits just below the header, then crop from y=68.
- The older calculator and portfolio phone images are 780 x 976. Both sizes have the same 4:5 framing and display below 640 px wide.
- Encode WebP around quality 82 to preserve photo detail and small interface text. Keep the new files lightweight; photo captures will be larger than flat placeholder drawings.
- Change the filename when replacing a shipped capture, and update its manifest entry, so returning visitors do not keep an older cached image.

## How to add a new slide

1. Add an entry to `PRODUCT_TOUR_SLIDES` in `src/data/product-tour.js` (`id`, `file`, optional `mobileFile`, `title`, `caption`, `captureUrl`).
2. Drop the matching files here.
3. Set `shipped: true` and commit both.
