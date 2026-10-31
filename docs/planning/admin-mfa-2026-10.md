# Two-factor sign-in for the admin account (28 Oct 2026)

Part E item E1 10 of `docs/planning/comprehensive-review-2026-10-14.md`: "turn on two-factor sign-in for the admin account and require it in `is_admin()`". Done when admin sign-in asks for a code.

## What shipped

- **Settings, Security** (admins only). Adds an authenticator app: Supabase's `mfa.enroll` gives a QR code and a secret key (shown as text for typing in by hand, with a copy button and, on a phone, a link that opens the authenticator app). The first 6-digit code turns it on (`mfa.challenge`, then `mfa.verify`). Lists the apps added and removes one after a confirm step on the page. Code: `src/components/settings/SecurityCard.jsx`, loaded only for admins.
- **The sign-in code step.** The app shell (`src/Layout.jsx`) is wrapped in `MfaStepUpGate`. When `mfa.getAuthenticatorAssuranceLevel()` says the session is `aal1` (password or sign-in link only) and the account has a verified authenticator (`nextLevel` `aal2`), every page, admin screens included, is replaced by "Enter your sign-in code" until a correct code raises the session to `aal2`. Same web code in the iPhone app. Members without an authenticator see nothing new and wait for nothing. The rules are in `src/lib/mfa.js`.
- **The database switch.** `supabase/migrations/20261028040200_admin_mfa.sql` adds `app_settings` `admin_requires_mfa` (false, not public), restates `public.is_admin()` so that, when the switch is true, an admin's request only counts as admin with a token at `aal2`, and points the `agent_hits_admin_read` policy at `is_admin()`. With the switch off, nothing changes for anyone. Tests: `supabase/tests/admin_mfa_regressions.sql`.

## Turning it on

1. Tennyson checks that authenticator apps (TOTP) are allowed: https://supabase.com/dashboard/project/mmuglfphhwlaluyfyxsp/auth/mfa ("Authenticator app (TOTP)" enabled; it is by default).
2. Tennyson opens Settings, Security, taps "Set up an authenticator app", scans the QR code, saves the secret key in a password manager, and types the first code.
3. Tennyson signs out and back in. The app asks for a code; the right code opens it.
4. **Not yet: the follow-up comes first.** The switch only covers `is_admin()` (see "What the switch does not cover yet" below). Turned on today, a stolen password could still read payment events, support messages and error logs through the 36 policies and the functions that check the role themselves. So the order is: a session writes and ships the follow-up migration that points those policies and functions at `is_admin()`, re-runs the listing query below until it returns no rows, and only then Tennyson tells a session "turn on admin MFA". The session first runs this read-only check and goes on only if every admin row shows a verified `totp` factor and the listing query returns nothing:

   ```sql
   select p.role, f.factor_type, f.status, f.created_at
     from public.profiles p
     join auth.users u on lower(u.email) = lower(p.email)
     left join auth.mfa_factors f on f.user_id = u.id
    where p.role = 'admin';
   ```

   Then it flips the switch and records the change in the deploy queue:

   ```sql
   update public.app_settings
      set value = 'true'::jsonb, updated_at = now()
    where key = 'admin_requires_mfa';
   ```

## Turning it off, or a lost phone

- The secret key saved in step 2 adds the account to an authenticator app on a new phone; nothing else is needed.
- Without the key, a session with database access turns the switch off (an admin who has not typed a code cannot change `app_settings` while it is on), and can remove the lost factor so sign-in stops asking:

  ```sql
  update public.app_settings
     set value = 'false'::jsonb, updated_at = now()
   where key = 'admin_requires_mfa';
  -- then, only for the admin account's lost authenticator:
  -- delete from auth.mfa_factors where id = '<factor id from the check above>';
  ```

## What the switch does not cover yet

`is_admin()` is called by 131 policies and 39 functions, and those follow the switch. On 28 Oct 2026, 36 other policies (support messages, payment events, Stripe logs, error logs and more) and some functions (`admin_erase_account`, `is_blog_admin`, `forum_is_admin`, `admin_verify_gecko_image`, `review_gecko_image` and others) still check `profiles.role = 'admin'` themselves, and edge functions such as `admin-delete-account` check the role with the server key. Those keep working at `aal1` even with the switch on. A follow-up migration must point them at `is_admin()` before the switch is turned on (step 4). Steps 1 to 3 are safe now: with an authenticator added, the app itself asks for the code at every sign-in. The read-only query that lists what is left:

```sql
select tablename, policyname from pg_policies
 where (coalesce(qual, '') || coalesce(with_check, '')) ilike '%''admin''%'
   and (coalesce(qual, '') || coalesce(with_check, '')) not ilike '%is_admin()%';
```
