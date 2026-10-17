# Generated Amazon product image display

This is a partial remediation. It prevents confirmed generated artwork from appearing as Amazon product photography. It does not add actual listing photos or change catalog data.

## Behavior

The August catalog seeds used `kind: representative`, `source: geck_inspect_original`, and `vendor_extra.image_is_generated_category_art` to identify generated images. A shared display filter now excludes those images from Amazon affiliate cards, detail galleries, Product JSON-LD, gecko recommendations and legacy cart thumbnails. Existing supplier and Creator Connections photos are preserved, including when an older product-level flag remains set.

Missing Amazon images show a neutral “See photos on Amazon” state. Affiliate destinations, descriptions and estimated pricing behavior stay unchanged. Other vendors and non-affiliate artwork are outside the filter. No assets, migrations, functions, secrets, agreements or retirement switches change.

The supplies store routes remain retired. Recommendation components also need the filter because they can load independently of the store routes. Their database selection now includes image provenance and the affiliate destination.

## Replacement blockers

The remaining generated-image products link to Amazon searches and do not identify exact product variants. Choosing a search result would introduce an unverified product selection. Exact ASIN/variant mappings and an authorized image source are required before replacing these images.

Amazon's [current image usage policies](https://affiliate-program.amazon.com/help/operating/policies) allow image-link caching for up to 24 hours but prohibit caching the API image itself. Images must retain their proportions and link to the relevant Amazon page. Permanent scraped CDN URLs or copied image files are not a replacement delivery mechanism.

Amazon identifies [Creators API as the supported successor to PA-API 5](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation). [GetItems](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/api-reference/operations/get-items) supplies image resources for exact identifiers. [Existing Associates eligibility and API credentials are required](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction). No Amazon image API integration was found in the repository; account eligibility was not established.

Completing replacement requires reviewed exact product mappings, authorized source access (or documented permission for exact supplier images), and a separate image-delivery/data update. If links must change, review each before/after destination and preserve its affiliate tag. This branch requires no database update to suppress generated images and does not alter the stored catalog images.

## Validation and evidence

- Full suite: 269 files and 3,037 tests passed, including 16 new image checks.
- Full lint: no errors; 74 existing warnings.
- Vite production bundle: passed with test environment values. This was not the network-backed publishing/prerender pipeline.
- Read-only catalog replay confirmed generated images are filtered and all other image arrays remain unchanged.
- Desktop (1280 px) and phone (390 px) visual checks covered real card, recommendation, detail and layout components with read-only catalog fixtures and mocked authentication/database access. No generated images, horizontal overflow or browser errors; existing supplier photos and affiliate destinations were preserved.

The detailed live-catalog provenance export, unresolved-product list, screenshots and browser results are retained privately in the task workspace. They are not published in this public repository. No production database writes, merge or manual deployment was performed.
