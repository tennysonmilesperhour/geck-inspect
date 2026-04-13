# Feature Priority Map

Build in this order. Each feature depends on the ones above it.

| Priority | Feature | Why This Order |
|----------|---------|---------------|
| **P1** | [Animal Passport + Ownership Transfer](./P1-animal-passport.md) | Core data model everything else depends on |
| **P2** | [Market Pricing Intelligence](./P2-market-pricing.md) | Needs animals to exist before it's useful |
| **P3** | [Breeding ROI Dashboard](./P3-breeding-roi.md) | Needs animals + pricing to be meaningful |
| **P4** | [Breeding Loan Management](./P4-breeding-loans.md) | Needs transfer infrastructure from P1 |
| **P5** | [Geck Answers (Q&A Knowledge Base)](./P5-geck-answers.md) | Standalone, no dependencies |
| **P6** | [Batch Husbandry Operations](./P6-batch-husbandry.md) | Enhancement to existing feeding groups |
| **P7** | [Printable Worksheets](./P7-printable-worksheets.md) | Enhancement to existing animal records |
| **P8** | [Enhanced Breeder Storefront](./P8-breeder-storefront.md) | Enhancement to existing public profiles |
| **P9** | [Breeding Journal / Blog](./P9-breeding-journal.md) | Nice-to-have, low leverage |
| **P10** | [Community Morph Photo Contributions](./P10-morph-photos.md) | Nice-to-have, low leverage |

---

## Master Integration Checklist

Run through this after all features are built.

### P1 <-> P2
- [ ] Passport page shows MarketValueCard component (P2) for owned animals
- [ ] Collection page shows PortfolioBanner component (P2)
- [ ] Transfer completion (P1) prompts to contribute sale price to MorphPriceEntry (P2)
- [ ] For-sale animals (P1) surface on market overview page (P2) as available listings

### P1 <-> P3
- [ ] Breeding project wizard pulls sire/dam from animals table (P1)
- [ ] Clutch hatch -> "Add hatchlings" creates Animal records via P1 infrastructure
- [ ] Hatchling Animal records have breeding_project_id FK linking back to project

### P2 <-> P3
- [ ] Project wizard outcome table auto-loads price ranges from morph_price_entries (P2)
- [ ] PortfolioBanner (P2) excludes animals with status sold/transferred

### P1 <-> P4
- [ ] Loan uses on_loan status from Animal (P1)
- [ ] Loan return does NOT create OwnershipRecord (it's not a transfer)
- [ ] Passport shows "on loan" notice when status = on_loan
- [ ] Loan completion can link to BreedingProject (P3)

### P1 <-> P7
- [ ] All print templates pull live data from Animal record
- [ ] Lineage card pulls parent passport data including photos

### P1 <-> P8
- [ ] Storefront shows for_sale animals using AnimalCard from P1
- [ ] Reviews show in passport ownership timeline
- [ ] Verified breeder badge pulls from BreederProfile

### P3 <-> P8
- [ ] Completed breeding projects contribute to "X animals sold" stat on storefront

---

## Master Testing Scenarios

### P1 Animal Passport
- [ ] Create animal -> passport_code auto-generates -> public page accessible logged out
- [ ] Download QR -> scan -> correct page
- [ ] Transfer initiated -> buyer claims -> ownership updated -> both get email
- [ ] Claim link expires 72h -> graceful error shown
- [ ] Sale price contribution prompt -> yes -> appears anonymized in market data

### P2 Market Pricing
- [ ] Log sale -> appears in market table
- [ ] Anonymous sale -> submitter never visible anywhere public
- [ ] MarketValueCard with <3 comps -> friendly empty state
- [ ] Portfolio valuation update -> total reflects current market midpoints

### P3 Breeding ROI
- [ ] Probability column != 100% -> blocked from submitting, clear error
- [ ] Price range auto-populates from market data
- [ ] Costs > projected revenue -> red warning banner visible
- [ ] Clutch hatch -> add hatchlings -> appear in collection
- [ ] Update actuals -> charts rerender

### P4 Breeding Loans
- [ ] Loan initiated -> animal status -> on_loan
- [ ] Borrower accepts -> loan -> active
- [ ] Loan return recorded -> animal status -> owned
- [ ] No OwnershipRecord created on return (verify this explicitly)
- [ ] Overdue loan (past expected return) -> amber badge visible

### P5 Geck Answers
- [ ] Ask question -> appears in list -> answerable by others
- [ ] Upvote -> count updates optimistically
- [ ] Mark best answer -> highlighted, question shows "Answered" badge
- [ ] Search across question titles and bodies
- [ ] Questions readable with no login

### P6 Batch Operations
- [ ] Create feeding group -> animals assigned
- [ ] Batch feed -> individual FeedingRecords created for each animal
- [ ] Refused animals -> appear as refusals in post-log summary
- [ ] Batch weight -> >10% drop flagged amber inline

### P7 Printables
- [ ] Each of 4 templates generates cleanly -> print dialog opens
- [ ] Vet card shows correct recent data
- [ ] Expo tag QR scans to correct passport
- [ ] Lineage card shows both parents with photos

### P8 Storefront
- [ ] Custom slug set -> /b/:slug accessible publicly
- [ ] For-sale animals appear in storefront grid
- [ ] Review submitted after confirmed transfer
- [ ] Embed widget renders on external site without auth
