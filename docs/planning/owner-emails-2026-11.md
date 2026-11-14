# Owner email addresses, 13 November 2026

Any signed-in member could read the owner's email address on rows the app shows other members. This file says what was readable, what was built and how it was checked. It was raised as decision E16 in `docs/OWNER-STEPS.md` and approved on 13 November 2026. Both steps are live since 14 November 2026 (section 6).

## 1. What was readable

Checked against production on 13 November 2026. The column is `created_by` on each table. Signed-out visitors could not read it on any of these: the 31 October change (`20261031061000_member_email_columns_revoke.sql`) already took it from them.

| Table | Whose rows another member could read |
|---|---|
| `geckos` | Every public gecko (325 of 391), and every gecko in a collection shared with them |
| `breeding_plans` | Every public plan |
| `weight_records`, `feeding_records`, `shed_records`, `vet_records`, `ownership_records` | The records of any gecko with a public passport, and of geckos in a shared collection |

No screen showed another member's email. The data was readable through the API by anyone with an account and some skill.

Also readable by signed-in members, and left alone: the admin's own address on guide content (care guide sections, morph guides and traits, forum categories, page settings), and the other person's address in a direct message, a follow or a transfer, where the two people have already been introduced. `question_votes` would have shown voters' addresses, but it is empty (Geck Answers is retired).

## 2. The approach

The same two steps used for photos and forum posts on 31 October:

1. **Step 1:** the app stops reading `created_by` on these seven tables and identifies the owner by `owner_profile_id` instead (the owner's profile id, not an email). Nothing is taken away, so tabs that are already open keep working.
2. **Step 2, a few days later:** members lose the right to read `created_by` on the seven tables. A tab older than step 1 that asks for the column would fail, which is why step 2 waits until those tabs have closed.

Why not one step: Postgres refuses a whole `select *` once one column in it is not granted, and the app read these tables with `select *` in many places. Every open tab would have failed to load My Geckos until reloaded.

## 3. Step 1, database (`supabase/migrations/20261113215000_owner_emails_step1.sql`)

- **`owner_profile_id`** on `breeding_plans`, `weight_records`, `feeding_records`, `shed_records`, `vet_records` and `ownership_records`, as `geckos` already had. The database sets it from `created_by` on every insert and whenever either column is written (a value the browser sends is replaced), with the same trigger function geckos uses. Existing rows were filled in, with the weight trigger that refreshes a gecko's latest weight paused for that one statement. Each has an index.
- **Four functions** that run with the member's own permissions stopped reading `created_by` and whole rows, which step 2 would refuse. Each keeps its name, arguments, grants and behaviour:
  - `save_gecko_record` checks ownership with `owner_profile_id` and returns the saved row through the new `gecko_row_as_member`, which includes only the columns the caller may read. It also accepts `estimated_hatch_year` (decision E13, a hatch year on its own).
  - `recent_weight_records` now runs as its owner and filters on the member's email itself, so it returns the same rows: the member's own weigh-ins and nobody else's.
  - `save_morphmarket_listing` checks ownership with `owns_animal`, which the record tables' row rules already use.
  - `import_morphmarket_listing` finds the member's gecko by `owner_profile_id`.
- **Three row rules on other tables** looked up `created_by` in a subquery: reading and clearing `gecko_sale_prices`, the owner's own `morphmarket_listing_details`, and reading `ownership_record_prices`. Postgres checks the reader's column rights inside such a subquery (a table's rule on its own columns is not checked), so after step 2 those tables would have refused every read. They now ask through functions that run as their owner (`owns_animal`, `gecko_shared_with_caller`, and a new `owns_ownership_record`). Who passes each rule is unchanged.

Found while building it: the plan first listed six tables. A check of every table whose `created_by` members could read found `feeding_records`, which follows the same public-passport rule as weights and sheds.

Also found: two functions that run as their owner, which column rights do not bind, handed the email out. `public_profile_content` (the public profile page) put `created_by` on every gecko and plan row for a signed-in caller, and `community_gecko_counts` returned every keeper's email with their gecko counts. `20261113225505_owner_emails_functions.sql` removes the email from the first for everyone and leaves the second to the server (the app has used `community_owner_gecko_counts`, by profile id, since October). The other functions of that kind that read these tables return counts, the caller's own rows, or are for admins only.

## 4. Step 1, the app

- **The entity layer** (`src/lib/ownerRows.js`, loaded with the first read of one of these tables, not with the app): members read every column but `created_by` (`OWNED_COLUMNS_BY_TABLE` in `src/lib/memberColumns.js`); a `created_by` filter becomes an `owner_profile_id` filter (the member's own address from their profile, anyone else's through `read_profiles`, an unknown address matches nothing as before); and the member's own rows get `created_by` back, set to their own email. So `Gecko.filter({ created_by: user.email })` and `gecko.created_by === user.email` keep working, unchanged, in the dozens of places that use them. Another member's row has no `created_by`.
- **Rows that arrive another way:** the long form and Quick Add put the member's email back on the row `save_gecko_record` returns. The shared ownership checks (`isOwnRow` in `src/lib/geckoAccess.js`, the record page, the sold-sheet transfer, the form) also accept `owner_profile_id` equal to the member's profile id.
- **Direct reads** that filtered on `created_by` now filter on `owner_profile_id`: the Overview's counts, My Store, the live gecko count, the first-gecko event, the iPhone reminders, and the retired Promote page (through the Gecko entity). The passport page reads the member list and finds the owner by profile id.
- **Another member's row:** the record page, the passport and the marketplace message the owner by profile id (`MessageUserButton` takes `recipientProfileId`; `/Messages?profile=<id>` opens the conversation) and report by profile id. The marketplace, liked geckos, community activity, the shared-collection badge, the trust panel and vet records find owners by `owner_profile_id`. Admin screens (members, moderation, analytics) take owners' emails from their profiles.
- **Checks in the app's tests:** `src/lib/__tests__/ownerRows.test.js` covers the lists, the filter translation and putting the email back, and fails on any direct read in `src/` that names `created_by` or uses `select *` on the seven tables. The browser tests' fake database (`e2e/support/fake-supabase.js`) now behaves like production after step 2: it keeps `owner_profile_id` in step, refuses any read that names `created_by` on these tables, returns only the columns asked for, and records each refusal; the member flow test fails if there is one.

## 5. Step 2 (`supabase/migrations/20261114023856_owner_emails_step2.sql`)

Signed-in accounts lose `select` on the seven tables and get a column grant of every column but `created_by`, as on 31 October. Its test, `supabase/tests/owner_emails_step2_regressions.sql`, applies it inside a transaction and proves the email and `select *` are refused for members and admins; every other column, and every list the app reads with, still works; owners still add, find, edit and delete their rows; another member still cannot; the functions and rules step 1 moved still work; signed-out visitors and the server are unchanged; and a second run changes nothing.

**When it moved.** The plan was to wait at least 3 days after step 1's app change, for tabs opened before it to close. Tennyson asked for it on 14 November, before then. The API logs for the 24 hours before the move showed 34 signed-in requests in all, from one session, the last at about 20:00 UTC on 13 November, and none since step 1's app went live at about 23:20 UTC; no phone app build is live and nothing has been submitted to Google Play. So nothing in use asked for the column. The one cost: the iPhone app bundles the website when it is built, so build 13 (and any build made before 14 November) cannot load geckos; the next build is made from `main` as of 14 November or later (`docs/OWNER-STEPS.md`, B3). Any new column on these tables needs its own grant from now on (`docs/RULES.md`, section 5).

Moving it changed four older SQL tests that still said members may read `created_by` on these tables: the admin analytics column check (`eng_regressions.sql`), the 31 October revoke's note that geckos kept the column (`member_email_columns_revoke_regressions.sql`, now inverted), the "before step 2" check in `owner_emails_step1_regressions.sql` (now checks either side), and the old 1,000-row read in `perf_regressions.sql` (now by `owner_profile_id`).

## 6. How it was checked, and status

- **SQL harness** (Postgres 16, every migration replayed): `supabase/tests/owner_emails_step1_regressions.sql` runs the migration a second time (no change), then checks the owner id on all six record tables, every path of the four functions, and the three row rules. It then takes `created_by` away from members inside the test, the way step 2 will, and proves every member path still works and still refuses everyone else. It fails against each of nine copies that put back one old definition (the four functions, the three rules, the owner id trigger). `supabase/tests/owner_emails_functions_regressions.sql` checks the public profile content for a visitor, another member and the owner (no email anywhere) and the old counts function (the server only); it fails against the old definitions. `supabase/tests/owner_emails_step2_regressions.sql` is described in section 5. All 44 SQL test files pass, and so do the transfer race checks. `supabase/tests/perf_regressions.sql` now checks that `recent_weight_records` keeps an empty search path, in place of the old "runs as the member" rule.
- **Production, after the database part was applied (13 November, about 22:22 UTC):** every row of the six record tables has its owner id and none disagrees with `created_by`; the new functions and rules are live; a read-only probe as the member with the most weigh-ins got 253 of their own weigh-ins and none of anyone else's, their sale prices and listing details, and all 325 public geckos.
- **Production, after the app push (13 November, about 23:24 UTC):** `20261113225505` is recorded; `community_gecko_counts` can be run by the server only; read-only, as one member opening another member's public profile, `public_profile_content` returned all 89 public geckos and the public plan with no `created_by` on any row and no email address anywhere in the answer.
- **Production, after step 2 was applied (14 November, about 03:00 UTC):** `20261114023856` is recorded. Signed-in accounts cannot read `created_by` on any of the seven tables and hold no table-wide read on them; every other column is granted; the server keeps the column. Read-only, as the member with the most weigh-ins: reading `geckos.created_by`, `select *` on `weight_records` and a filter on `breeding_plans.created_by` were all refused, while their 133 geckos (with the app's column list), 253 recent weigh-ins, 17 breeding plans and 9 sale prices, and all 325 public geckos, read as before.
- **Status, 14 November 2026:** both steps are live. Step 1: the database at about 22:22 UTC on 13 November, the app and the functions follow-up at about 23:20 UTC. Step 2: pushed on 14 November (section 5). The same push switched the passport step on the sold sheet back on (E15, `docs/DECISIONS.md` entry 69). The check-in scheduled for 17 November was cancelled, as there was nothing left for it to do.
