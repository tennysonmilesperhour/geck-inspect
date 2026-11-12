# Documentation review, 11 November 2026

A review of every document in the repository that is not code: the plans, specs, runbooks, reviews and notes. It says what was wrong, what was changed in the same commit, and what is left, so another session can finish it without rereading 20,000 lines.

The map this review produced is `docs/README.md`. Read that to find a document. Read this to understand why the documents look the way they do, or to carry on the work.

## 0. How to use this file

- Sections 1 and 2 are the findings. Section 3 is what changed. Section 4 is what is left, as work packages with "done when" checks. Section 5 is how to keep the documents true from here on.
- Paste-ready prompt for a session that continues the work:

> Read `docs/planning/docs-review-2026-11-11.md`, sections 4 and 5, and `docs/README.md`. Do package DOC-N only. Change documents, not code, unless the package says otherwise. Run `node scripts/check-doc-links.mjs` before committing, keep the rows in `docs/README.md` in step, and add a dated line under the package when it is done. No em dashes or en dashes.

## 1. The answer in short

There were 198 markdown files: 121 hand-written documents and the rest generated reports, email content and archives. The individual documents are mostly well written. The set was the problem. A new session could not tell which document was the plan, which facts were current, or what Tennyson still had to do.

The ten findings that mattered most:

1. **No map.** The only index was a 37-line list inside `CLAUDE.md` that left out a third of the important documents, mixed live plans with history, and called the folder that holds the active plan "older audit and planning documents, kept for history".
2. **Four documents each said they were the plan.** The feature audit ("this file is the roadmap now"), the VIP audit, the launch review ("start here") and the October growth plan ("start here for priorities") all still read as current. Only `ROADMAP.md` and Part E of the comprehensive review were right.
3. **The plan had no status.** `ROADMAP.md` says progress is recorded "with a dated line on the item", and no item in Part E had one, 27 days in.
4. **Tennyson's steps were scattered over about 20 documents.** About 37 open steps and decisions; `docs/NOW.md`'s top ten carried 10 of them, and the scoreboard had not been refreshed since 31 October.
5. **Documents that could cause a mistake.** The schema snapshot said "merging a migration does not apply it to production" (it does). Two notes beside the migrations said to paste SQL into production by hand. The design document said fonts load from Google Fonts (they are self-hosted). A July pricing memo proposed $9.99 for Breeder as if adopted. Paste-ready prompt blocks in old specs carried a font and colour scheme that never shipped.
6. **Retired features read as live** in about 15 documents: Promote, the AI Consultant, Other Reptiles, the store, the website builder, Guess the Price, Breeding Loans, Geck Answers. A spec for each of four retired features sat beside the live design document with nothing to tell them apart.
7. **Facts stated in several places disagreed.** Twenty-three cases were found, among them the number of edge functions (five different figures), reminder timing (fixed UTC times in one runbook, 7 am local time in another), whether the iPhone app had been submitted, the Founding Breeder offer (a free year in three documents, $120 prepaid in the plan), and the iPhone build number.
8. **Rules were scattered.** About 60 standing rules ("do not change the landing page while the test runs", "never write a breeder's email in this file", "retired code is kept") lived in 15 documents. One contradicted another: the plan says to delete retired code after a month; Tennyson's later decision keeps it.
9. **Things a new session needs did not exist:** a description of how the code is laid out, a glossary, one place that states the product's current shape (12-item menu, phone tabs, dark only, what is retired).
10. **The generator of the weekly growth report wrote a ready-made prompt, every week, to draft a blog post and commit it to main**, although blog work has been shelved since 30 September. The same template put en dashes into every report.

The dash rule itself was in good shape: outside generated reports, only `CLAUDE.md` (which printed the characters while forbidding them), `docs/INTENT.md`, `docs/native-shell-plan.md`, `docs/seo.md`, `docs/blog-style-guide.md` and one old audit contained any.

## 2. The brief, with the gaps filled in

The request was to review all the non-code documents and revise the whole set under the same guidelines as the experience review: specific, actionable, easy to hand to another AI, with removals, reorganisation and the gaps filled.

| Question the request left open | Assumed answer |
|---|---|
| Who reads these documents? | A Claude session that starts cold, and Tennyson, who is not a programmer. So: plain words, the answer first, and nothing that needs a second document to make sense. |
| What does "revise" allow? | Reorganise, correct, mark and add. Not rewrite history: a finished plan keeps its text and gains a banner. Not change decisions: where documents disagree, the newer decision is recorded, not re-argued. |
| May documents be deleted? | No. Finished ones move to `history/` folders. |
| May generated reports be edited? | No. The script that writes them was fixed. |
| What about documents that scripts or code comments point at? | They stay where they are (the email rules, the Morph ID evaluation notes, the quality scale spec, the weekly notes, the generated report folders). Only documents with no such ties were moved. |
| What must not be touched? | `docs/drafts/` (the shelved article: "stays untouched"), applied migrations, the landing page files. |

One thing the request could not have known: three scheduled routines in Tennyson's Claude account read these documents every week, and two of their prompts are out of date (section 4, DOC-6). Those prompts are not in the repository and were not changed.

## 3. What changed in this commit

**New documents**

| File | What it is |
|---|---|
| `docs/README.md` | The map: every document, its purpose and its status (live, reference, dated, history, shelved, generated), a reading order, and a table by job. |
| `docs/OWNER-STEPS.md` | Every step and decision waiting on Tennyson, with the link and the values first. |
| `docs/RULES.md` | Every standing rule, with its source. |
| `docs/ARCHITECTURE.md` | How the code is laid out, written from the code. |
| `docs/GLOSSARY.md` | Product words and crested gecko words. |
| `scripts/check-doc-links.mjs` | Finds links between documents that point at nothing. |

**`CLAUDE.md` restructured.** The git rules are word for word as they were. After them: what the project is, a reading order, where things stand today, how to work with Tennyson, the writing rules, the rules that always apply, and a short table of where documents are. Stale lines were corrected (the Breed Ledger launch is in the past; the Word documents it cited are not in the repository; the retired list was incomplete; three "waiting on Tennyson" notes described things that were done). The dash characters it printed are now described by name.

**Moved to history** (with every reference to them rewritten: 17 files, six of them code comments):

- `docs/planning/history/`: 15 finished audits and plans and their three screenshot folders.
- `docs/specs/history/`: 8 specs for retired, shelved or replaced work.

**Banners and corrections on 80 documents.** Each document that is no longer current opens with one paragraph: its status, what changed, what replaced it. The live runbooks (`CONTEXT`, `ENGINEERING`, `OPERATIONS`, `INFRASTRUCTURE`, `BILLING`, `STRATEGY`) open with a dated list of corrections.

**Fixed in the text itself**, because a banner was not enough:

- `supabase/SCHEMA_SNAPSHOT.md`: merging a migration does apply it to production.
- `docs/CONTEXT.md`: the iPhone app has been submitted.
- `docs/specs/DESIGN-SYSTEM.md`: fonts are self-hosted; where the wordmark font is used; counts.
- `docs/planning/app-store-resubmission-2026-10-26.md`: the build to upload is 15, and Sign in with Apple is on.
- `docs/specs/P8-breeder-storefront.md`: an example address that echoed the other breeder's name.
- `README.md`, `ROADMAP.md`: pointers to documents that had been replaced.

**The plan has a status.** Part E of the comprehensive review opens with a table of where each item stood on 11 November, checked against the code and the git log. The tables under it are untouched.

**`docs/NOW.md`** opens with a note that it has not been refreshed since 31 October and points at the owner steps. Its numbers were not changed: they come from production and are Tennyson's to copy.

**The growth report generator** (`scripts/growth-report.mjs`) no longer writes a blog prompt and no longer uses en dashes. Old reports were left as they are.

## 4. What is left

Each package is documents only unless it says otherwise. Effort: S is under an hour, M is a few hours.

### DOC-1. Correct the runbooks in the text, then drop their correction banners (M)

The six runbooks carry a "Corrections" paragraph at the top. The stale sentences are still in the body.

- `docs/CONTEXT.md`: sections 1 to 5 (retired features, the Promote promo line), the function counts, section 7 (replace with a pointer to `STRATEGY.md`), section 8 (name both landing pages).
- `docs/ENGINEERING.md`: the integration table rows for the Morph Visualizer, Promote and Govee; the iPhone sign-in and account deletion paragraphs.
- `docs/OPERATIONS.md`: the function counts; the Promote lines; the revenue line; replace section 5's database job table with a pointer to section 4 of `docs/INFRASTRUCTURE.md`.
- `docs/INFRASTRUCTURE.md`: the counts in section 1.
- `docs/BILLING.md`: the header date; the Apple notifications paragraph. Move the Stripe portal setup and the webhook events list from `docs/stripe-plan-switching.md` into it, then move that file to history.
- `STRATEGY.md`: the lines about the app stores, the website editor, the sensor integration and the missing Word documents.

Done when: each fact in the banner is corrected where it appears, the banner is removed, and `grep -n "Corrections, 11 November" docs/*.md STRATEGY.md` returns nothing.

Done 12 November 2026: all six runbooks corrected in the text and their banners removed. The Stripe portal setup, webhook events and refund rules are in the "Stripe" section of `docs/BILLING.md`, and the old file is `docs/planning/history/stripe-plan-switching-2026-10.md`. Production was not read, so the counts are from the repository and the last production readings (28 and 31 October) are dated as such.

### DOC-2. One home for each fact that drifts (S)

- Edge function counts appear in four documents. Keep the number in `docs/INFRASTRUCTURE.md` only; elsewhere say "see INFRASTRUCTURE".
- Prices appear in `docs/CONTEXT.md`, `STRATEGY.md`, `docs/GLOSSARY.md` and old decisions. Keep one table in `docs/CONTEXT.md` that names `src/lib/stripe-config.js` as the source; elsewhere point to it.
- "How a merge deploys" is told in five documents. `docs/MIGRATIONS.md` owns it; the others keep one sentence and a link.

Done when: a search for the function count, a price and "applies new migration" each finds one full statement.

Done 12 November 2026: the counts live in `docs/INFRASTRUCTURE.md` section 2, the prices in `docs/CONTEXT.md` section 5 (`docs/GLOSSARY.md` keeps a one-line summary that names the code as the source), and the deploy story in `docs/MIGRATIONS.md`. The database job table also has one home now, `docs/INFRASTRUCTURE.md` section 4. Left as they are: prices quoted inside dated plans, old decisions and `docs/NOW.md`.

### DOC-3. A status index for the decision log (M)

`docs/DECISIONS.md` has 60 entries and several carry a status that a later entry overturned (listed in its new opening note). Add a table at the top: number, title, one of live, replaced by N, or never built. Do not edit the entries. Add the two missing entries: reminders at 7 am local time (31 October) and Sign in with Apple (10 November).

Done when: every entry number appears in the table with a status.

Done 12 November 2026: the status index is at the top of `docs/DECISIONS.md` (62 rows), and decisions 61 (reminders at 7 am local time) and 62 (Sign in with Apple) are appended. No entry was edited, so the personal email address in decisions 18 and 21 is still there (DOC-9).

### DOC-4. Refresh the documents that are meant to be current (S, needs production numbers)

- `docs/NOW.md`: the scoreboard numbers and the top ten. Tennyson's, or a session's draft marked as a draft.
- `supabase/SCHEMA_SNAPSHOT.md`: regenerate with the queries at its foot.
- `supabase/migrations/_applied_by_hand/README.md`: five files in the folder are missing from its table.
- `docs/marketing/email-brain.md`: the log stops on 28 October; the readings due on 2 and 9 November are not there.
- `docs/planning/agent-access-2026-10.md`: the review log has no entry after 7 October.
- `docs/planning/weekly-notes-2026-10.md`: the section 4 table against the note files.

Done when: each has a date from this month on it, or a line saying why not.

Part done 12 November 2026: `supabase/migrations/_applied_by_hand/README.md` lists all nine files, and the section 4 table of `docs/planning/weekly-notes-2026-10.md` matches the note files. Not done, because they need production numbers or Tennyson: `docs/NOW.md`, `supabase/SCHEMA_SNAPSHOT.md`, the `docs/marketing/email-brain.md` log and the `docs/planning/agent-access-2026-10.md` review log.

### DOC-5. Specs: cut the paste-ready prompt blocks (S)

`docs/specs/P1-animal-passport.md` and `P7-printable-worksheets.md` end with "Claude Code Prompt" blocks that carry fonts, colours and routes that never shipped. The banners warn about them. Better: delete the blocks (git keeps them) and leave a one-line pointer to `docs/specs/DESIGN-SYSTEM.md`.

Done when: `grep -rn "Google Fonts\|DM Serif" docs/specs/*.md` finds only the design document's own history note.

Done 12 November 2026: the build prompt blocks were cut from P1, P2, P6, P7, P8 and P10 (P11 had none), each leaving the one-line pointer, and the two font names in P1's UI spec became "the heading font". The grep now finds only `docs/specs/DESIGN-SYSTEM.md`.

### DOC-6. Routine prompts (owner step, with a session's help)

Three routines read these documents: the Monday agent review, the Thursday Weekly Gecko Notes writer and the daily health check. Two prompts are out of date (`docs/OWNER-STEPS.md`, step C8). When Tennyson opens them, a session should also point each at `docs/README.md` and `docs/RULES.md`.

### DOC-7. An index of `scripts/` (S)

`scripts/README.md` covers only the Morph ID scripts. Write one table: each script or folder, what runs it (a `package.json` script, a workflow, by hand) and what it writes.

Done when: every entry in `scripts/` has a row.

Done 12 November 2026: `scripts/README.md` is the index (54 rows), with the Morph ID operations below it and its three errors fixed. Two things it turned up are in code and were not changed: `scripts/deploy-morph-id.sh` still says in its own comments that it applies migrations and deploys four functions, and the weekly growth report still adds search gaps to `docs/blog-queue.json`.

### DOC-8. A route map (S)

Old specs name addresses that never existed (`/collection`, `/b/:slug`, `/answers`, `/loans`). A short table in `docs/ARCHITECTURE.md`, old spec address against real address, would stop a session building from them.

Done 12 November 2026: section 12 of `docs/ARCHITECTURE.md`, 17 rows, each real address checked in `src/App.jsx`, `src/pages.config.js` or `src/lib/retiredPages.js`.

### DOC-9. Decide about personal details in history (owner decision)

`docs/marketing/email-brain.md` and two old decisions contain a personal email address, in a public repository. Making the repository private (`docs/OWNER-STEPS.md`, step C3) is the fix that covers the history too. Until then, a session can replace the address in the current files with a description.

### Not proposed

- Moving the generated report folders (`docs/growth-reports/` and three others) under one `reports/` folder. Four workflows and nine scripts write to those paths; the gain is tidiness only.
- Moving the top-level history documents (`INTENT.md`, `RELEASE_READINESS.md` and four others) to `docs/archive/`. Other documents and one workflow cite them; they carry banners now.
- Rewriting any finished plan to match today.

## 5. Keeping it true

The documents drifted because each session added a document and none owned the set. Six habits keep that from recurring. They are also rule 13 of `docs/RULES.md` and the last section of `docs/README.md`.

1. **One fact, one home.** If a fact is already written somewhere, link to it.
2. **A new document gets a row in `docs/README.md` in the same commit**, with a status.
3. **When a document stops being true, give it a banner on its first lines** and change its row. Do not leave it to the next reader to work out.
4. **When a plan is finished, move it to `history/`** with `git mv`, then run `node scripts/check-doc-links.mjs`.
5. **A step for Tennyson goes in `docs/OWNER-STEPS.md`**, link and values first. Other documents point at the step.
6. **A new standing rule goes in `docs/RULES.md`**, with its source.

Two checks a session can run at any time:

| Check | Command |
|---|---|
| Links between documents | `node scripts/check-doc-links.mjs` |
| File paths named in documents that no longer exist | `node scripts/check-doc-links.mjs --paths` |
| Dashes in hand-written documents | `grep -rlP "\x{2014}\|\x{2013}" --include=*.md . \| grep -v "node_modules\|growth-reports\|seo-audits\|blog-reports\|docs/archive"` |

Worth adding later (code, so not done here): run the link check in CI on any commit that touches a markdown file.

## 6. Method and limits

- Three read-only sweeps read every hand-written document in full: the entry and reference documents, the 37 planning documents, and the specs with everything else. Each claim they flagged was checked against the code, the git log or another document, with file and line.
- The findings that drove a change in the text (not a banner) were re-read by hand before the change.
- The git history in this checkout begins on 24 October 2026, so "last changed" dates before that could not be read from git; the dates inside the documents were used.
- Not verifiable from a session: anything in the Supabase, Stripe, Apple, PostHog or Vercel dashboards. Where a banner or the owner steps say "not recorded", it means no document says it happened.
- Not reviewed line by line: the 60 generated reports, the 16 Weekly Gecko Notes (they are email content with their own rules) and the Base44 archive.
