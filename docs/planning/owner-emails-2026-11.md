# Owner email addresses, 13 November 2026

Any signed-in member could read the owner's email address on rows the app shows other members. This file says what was readable, what was built, how it was checked, and what is left. It was raised as decision E16 in `docs/OWNER-STEPS.md` and approved on 13 November 2026. Live status is in section 6.

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

## 5. Step 2 (`supabase/pending/owner_emails_step2.sql`)

Signed-in accounts lose `select` on the seven tables and get a column grant of every column but `created_by`, as on 31 October. Its test, `supabase/tests/owner_emails_step2_regressions.sql`, applies it inside a transaction and proves the email and `select *` are refused for members and admins; every other column, and every list the app reads with, still works; owners still add, find, edit and delete their rows; another member still cannot; the functions and rules step 1 moved still work; signed-out visitors and the server are unchanged; and a second run changes nothing.

**When to move it to `supabase/migrations/`:** at least 3 days after step 1's app change is live, and only after the API logs (Supabase dashboard, Logs, API, or the logs tool) show no request in the last 24 hours to `/rest/v1/geckos`, `breeding_plans`, `weight_records`, `feeding_records`, `shed_records`, `vet_records` or `ownership_records` whose query names `created_by` or asks for `select=*` (or no select at all) from a signed-in member. Give it a timestamp later than every migration, change the `\ir` line in its test, update `supabase/pending/README.md`, and check after the merge that members cannot read the column (the test's checks, read-only, against production). Any new column on these tables needs its own grant from then on (`docs/RULES.md`, section 5).

## 6. How it was checked, and status

- **SQL harness** (Postgres 16, every migration replayed): `supabase/tests/owner_emails_step1_regressions.sql` runs the migration a second time (no change), then checks the owner id on all six record tables, every path of the four functions, and the three row rules. It then takes `created_by` away from members inside the test, the way step 2 will, and proves every member path still works and still refuses everyone else. It fails against each of nine copies that put back one old definition (the four functions, the three rules, the owner id trigger). `supabase/tests/owner_emails_functions_regressions.sql` checks the public profile content for a visitor, another member and the owner (no email anywhere) and the old counts function (the server only); it fails against the old definitions. `supabase/tests/owner_emails_step2_regressions.sql` is described in section 5. All 44 SQL test files pass, and so do the transfer race checks. `supabase/tests/perf_regressions.sql` now checks that `recent_weight_records` keeps an empty search path, in place of the old "runs as the member" rule.
- **Production, after the database part was applied (13 November, about 22:22 UTC):** every row of the six record tables has its owner id and none disagrees with `created_by`; the new functions and rules are live; a read-only probe as the member with the most weigh-ins got 253 of their own weigh-ins and none of anyone else's, their sale prices and listing details, and all 325 public geckos.
- **Status, 13 November 2026:** step 1 database live; the functions follow-up and the app change pushed with this note. Step 2 waits in `supabase/pending/` (section 5); then E15 switches the passport step on the sold sheet.
