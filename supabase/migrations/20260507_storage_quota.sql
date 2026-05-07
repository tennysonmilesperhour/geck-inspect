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

-- Note: an earlier draft of this migration also created a public
-- monitoring view `storage_usage_per_user`. It was dropped because
-- views in the public schema inherit SECURITY DEFINER semantics from
-- their creator (which Supabase's linter flags as an error), and the
-- view was never wired up from the client. If admins need a global
-- usage report later, query storage.objects directly from the SQL
-- editor or expose a SECURITY INVOKER RPC instead of a view.
