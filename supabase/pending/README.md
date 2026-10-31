# Pending migrations

Files here are not in `supabase/migrations/`, so the Supabase CLI and the
GitHub integration will not run them. Use this folder for SQL that is
written but must not run yet, and say why in the table below.

| File | Why it is here |
|---|---|
| (none) | Nothing is waiting. |

## Retired

- `member_email_columns_revoke.sql` and `member_email_columns_revoke_regressions.sql`
  (moved 31 Oct 2026). Step 2 of Part E item E1 4, which takes the columns
  that hold another member's email address away from signed-in accounts,
  waited here until step 1 (`supabase/migrations/20261028040000_member_email_reads.sql`)
  had been live for 3 days. It is now
  `supabase/migrations/20261031061000_member_email_columns_revoke.sql`, with
  its test in `supabase/tests/member_email_columns_revoke_regressions.sql`.
- `20261003220300_waitlist_require_confirmation.sql` (removed 15 Oct 2026).
  It closed the old direct waitlist signup by taking `join_waitlist()` away
  from everyone but the server. That change is already live: the same two
  lines ran on 8 Oct 2026 inside
  `supabase/migrations/20261008063704_lock_security_definer_execute.sql`
  (lines 41 and 48). A read-only check on 15 Oct confirmed that signed-out
  and signed-in callers cannot run `join_waitlist()` while the server can,
  and the app no longer calls it (waitlist signups go through the
  `waitlist-signup` function, which emails a confirmation link).
