-- Collaborators with an activity log (P9.3, 29 Sep 2026).
--
-- 1. Lock down collection_members updates. The update policy let anyone
--    edit a membership row that carried their own email, so a viewer could
--    make themselves an editor, and any user could move their own owner row
--    into someone else's collection (collection ids are readable on public
--    geckos) and gain edit and delete rights there. No row has been touched
--    that way (checked 29 Sep: every member row is its collection's owner).
--    Now a membership never moves between collections, and a member can
--    only accept or decline their own invitation. The owner can still
--    change everything else. Server-side code (no signed-in email) is not
--    limited.
-- 2. Collaborators can read the weight, feeding and shed records of geckos
--    in a collection they have joined. Before, those records were visible
--    only to whoever typed them, so the owner never saw a collaborator's
--    feedings and the other way round.
-- 3. collection_activity: who added, edited, weighed, fed, archived or
--    moved which gecko, written by triggers so every screen is covered.
--    Recorded only while a collection is shared (it has an invited or
--    joined collaborator). Readable by the owner and joined members.
--    Clients cannot write it.

-- 1. Membership guard -------------------------------------------------------

create or replace function public.guard_collection_member_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller text := lower(coalesce(auth.email(), ''));
begin
  if caller = '' then
    return new;
  end if;
  if new.collection_id is distinct from old.collection_id then
    raise exception 'A membership cannot move to another collection';
  end if;
  if public.is_collection_owner(old.collection_id, caller) then
    return new;
  end if;
  if new.member_email is distinct from old.member_email
     or new.role is distinct from old.role
     or new.invite_token is distinct from old.invite_token
     or new.invited_by_email is distinct from old.invited_by_email
     or new.invited_at is distinct from old.invited_at
     or new.expires_at is distinct from old.expires_at then
    raise exception 'Only the collection owner can change an invitation';
  end if;
  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending' and new.status in ('accepted', 'declined'))
      or (old.status = 'accepted' and new.status = 'declined')
    ) then
      raise exception 'An invitation cannot go from % to %', old.status, new.status;
    end if;
    if new.status = 'accepted' and old.expires_at is not null and old.expires_at < now() then
      raise exception 'invite expired';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists collection_members_guard_update on public.collection_members;
create trigger collection_members_guard_update
  before update on public.collection_members
  for each row execute function public.guard_collection_member_update();

-- 2. Collaborators see care records ----------------------------------------

create or replace function public.gecko_shared_with_caller(p_gecko_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.geckos g
      join public.collection_members m on m.collection_id = g.collection_id
     where g.id = p_gecko_id
       and m.status = 'accepted'
       and lower(m.member_email) = lower(coalesce(auth.email(), ''))
  );
$$;

drop policy if exists weight_records_read_collection on public.weight_records;
create policy weight_records_read_collection on public.weight_records
  for select to authenticated
  using (public.gecko_shared_with_caller(gecko_id));

drop policy if exists feeding_records_read_collection on public.feeding_records;
create policy feeding_records_read_collection on public.feeding_records
  for select to authenticated
  using (public.gecko_shared_with_caller(animal_id));

drop policy if exists shed_records_read_collection on public.shed_records;
create policy shed_records_read_collection on public.shed_records
  for select to authenticated
  using (public.gecko_shared_with_caller(animal_id));

-- 3. Activity log -----------------------------------------------------------

create table if not exists public.collection_activity (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  gecko_id text,
  gecko_name text,
  actor_email text,
  actor_name text,
  action text not null check (action in (
    'added', 'edited', 'archived', 'restored', 'deleted', 'moved_in', 'moved_out',
    'weighed', 'fed', 'shed', 'joined', 'removed'
  )),
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists collection_activity_collection_created_idx
  on public.collection_activity (collection_id, created_at desc);
create index if not exists collection_activity_gecko_created_idx
  on public.collection_activity (gecko_id, created_at desc);

alter table public.collection_activity enable row level security;

drop policy if exists collection_activity_read on public.collection_activity;
create policy collection_activity_read on public.collection_activity
  for select to authenticated
  using (
    public.is_collection_owner(collection_id, (select auth.email()))
    or exists (
      select 1 from public.collection_members m
       where m.collection_id = collection_activity.collection_id
         and m.status = 'accepted'
         and lower(m.member_email) = lower(coalesce((select auth.email()), ''))
    )
  );

revoke insert, update, delete on public.collection_activity from anon, authenticated;

create or replace function public.collection_is_shared(p_collection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.collection_members
     where collection_id = p_collection_id
       and role <> 'owner'
       and status in ('pending', 'accepted')
  );
$$;

create or replace function public.log_collection_activity(
  p_collection_id uuid,
  p_gecko_id text,
  p_gecko_name text,
  p_action text,
  p_detail text,
  p_force boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text := lower(nullif(auth.email(), ''));
  actor_label text;
  recent uuid;
begin
  -- Nothing to record against a collection that is being deleted.
  if p_collection_id is null
     or not exists (select 1 from public.collections where id = p_collection_id) then
    return;
  end if;
  if not p_force and not public.collection_is_shared(p_collection_id) then
    return;
  end if;
  if actor is not null then
    select coalesce(nullif(p.full_name, ''), nullif(p.breeder_name, ''), nullif(p.business_name, ''))
      into actor_label
      from public.profiles p
     where lower(p.email) = actor
     limit 1;
  end if;

  -- One save can touch the row more than once; fold edits by the same
  -- person to the same gecko within ten minutes into one entry.
  if p_action = 'edited' then
    select id into recent
      from public.collection_activity
     where collection_id = p_collection_id
       and gecko_id is not distinct from p_gecko_id
       and action = 'edited'
       and actor_email is not distinct from actor
       and created_at > now() - interval '10 minutes'
     order by created_at desc
     limit 1;
    if recent is not null then
      update public.collection_activity a
         set detail = (
               select string_agg(distinct f, ', ' order by f)
                 from unnest(string_to_array(coalesce(a.detail, ''), ', ')
                          || string_to_array(coalesce(p_detail, ''), ', ')) as f
                where f <> ''
             ),
             gecko_name = p_gecko_name,
             created_at = now()
       where a.id = recent;
      return;
    end if;
  end if;

  insert into public.collection_activity
    (collection_id, gecko_id, gecko_name, actor_email, actor_name, action, detail)
  values
    (p_collection_id, p_gecko_id, p_gecko_name, actor, actor_label, p_action, p_detail);
end;
$$;

revoke execute on function public.log_collection_activity(uuid, text, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.collection_is_shared(uuid) from public, anon, authenticated;
revoke execute on function public.gecko_shared_with_caller(text) from public, anon;
grant execute on function public.gecko_shared_with_caller(text) to authenticated;

create or replace function public.collection_activity_on_gecko()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fields text[] := '{}';
begin
  if tg_op = 'INSERT' then
    perform public.log_collection_activity(new.collection_id, new.id, new.name, 'added', nullif(new.morphs_traits, ''));
    return new;
  elsif tg_op = 'DELETE' then
    perform public.log_collection_activity(old.collection_id, old.id, old.name, 'deleted', null);
    return old;
  end if;

  if new.collection_id is distinct from old.collection_id then
    perform public.log_collection_activity(old.collection_id, new.id, new.name, 'moved_out',
      (select c.name from public.collections c where c.id = new.collection_id));
    perform public.log_collection_activity(new.collection_id, new.id, new.name, 'moved_in',
      (select c.name from public.collections c where c.id = old.collection_id));
  end if;

  if coalesce(new.archived, false) is distinct from coalesce(old.archived, false) then
    perform public.log_collection_activity(new.collection_id, new.id, new.name,
      case when new.archived then 'archived' else 'restored' end,
      case when new.archived then nullif(new.archive_reason, '') end);
  end if;

  -- Weight is left out: weigh-ins log their own entry and then copy the
  -- latest weight onto the gecko.
  if new.name is distinct from old.name then fields := array_append(fields, 'name'); end if;
  if new.status is distinct from old.status then
    fields := array_append(fields, 'status: ' || coalesce(nullif(new.status, ''), 'none'));
  end if;
  if new.sex is distinct from old.sex then fields := array_append(fields, 'sex'); end if;
  if new.morphs_traits is distinct from old.morphs_traits or new.morph_tags is distinct from old.morph_tags then
    fields := array_append(fields, 'traits');
  end if;
  if new.hatch_date is distinct from old.hatch_date or new.estimated_hatch_year is distinct from old.estimated_hatch_year then
    fields := array_append(fields, 'hatch date');
  end if;
  if new.sire_id is distinct from old.sire_id or new.dam_id is distinct from old.dam_id
     or new.sire_name is distinct from old.sire_name or new.dam_name is distinct from old.dam_name then
    fields := array_append(fields, 'parents');
  end if;
  if new.image_urls is distinct from old.image_urls or new.image_crop_data is distinct from old.image_crop_data then
    fields := array_append(fields, 'photos');
  end if;
  if new.notes is distinct from old.notes or new.genetics_notes is distinct from old.genetics_notes then
    fields := array_append(fields, 'notes');
  end if;
  if new.asking_price is distinct from old.asking_price or new.listing_price is distinct from old.listing_price
     or new.marketplace_description is distinct from old.marketplace_description then
    fields := array_append(fields, 'listing');
  end if;
  if new.sold_price is distinct from old.sold_price then fields := array_append(fields, 'sale price'); end if;
  if new.is_public is distinct from old.is_public or new.gallery_display is distinct from old.gallery_display then
    fields := array_append(fields, 'visibility');
  end if;
  if new.feeding_group_id is distinct from old.feeding_group_id then fields := array_append(fields, 'feeding group'); end if;
  if new.is_gravid is distinct from old.is_gravid or new.gravid_since is distinct from old.gravid_since
     or new.egg_drop_date is distinct from old.egg_drop_date then
    fields := array_append(fields, 'gravid status');
  end if;
  if new.quality_score is distinct from old.quality_score or new.pattern_grade is distinct from old.pattern_grade then
    fields := array_append(fields, 'quality');
  end if;
  if new.tail_status is distinct from old.tail_status then fields := array_append(fields, 'tail'); end if;
  if new.gecko_id_code is distinct from old.gecko_id_code then fields := array_append(fields, 'ID code'); end if;
  if new.species is distinct from old.species then fields := array_append(fields, 'species'); end if;

  if coalesce(array_length(fields, 1), 0) > 0 then
    perform public.log_collection_activity(new.collection_id, new.id, new.name, 'edited', array_to_string(fields, ', '));
  end if;
  return new;
end;
$$;

drop trigger if exists geckos_collection_activity on public.geckos;
create trigger geckos_collection_activity
  after insert or update or delete on public.geckos
  for each row execute function public.collection_activity_on_gecko();

create or replace function public.collection_activity_on_care()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gid text;
  act text;
  det text;
  cid uuid;
  gname text;
begin
  if tg_table_name = 'weight_records' then
    gid := new.gecko_id;
    act := 'weighed';
    det := case when new.weight_grams is null then null
                when new.weight_grams::text like '%.%' then rtrim(rtrim(new.weight_grams::text, '0'), '.') || ' g'
                else new.weight_grams::text || ' g' end;
  elsif tg_table_name = 'feeding_records' then
    gid := new.animal_id;
    act := 'fed';
    det := coalesce(nullif(new.food_type, ''), 'food')
           || case when new.accepted = false then ', refused' else '' end;
  else
    gid := new.animal_id;
    act := 'shed';
    det := nullif(new.quality, '');
  end if;

  select g.collection_id, g.name into cid, gname from public.geckos g where g.id = gid;
  if cid is not null then
    perform public.log_collection_activity(cid, gid, gname, act, det);
  end if;
  return new;
end;
$$;

drop trigger if exists weight_records_collection_activity on public.weight_records;
create trigger weight_records_collection_activity
  after insert on public.weight_records
  for each row execute function public.collection_activity_on_care();

drop trigger if exists feeding_records_collection_activity on public.feeding_records;
create trigger feeding_records_collection_activity
  after insert on public.feeding_records
  for each row execute function public.collection_activity_on_care();

drop trigger if exists shed_records_collection_activity on public.shed_records;
create trigger shed_records_collection_activity
  after insert on public.shed_records
  for each row execute function public.collection_activity_on_care();

create or replace function public.collection_activity_on_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.role <> 'owner' and new.status = 'accepted' and old.status is distinct from 'accepted' then
      perform public.log_collection_activity(new.collection_id, null, null, 'joined', new.role);
    end if;
    return new;
  end if;
  if old.role <> 'owner' and old.status = 'accepted' then
    perform public.log_collection_activity(old.collection_id, null, null, 'removed', lower(old.member_email), true);
  end if;
  return old;
end;
$$;

drop trigger if exists collection_members_activity on public.collection_members;
create trigger collection_members_activity
  after update or delete on public.collection_members
  for each row execute function public.collection_activity_on_member();
