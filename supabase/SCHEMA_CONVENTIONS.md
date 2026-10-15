# Schema conventions

Read this before writing a migration or a new entity. Everything here was
verified against production on 2026-08-18.

Geck Inspect's database grew in two eras: tables migrated in from the
original hosted platform, and tables created since on Supabase. The two
eras follow different conventions, and mixing them up is the single most
common way to ship a broken table. The rules below are what is actually
true in production, not what a greenfield Supabase schema would look like.

## 1. Primary keys: TEXT on legacy tables, UUID on new ones

| Era | `id` type | Count |
|---|---|---|
| Migrated legacy tables | `TEXT` | 45 |
| Tables created on Supabase since | `UUID` | 62 |

**`geckos.id` is `TEXT`.** So are `profiles.id`, `eggs.id`,
`breeding_plans.id`, `gecko_images.id`, `weight_records.id`,
`notifications.id`, and 39 others.

**Consequences you must respect:**

- **Any foreign key pointing at a legacy table must be `TEXT`.** Declaring
  `sire_id UUID REFERENCES geckos` looks correct and is wrong: every insert
  fails with a type error. This exact mistake shipped in
  `pairing_outcome_logs` and was caught only when the first save failed.
- **`profiles.id` is not `auth.users.id`.** Legacy profile rows carry TEXT
  ids that do not equal the auth UUID, so `.eq('id', user.id)` silently
  matches nothing. **Resolve profiles by email**, which is the app-wide
  convention (see `src/lib/ThemeContext.jsx` for a case where this bit us).
- New tables that reference nothing legacy should use
  `UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
- A TEXT id is also the right choice when the key is a natural identifier
  rather than a surrogate. `genetics_trait_overrides.id` is TEXT because
  the key is a trait id such as `whiteout`.

**Check before you write the migration:**

```sql
SELECT data_type FROM information_schema.columns
WHERE table_name = 'geckos' AND column_name = 'id';
```

## 2. Timestamps: `created_date`, not `created_at`

100 of 110 tables use `created_date` / `updated_date`. Six use
`created_at`, and four have no timestamp column at all.

The entity layer defaults every unsorted `.list()` / `.filter({})` to
`order('created_date')`. A table that uses `created_at` instead must be
registered in `ENTITY_SORT_COLUMN` in `src/api/supabaseEntities.js`, and a
table with no timestamp column must be registered there as `null`.
Otherwise PostgREST rejects the query with a 400, and because several call
sites wrap reads in `.catch(() => [])`, the failure is silent: the UI just
shows nothing.

**New tables should use `created_date` / `updated_date`** to match the
majority convention and get correct default sorting for free.

## 3. Ownership: `created_by` holds an email

72 tables carry a `created_by TEXT` column containing the user's **email**,
not their UUID. RLS policies compare against the JWT email claim:

```sql
CREATE POLICY "Users manage their own rows" ON my_table FOR ALL
  USING (created_by = (auth.jwt() ->> 'email'))
  WITH CHECK (created_by = (auth.jwt() ->> 'email'));
```

`Entity.create()` injects `created_by` automatically. A table that tracks
ownership differently (the `social_*` tables use `created_by_user_id` /
`user_id`) must be listed in `ENTITIES_WITHOUT_CREATED_BY` in
`src/api/supabaseEntities.js`, or inserts fail with "Could not find the
'created_by' column in the schema cache".

## 4. Migrations are not applied by merging

Files in `supabase/migrations/` are the record of what ran. **Merging to
`main` does not run them against production.** The GitHub integration
builds preview branches; it does not migrate the production database.

The order is the one in `docs/MIGRATIONS.md` ("How to make a schema
change today"): apply to production first, then commit.

1. Write the file with a full 14-digit timestamp and make it idempotent.
2. Apply it to production with the Supabase MCP `apply_migration` tool,
   which records it in the migration history. If it has to go through the
   dashboard's SQL editor instead, record it afterwards with
   `supabase migration repair --status applied <version>`, because the
   editor does not record history on its own.
3. Read back the version production recorded. If it differs from the
   filename, rename the file to match, then commit it.

`docs/MIGRATIONS.md` does not use `supabase db push` to apply changes. Run
it only with `--dry-run`, as the check described there, and never with
`--include-all`.

Then confirm the table or function exists before assuming the feature works.
Two Phase 3 calculator features sat inert for hours because the migrations
had merged but never run.

## 4a. Grants: every new function says who may run it

From `20261015130000_comms_and_exposure.sql` (section 8) on, a function a
migration creates gets **no EXECUTE for `anon`, `authenticated` or
`PUBLIC`** by default. The default privileges for role `postgres` were
changed so that nothing is callable from the API by accident. `service_role`
and the owner still get it.

So every migration that adds a function must grant it explicitly, for
example:

```sql
revoke all on function public.my_fn(text) from public, anon;
grant execute on function public.my_fn(text) to authenticated;
```

This includes small SQL helpers that a row security policy or a SECURITY
INVOKER trigger calls: those run as the member, so the member's role needs
EXECUTE too. Without the grant the app gets "permission denied for
function".

**DROP plus CREATE loses the grants.** `create or replace function` keeps
an existing function's grants. Dropping a function and creating it again
(for example to change its return type or its arguments) makes a new
function with no API grants at all, so re-grant it in the same migration.
Prefer `create or replace` whenever the signature allows it.

Objects created as `supabase_admin` (the dashboard, some extensions) do not
follow this rule: that role's default privileges still grant the API roles
everything. Grant and revoke explicitly there too.

## 5. Historical artifacts

Some files legitimately still name the original platform and should be
left alone:

- `supabase/migrations/*`, applied history. Never rewrite an applied
  migration, including its filename, even when the name mentions the old
  platform.
- `docs/archive/`, a deliberately frozen snapshot of the pre-Supabase
  backend, kept for reference. Nothing in `src/` imports it.

Live application code should not reference the old platform by name. If
you find such a reference outside the two locations above, it is stale.
