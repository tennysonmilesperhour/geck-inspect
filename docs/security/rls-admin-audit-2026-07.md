# RLS admin audit, 2026-07-07

Scope: every table written from the admin surface (`src/pages/AdminPanel.jsx`
and `src/components/admin/*`). The admin panel is gated client-side only
(`AdminPanel.jsx` redirects non-admins), so RLS is the real security
boundary. This audit checked the policies actually deployed to project
`mmuglfphhwlaluyfyxsp` (via `pg_policies`), not just what the migrations
say.

## Method

1. Enumerated admin-writable tables from `.create/.update/.delete` and
   `supabase.from(...)` calls in the admin components.
2. Pulled deployed policies with `select ... from pg_policies` plus
   `relrowsecurity` from `pg_class` for each table.
3. Verified each admin check is email-based (the correct pattern), not
   the `auth.uid()::text = profiles.id` pattern that migration
   `20260517_fix_admin_rls_use_email_not_uid.sql` fixed.

## Result: one gap, otherwise clean

Every audited table has RLS enabled and a working, email-based admin
write policy. Two equivalent admin-check forms are in use, both correct:

- Inline: `exists (select 1 from profiles p where p.email = auth.email()
  and p.role = 'admin')`
- `auth.jwt() ->> 'email'` variant (error_logs, some gecko_images
  policies), equivalent.
- `is_blog_admin()` for blog tables: a `STABLE SECURITY DEFINER`
  function with `search_path` pinned to `public`, checking
  `email = auth.jwt() ->> 'email' and role = 'admin'`. Correct.

No leftover `auth.uid()`-based admin checks remain anywhere in the
audited set.

| Table | Admin write policy | Non-admin blocked | Verdict |
|---|---|---|---|
| admin_tasks | `Admins write tasks` (ALL, email) | RLS on, no public write | OK |
| app_settings | `Admins write settings` (ALL, email) | public read only when `is_public` | OK |
| store_products | `Admins write products` (ALL, email) | public read only `active` | OK |
| store_categories | `Admins write categories` (ALL, email) | public read only `is_active` | OK |
| store_vendors | `Admins write vendors` (ALL, email) | public read only `is_active` | OK |
| page_config | `page_config_write_admin` (ALL, email) | public read, no public write | OK |
| notifications | `notifications_delete_admin` + owner insert/read/update | see note 1 | OK (note) |
| profiles | delete_admin (email); **no admin UPDATE** | update is owner-only | **GAP** |
| testimonials | `Admins write testimonials` (ALL, email) | public read only `approved` | OK |
| support_messages | update/delete admin (email) | insert anyone; read own-or-admin | OK |
| scraped_training_data | `scraped_data_admin` (ALL, email) | RLS on, no public access | OK |
| direct_messages | admin included in insert/delete; owner read/update | sender/recipient scoped | OK |
| change_logs | `change_logs_write_admin` (ALL, email) | public read only `is_published` | OK |
| morph_reference_images | update admin-or-owner; insert own | public read | OK |
| morph_guides | `morph_guides_write_admin` (ALL, email) | public read | OK |
| morph_price_cache | `morph_price_cache_write_admin` (ALL, email) | public read | OK |
| gecko_images | admin delete + reviewer/admin update (email) | owner-scoped otherwise | OK |
| error_logs | admin read/update/delete (email) | anyone insert | OK |
| blog_settings / blog_posts / blog_categories / blog_tags | `*_admin_all` via `is_blog_admin()` | public read of published/active | OK |

## The gap: profiles has no admin UPDATE policy

`src/components/admin/UserManagement.jsx` grants/revokes the `admin`
role and `is_expert` flag on other users:

```
User.update(selectedUser.id, { role: 'admin' });        // line ~201
User.update(selectedUser.id, { is_expert: true });      // line ~209
```

These are client-side `profiles` UPDATEs. The only UPDATE policy on
`profiles` is `profiles_update_own`:

```
using (auth.email() = email OR auth.email() = created_by)
```

An admin editing a different user's row matches neither clause, so RLS
silently filters the UPDATE to zero rows. In production, "Make Admin",
"Make Expert", and "Remove Expert" do nothing (no error, no change).

**Fix:** migration
`supabase/migrations/20260707000000_profiles_admin_update_policy.sql`
adds a permissive admin UPDATE policy using the standard email check.
APPLIED to production 2026-07-07 (verified: `profiles_update_admin`
now present alongside `profiles_update_own`).
The self-referential `exists (select 1 from profiles ...)` is safe here
because `profiles_read_all` (`using (true)`) makes the subquery
permissive, the same construction already used by `profiles_delete_admin`
in production.

## Notes / lower-priority observations

1. `notifications_insert_any_authed` lets any authenticated user insert
   a notification where `created_by = auth.email()`, `created_by IS
   NULL`, or the caller is an admin, with any `user_email`. This is
   intentional (cross-user notifications like "new follower" are created
   by the acting user for the recipient), but it does allow notification
   spam to arbitrary users. Not a privilege-escalation, no fix proposed;
   flagged for awareness. If abuse appears, tighten to require the row
   relate to a real interaction (follow, message, etc.).
2. `profiles` remains fully public-read (`profiles_read_all`), which is
   by design (community profiles). The 2026-06-10 snapshot already
   removed the API-key columns that made this dangerous. Standing rule:
   never store secrets on `profiles`.
3. No service-role key is reachable from client code (`grep` for
   `service_role` under `src/` finds only comments). Service-role usage
   is confined to edge functions.

## How to re-run

```sql
-- policies for a set of tables
select c.relname, c.relrowsecurity, p.policyname, p.cmd, p.roles::text,
       p.qual, p.with_check
from pg_class c
join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
left join pg_policies p on p.schemaname='public' and p.tablename=c.relname
where c.relname = any(array['profiles','app_settings', /* ... */])
order by c.relname, p.cmd;
```
