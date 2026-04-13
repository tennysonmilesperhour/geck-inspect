# P1 — Animal Passport + Ownership Transfer

**Priority:** P1 (Highest)
**Dependencies:** None — core data model everything else depends on
**Origin:** iHerp analysis confirmed this is their single most powerful network-effect feature

---

## What It Is

Every gecko gets a permanent digital identity — its passport. The passport travels with the animal forever. When sold, the full record (feeding history, weight logs, shed history, photos, lineage) transfers to the new owner's account. Anyone with the QR link can view the public profile. Only the current owner can edit or transfer.

Think **Carfax report for geckos**. The record is objective, not just the seller's word. This is what makes Geck Inspect trustworthy at the point of sale — which is the moment that matters most in this hobby.

---

## Data Model

```
Animal {
  id:               UUID (primary key)
  passport_code:    string UNIQUE (format: "GI-YYYY-XXXX", e.g. "GI-2025-A7K3")
                    -- never changes even across ownership transfers
  name:             string
  species:          string (default: "Correlophus ciliatus")
  date_of_birth:    date (nullable — use estimated_hatch_year if exact DOB unknown)
  estimated_hatch_year: integer (nullable)
  sex:              enum [male, female, unknown]
  weight_grams:     decimal (current weight — pulled from latest WeightRecord)
  photos:           array of image URLs (index 0 = profile photo)

  -- Morph / genetics
  base_morph:       string
  morph_traits:     array of strings
  pattern_grade:    enum [pet, breeder, high_end, investment]
  genetics_notes:   text

  -- Lineage
  sire_id:          UUID nullable → Animal
  dam_id:           UUID nullable → Animal
  sire_name_manual: string (used when sire not in system)
  dam_name_manual:  string
  breeder_name:     string
  breeder_user_id:  UUID nullable → User
  hatch_facility:   string

  -- Ownership
  current_owner_id: UUID → User

  -- Status
  status:           enum [owned, for_sale, on_loan, sold, transferred, deceased]
  listing_price:    decimal nullable

  -- Visibility
  is_public:        boolean default true

  created_at:       timestamp
  updated_at:       timestamp
}

OwnershipRecord {
  id:               UUID
  animal_id:        UUID → Animal
  owner_user_id:    UUID → User
  owner_name:       string  (snapshot — preserved even if user deletes account)
  owner_avatar_url: string  (snapshot)
  acquired_date:    date
  transfer_method:  enum [original_breeder, purchased, gifted, breeding_loan_return]
  sale_price:       decimal nullable
  contributed_to_market_data: boolean default false
  notes:            text
  created_at:       timestamp
}

FeedingRecord {
  id:          UUID
  animal_id:   UUID → Animal
  logged_by:   UUID → User
  date:        date
  food_type:   string  (e.g. "Repashy CGD", "crickets", "dubia", "waxworms")
  accepted:    boolean
  notes:       text
  created_at:  timestamp
}

ShedRecord {
  id:          UUID
  animal_id:   UUID → Animal
  logged_by:   UUID → User
  date:        date
  quality:     enum [complete, retained_toes, retained_eye_caps, partial, unknown]
  notes:       text
  created_at:  timestamp
}

WeightRecord {
  id:            UUID
  animal_id:     UUID → Animal
  logged_by:     UUID → User
  date:          date
  weight_grams:  decimal
  notes:         text
  created_at:    timestamp
}

VetRecord {
  id:            UUID
  animal_id:     UUID → Animal
  date:          date
  vet_name:      string
  reason:        string
  findings:      text
  treatment:     text
  follow_up:     date nullable
  attachments:   array of URLs (for vet report PDFs/photos)
  created_at:    timestamp
}

TransferRequest {
  id:              UUID
  animal_id:       UUID → Animal
  from_user_id:    UUID → User
  to_email:        string
  to_user_id:      UUID nullable → User  (populated on claim)
  token:           string UNIQUE  (cryptographically random, used in /claim/:token URL)
  status:          enum [pending, claimed, expired, cancelled]
  sale_price:      decimal nullable
  message:         text
  created_at:      timestamp
  claimed_at:      timestamp nullable
  expires_at:      timestamp  (created_at + 72 hours)
}
```

---

## UI Spec

### Screen 1: My Collection (`/collection`)

- **Header:** "My collection" + gecko count + "Add gecko" button
- **Portfolio value banner** (from P2 — embed here once built)
- **Filter chips:** All / Owned / For Sale / On Loan / Sold
- **Sort:** Recently added / Name A-Z / Morph / Pattern grade
- **Grid:** 2 columns desktop, 1 mobile

**AnimalCard component:**
- Profile photo (square, object-fit cover, click -> passport page)
- Name in DM Serif Display 16px
- Passport code in monospace 11px muted
- Morph pill (sage bg) + pattern grade badge (gold if high_end/investment)
- Sex + age in one chip
- Status badge
- Care indicator row: Last fed (green <3d / amber 3-7d / red >7d) - Last weight - Last shed
- Hover: subtle border lift, "View" button appears

**Empty state:** gecko SVG silhouette + "No geckos yet." + "Add your first gecko" CTA

### Screen 2: Add / Edit Animal (`/collection/new`, `/collection/:id/edit`)

3-step wizard, progress bar at top showing Step 1 / 2 / 3:

**Step 1 — Identity**
- Name (required)
- Date of birth (date picker) OR estimated year (number, shown if "I don't know exact date" toggled)
- Sex: radio buttons Male / Female / Unknown
- Current weight in grams (number input)
- Photos: drag-drop zone, up to 8 images, reorderable thumbnails (first = profile photo)

**Step 2 — Morph & genetics**
- Base morph: searchable select, pre-populated list:
  Harlequin, Extreme Harlequin, Pinstripe, Full Pinstripe, Phantom Pinstripe, Flame, Bicolor, Tricolor, Dalmatian, Moonglow, Cream on Cream, Brindle, Tiger, Super Tiger, Quad Stripe, Lilly White, Axanthic, Super Mack Snow, Mack Snow, Halloween, Dark Base, Xtreme Harlequin
- Morph traits: multi-select checkboxes:
  Dalmatian spots, Cream back, Pinstripe elements, White-fringed, Fire pattern, High-contrast, Low-contrast, White walls, Cream overlay, Dark lateral stripe
- Pattern grade selector with descriptions:
  - **Pet** — primarily a companion animal
  - **Breeder** — suitable for production
  - **High-end** — exceptional expression, strong breeder value
  - **Investment** — extraordinary specimen, collector tier
- Genetics notes: textarea

**Step 3 — Lineage**
- Sire: search your own animals (typeahead), or toggle "Not in my collection" -> free text
- Dam: same
- Original breeder name
- Hatch facility / location
- Preview: shows simple 3-node lineage diagram before saving

On final save: auto-generate passport_code, set is_public = true, redirect to passport page.
"Save as draft" available at any step — saves without generating passport_code or publishing.

### Screen 3: Public Passport Page (`/passport/:passport_code`)

No auth required. This is a marketing asset — it must look exceptional.

**Layout top to bottom:**

1. **Hero** — full-width photo carousel (swipeable, dot nav, 400px max height)
2. **Gecko name:** DM Serif Display 36px. **Passport code:** small monospace pill badge. **Status badge** top-right.
3. **Identity row** — 4 stat chips in a row: Species - Sex - Date of birth - Current weight
4. **Morph card** — base morph as large pill (sage bg, forest text). Trait tags below in smaller pills. Pattern grade badge (ember gold for high_end/investment).
5. **Market value card** (from P2 — embed here once built): estimated value range, comparable sales, price trend. Show only if pattern_grade is set.
6. **Lineage tree** — 3-node visual: sire (top-left), dam (top-right), this animal (center-bottom). If linked to passports in the system, names are clickable links. If manual names only, show in muted text with "Not in Geck Inspect" label.
7. **Ownership timeline** — chronological list of all OwnershipRecords. Each entry: avatar circle (initials), owner name, acquired date, transfer method badge, sale price (if set and not private). This is the provenance chain — make it feel credible.
8. **Care history tabs** — Feeding / Weight / Sheds / Vet
   - **Feeding:** table of records, most recent first. Acceptance rate % shown as summary stat.
   - **Weight:** line chart (Chart.js) showing weight over time. Flag any >10% drop in 30 days with an amber warning marker on the chart.
   - **Sheds:** table with quality badges. Retained issue flag in amber.
   - **Vet:** list of vet records with expandable detail.
9. **Sticky footer action bar** (shown only to non-owners / logged-out users):
   - If status = for_sale: "Inquire about this gecko" button (sage)
   - Always: "I purchased this gecko — claim ownership" button (outlined)
   - If logged out: both buttons prompt login first, then return to action

### Screen 4: Transfer / Claim Flow

**Owner initiates** (from animal detail, edit mode):
- "Transfer ownership" button -> modal
- Modal fields: recipient email, sale price (optional), personal message (optional)
- Preview: shows what the buyer will see in their claim email
- On submit: creates TransferRequest, sends email with `/claim/:token` link
- Owner sees: "Transfer pending — expires in 72 hours" status on the animal card
- Owner can cancel any pending transfer

**Buyer claim page** (`/claim/:token`):
- Shows animal summary (photo, name, morph, passport code)
- Shows message from seller (if set)
- Shows sale price (if set)
- "Accept ownership" CTA in Sage accent
- If buyer has no account: "Create your free Geck Inspect account to claim" flow, then auto-redirect back to claim page after signup
- On accept: new OwnershipRecord created, animal.current_owner_id updated, token expired, both parties receive confirmation email
- If token expired: "This transfer link has expired. Ask the seller to resend."
- Prompt on accept: "Would you like to add this sale price ($X) to market data? It will be anonymized." — checkbox, default ON if sale_price is set

### Screen 5: QR Code (`/collection/:id/qr`)

- Large QR code linking to `/passport/:passport_code`
- Animal name and passport code below QR
- Geck Inspect logo + "Scan to view full history" tagline
- Two buttons: "Download PNG" (800x800px) and "Copy link"
- Printable layout: clean white page for sticker printing
- Hint text: "Print and stick on your enclosure or tub"

---

## Claude Code Prompt

```
Build the Animal Passport + Ownership Transfer system for Geck Inspect,
a professional crested gecko breeding management app.

DESIGN SYSTEM (apply to everything you build):
Fonts: DM Serif Display (headings), DM Sans (UI) — load from Google Fonts.
Colors: Forest deep #1A2E1A, Moss mid #2D4A2D, Sage accent #4E7C4E,
Pale sage #E8F0E8, Warm white #F7F9F4, Ember gold #C4860A,
Ember light #FDF3E0, Alert red #C0392B, Slate text #3D4A3D, Muted text #6B7B6B.
Cards: border-radius 12px, 1px border rgba(78,124,78,0.15), padding 24px.
Status badges: pill shape (border-radius 999px), 12px, padding 4px 10px.
Tone: professional, science-forward — a serious tool for serious breeders.
Mobile-first responsive. Skeleton loading states, not spinners.
All destructive actions require typing the animal name to confirm.

DATABASE — create these tables:
[PASTE FULL DATA MODEL FROM THIS DOCUMENT]

BUILD THESE SCREENS:

1. MY COLLECTION PAGE (/collection)
[Full screen spec as documented above]

2. ADD/EDIT FORM (/collection/new, /collection/:id/edit)
[Full screen spec as documented above]

3. PUBLIC PASSPORT PAGE (/passport/:passport_code) — NO AUTH REQUIRED
[Full screen spec as documented above]

4. TRANSFER FLOW
[Full screen spec as documented above]

5. QR CODE PAGE (/collection/:id/qr)
[Full screen spec as documented above]

QUALITY BAR:
The public passport page will be shared by breeders to sell their animals.
It represents the Geck Inspect brand in the wild. Make it genuinely impressive.
Weight chart must handle <3 data points gracefully (show "Add weight logs to see trends").
Ownership timeline with a single entry should still look intentional, not broken.
```
