# Ops scripts for the /recognition + /training pipeline

Two helpers that take the "follow the deploy guide" step out of shipping
updates to the morph-ID system.

## `deploy-morph-id.sh`

Applies all auto-migrations, deploys all four edge functions, and
(optionally) backfills embeddings for verified rows that don't have
one yet.

```bash
# Full deploy, no backfill:
scripts/deploy-morph-id.sh

# Full deploy + backfill up to 500 missing embeddings:
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<key> \
  scripts/deploy-morph-id.sh --backfill

# Preview what would happen without doing it:
scripts/deploy-morph-id.sh --dry-run
```

### One-time prereqs (do these by hand, once)

1. Install + auth the Supabase CLI.
2. `supabase link --project-ref <your-ref>`
3. Set edge-function secrets:
   ```bash
   supabase secrets set REPLICATE_API_TOKEN=r8_xxx
   supabase secrets set SIGLIP_MODEL=owner/siglip2-endpoint
   ```
4. Ensure the `vector` extension is enabled in prod (Dashboard →
   Database → Extensions → search "vector" → Enable).

### Hands-on-keyboard steps the script intentionally skips

- `supabase/migrations/README_training_rls_prod.md` ,  RLS + role
  migration. Not auto-applied because its policies depend on
  `profiles.role`, which only exists in prod.
- Granting the role:
  ```sql
  UPDATE profiles SET role = 'expert_reviewer' WHERE email = 'you@example.com';
  ```

## `check-morph-id.sh`

Read-only probe that verifies every moving part. Safe to run any time.
Prints `PASS / FAIL` per check and exits non-zero if anything failed, so
you can wire it into CI.

```bash
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_ANON_KEY=<anon key> \
SUPABASE_SERVICE_ROLE_KEY=<service key>  \
  scripts/check-morph-id.sh
```

`SUPABASE_SERVICE_ROLE_KEY` is optional. Without it, the column-presence
probe is skipped (RLS hides the schema from anon/authenticated).

What it checks:

- **Schema** ,  `gecko_images` has every training / embedding column.
- **RPCs** ,  `gecko_image_stats`, `is_expert_reviewer`,
  `nearest_training_samples`, `review_gecko_image` are callable.
- **Edge functions** ,  all three POST/GET with sensible 4xx on bad input
  (confirms deployed + reachable, without needing real API calls).
- **Dataset sanity** ,  prints current total and verified counts.

## Typical cadence

After code changes:

```bash
scripts/deploy-morph-id.sh && \
  SUPABASE_URL=... SUPABASE_ANON_KEY=... scripts/check-morph-id.sh
```

If `check` fails, the message above it points at which step missed.
