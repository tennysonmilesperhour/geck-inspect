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

Files in `supabase/migrations/` are the record of intent. **Merging to
`main` does not run them against production.** The GitHub integration
builds preview branches; it does not migrate the production database.

After merging a migration, apply it one of these ways:

- the Supabase MCP tools (`apply_migration`) from an agent session,
- `supabase db push` from the CLI, or
- pasting the SQL into the dashboard's SQL editor.

Then confirm the table exists before assuming the feature works. Two
Phase 3 calculator features sat inert for hours because the migrations had
merged but never run.

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
