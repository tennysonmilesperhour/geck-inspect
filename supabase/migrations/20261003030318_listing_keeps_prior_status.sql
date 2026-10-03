-- Unlisting gives a gecko back the status it had before it was listed
-- (3 Oct 2026, feature audit step 30).
--
-- A listing is a gecko whose status is 'For Sale'. Listing a Holdback or a
-- Proven female replaced that status, and Unlist then set 'Pet', so the
-- breeder lost it twice. Now the database remembers the status a gecko had
-- the moment it became 'For Sale', in geckos.status_before_listing, and the
-- Unlist button puts it back.
--
-- Additive: one nullable column and a trigger that only fills that column.
-- Older clients never read it. Idempotent.

alter table public.geckos add column if not exists status_before_listing text;

comment on column public.geckos.status_before_listing is
  'Status the gecko had when it was last set to For Sale. Unlist restores it.';

create or replace function public.geckos_remember_status_before_listing()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.status = 'For Sale'
     and old.status is distinct from 'For Sale'
     and old.status is distinct from 'Sold' then
    new.status_before_listing := old.status;
  end if;
  return new;
end;
$function$;

create or replace trigger geckos_remember_status_before_listing
  before update of status on public.geckos
  for each row execute function public.geckos_remember_status_before_listing();
