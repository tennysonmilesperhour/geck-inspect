-- Existing collisions remain intact; prevent adding new ambiguity.
create or replace function public.guard_unique_gecko_code() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if nullif(btrim(new.gecko_id_code),'') is null then return new; end if;
  if tg_op='UPDATE' and new.created_by is not distinct from old.created_by
    and lower(btrim(new.gecko_id_code)) is not distinct from lower(btrim(old.gecko_id_code)) then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(new.created_by,'')||':'||lower(btrim(new.gecko_id_code)), 1));
  if exists(select 1 from public.geckos where created_by=new.created_by and lower(btrim(gecko_id_code))=lower(btrim(new.gecko_id_code)) and id<>new.id) then
    raise exception 'This animal ID is already used in your collection. Choose a different ID.' using errcode='23505';
  end if;
  return new;
end $$;
create trigger geckos_unique_owner_code before insert or update of gecko_id_code,created_by on public.geckos for each row execute function public.guard_unique_gecko_code();
