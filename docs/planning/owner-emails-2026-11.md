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

## 4. Step 1, the app

To do. The app reads named columns on the seven tables, never `created_by`; finds "mine" by `owner_profile_id`; and puts the member's own email back on their own rows, so screens that compare `created_by` with the member's email keep working. Other members' rows read `created_by` as null. Screens that need another member's name use their profile, as the breeder pages already do.

## 5. Step 2

To do. A migration in `supabase/pending/` revokes `select` on the seven tables from signed-in accounts and grants every column but `created_by`. It moves to `supabase/migrations/` at least three days after step 1's app is live, once the API logs show no request still naming the column. Any new column on these tables needs its own grant from then on (`docs/RULES.md`).

## 6. How it was checked, and status

- **SQL harness** (Postgres 16, every migration replayed): `supabase/tests/owner_emails_step1_regressions.sql` runs the migration a second time (no change), then checks the owner id on all six record tables, every path of the four functions, and the three row rules. It then takes `created_by` away from members inside the test, the way step 2 will, and proves every member path still works and still refuses everyone else. It fails against each of nine copies that put back one old definition (the four functions, the three rules, the owner id trigger). All 42 SQL test files pass, and so do the transfer race checks. `supabase/tests/perf_regressions.sql` now checks that `recent_weight_records` keeps an empty search path, in place of the old "runs as the member" rule.
- **Status, 13 November 2026:** step 1 database pushed. Step 1 app, step 2 and then E15 (the passport step on the sold sheet) are next.
