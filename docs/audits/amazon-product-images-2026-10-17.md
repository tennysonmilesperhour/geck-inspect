# Amazon product images and affiliate destinations

This is a partial remediation. It hides confirmed generated artwork and resolves four verified product destinations. Actual listing image replacements still require an authorized image delivery source.

## Affiliate destinations

The catalog already contains tagged affiliate links, including its Amazon searches. A search URL is not evidence of missing affiliate attribution.

The shared outbound-link resolver maps these four legacy searches to exact Amazon.com products, retaining the existing geckinspect09-20 tag. Detail pages were checked on 2026-10-17:

| Catalog product | Verified listing | Match |
| --- | --- | --- |
| Dymo LabelWriter 450 | [B0027JBLV4](https://www.amazon.com/dp/B0027JBLV4) | Base 450 Machine; not Turbo, Twin or Renewed |
| Hova-Bator 1602N | [B0145O6C0S](https://www.amazon.com/dp/B0145O6C0S) | GQF still/thermal-air 1602N; no fan/turner bundle |
| Rhacodactylus: The Complete Guide | [0974297100](https://www.amazon.com/dp/0974297100) | De Vosjoli, Repashy and Fast; paperback ISBN 9780974297101 |
| Uniheat 40-hour heat pack (10 pack) | [B00I3R1RMC](https://www.amazon.com/dp/B00I3R1RMC) | Exact duration and pack count |

Only the verified slug, title, original search query and existing tag can trigger a mapping. Direct links and subsequent catalog edits take precedence. Unresolved searches retain their destination and are labeled “Find on Amazon,” even when old metadata does not mark them as searches. Click logging records the actual resolved destination. Descriptions and price behavior stay unchanged.

This is a code-backed correction at the shared outbound-link component. No production database update is required. The catalog remains the stored source, and the code does not infer variants for generic product names.

## Generated images

The August catalog seeds used kind: representative, source: geck_inspect_original, and vendor_extra.image_is_generated_category_art to identify generated images. A shared filter excludes these from Amazon affiliate cards, detail galleries, Product JSON-LD, recommendations and legacy cart thumbnails. Existing supplier and Creator Connections photos are preserved, including when an older product-level flag remains set.

Missing Amazon images show a neutral “See photos on Amazon” state. Other vendors and non-affiliate artwork are outside the filter. No assets, migrations, functions, secrets, agreements or retirement switches change. Supplies routes remain retired; recommendations can load independently and also need the filter.

## Actual image replacement requirements

Research distinguishes exact matches from category matches, missing size/color/pack choices, unavailable models, and conflicting listing metadata. The unresolved inventory and evidence remain private. No similar product or scraped image is substituted.

Amazon's [image usage policies](https://affiliate-program.amazon.com/help/operating/policies) limit API image-link caching to 24 hours, prohibit caching the image itself, and require proportional images linked to the relevant Amazon page. Permanent scraped CDN URLs or copied image files do not provide a supported replacement mechanism.

[Creators API replaces PA-API 5](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation). [GetItems](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/api-reference/operations/get-items) supplies image resources for exact identifiers, subject to [account eligibility and authorized API access](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction). No usable Amazon image integration was found in the app. Account-specific access findings are retained privately.

Completing replacements requires authorized source access, or documented supplier permission for exact listing photos, followed by an image-delivery change. Neither the image filter nor the destination mappings modify stored catalog images.

## Validation and private evidence

The final branch passes 271 test files and 3,056 tests, including 35 image/destination checks. Full lint has zero errors and 74 existing warnings. The Vite production bundle passes with test environment values. The publishing/prerender pipeline was not run.

Read-only catalog replay checks that only intended images and destinations change. Desktop (1280 px) and phone (390 px) checks use real components with private catalog fixtures and mocked authentication/database access. Detailed provenance, unresolved variants, screenshots and browser observations stay in the private task workspace, outside this public repository.

No production database writes, merge or manual deployment were performed.
