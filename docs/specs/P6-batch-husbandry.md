# P6: Batch Husbandry Operations

> **Status, 11 November 2026: Built, and Dated.** Live as one page, `/BatchHusbandry` (`src/pages/BatchHusbandry.jsx`), on the Breeder plan. The routes and the table columns in this spec differ from what shipped. The experience review proposes folding it into the one-tap log (package WP-4). The paste-ready build prompt that ended this file was removed on 12 November 2026 (git keeps it).

> **Design note (15 October 2026, shortened 12 November 2026):** this spec was written for a set of fonts and a green colour palette that never shipped. The lines that set them out were in the build prompt, which has been removed. Any colour name still in the text below (sage, forest, ember gold) comes from that palette: ignore it. Use `docs/specs/DESIGN-SYSTEM.md`, which describes the shipped theme tokens.

**Priority:** P6
**Dependencies:** P1 (Animal Passport. FeedingRecord and WeightRecord tables)
**Origin:** iHerp analysis, iHerp's "batch feed a group" is one of its most-used daily features

---

## What It Is

One-tap logging for routine daily/weekly care across a group of animals. A breeder feeding 20 geckos shouldn't have to tap into 20 separate animal records. They should be able to see who's due, check them off, and be done in under 2 minutes.

---

## Data Model

```
FeedingGroup {
  id:            UUID
  user_id:       UUID → User
  name:          string
  animal_ids:    array of UUID → Animal
  default_food:  string
  frequency_days: integer
  created_at:    timestamp
}
```

No other new tables needed, batch operations create individual FeedingRecord and WeightRecord entries per animal.

---

## UI Spec

### Feeding Groups (enhancement to existing collection page)

- **"Groups" tab** on collection page alongside individual animals
- **Create group:** name, select animals (multi-select from collection), feeding schedule (every N days), food type default
- **Group card:** group name, animal count, "X due today" indicator in amber/red if overdue
- **"Feed group" button** -> batch log screen

### Batch Feed Screen (`/groups/:id/feed`)

Sorted list of animals in group, each with:
- Profile photo + name
- Last fed indicator (days ago, color coded)
- "Fed / Refused" toggle, defaults to Fed
- Optional notes field (collapsed, expand per animal)

**Actions:**
- "Log all as Fed" button at top (bulk action)
- "Save batch log" -> creates individual FeedingRecord for each toggled animal
- **Summary:** "Logged 18/20 to 2 refused. View animals with refusals ->"

### Batch Weight Screen (`/groups/:id/weigh`)

Same concept: select a group, enter weights for each animal in a list.

- **Compact input:** animal name | last weight | new weight input
- **Flags:** any animal >10% lighter than last reading gets amber flag inline
- **"Skip" option** per row for animals not being weighed that day

---

The build prompt that stood here was removed on 12 November 2026 because its fonts, colours and routes were never shipped. Design is `docs/specs/DESIGN-SYSTEM.md`.
