# Landing-page product tour screenshots

This folder feeds the `<ProductTour />` slideshow on the public landing page (`src/components/landing/ProductTour.jsx`) and the product shot beside the landing headline on laptops (`hero-gecko-record.webp`, used in `src/pages/Home.jsx`). The slide list and captions are defined in `src/data/product-tour.js`. A slide is only requested once it has `shipped: true`, so commit the image and flip the flag in the same change.

## What is here (October 2026)

Recaptured from the guest demo collection with bundled real photos from the admin collection. All eight source geckos have exact hatch dates before October 6, 2024, verified on October 6, 2026. Photo names and hatch dates are recorded in `src/lib/demoGeckoPhotos.js`; the demo records remain illustrative. Value estimates use the existing dated Geck Data snapshot. Both the product tour and `hero-gecko-record.webp` now include actual gecko photos.

| Slide | Laptop file (1600 x 1000) | Phone file (780 x 976, 4:5) | Demo page |
|---|---|---|---|
| One record per gecko | `gecko-record.webp` | `gecko-record-phone.webp` | `/GeckoDetail?id=mock-gecko-4` |
| Genetics calculator | `genetics-calculator.webp` | `genetics-calculator-phone.webp` | `/calculator?sireGecko=mock-gecko-2&damGecko=mock-gecko-1` |
| Multi-generation lineage | `lineage-tree.webp` | `lineage-tree-phone.webp` | `/Lineage?geckoId=mock-gecko-4` |
| Breeding plans | `breeding-planner.webp` | `breeding-planner-phone.webp` | `/Breeding` |
| Collection value | `portfolio.webp` | `portfolio-phone.webp` | `/Portfolio` |

Still to capture: dashboard, morph guide, AI morph ID, breeder storefront, photo timeline.

## Capture tips

- Laptop: 1600 x 1000 viewport, dark theme, sidebar collapsed, demo tour card and toasts closed. Phone: 390 px wide at 2x, a 488 px crop below the header. Calculator and portfolio phone captures scroll to the populated photo rows.
- WebP at quality 78, with optimized bundled photos for reliable captures.
- Phone files go in `mobileFile`; the tour shows them below 640 px wide in a 4:5 frame.

## How to add a NEW slide

1. Add an entry to `PRODUCT_TOUR_SLIDES` in `src/data/product-tour.js` (`id`, `file`, optional `mobileFile`, `title`, `caption`, `captureUrl`).
2. Drop the matching files here.
3. Set `shipped: true` and commit both.
