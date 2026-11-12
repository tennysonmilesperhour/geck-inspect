# P7: Printable Worksheets

> **Status, 11 November 2026: Built.** Live at `/PrintableWorksheets` with the four templates here plus rack labels. The paste-ready build prompt that ended this file, with its line about fonts and colours, was removed on 12 November 2026 (git keeps it); they were never shipped.

> **Design note (15 October 2026, shortened 12 November 2026):** this spec was written for a set of fonts and a green colour palette that never shipped. The lines that set them out were in the build prompt, which has been removed. Any colour name still in the text below (sage, forest, ember gold) comes from that palette: ignore it. Use `docs/specs/DESIGN-SYSTEM.md`, which describes the shipped theme tokens.

**Priority:** P7
**Dependencies:** P1 (Animal Passport, all animal data, care logs, and lineage)
**Origin:** iHerp analysis, practical, high-perceived-value, low build cost

---

## What It Is

Print-ready documents generated from existing animal data. Four document types:

1. **Feeding log sheet**: weekly paper backup for breeders who prefer paper in the gecko room. Animal name, morph, DOB, pre-filled date column for the week, rows for each day, food type and accepted checkboxes.

2. **Vet health card**: one-page summary for vet visits. Name, species, DOB, sex, weight history chart, recent shed quality, recent feeding history, current medications (if any), known issues. Professional-looking so the vet takes it seriously.

3. **Expo price tag / QR sticker**: small print layout: animal photo, name, morph, price, QR code linking to passport. Designed to fit Avery label sizes.

4. **Lineage card**: buyer-facing document showing the animal's parents, grandparents (if available), breeder info, and passport QR code. The physical artifact that travels with the sold animal.

---

The build prompt that stood here was removed on 12 November 2026 because its fonts, colours and routes were never shipped. Design is `docs/specs/DESIGN-SYSTEM.md`.
