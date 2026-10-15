# Pending migrations

Files here are not in `supabase/migrations/`, so the Supabase CLI and the
GitHub integration will not run them. Use this folder for SQL that is
written but must not run yet, and say why in the table below.

The folder holds no SQL right now.

| File | Why it is here |
|---|---|
| (none) | |

## Retired

- `20261003220300_waitlist_require_confirmation.sql` (removed 15 Oct 2026).
  It closed the old direct waitlist signup by taking `join_waitlist()` away
  from everyone but the server. That change is already live: the same two
  lines ran on 8 Oct 2026 inside
  `supabase/migrations/20261008063704_lock_security_definer_execute.sql`
  (lines 41 and 48). A read-only check on 15 Oct confirmed that signed-out
  and signed-in callers cannot run `join_waitlist()` while the server can,
  and the app no longer calls it (waitlist signups go through the
  `waitlist-signup` function, which emails a confirmation link).
