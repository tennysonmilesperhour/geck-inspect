# P7 — Printable Worksheets

**Priority:** P7
**Dependencies:** P1 (Animal Passport — all animal data, care logs, and lineage)
**Origin:** iHerp analysis — practical, high-perceived-value, low build cost

---

## What It Is

Print-ready documents generated from existing animal data. Four document types:

1. **Feeding log sheet** — weekly paper backup for breeders who prefer paper in the gecko room. Animal name, morph, DOB, pre-filled date column for the week, rows for each day, food type and accepted checkboxes.

2. **Vet health card** — one-page summary for vet visits. Name, species, DOB, sex, weight history chart, recent shed quality, recent feeding history, current medications (if any), known issues. Professional-looking so the vet takes it seriously.

3. **Expo price tag / QR sticker** — small print layout: animal photo, name, morph, price, QR code linking to passport. Designed to fit Avery label sizes.

4. **Lineage card** — buyer-facing document showing the animal's parents, grandparents (if available), breeder info, and passport QR code. The physical artifact that travels with the sold animal.

---

## Claude Code Prompt

```
Build Printable Worksheets for Geck Inspect.

DESIGN SYSTEM: [PASTE GLOBAL DESIGN SYSTEM]
For print: use black text on white background regardless of app theme.
Geck Inspect logo in Forest deep. Clean serif typography (DM Serif Display for headers).

CONTEXT: Animal Passport (P1) is built. All animal data, care logs, and lineage exist.
This feature generates PDFs or print-optimized HTML from that data.

BUILD FOUR PRINT LAYOUTS (accessible from animal detail page → "Print" menu):

1. FEEDING LOG SHEET (weekly): animal name/morph/DOB header, 7-column table (Mon–Sun),
   each cell has Food type line + Accepted checkbox. Minimal, fits one page, printable.

2. VET HEALTH CARD: professional one-pager. Header with animal name, species, DOB, sex.
   Weight table: last 10 weights with dates. Recent shed quality summary (last 5).
   Feeding acceptance rate last 30 days. Known health issues (from vet_log). QR code.
   Make it look like a real medical document — a vet should take it seriously.

3. EXPO PRICE TAG: small format (3×4 inch). Animal photo, name, morph, pattern grade,
   price (large, prominent), breeder name, QR code. Clean, professional.
   Offer as 2-up and 4-up layouts for printing multiple on one sheet.

4. LINEAGE CARD: buyer takeaway document. Animal photo, name, morph.
   Parents: sire name/morph + photo thumbnail, dam name/morph + photo thumbnail.
   Grandparents if available. Original breeder. QR code to live passport.
   Styled like a certificate — this is a premium product and the document should feel like it.

All four: "Print" button opens browser print dialog with correct @media print styles.
"Download PDF" button generates PDF (use browser print-to-PDF or a server-side PDF lib).
All documents: Geck Inspect branding in footer, document generated date.
```
