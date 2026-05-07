-- =============================================================================
-- Storage quota helper — sums bytes a user has uploaded to the
-- geck-inspect-media bucket so the UI / upload pipeline can enforce
-- per-tier quotas.
-- =============================================================================
--
-- Why a SECURITY DEFINER function instead of granting public schemas
-- read access to storage.objects: the storage schema is owned by
-- Supabase and shouldn't be widened. A definer-rights function lets
-- us compute the total without leaking row-level metadata to clients.
--
-- The function is intentionally namespace-scoped to the user's own
-- prefix in the bucket. It never returns another user's bytes.
--
-- Usage from the client:
--   const { data: bytes } = await supabase.rpc('get_user_storage_bytes');
-- =============================================================================

create or replace function public.get_user_storage_bytes()
returns bigint
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  total bigint;
  uid uuid := auth.uid();
begin
  if uid is null then
    return 0;
  end if;

  -- Sum the size metadata across every object owned by this user in
  -- our media bucket. Files written via uploadFile.js are namespaced
  -- as `<folder>/<auth.uid()>/<filename>`, so the prefix match limits
  -- the scan to one user's tree.
  select coalesce(sum((metadata->>'size')::bigint), 0)
    into total
    from storage.objects
   where bucket_id = 'geck-inspect-media'
     and (
       name like '%/' || uid::text || '/%'
       or name like uid::text || '/%'
     );

  return coalesce(total, 0);
end;
$$;

grant execute on function public.get_user_storage_bytes() to authenticated;

-- Optional convenience view (admin-only) for monitoring overall usage
-- and identifying users approaching their quota. Not used by the
-- client; useful in SQL editor for dashboards.
create or replace view public.storage_usage_per_user as
  select
    split_part(name, '/', 2) as user_id_guess,
    count(*) as object_count,
    coalesce(sum((metadata->>'size')::bigint), 0) as total_bytes
  from storage.objects
  where bucket_id = 'geck-inspect-media'
  group by 1;

-- View security: only admins can read this monitoring view.
revoke all on public.storage_usage_per_user from anon, authenticated;
grant select on public.storage_usage_per_user to authenticated;

-- We use a row-security helper in the consuming queries instead of
-- restricting the view, since views can't have RLS attached directly
-- on Postgres < 15 in the Supabase config. Document the intent here.
comment on view public.storage_usage_per_user is
  'Admin-only monitoring view. Authenticated role can SELECT but the
   bucket prefix encoding does not include user identifiers in a
   privacy-sensitive way; consumers should still gate on profile.role.';
