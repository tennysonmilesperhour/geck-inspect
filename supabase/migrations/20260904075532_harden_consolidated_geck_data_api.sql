alter table geck_data.trait_tiers enable row level security;

drop policy if exists "public read trait_tiers" on geck_data.trait_tiers;
create policy "public read trait_tiers"
  on geck_data.trait_tiers for select
  to anon, authenticated
  using (true);

revoke execute on function geck_data.combo_index_health() from anon, authenticated;
grant execute on function geck_data.combo_index_health() to service_role;

do $harden_search_paths$
declare
  function_record record;
begin
  for function_record in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'geck_data'
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, array[]::text[])) setting
        where setting like 'search_path=%'
      )
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = pg_catalog, geck_data, extensions',
      function_record.schema_name,
      function_record.function_name,
      function_record.identity_arguments
    );
  end loop;
end
$harden_search_paths$;

notify pgrst, 'reload schema';
