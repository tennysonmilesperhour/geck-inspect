# P5 — Geck Answers (Q&A Knowledge Base)

**Priority:** P5
**Dependencies:** None — standalone feature
**Origin:** iHerp analysis — iHerp Answers built real domain authority. Stack Overflow-style Q&A separate from forums.

---

## What It Is

A structured Q&A system where breeders ask questions and the community answers. Best answers get surfaced. Questions accumulate into a searchable knowledge base. Unlike a forum thread, a Q&A post has a clear "best answer" state — it's resolved or unresolved. Over time this becomes the authoritative CG resource online.

## Strategic Value

**SEO flywheel.** A question like "how often should I weigh a juvenile crested gecko" that gets a high-quality answer will rank in Google. That drives free organic traffic to Geck Inspect from people who don't know the app exists yet. iHerp had this — it built real domain authority for them. We can do it better.

---

## Data Model

```
Question {
  id:              UUID
  author_id:       UUID → User
  title:           string  (max 150 chars — the searchable, SEO-important part)
  body:            text    (markdown supported)
  tags:            array of strings  (e.g. ["nutrition", "juvenile", "weight"])
  status:          enum [open, answered, closed]
  best_answer_id:  UUID nullable → Answer
  view_count:      integer
  upvote_count:    integer
  is_featured:     boolean  (admin can feature important questions)
  created_at:      timestamp
  updated_at:      timestamp
}

Answer {
  id:              UUID
  question_id:     UUID → Question
  author_id:       UUID → User
  body:            text  (markdown supported)
  upvote_count:    integer
  is_best_answer:  boolean
  created_at:      timestamp
  updated_at:      timestamp
}

QuestionVote {
  user_id:         UUID → User
  question_id:     UUID nullable → Question
  answer_id:       UUID nullable → Answer
  value:           integer  (+1 only — upvote, no downvotes for community health)
  created_at:      timestamp
}
```

---

## UI Spec

### Geck Answers Home (`/answers`)

- **Search bar** prominent at top: "Search 500+ answers..."
- **Tag filter chips:** Nutrition - Health - Housing - Breeding - Morphs - Juveniles - Adults - Hatchlings - Equipment - Genetics
- **Two tabs:** Recent / Trending
- **Question list:** upvote count (left), title (bold), body excerpt, tags, answer count, "Answered" badge (sage) if best_answer_id set, author + time
- **"Ask a question" button** (Sage accent, top right)
- Featured questions pinned at top of list

### Question Detail Page (`/answers/:id`)

- Question title in DM Serif Display
- Body text (rendered markdown)
- Tags as clickable pills -> filter list by tag
- Upvote button (left side of question, count shown)
- **Best answer** (if set): highlighted in pale sage with "Best answer" badge in ember gold
- All other answers below, sorted by upvote count
- Each answer: body, author, date, upvote count, upvote button
- "Mark as best answer" button on each answer — only question author can click
- "Add your answer" form at bottom (textarea with markdown toolbar, submit button)
- If question is answered: subtle "This question has a best answer" banner at top

### Ask a Question (`/answers/new`)

- **Title field:** "What's your question?" — live character count, 150 max
- **Body:** markdown textarea with preview toggle
- **Tags:** multi-select (max 5 tags from predefined list)
- **Related questions:** as user types title, show "Similar questions — have these been answered?" (search existing questions — reduces duplicates)
- **"Post question" button**

### Seed Content

Seed with 10-15 high-quality starter questions covering:
- Feeding frequency
- Weight goals by age
- Shedding problems
- Lilly White care
- Incubation temperatures
- First breeding age
- CGD brands
- Habitat setup
- Juvenile vs adult care differences
- Common health issues

Each seeded question should have 2-3 answers with one marked as best.

---

## Claude Code Prompt

```
Build Geck Answers, a Stack Overflow-style Q&A knowledge base, for Geck Inspect.

DESIGN SYSTEM: [PASTE GLOBAL DESIGN SYSTEM]

CONTEXT: This is a standalone feature — no dependencies on P1-P4.
It builds a permanent searchable knowledge base about crested gecko care and breeding.
Strong SEO is a key goal — question titles and answer content must render as clean HTML,
not behind auth walls. Public read, account required to ask or answer.

DATABASE:
[PASTE Question, Answer, QuestionVote models]

Seed with 10–15 high-quality starter questions covering: feeding frequency, weight goals
by age, shedding problems, Lilly White care, incubation temperatures, first breeding age,
CGD brands, habitat setup, juvenile vs adult care differences, common health issues.
Each seeded question should have 2–3 answers with one marked as best.

BUILD:

1. ANSWERS HOME (/answers)
Prominent search bar at top. Tag filter chips (Nutrition, Health, Housing, Breeding,
Morphs, Juveniles, Adults, Hatchlings, Equipment, Genetics).
Tabs: Recent / Trending (trending = most views + votes in last 30 days).
Question list: upvote count bubble (left), title, excerpt, tags, answer count badge,
"Answered" badge (sage) or "Unanswered" (muted), author avatar + relative time.
Featured questions pinned at top. "Ask a question" button.

2. QUESTION DETAIL (/answers/:id) — PUBLIC, NO AUTH REQUIRED TO READ
Question title in DM Serif 28px. Body rendered markdown. Tags. Upvote button + count.
Best answer highlighted (pale sage bg, "Best answer" badge in ember gold).
Other answers below sorted by upvote count.
Each answer: rendered body, author, date, upvotes, upvote button.
"Mark as best answer" — question author only.
"Add your answer" form at bottom — auth required, markdown textarea.

3. ASK A QUESTION (/answers/new) — AUTH REQUIRED
Title input with 150-char counter. Body textarea with markdown preview.
Tag multi-select (max 5). As-you-type: show similar existing questions.
"Post question" submit.

4. SEARCH
Full-text search across question titles and bodies. Results page similar to home list.
Search must be fast — ideally using Postgres full-text search (tsvector/tsquery).

QUALITY:
Question titles must render as clean <h1> tags with the question as the meta title —
this is what Google indexes. No auth walls on question or answer content.
Markdown must render correctly (bold, bullets, code blocks for enclosure measurements etc.)
Upvote counts must update optimistically on click.
Seed data must be high enough quality that the feature feels useful on day one.
```
