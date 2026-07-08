# Base44 backend snapshot (archive, do not use)

This is a frozen snapshot of the original Base44 backend that Geck Inspect
was migrated off of. It is NOT part of the build and nothing in `src/`
imports it. It lives here purely as historical reference.

- `entities/*.jsonc`: the old Base44 entity schemas.
- `functions/*/entry.ts`: the old Base44 Deno backend functions.

The live backend is Supabase: schema is documented in
`supabase/SCHEMA_SNAPSHOT.md`, entity access goes through
`src/api/supabaseEntities.js`, and edge functions live in
`supabase/functions/`.
