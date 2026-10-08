# Pending migrations

These files are not in `supabase/migrations/`, so the Supabase CLI and the
GitHub integration will not run them.

| File | Why it is here |
|---|---|
| `20261003220300_waitlist_require_confirmation.sql` | It is not applied yet. Applying it as-is would break signups on the current page, which still calls `join_waitlist()`. Put it back under `supabase/migrations/` with a fresh timestamp only after the waitlist-signup client is live. Do not mark it applied. |
