# Pending migrations

Files here are not in `supabase/migrations/`, so the Supabase CLI and the
GitHub integration will not run them. Use this folder for SQL that is
written but must not run yet, and say why in the table below.

| File | Why it is here |
|---|---|
| `member_email_columns_revoke.sql` | Step 2 of taking members' email addresses off the rows other members read (Part E item E1 4). It takes `created_by` and the other email columns on `gecko_images`, the forum tables, `breeder_profiles`, `breeder_reviews`, `morph_guide_comments`, `user_badges`, `giveaways`, `community_event_reactions` and `morph_price_entries` away from signed-in members. An app tab opened before step 1 (`supabase/migrations/20261028040000_member_email_reads.sql` and the app change merged with it) still asks for those columns, so this waits. **Move it to `supabase/migrations` once step 1 has been live for 3 days**, with a fresh version (the time you move it, after production's newest), and move `member_email_columns_revoke_regressions.sql` to `supabase/tests` in the same commit. |
| `member_email_columns_revoke_regressions.sql` | Its regression test. Run it with psql on a scratch copy of the harness template; it applies the step 2 file first when the copy does not have it, all inside one transaction that rolls back. |

Checking step 2 locally before moving it:

```sh
psql -d postgres -c 'create database step2_check template geck_harness'
cd supabase/pending
psql -X -v ON_ERROR_STOP=1 -d step2_check -f member_email_columns_revoke_regressions.sql
psql -d postgres -c 'drop database step2_check'
```

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
