# Monetization Strategy

Utah Forage Map is a free community resource. Revenue covers hosting costs and
supports ongoing development without compromising the core experience.

---

## Phase 1 — Google AdSense (passive)

**Status:** Infrastructure ready, disabled by default.

AdSense fills ad slots automatically with contextual ads. Low setup cost but
also low CPM ($1–5 for outdoors/nature audiences).

**To enable:**
1. Sign up at [adsense.google.com](https://adsense.google.com) and add the site.
2. Create ad units matching each slot below; copy the slot IDs.
3. Update slot IDs in `frontend/src/config/ads.js`.
4. Add to your production environment (Vercel dashboard):
   ```
   VITE_ADS_ENABLED=true
   VITE_ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx
   ```
5. Add the AdSense script to `frontend/index.html` `<head>`:
   ```html
   <script async
     src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-xxxxxxxxxxxxxxxx"
     crossorigin="anonymous">
   </script>
   ```

**Ad slots:**

| Placement key    | Size    | Location                           |
|------------------|---------|------------------------------------|
| `sidebar_top`    | 300×250 | Sidebar, below the app title       |
| `sidebar_bottom` | 300×250 | Sidebar, below the filter panel    |
| `map_banner`     | 728×90  | Above or below the map (future)    |
| `species_detail` | 300×250 | Species detail panel (future)      |

---

## Phase 2 — Direct / Local Sponsors

**Status:** `Sponsor` model in DB, `GET /api/v1/sponsors/active` endpoint ready.

Local businesses (outfitters, mycology tour guides, gear shops) pay for a
named placement. The `AdSlot` component renders a `SponsorCard` when a sponsor
object is passed, bypassing AdSense entirely for that slot.

**How to add a sponsor:**

1. Insert a row in the `sponsors` table:
   ```sql
   INSERT INTO sponsors (id, name, tagline, image_url, link_url, placement, is_active, starts_on, ends_on)
   VALUES (gen_random_uuid(), 'Sponsor Name', 'Short tagline here',
           'https://...logo.png', 'https://sponsor.com',
           'sidebar_top', true, '2026-05-01', '2026-07-31');
   ```
2. The frontend can fetch `/api/v1/sponsors/active` and pass matching entries
   as the `sponsor` prop to each `<AdSlot>`.

**Target sponsors:** REI, local mushroom tour companies, foraging book authors,
wilderness gear shops, Utah outdoor education programs.

**Suggested pricing:** $150–500/month per slot depending on placement and traffic.

---

## Phase 3 — Premium User Accounts

**Status:** Not yet implemented.

Paid tier ($4–8/month) would offer:
- Ad-free experience
- Unlimited private sighting notes
- Export sightings to CSV/GPX
- Early access to new features (heat maps, species alerts)

Implementation would require Stripe integration and a `subscription_tier` field
on the `User` model.

---

## Revenue Estimates (rough)

| Phase | Monthly active users | Est. monthly revenue |
|-------|---------------------|----------------------|
| AdSense only | 1,000 | $15–50 |
| + 2 direct sponsors | 1,000 | $300–1,000 |
| + 5% premium conversion | 5,000 | $1,000–2,500 |

---

## Principles

- Ads are **off by default** in development — no blank boxes, no layout shift.
- Sponsor cards are **clearly labeled** and styled to feel like part of the app.
- No tracking pixels beyond what AdSense provides; no selling user data.
- Community sighting data remains public and free forever.
