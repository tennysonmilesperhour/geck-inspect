# Storefront / Selling-Surface Consolidation

> **Usage reality check (2026-07-09, from production):** the whole database has
> **1** `breeder_store_pages` row and **0** `breeder_profiles` rows. The
> storefront feature is barely adopted yet, so the two-writer race and the
> overlapping public surfaces affect ~1 real user, and the `/store → /Breeder`
> redirect cannot even resolve (there are no `breeder_profiles.custom_slug`
> values to target). This makes the full consolidation LOW-URGENCY
> maintainability work, not a live-impact fix. **Step 1 (drop the dead
> BreederStorefront nav entry) shipped 2026-07-09.** The deep editor merge and
> the public-URL redirect are deferred: they are a large, hard-to-runtime-test
> refactor whose payoff scales with storefront adoption, which is currently
> near zero. Revisit when breeders actually start creating storefronts.


Status: proposal (analysis only, no code changed)
Author: file-search analysis, 2026-07-08
Scope: the overlapping "breeder selling / storefront" page surfaces plus the redundant
Marketplace tab shell. The customer supplies **Store** is a different product and is only
in scope to be explicitly kept separate.

---

## 1. What each surface actually is

### `src/pages/Store.jsx`: Customer supplies store (DIFFERENT PRODUCT)
- **Renders:** a self-contained sub-router (`Store.jsx:33-48`) mounted at `/Store/*` with its
  own chrome (`StoreLayout`), landing, category, product detail, cart, Stripe checkout success,
  and order history. Audience = **any customer buying physical supplies** (food, kits, gifts),
  guest or authed.
- **Tables / entities:** the whole `src/components/store/*` tree (StoreProduct, StoreCart,
  StoreOrders, StoreOrderDetail, StoreCheckoutSuccess, AddToCartButton, ProductCard,
  FoodRunoutWidget, RecommendedKitForGecko). This is a Stripe-backed product/order system, not
  a breeder storefront. No `breeder_store_pages` / `breeder_profiles` involvement.
- **Routed at:** `/Store/*`, declared in `App.jsx:107,284,339` (both the unauthenticated and
  the in-Layout route sets). Note the **capital-S `/Store`** vs the breeder **lowercase
  `/store/:slug`**; they are distinct routes that only differ by case.
- **Nav-reachable:** yes. `navItems.js:107` (`FALLBACK_NAV_ITEMS.collection`, "Supplies",
  `requires_auth:false`) and `SECTION_FOR_PAGE.Store='manage'` (`navItems.js:54`).
- **Verdict: KEEP, untouched.** Separate product. Its only naming risk is the `/Store` vs
  `/store` case collision (see §4).

### `src/pages/StorePage.jsx`: Public curated breeder storefront (`/store/:slug`)
- **Renders:** a chrome-free public page (only a floating "Geck Inspect" pill) that reads as the
  breeder's own site. Hero, about, a **curated** gallery of hand-picked geckos bucketed by
  status (available/reserved/sold/showcase), curated pairings, policies, contact + external
  links, owner signature. Audience = **a buyer viewing one breeder**.
- **Reads:** `breeder_store_pages` by `slug` (`StorePage.jsx:297-301`), `profiles` by
  `owner_email` (`:310-314`), `geckos` by `featured_gecko_ids` (`:319-324`), `breeding_plans`
  by `featured_breeding_plan_ids` + parent `geckos` (`:333-347`). **Read-only.**
- **Routed at:** `/store/:slug`, `App.jsx:263` (unauth) and `App.jsx:346` (authed, outside
  Layout). Public via RLS when `is_published`.
- **Nav-reachable:** not a sidebar item. Reached via share links: `MyStore.jsx:359`
  ("View live store"), `MyStoreButton` (Dashboard), `BreederStoreCard.jsx:61` (Settings),
  `PublicProfile.jsx:347`. **Not** in the SEO sitemap `DYNAMIC_ROUTE_PATTERNS`
  (`scripts/seo-routes.mjs:564-576`).
- **Verdict: REDIRECT (merge presentation into Breeder).** URLs are already shared publicly, so
  the path must keep resolving.

### `src/pages/MyStore.jsx`: Breeder store-management editor (curated model)
- **Renders:** a full editor (tier-gated behind the Breeder/Enterprise/grandfathered perk,
  `MyStore.jsx:122-125,305-329`): store URL/slug with a change-cooldown, title/tagline, header
  image, bio, **hand-pick featured geckos** (`:485-541`), **hand-pick featured pairs**
  (`:543-596`), policies, contact + external links, publish toggle. Audience = **a breeder
  managing their own storefront**. Writes the `/store/:slug` (StorePage) row.
- **Reads/writes:** reads `breeder_store_pages` (own row), `geckos`, `breeding_plans`
  (`:132-148`). **Writes** `breeder_store_pages` insert/update (`:284-286`).
- **Routed at:** `/MyStore` (auto-router via `pages.config.js:99,168`).
- **Nav-reachable:** not a sidebar item, not in CommandPalette. Reached via `MyStoreButton`
  (Dashboard, `:106,116`) and `BreederStoreCard` (Settings, `:49`).
- **Verdict: KEEP as the single management page**, absorb BreederStorefront's fields.

### `src/pages/BreederStorefront.jsx`: Breeder store-management editor (profile model)
- **Renders:** a page that is BOTH a public-ish view AND an owner editor for a **different**
  data model. Setup form to create a `breeder_profiles` row (`:154-161,168-188`); owner edit of
  display_name/bio/location/years/specialty_morphs (`:147-152`); an owner-only "Mini-site
  settings" panel (accent theme, "Available now" toggle, featured waitlist) whose values are
  stored as reserved `_`-prefixed entries inside `breeder_store_pages.external_links`
  (`:101-145`, format defined in `StorefrontSections.jsx:6-25`). It renders a For-Sale grid,
  store policy, and reviews inline. Audience = **breeder managing their profile/mini-site**;
  can also render a public profile when given `?slug=`.
- **Reads/writes:** reads/writes `breeder_profiles` (`:35-38,44,149,156`); reads
  `breeder_reviews` (`:44`), `geckos` (`:48`), `profiles.store_policy` (`:51`),
  `gecko_waitlists` (`:86-90`); reads/writes `breeder_store_pages` **external_links only**
  (`:80-84,108-135`). It will even **insert a minimal published `breeder_store_pages` row**
  just to carry theme settings (`:124-135`), a second writer racing MyStore for the same row.
- **Routed at:** `/BreederStorefront` (auto-router, `pages.config.js:119,187`).
- **Nav-reachable:** effectively **orphaned**. It is in `SECTION_FOR_PAGE` and
  `BREEDER_ONLY_PAGES` (`navItems.js:51,163`) but NOT in `FALLBACK_NAV_ITEMS` and NOT in
  CommandPalette. The only nav entry pointing at it, "My Storefront" in
  `layoutConstants.js:58` (`userSpecificNavItems`), is **dead code**, `Layout.jsx:40-45` only
  imports the level/milestone constants from that module, never `userSpecificNavItems`. So it is
  reachable only by typing `/BreederStorefront`, via the tutorial (`TutorialModal.jsx:137`), or
  if an admin adds a PageConfig row.
- **Verdict: MERGE into MyStore, then DELETE (redirect `/BreederStorefront` → `/MyStore`).**

### `src/pages/Breeder.jsx`: Public breeder page (`/Breeder/:slug`), the SEO canonical
- **Renders:** two modes. **curated**, a `breeder_profiles` row exists for the slug: banner,
  bio, specialty morphs, `TrustPanel`, auto-synced "Available now" grid, waitlist CTA, store
  policy, reviews, JSON-LD (`LocalBusiness`/`Offer`/`AggregateRating`), a `BuyerInquiryModal`.
  **inferred**, no row: an auto-generated long-tail SEO page built by scraping `geckos`
  dam/sire/notes attribution, with a "claim this page" CTA. Audience = **a buyer/crawler
  viewing one breeder**.
- **Reads:** `breeder_profiles` by `custom_slug` (`:121-125`); then `geckos` (public For-Sale,
  auto-synced, `:138-145`), `breeder_reviews` (`:147-153`), `profiles.store_policy`
  (`:154-158`), `breeder_store_pages.external_links` for mini-site settings (`:162-167`),
  `gecko_waitlists` (`:177-181`); inferred mode scrapes `geckos` (`:197-201`). **Read-only** in
  the page; the inquiry form posts to the `send-breeder-inquiry` edge function which writes
  `breeder_inquiries` and emails via Resend (`BuyerInquiryModal.jsx:6-9,66`).
- **Routed at:** `/Breeder/:slug` (path) and legacy `/Breeder?slug=`, `App.jsx:235,269`;
  `pages.config.js` `Breeder`; `DYNAMIC_ROUTE_PATTERNS` (`seo-routes.mjs:570`); vercel redirect
  `/breeder → /Breeder`, `/breeder/:slug → /Breeder/:slug` (`build-vercel-json.mjs:93-94,236-240`).
- **Nav-reachable:** it is a public SEO destination, not a sidebar item
  (`SECTION_FOR_PAGE.Breeder='discover'`). Reached from `GeckoDetail.jsx:38`, the sitemap,
  canonical tags, and external inbound links.
- **Verdict: KEEP as THE single public breeder storefront.** Highest SEO investment; only page
  with reviews, trust panel, inquiry flow, waitlist CTA, and the inferred long-tail fallback.

### `src/pages/Marketplace.jsx`: Redundant tab shell
- **Renders:** a `Tabs` shell (`Marketplace.jsx:61-88`) that mounts `MarketplaceBuyPage` and
  `MarketplaceSellPage`, both of which are ALSO routed standalone at `/MarketplaceBuy` and
  `/MarketplaceSell` (`pages.config.js:88,90,156,158`). Adds only a `CollectionPage` JSON-LD
  wrapper (`:11-42`).
- **Nav-reachable:** yes, heavily, `FALLBACK_NAV_ITEMS.public` (`navItems.js:123`),
  `layoutConstants.js:43` (dead), CommandPalette `Marketplace/Buy/Sell/MyListings`
  (`CommandPalette.jsx:56-59`).
- **Verdict: KEEP the `/Marketplace` URL (SEO landing) but treat the shell as canonical;** the
  standalone `/MarketplaceBuy` + `/MarketplaceSell` routes are the duplication. This is a
  secondary cleanup, not part of the storefront merge. See §5, last step.

---

## 2. Summary table

| Page | Audience | Reads / Writes | Routed at | Nav-reachable? | Verdict |
|---|---|---|---|---|---|
| `Store.jsx` | Customer buying supplies | store products/orders (Stripe); no breeder tables | `/Store/*` | Yes (sidebar "Supplies") | **KEEP** (separate product) |
| `StorePage.jsx` | Buyer viewing a breeder | R: `breeder_store_pages`, `profiles`, `geckos`, `breeding_plans` | `/store/:slug` | Share links only (not sitemap) | **REDIRECT → `/Breeder/:slug`** |
| `MyStore.jsx` | Breeder managing storefront | R/W: `breeder_store_pages`; R: `geckos`, `breeding_plans` | `/MyStore` | Dashboard + Settings buttons | **KEEP** (single editor; absorb BreederStorefront) |
| `BreederStorefront.jsx` | Breeder managing profile/mini-site | R/W: `breeder_profiles`, `breeder_store_pages.external_links`; R: `breeder_reviews`, `geckos`, `profiles`, `gecko_waitlists` | `/BreederStorefront` | **Orphaned** (dead nav link) | **MERGE → MyStore, then REDIRECT/DELETE** |
| `Breeder.jsx` | Buyer/crawler viewing a breeder | R: `breeder_profiles`, `geckos`, `breeder_reviews`, `profiles`, `breeder_store_pages.external_links`, `gecko_waitlists`; W (via edge fn): `breeder_inquiries` | `/Breeder/:slug` (+ legacy `?slug=`) | Public SEO (sitemap/canonical) | **KEEP** (single public storefront) |
| `Marketplace.jsx` | Buyer + seller | none directly (delegates) | `/Marketplace` | Yes (sidebar + palette) | **KEEP shell**; dedupe standalone Buy/Sell routes |

---

## 3. Recommended end state

Two data models exist today and they are entangled through one row:

- **Curated model:** `MyStore` (editor) → `breeder_store_pages` (full row: slug, featured_*,
  policies, links) → `StorePage` at `/store/:slug`.
- **Profile / auto model:** `BreederStorefront` (editor) → `breeder_profiles` +
  `breeder_store_pages.external_links` (theme/available/waitlist only) → `Breeder` at
  `/Breeder/:slug`.

They collide on `breeder_store_pages`: MyStore owns the whole row, while BreederStorefront and
Breeder only use its `external_links` jsonb, and BreederStorefront will even create the row
itself. Two writers, one row, two slugs (`breeder_store_pages.slug` vs
`breeder_profiles.custom_slug`).

**Target: one public page, one editor, plus the untouched supplies Store.**

1. **Public breeder storefront = `Breeder.jsx` at `/Breeder/:slug`.** It is the SEO-canonical,
   sitemap'd, trust/review/inquiry/waitlist-rich page with an inferred long-tail fallback.
   - Fold the nicer StorePage presentation (status-bucketed gallery, curated pairings section)
     into `Breeder.jsx`/`StorefrontSections.jsx` as an *optional curated* block that renders the
     owner's `featured_gecko_ids` when present, otherwise the existing auto-synced "Available
     now" grid. This preserves the one capability StorePage has that Breeder lacks (manual
     curation) without a second page.
   - `StorePage.jsx` becomes a **thin resolver/redirect**: look up `breeder_store_pages` by
     `slug` → resolve owner → `breeder_profiles.custom_slug` → `301`/`<Navigate>` to
     `/Breeder/:custom_slug`. If no profile exists, keep rendering StorePage's body as a
     fallback until every store owner has a profile slug (see §4 risk).

2. **Breeder store-management page = `MyStore.jsx` at `/MyStore`.** Absorb everything
   `BreederStorefront` did:
   - Profile identity fields (display_name/bio/location/years_breeding/specialty_morphs) →
     write `breeder_profiles` from MyStore (create the row if missing, replacing
     `BreederStorefront.createStorefront`).
   - The mini-site settings panel (theme / "Available now" toggle / featured waitlist) → move
     into MyStore, writing the same reserved `external_links` entries via the existing
     `applyStoreSettings` helper (`StorefrontSections.jsx:135-141`). MyStore already owns this
     row, which removes the two-writer race.
   - `BreederStorefront.jsx` → **delete**; add a redirect `/BreederStorefront → /MyStore`.

3. **Customer supplies `Store.jsx`**, **unchanged**. Different product. (Optional hygiene:
   resolve the `/Store` vs `/store` case collision, §4.)

**Files:**
- Merge INTO `MyStore.jsx`: the profile-edit + mini-site-settings logic from
  `BreederStorefront.jsx`.
- Merge INTO `Breeder.jsx` (+ `StorefrontSections.jsx`): the curated status-bucketed gallery /
  pairings presentation from `StorePage.jsx`.
- Becomes a redirect: `StorePage.jsx` (`/store/:slug` → `/Breeder/:slug`) and the
  `/BreederStorefront` route (→ `/MyStore`).
- Delete after redirect lands: `BreederStorefront.jsx` (and remove it from
  `pages.config.js`, `navItems.js:51,163`, `TutorialModal.jsx:137`, and the dead
  `layoutConstants.js:58` entry).

---

## 4. Migration risk notes (URLs that must keep resolving)

- **`/Breeder/:slug` (KEEP):** in the sitemap (`seo-routes.mjs:570`), canonical tags
  (`Breeder.jsx:247,337`), vercel lowercase redirects (`build-vercel-json.mjs:93-94,236-240`),
  linked from `GeckoDetail.jsx:38`, and the legacy `/Breeder?slug=` query form is still read
  (`Breeder.jsx:74-78`). Do not rename. This is the safe consolidation target.
- **`/store/:slug` (must keep resolving via redirect):** breeders are told to "share one link
  anywhere you sell" (`MyStore.jsx:349-351`), and the URL is emitted from `MyStore.jsx:359`,
  `MyStoreButton`, `BreederStoreCard.jsx:61`, and `PublicProfile.jsx:347`. Those links live in
  MorphMarket bios, socials, etc. **Preserve with a server/client redirect**, not a delete.
  Risk: `breeder_store_pages.slug` != `breeder_profiles.custom_slug`, and a store owner may have
  **no** `breeder_profiles` row. Redirect must fall back to rendering the existing StorePage
  body when no profile slug resolves; backfill `breeder_profiles` (or copy the store slug into
  `custom_slug`) before flipping the redirect to unconditional.
- **`/BreederStorefront` (safe to redirect):** orphaned in nav (dead `layoutConstants.js:58`
  link; not in `FALLBACK_NAV_ITEMS`/CommandPalette). Low external exposure. Redirect →
  `/MyStore`. Check `TutorialModal.jsx:137` copy.
- **`/Store` supplies vs `/store` breeder:** these differ only by case
  (`App.jsx:284,339` vs `:263,346`). Vercel `cleanUrls`/case handling could make one shadow the
  other; verify the redirect table (`build-vercel-json.mjs`) does not lowercase `/Store` into
  the breeder route. Keep this in mind when adding the `/store/:slug` redirect.
- **Passports / QR:** public passport + QR pages (`/passport/:code`, `.../qr`) are unaffected, 
  storefront pages link *out* to passports, not the reverse; no passport embeds a `/store` or
  `/Breeder` URL that would break. (Confirm during implementation, but no emitter was found.)
- **`breeder_store_pages` two-writer hazard:** once mini-site settings move into MyStore, remove
  BreederStorefront's row-creation path (`BreederStorefront.jsx:124-135`) so nothing else
  inserts/updates the row. Migrations to be aware of:
  `20260517_breeder_privacy_and_store_pages.sql`,
  `20260517_breeder_store_pages_richer_storefront.sql`,
  `20260517_breeder_store_pages_featured_ids_to_text.sql`, `20260508_breeder_inquiries.sql`.

---

## 5. Ordered execution plan (smallest blast radius first)

1. **Remove the dead nav link.** Delete the `BreederStorefront` "My Storefront" entry in
   `layoutConstants.js:58` (unused import, zero user impact) to stop it looking reachable.
   Confirm nothing else imports `userSpecificNavItems`.
2. **Redirect `/BreederStorefront` → `/MyStore`** at the router (keep the file for now). Update
   `TutorialModal.jsx:137`. This orphaned page is the lowest-risk removal.
3. **Move mini-site settings (theme / available toggle / waitlist) into `MyStore.jsx`**, writing
   via `applyStoreSettings` on the row MyStore already owns. Verify `/Breeder/:slug` still reads
   them (`Breeder.jsx:162-174`). This kills the two-writer race on `breeder_store_pages`.
4. **Move profile identity fields into `MyStore.jsx`** (write `breeder_profiles`, create if
   missing). Now MyStore is the single editor for both models.
5. **Delete `BreederStorefront.jsx`** and its `pages.config.js` / `navItems.js:51,163` entries;
   the redirect from step 2 stays.
6. **Fold StorePage's curated gallery into `Breeder.jsx`/`StorefrontSections.jsx`** as an
   optional `featured_gecko_ids` block; keep the auto "Available now" grid as the default.
7. **Backfill `breeder_profiles.custom_slug`** for every `breeder_store_pages` owner that lacks
   one (so the redirect can resolve).
8. **Convert `StorePage.jsx` into a resolver/redirect** `/store/:slug → /Breeder/:custom_slug`,
   with the current body as the fallback when no profile slug resolves. Update the emitters
   (`MyStore.jsx:359`, `MyStoreButton`, `BreederStoreCard.jsx:61`, `PublicProfile.jsx:347`) to
   point at `/Breeder/:custom_slug` directly. Once emitters and backfill are done, make the
   redirect unconditional.
9. **(Secondary, independent) Marketplace dedupe:** keep `/Marketplace` as the SEO landing and
   the canonical shell; make `/MarketplaceBuy` and `/MarketplaceSell` redirect into
   `/Marketplace?tab=buy|sell` (or keep them only as JSON-LD-referenced deep links). Not part of
   the storefront merge; do last.

Each step is independently shippable and reversible; nothing before step 8 touches a
publicly-shared URL, and step 8 is guarded by the step-7 backfill plus a render fallback.
