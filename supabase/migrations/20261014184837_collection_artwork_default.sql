-- Account default, separate from each gecko's explicit override. Carry only
-- the resolved owner preference on public records, never the private profile.
alter table public.profiles add column if not exists gecko_artwork_style text;
alter table public.profiles drop constraint if exists profiles_gecko_artwork_style_check;
alter table public.profiles add constraint profiles_gecko_artwork_style_check
  check (gecko_artwork_style in ('engraving', 'woodcut', 'nouveau', 'celestial', 'terracotta'));

alter table public.geckos add column if not exists inherited_placeholder_style text;
alter table public.geckos drop constraint if exists geckos_inherited_placeholder_style_check;
alter table public.geckos add constraint geckos_inherited_placeholder_style_check
  check (inherited_placeholder_style in ('engraving', 'woodcut', 'nouveau', 'celestial', 'terracotta'));

comment on column public.profiles.gecko_artwork_style is
  'Owner-wide placeholder artwork default. NULL keeps the stable automatic mix.';
comment on column public.geckos.inherited_placeholder_style is
  'Server-maintained owner default. placeholder_style overrides it; NULL uses the automatic mix.';

create schema if not exists geck_private;
revoke all on schema geck_private from public, anon, authenticated;

-- Profiles are intentionally private. This internal trigger reads one
-- harmless preference after the normal gecko write has passed its RLS.
-- It is not exposed as an RPC and cannot accept a caller-selected owner.
create or replace function geck_private.inherit_gecko_artwork()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role'
    and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  new.inherited_placeholder_style := (
    select p.gecko_artwork_style from public.profiles p where p.email = new.created_by
  );
  return new;
end;
$$;
revoke all on function geck_private.inherit_gecko_artwork() from public, anon, authenticated;

drop trigger if exists geckos_inherit_artwork on public.geckos;
create trigger geckos_inherit_artwork
  before insert or update of created_by, inherited_placeholder_style on public.geckos
  for each row execute function geck_private.inherit_gecko_artwork();

-- The profile row is authorized by existing profile RLS. Updating only its
-- owner's cached defaults also covers archived and shared records, without
-- replacing any individual choice or changing their photos.
create or replace function geck_private.sync_owner_artwork()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role'
    and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  update public.geckos g
    set inherited_placeholder_style = new.gecko_artwork_style
    where g.created_by = new.email
      and g.inherited_placeholder_style is distinct from new.gecko_artwork_style;
  return new;
end;
$$;
revoke all on function geck_private.sync_owner_artwork() from public, anon, authenticated;

drop trigger if exists profiles_sync_gecko_artwork on public.profiles;
create trigger profiles_sync_gecko_artwork
  after insert or update of gecko_artwork_style on public.profiles
  for each row execute function geck_private.sync_owner_artwork();

-- Normally a no-op on first deploy, since every default starts as NULL.
update public.geckos g set inherited_placeholder_style = p.gecko_artwork_style
  from public.profiles p
  where p.email = g.created_by
    and g.inherited_placeholder_style is distinct from p.gecko_artwork_style;

grant select (inherited_placeholder_style) on public.geckos to anon;
notify pgrst, 'reload schema';
