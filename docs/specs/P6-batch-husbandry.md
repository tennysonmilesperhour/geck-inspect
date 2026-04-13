# P6 — Batch Husbandry Operations

**Priority:** P6
**Dependencies:** P1 (Animal Passport — FeedingRecord and WeightRecord tables)
**Origin:** iHerp analysis — iHerp's "batch feed a group" is one of its most-used daily features

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

No other new tables needed — batch operations create individual FeedingRecord and WeightRecord entries per animal.

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
- "Fed / Refused" toggle — defaults to Fed
- Optional notes field (collapsed, expand per animal)

**Actions:**
- "Log all as Fed" button at top (bulk action)
- "Save batch log" -> creates individual FeedingRecord for each toggled animal
- **Summary:** "Logged 18/20 — 2 refused. View animals with refusals ->"

### Batch Weight Screen (`/groups/:id/weigh`)

Same concept: select a group, enter weights for each animal in a list.

- **Compact input:** animal name | last weight | new weight input
- **Flags:** any animal >10% lighter than last reading gets amber flag inline
- **"Skip" option** per row for animals not being weighed that day

---

## Claude Code Prompt

```
Build Batch Husbandry Operations for Geck Inspect.

DESIGN SYSTEM: [PASTE GLOBAL DESIGN SYSTEM]

CONTEXT: Animal Passport (P1) is built. Animals have FeedingRecord and WeightRecord tables.
This is an enhancement to the existing collection UX — no new tables needed,
just new UI that creates multiple records at once.

New table needed:
FeedingGroup {
  id:            UUID
  user_id:       UUID → User
  name:          string
  animal_ids:    array of UUID → Animal
  default_food:  string
  frequency_days: integer
  created_at:    timestamp
}

BUILD:

1. GROUPS TAB on /collection: alongside individual animal grid, "Groups" tab.
   Group cards: name, animal count, "X due today" (count of animals past frequency_days
   since last feed), "Feed group" CTA, edit/delete options.
   "Create group" button: name, animal multi-select, frequency, default food type.

2. BATCH FEED SCREEN (/groups/:id/feed):
   Header: group name + "X animals due today".
   Sorted list (most overdue first): animal photo + name | days since last feed (color coded)
     | Fed / Refused toggle (default: Fed) | notes field (collapsed).
   "Mark all as Fed" bulk toggle at top.
   "Save log" → creates FeedingRecord for each toggled animal with today's date.
   Post-save summary: "Logged X/Y — Z refused. View refusals →" with link to filter collection.

3. BATCH WEIGHT SCREEN (/groups/:id/weigh):
   Compact table: animal name | last weight (date) | new weight input.
   Submit creates WeightRecord per row that has a value entered.
   Inline amber flag for any new weight >10% below last weight.
   "Skip" option per row for animals not being weighed that day.

QUALITY:
This feature is used daily, often on a phone in a gecko room.
It must be extremely fast to interact with — large touch targets, minimal taps.
The batch feed screen must load and save within 1 second.
```
