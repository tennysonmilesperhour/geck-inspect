# P8 — Enhanced Breeder Storefront

**Priority:** P8
**Dependencies:** P1 (Animal Passport), P2 (Market Pricing)
**Origin:** iHerp analysis — turns each breeder's public profile into a proper business page

---

## What It Is

Every Geck Inspect user who lists animals for sale gets an automatically-generated breeder storefront. Currently profiles are minimal. This enhances them to be a real business page that breeders can share, that buyers can review, and that builds the Geck Inspect marketplace network.

---

## Data Model

```
BreederProfile {
  user_id:          UUID → User  (one-to-one)
  display_name:     string
  custom_slug:      string UNIQUE  (e.g. "tennys-crested-geckos" → geckinspect.com/b/tennys-crested-geckos)
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
  rating:           integer  (1–5)
  title:            string
  body:             text
  transaction_type: enum [purchase, breeding_loan, trade]
  is_verified:      boolean  (admin verified this was a real transaction)
  created_at:       timestamp
}
```

---

## UI Spec

### Breeder Storefront (`/b/:slug`) — Public URL

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
- Must work on external sites — no auth, public data only

---

## Claude Code Prompt

```
Build the Enhanced Breeder Storefront for Geck Inspect.

DESIGN SYSTEM: [PASTE GLOBAL DESIGN SYSTEM]

CONTEXT: Animal Passport (P1) and Market Pricing (P2) are built. Users already exist.
This enhances user profiles into proper business pages.

DATABASE:
[PASTE BreederProfile and BreederReview models]

BUILD:

1. STOREFRONT PAGE (/b/:slug) — PUBLIC
Banner photo (full-width hero), profile photo overlaid bottom-left.
Header: display name, location, verified badge (sage checkmark if is_verified),
specialty morphs as pills, bio, years breeding, social links, "Contact" button.
Stats row: X animals sold | X reviews | Member since [year] | Ships to [list].
"For Sale" grid: AnimalCards for all animals with status = for_sale.
Reviews section: summary (avg stars + count), review cards (title, body, rating stars,
verified badge if is_verified, transaction type, date).

2. PROFILE SETTINGS (/settings/storefront)
Edit all BreederProfile fields. Custom slug input with availability check (live).
Preview button shows storefront as buyers see it.

3. REVIEW SYSTEM
Buyers can leave a review for a seller after a confirmed transfer (OwnershipRecord exists).
Review form: rating (1–5 stars), title, body, transaction type.
Reviews display on storefront and in animal passport ownership timeline.

4. EMBED WIDGET (/b/:slug/widget)
Generate iframe embed code for "Available animals from [breeder]".
Minimal widget: 2-col grid of for_sale animals with price and passport link.
Must work on external sites — no auth, public data only.

QUALITY: Breeders will share this URL on Instagram, Facebook, at expos.
It is Geck Inspect's public face in the wild. Make it look like a real business page,
not a web app profile. Verified badge matters — make it clearly visible.
```
