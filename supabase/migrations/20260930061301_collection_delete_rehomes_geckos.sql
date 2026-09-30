-- Deleting a collection set its geckos' collection to nothing (the foreign
-- key is ON DELETE SET NULL), and the app only lists geckos in collections
-- you can open, so they vanished from My Geckos, Field Mode and the
-- Dashboard. Before a collection is deleted, each of its geckos now moves to
-- its owner's default collection, made the same way a first gecko makes one
-- if the owner has none. A gecko a collaborator added goes back to that
-- collaborator's default. The default collection itself is left alone: the
-- app never deletes it, and removing an account is done by hand.
create or replace function public.collections_rehome_geckos()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r record;
  cid uuid;
begin
  if old.is_default then
    return old;
  end if;

  for r in
    select distinct lower(coalesce(nullif(g.created_by, ''), old.owner_email)) as owner
      from public.geckos g
     where g.collection_id = old.id
  loop
    cid := null;
    select c.id into cid
      from public.collections c
     where lower(c.owner_email) = r.owner and c.is_default = true and c.id <> old.id
     limit 1;

    if cid is null then
      insert into public.collections (owner_email, name, description, is_default)
        values (r.owner, 'My collection', 'Default collection.', true)
        returning id into cid;

      insert into public.collection_members
          (collection_id, member_email, role, status, accepted_at)
        values
          (cid, r.owner, 'owner', 'accepted', now())
        on conflict (collection_id, lower(member_email)) do nothing;
    end if;

    update public.geckos g
       set collection_id = cid
     where g.collection_id = old.id
       and lower(coalesce(nullif(g.created_by, ''), old.owner_email)) = r.owner;
  end loop;

  return old;
end;
$$;

revoke execute on function public.collections_rehome_geckos() from public, anon, authenticated;
grant execute on function public.collections_rehome_geckos() to service_role;

drop trigger if exists collections_rehome_geckos_trg on public.collections;
create trigger collections_rehome_geckos_trg
  before delete on public.collections
  for each row execute function public.collections_rehome_geckos();
