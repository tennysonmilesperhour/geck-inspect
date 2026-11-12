# P8: Enhanced Breeder Storefront

> **Status, 11 November 2026: Partly built, and Dated.** The public page is `/Breeder/:slug` and the editor is `/MyStore`. There are no `/b/` routes and no embed widget. The visual website editor was retired on 16 October. The paste-ready build prompt that ended this file was removed on 12 November 2026 (git keeps it).

> **Design note (15 October 2026, shortened 12 November 2026):** this spec was written for a set of fonts and a green colour palette that never shipped. The lines that set them out were in the build prompt, which has been removed. Any colour name still in the text below (sage, forest, ember gold) comes from that palette: ignore it. Use `docs/specs/DESIGN-SYSTEM.md`, which describes the shipped theme tokens.

**Priority:** P8
**Dependencies:** P1 (Animal Passport), P2 (Market Pricing)
**Origin:** iHerp analysis, turns each breeder's public profile into a proper business page

---

## What It Is

Every Geck Inspect user who lists animals for sale gets an automatically-generated breeder storefront. Currently profiles are minimal. This enhances them to be a real business page that breeders can share, that buyers can review, and that builds the Geck Inspect marketplace network.

---

## Data Model

```
BreederProfile {
  user_id:          UUID → User  (one-to-one)
  display_name:     string
  custom_slug:      string UNIQUE  (e.g. "lakeside-cresties" → geckinspect.com/b/lakeside-cresties)
  bio:              text
  location:         string  (city/state)
  years_breeding:   integer
  specialty_morphs: array of strings
  social_links:     JSONB  (instagram, facebook, website)
  profile_photo:    string URL
  banner_photo:     string URL
  is_verified:      boolean  (admin verified = real breeder)
  accepts_inquiries: boolean
  ships_to:         array of strings  (states/countries)
  created_at:       timestamp
}

BreederReview {
  id:               UUID
  reviewer_user_id: UUID → User
  reviewed_user_id: UUID → User
  animal_id:        UUID nullable → Animal  (the animal the transaction was about)
  rating:           integer  (1 to 5)
  title:            string
  body:             text
  transaction_type: enum [purchase, breeding_loan, trade]
  is_verified:      boolean  (admin verified this was a real transaction)
  created_at:       timestamp
}
```

---

## UI Spec

### Breeder Storefront (`/b/:slug`): Public URL

- **Profile header:** banner photo, profile photo, display name, location, verified badge, bio, years breeding, specialty morphs, social links, "Contact" button
- **For sale animals grid** (matching collection view but filtered to for_sale status)
- **Reviews section:** star rating summary (avg + count), recent reviews
- **Stats:** animals sold (from ownership records), avg response time, member since
- **Embed widget:** `<iframe>` code to embed "Available animals" on external website

### Profile Settings (`/settings/storefront`)

- Edit all BreederProfile fields
- Custom slug input with availability check (live)
- Preview button shows storefront as buyers see it

### Review System

- Buyers can leave a review for a seller after a confirmed transfer (OwnershipRecord exists)
- Review form: rating (1-5 stars), title, body, transaction type
- Reviews display on storefront and in animal passport ownership timeline

### Embed Widget (`/b/:slug/widget`)

- Generate iframe embed code for "Available animals from [breeder]"
- Minimal widget: 2-col grid of for_sale animals with price and passport link
- Must work on external sites, no auth, public data only

---

The build prompt that stood here was removed on 12 November 2026 because its fonts, colours and routes were never shipped. Design is `docs/specs/DESIGN-SYSTEM.md`.
