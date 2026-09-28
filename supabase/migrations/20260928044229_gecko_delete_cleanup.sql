-- Deleting a gecko left rows pointing at it: weigh-ins nobody could see
-- again (9) and hatched eggs still marked "gecko created in collection"
-- for a gecko that no longer exists (20). On delete, weigh-ins go with the
-- gecko and eggs keep their history but drop the link. Breeding plans keep
-- their sire and dam ids so pairing history survives; the app already shows
-- a missing parent as unknown. Existing leftovers are cleaned the same way.

create or replace function public.cleanup_gecko_references_on_delete()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  delete from public.weight_records where gecko_id = old.id;
  update public.eggs set gecko_id = null where gecko_id = old.id;
  return old;
end;
$$;

revoke all on function public.cleanup_gecko_references_on_delete() from public, anon, authenticated;

drop trigger if exists trg_cleanup_gecko_references on public.geckos;
create trigger trg_cleanup_gecko_references
  after delete on public.geckos
  for each row execute function public.cleanup_gecko_references_on_delete();

delete from public.weight_records w
 where not exists (select 1 from public.geckos g where g.id = w.gecko_id);

update public.eggs e
   set gecko_id = null
 where e.gecko_id is not null
   and not exists (select 1 from public.geckos g where g.id = e.gecko_id);
