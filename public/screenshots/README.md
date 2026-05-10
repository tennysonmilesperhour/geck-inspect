# Landing-page product tour screenshots

This folder feeds the `<ProductTour />` slideshow on the public landing page (`src/components/landing/ProductTour.jsx`). The slide list and captions are defined in `src/data/product-tour.js`. Drop a PNG/WebP here with the matching filename and the slide auto-activates on next page load. Files that don't exist yet are silently skipped.

## What to capture

Eight slides are configured. Capture each at **1600 × 1000 px (16:10)**, PNG or WebP (WebP preferred for size).

| File | Page to capture | What to show |
|---|---|---|
| `dashboard.png` | `/Dashboard` | Populated dashboard ,  recent activity, weights due, breeding pairs |
| `lineage-tree.png` | `/MyGeckos` → open a gecko → Lineage tab | Multi-generation tree with at least 3 generations visible |
| `genetics-calculator.png` | `/calculator` | A populated calculation with multi-trait outcomes |
| `morph-guide.png` | `/MorphGuide` | The morph index grid with photo tiles |
| `ai-morph-id.png` | `/MorphIdentifier` (or wherever AI ID lives) | Result view with primary morph + secondary traits + confidence |
| `breeder-storefront.png` | `/Breeder/<your-slug>` | Curated storefront with banner + for-sale grid |
| `photo-timeline.png` | `/GeckoDetail?id=<gecko-with-many-photos>` | The auto-advancing photo timeline of one gecko |
| `breeding-planner.png` | `/Breeding` | Season planner with active pairings and clutch logs |

## Capture tips

- Use a **wide laptop viewport** (1440+ wide), browser zoom 100%.
- Use a **populated demo collection** so it doesn't look like an empty state.
- Crop tightly to remove browser chrome (no Chrome tabs, no OS window decorations). The tour frames the image inside a card, so include in-app header/sidebar but nothing outside the app.
- Dark theme is preferred (it matches the landing page background gradient).
- Re-export anytime; the slideshow picks up the latest file automatically on next deploy.

## How to add a NEW slide

1. Add an entry to `PRODUCT_TOUR_SLIDES` in `src/data/product-tour.js` (give it `id`, `file`, `title`, `caption`, `captureUrl`).
2. Drop the matching `<file>.png` here.
3. Commit both. The slideshow will start showing it.
