# Landing-page product tour screenshots

This folder feeds the `<ProductTour />` slideshow on the public landing page (`src/components/landing/ProductTour.jsx`) and the product shot beside the landing headline on laptops (`hero-gecko-record.webp`, used in `src/pages/Home.jsx`). The slide list and captions are defined in `src/data/product-tour.js`. A slide is only requested once it has `shipped: true`, so commit the image and flip the flag in the same change.

## What is here (October 2026)

Captured from the guest demo collection (sample geckos) with Playwright. Value estimates come from the real Geck Data listings table (`trait_value_table`), read once and served to the browser. The demo's photos live on hosts the capture sandbox could not reach, so photo slots show the app's own no-photo placeholder. See `docs/planning/landing-speed-2026-10.md`.

| Slide | Laptop file (1600 x 1000) | Phone file (780 x 976, 4:5) | Demo page |
|---|---|---|---|
| One record per gecko | `gecko-record.webp` | `gecko-record-phone.webp` | `/GeckoDetail?id=mock-gecko-4` |
| Genetics calculator | `genetics-calculator.webp` | `genetics-calculator-phone.webp` | `/calculator?sireGecko=mock-gecko-2&damGecko=mock-gecko-1` |
| Multi-generation lineage | `lineage-tree.webp` | `lineage-tree-phone.webp` | `/Lineage?geckoId=mock-gecko-4` |
| Breeding plans | `breeding-planner.webp` | `breeding-planner-phone.webp` | `/Breeding` |
| Collection value | `portfolio.webp` | `portfolio-phone.webp` | `/Portfolio` |

Still to capture (they need real photos, so capture on production): dashboard, morph guide, AI morph ID, breeder storefront, photo timeline.

## Capture tips

- Laptop: 1600 x 1000 viewport, dark theme, sidebar collapsed, demo tour card and toasts closed. Phone: 390 px wide at 2x, top 488 px of the screen (below the header, above the bottom nav).
- WebP at quality 70 to 75. Every file here is under 50 KB.
- Phone files go in `mobileFile`; the tour shows them below 640 px wide in a 4:5 frame.

## How to add a NEW slide

1. Add an entry to `PRODUCT_TOUR_SLIDES` in `src/data/product-tour.js` (`id`, `file`, optional `mobileFile`, `title`, `caption`, `captureUrl`).
2. Drop the matching files here.
3. Set `shipped: true` and commit both.
