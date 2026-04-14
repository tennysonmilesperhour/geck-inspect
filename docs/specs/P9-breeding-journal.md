# P9 — Breeding Journal / Blog

**Priority:** P9 (Low — build only after P1-P8 are solid)
**Dependencies:** P8 (Breeder Storefront — blogs linked from storefront)
**Origin:** iHerp analysis — member blogs create engagement and organic content

---

## What It Is

Each user gets a personal blog feed with optional auto-generated milestone posts (e.g. "First clutch of 2025!", "Hatched my first Lilly White!"). Manual posts supported. Posts are public and linked from the breeder storefront. Simple rich text editor. Not a community feed — just personal pages that breeders can share.

---

## Claude Code Prompt

```
Build a simple personal blog per user at /b/:slug/journal.

Posts have title, body (rich text), optional attached animal links (show animal card inline),
and published/draft status.

Auto-suggest post titles based on recent events (first clutch, transfer completed,
hatchlings added).

Public read, owner-only write.
```
