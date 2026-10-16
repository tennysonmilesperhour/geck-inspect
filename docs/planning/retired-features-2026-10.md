# Retired features and the smaller menu, October 2026

Review item E3 23 ("retire breadth") and the menu half of E3 25 (the Today screen and the phone tabs), from Part E of `comprehensive-review-2026-10-14.md`. Built on 16 October 2026.

The rule the review set: take what nobody uses out of the app behind a switch, keep every database table, and delete the code only after a month with no traffic. Nothing here deletes data. Every retired page redirects somewhere sensible, and a member who follows an old link sees one short note saying why.

## 1. What was retired

Usage is from production, read only, for the 30 days to 15 October 2026 (`user_events` page views and each feature's own tables). "Admin" is Tennyson's own account.

| Feature | What it did | Real use in the last 30 days | Where its links go now | Tables kept |
|---|---|---|---|---|
| **Promote** (`/Promote`) | Drafted social posts about a gecko | None. 6 posts ever, the last on 18 August; no platform connections and no uploaded images ever. The page was already switched off in the admin Pages tool on 18 August. | `/MyGeckos`, with the note "Promote is switched off" | `social_posts`, `social_post_variants`, `social_post_usage`, `social_post_photo_usage`, `social_generation_log`, `social_platform_connections`, `social_referral_bonuses`, `promote_images`, `promote_image_usage` |
| **AI Consultant** (`/BreederConsultant`) | A chat assistant for care and breeding questions | None. No conversation was ever saved, and the page was switched off in the Pages tool on 15 April. | `/CareGuide`, with a note pointing to the guides and the Forum | `consultant_conversations` |
| **Other Reptiles** (`/OtherReptiles`) | Records for non-gecko animals | No member edits. Two members opened the page; neither had any reptiles (or geckos). 12 records exist: 9 are the admin's, 3 belong to one imported profile that cannot sign in (last edited 10 January). | `/MyGeckos`, with a note that the records are kept and support can send a copy | `other_reptiles`, `reptile_events` |
| **Supplies store and sticker builders** (`/Store` and everything under it: the catalogue, cart, the custom sticker and tee designers) | Affiliate supplies, and stickers made from a gecko's record | No purchases ever (0 orders; all 4 carts empty). One member opened the store twice on 23 September and added nothing. The sticker designer was used by the admin and by 4 signed-out visits on 6 and 7 October. | `/CareGuide`, with a note that the store is closed and each passport has a printable QR card. The "Make a sticker" card on gecko records is hidden too. | `store_products`, `store_categories`, `store_vendors`, `store_carts`, `store_cart_items`, `store_orders`, `store_order_items`, `store_fulfillments`, `store_promo_codes`, `store_signup_grants`, `store_affiliate_clicks` |
| **Website builder** (the visual editor on My Store) | Templates, fonts and sections for a breeder's store page | Not used. The only store page is the admin's, has no website design saved, and was last edited on 17 May. | My Store still opens; only the visual editor is hidden. A design saved before keeps showing on the public page and is saved back unchanged. | `breeder_store_pages` (unchanged) |
| **Guess the Price** | A daily price-guessing game | None. No guess was ever saved. It already left the Market tabs on 6 October (`?tab=game` opens the Today tab). Its last mention, in the demo market brief, is gone. | `/Market` | `price_game_rounds`, `price_game_guesses` |
| **Morph Visualizer** | A gecko drawing that changed with chosen traits | Retired on 2 October (switched off for members since 15 May). 7 visits to the old address, all redirected, none by members. | `/MorphGuide` (unchanged) | none of its own |
| **Community Connect** | A breeder directory with its own forum tab | Retired on 2 October. 10 visits to the old address, all redirected. The one remnant, a line in the built-in "What's new" list that still offered it, now says it was retired. | `/Forum` (unchanged) | none of its own |
| **Morph study preview** | A local morph-recognition study (14 October) | None possible: it only exists on the developer preview page (`/DesignPreview`), which production builds leave out. The 12 hits on that address in production were the "page not found" page. | Nothing to switch | none |

No feature on the list had a member other than the admin using it, so nothing was kept back. The production counts above were checked again on 16 October.

## 2. The menu

The sidebar is now one fixed list (`NAV_GROUPS` in `src/lib/navItems.js`), and a page not on it does not show, even when its row in the admin Pages tool says enabled. The Pages tool can still hide a listed page.

**Breeder sidebar, 12 destinations:** Dashboard; Collection: Today, My Geckos; Breeding: Breeding, Lineage, Business Tools; Tools: Morph ID, Market Intelligence; Learn: Morph Guide, Care Guide, Genetics Guide; Community: Forum.

**Keeper mode, 8:** Dashboard, Today, My Geckos, Morph ID, Morph Guide, Care Guide, Genetics Guide, Forum. Market Intelligence is now a breeder page in Keeper mode (it is a selling tool).

Before: 20 in the default list (12 in Keeper mode), and 17 in production, where old Pages tool rows added Sell Geckos, My Profile and Other Reptiles.

Pages that left the sidebar but stay live, and where to find them:

| Page | Still reached from |
|---|---|
| Season Planner, Season Timeline, Pairing Planner | A "Plan ahead" row at the top of the Breeding page; the quick search |
| Portfolio | Market Intelligence, each gecko's value card, Market Pricing; the quick search |
| Field Mode | The phone's Log tab, the Today page's Field Mode button, the one-tap log page, passports; the quick search |
| Community Gallery | The Dashboard; the quick search |

The quick search (command palette) now uses one name per page, the same as the sidebar (Breeding, Lineage, Season Planner, Morph ID), and keeps the old names as search words.

`src/lib/navItems.derived.test.js` holds both limits, against the default list and against the rows production has in `page_config`, so the sidebar cannot grow past 12 again without a failing test.

## 3. The phone tabs and Today

The phone's bottom bar is now **Today, Geckos, Log, More**. On a phone the app opens on Today: opening the site at its home address and opening the installed app both land there (`src/lib/pwaLaunch.js` also moves older phone installs that start at My Geckos). Signing in with Google or an email link still lands on My Geckos (the redirect in `src/components/auth/LoginPortal.jsx`), one tap from Today. Laptops keep the Dashboard and the sidebar, and a desktop install keeps opening on My Geckos. Log opens a short sheet: Feeding, Weigh-in, Shed, or Field Mode. More opens the full menu.

Today lists what is due today and overdue (feedings, weigh-ins, eggs close to hatching, vet follow-ups, Season Planner tasks and open pairing windows), then the week ahead, then the collection. A feeding takes two taps from a cold open: **Log feeding**, then **Fed**. The list comes from `public.my_care_today` (migration `20261016090100_nav.sql`), which uses the reminder jobs' own rules for feedings, weigh-ins, vet follow-ups and Season Planner tasks, so the screen agrees with those reminders; a regression file checks it against the feeding and weigh-in jobs. Eggs are the one small difference: a clutch with an expected hatch date shows from 7 days before that date, which can be a little before the hatch alert itself (the alert also waits for the member's hatch alert days since laying). The last copy is kept on the phone, so Today opens with no signal, and a log saved on the phone but not yet sent shows as saved. Guests in the demo, and signed-out visitors who open `/Today`, see the demo collection's day.

## 4. How to switch one back on

- **A retired page** (Promote, AI Consultant, Other Reptiles, the store): delete its entry in `RETIRED_PAGES` (`src/lib/retiredPages.js`). The page still has its line in `src/pages.config.js`, so its route comes back. To put it back in the sidebar too, add it to `NAV_GROUPS` and give it a `sidebar` block in `NAV_REGISTRY` (`src/lib/navItems.js`), check the sidebar still fits in 12 (8 in Keeper mode), and update `src/lib/navItems.derived.test.js`. Run `node scripts/build-vercel-json.mjs` so the edge redirect goes too.
- **One catch when switching back on:** the edge redirects for the old addresses are permanent ones (HTTP 301), and browsers remember those. Someone who already visited `/Promote`, `/BreederConsultant`, `/OtherReptiles` or `/Store` after 16 October keeps landing on the redirect target when they type or bookmark that address, until their browser cache clears. Links inside the app are not affected (they never reach the edge). If a page might come back soon, make its edge redirect temporary first (302, in `scripts/build-vercel-json.mjs`).
- **The store**: also brings back the "Make a sticker" card on gecko records (`src/components/store/StickerGeckoActions.jsx` reads the same switch).
- **The website builder**: delete the `websiteBuilder` line in `RETIRED_FEATURES` (`src/lib/retiredPages.js`).
- **The AI Consultant**: the Membership page lists its message allowance again only when the page is both not retired and switched on in the Pages tool (`pageIsLive` in `src/lib/membershipFeatures.js`).

## 5. When the code can go

Deleting the code is the next step after a month with no traffic, and the tables stay either way.

| Code | Retired | Can be deleted from | Notes |
|---|---|---|---|
| Morph Visualizer: `src/pages/MorphVisualizer.jsx`, `src/components/morph-visualizer/` | 2 October | 2 November | Move `src/components/morph-visualizer/data/traits.js` somewhere neutral first: `scripts/check-genetics-consistency.mjs` reads it. |
| Guess the Price helpers in `src/lib/marketHabit.js` and their tests | 6 October | 6 November | The admin Market habit card mentions it in a comment only. |
| Promote: `src/pages/Promote.jsx`, `src/components/promote/`, `src/lib/postCraft.js` | 16 October | 16 November | The `generate-social-post` function and the monthly `report-social-overage` job belong with it (see section 6). |
| AI Consultant: `src/pages/BreederConsultant.jsx`, `src/lib/assistantActions.js`, `src/lib/consultantContext.js`, `src/lib/consultantConversations.js` | 16 October | 16 November | The `invoke-llm` function is shared with other features; keep it. |
| Other Reptiles: `src/pages/OtherReptiles.jsx`, `src/components/other-reptiles/` | 16 October | 16 November | Reminders and the Dashboard still read `other_reptiles` (section 6). |
| Supplies store: `src/pages/Store.jsx`, `src/components/store/`, `src/lib/store/` | 16 October | 16 November | `StickerGeckoActions` is used on gecko records; remove those two lines with it. |
| Website builder: `src/components/storefront/WebsiteBuilder.jsx` | 16 October | 16 November | Keep `StorefrontWebsite` (the public page uses it) and `src/lib/storeWebsite.js`. |
| Morph study preview: `src/components/preview/morph-study/` | never in production | when the study is finished or dropped | Developer preview only. |

## 6. Left as they were, on purpose

- **The monthly social-post overage job** (`monthly-overage-billing`, calling `report-social-overage`) is still scheduled. With no posts it bills nothing, but it touches Stripe, so switching it off is Tennyson's call, not a session's.
- **Tennyson's own two reptiles** with feeding reminders on still get them: the daily feeding job, the Dashboard's next actions and the feeding pop-ups still read `other_reptiles`, and the reminder links to `/OtherReptiles`, which now redirects with the note. Turn the reminders off on those two records, or decide to drop reptiles from the job.
- **The admin Pages tool** still lists pages that are no longer in the sidebar; switching one on there no longer adds it to the sidebar.
