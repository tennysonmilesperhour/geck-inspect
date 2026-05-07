-- =============================================================================
-- Collections + per-collection collaborators (email-keyed identity)
-- =============================================================================
-- Adds two tables:
--   collections           — a named bucket of geckos owned by one email
--   collection_members    — invitation + role records linking an email to a
--                           collection (roles: owner / editor / viewer)
--
-- Adds one column:
--   geckos.collection_id  — every gecko belongs to exactly one collection
--
-- Identity model
-- --------------
-- This schema is keyed by email rather than auth.users.id (uuid). That
-- matches the canonical pattern used everywhere else in this codebase
-- ("auth.email() = created_by" in every existing RLS policy), and it
-- works for legacy Base44-era profiles whose `profiles.id` is a 24-char
-- hex string with no corresponding auth.users row. A uuid-keyed design
-- silently drops every legacy owner from the backfill.
--
-- RLS posture
-- -----------
--   collections           — readable by owner; readable by any
--                           accepted/pending member; writable by owner.
--   collection_members    — readable by collection owner; readable by
--                           the member themselves; writable by owner;
--                           updatable (status only) by the member.
--   geckos                — UNCHANGED here. The existing geckos_read_all
--                           policy already returns true for any authed
--                           user, so collaborator visibility is already
--                           there. Phase B updates the WRITE policies
--                           to allow editor-role members to mutate rows
--                           in collections they belong to.
--
-- Backfill: for every distinct geckos.created_by, create a default
-- "My collection", insert an owner row in collection_members, and set
-- collection_id on each of that owner's geckos.
--
-- Idempotent — safe to run twice.
-- =============================================================================

-- 1. collections -----------------------------------------------------------

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  name text not null,
  description text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists collections_owner_idx on public.collections(lower(owner_email));

-- One default collection per owner so the find-or-create backfill below
-- is idempotent.
create unique index if not exists collections_one_default_per_owner
  on public.collections(lower(owner_email)) where is_default = true;

alter table public.collections enable row level security;

drop policy if exists "Owners read their collections" on public.collections;
create policy "Owners read their collections"
  on public.collections
  for select
  using (lower(owner_email) = lower(coalesce(auth.email(), '')));

drop policy if exists "Owners write their collections" on public.collections;
create policy "Owners write their collections"
  on public.collections
  for all
  using (lower(owner_email) = lower(coalesce(auth.email(), '')))
  with check (lower(owner_email) = lower(coalesce(auth.email(), '')));


-- 2. collection_members ----------------------------------------------------

create table if not exists public.collection_members (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  member_email text not null,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  invite_token text unique,
  invited_by_email text,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  expires_at timestamptz
);

create index if not exists collection_members_collection_idx
  on public.collection_members(collection_id);
create index if not exists collection_members_email_idx
  on public.collection_members(lower(member_email));
create unique index if not exists collection_members_unique_invite
  on public.collection_members(collection_id, lower(member_email));

alter table public.collection_members enable row level security;

-- Member-readable policy on collections (defined here because the EXISTS
-- subquery references collection_members which must exist first).
drop policy if exists "Members read collections they belong to" on public.collections;
create policy "Members read collections they belong to"
  on public.collections
  for select
  using (
    exists (
      select 1 from public.collection_members cm
      where cm.collection_id = collections.id
        and lower(cm.member_email) = lower(coalesce(auth.email(), ''))
        and cm.status in ('pending', 'accepted')
    )
  );

drop policy if exists "Owners read members of their collections" on public.collection_members;
create policy "Owners read members of their collections"
  on public.collection_members
  for select
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_members.collection_id
        and lower(c.owner_email) = lower(coalesce(auth.email(), ''))
    )
  );

drop policy if exists "Members read their own membership" on public.collection_members;
create policy "Members read their own membership"
  on public.collection_members
  for select
  using (lower(member_email) = lower(coalesce(auth.email(), '')));

drop policy if exists "Owners write members of their collections" on public.collection_members;
create policy "Owners write members of their collections"
  on public.collection_members
  for all
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_members.collection_id
        and lower(c.owner_email) = lower(coalesce(auth.email(), ''))
    )
  )
  with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_members.collection_id
        and lower(c.owner_email) = lower(coalesce(auth.email(), ''))
    )
  );

-- Members can update their OWN row to accept / decline / leave. The
-- accept_collection_invite RPC is the supported path, but this policy
-- exists so direct updates from the client also stay scoped to self.
drop policy if exists "Members update their own membership" on public.collection_members;
create policy "Members update their own membership"
  on public.collection_members
  for update
  using (lower(member_email) = lower(coalesce(auth.email(), '')))
  with check (lower(member_email) = lower(coalesce(auth.email(), '')));

create or replace function public.bump_collection_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.collections
     set updated_at = now()
   where id = coalesce(new.collection_id, old.collection_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists collection_members_bump_parent on public.collection_members;
create trigger collection_members_bump_parent
  after insert or update or delete on public.collection_members
  for each row execute function public.bump_collection_updated_at();


-- 3. geckos.collection_id (nullable for now) ------------------------------

alter table public.geckos
  add column if not exists collection_id uuid references public.collections(id) on delete set null;

create index if not exists geckos_collection_idx on public.geckos(collection_id);


-- 4. Backfill: default collection per existing geckos.created_by ----------

do $$
declare
  rec record;
  cid uuid;
begin
  for rec in
    select distinct created_by as email
      from public.geckos
     where collection_id is null
       and created_by is not null
  loop
    select id into cid
      from public.collections
     where lower(owner_email) = lower(rec.email) and is_default = true
     limit 1;

    if cid is null then
      insert into public.collections (owner_email, name, description, is_default)
        values (rec.email, 'My collection', 'Default collection.', true)
        returning id into cid;
    end if;

    insert into public.collection_members
        (collection_id, member_email, role, status, accepted_at)
      values
        (cid, rec.email, 'owner', 'accepted', now())
      on conflict (collection_id, lower(member_email)) do nothing;

    update public.geckos
       set collection_id = cid
     where created_by = rec.email
       and collection_id is null;
  end loop;
end $$;


-- 5. Trigger that auto-fills collection_id on insert ----------------------

create or replace function public.geckos_set_default_collection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  effective_email text;
begin
  if new.collection_id is not null then
    return new;
  end if;
  effective_email := coalesce(new.created_by, auth.email());
  if effective_email is null or effective_email = '' then
    return new;
  end if;

  select id into cid
    from public.collections
   where lower(owner_email) = lower(effective_email) and is_default = true
   limit 1;

  if cid is null then
    insert into public.collections (owner_email, name, description, is_default)
      values (effective_email, 'My collection', 'Default collection.', true)
      returning id into cid;

    insert into public.collection_members
        (collection_id, member_email, role, status, accepted_at)
      values
        (cid, effective_email, 'owner', 'accepted', now())
      on conflict (collection_id, lower(member_email)) do nothing;
  end if;

  new.collection_id := cid;
  return new;
end;
$$;

drop trigger if exists geckos_set_default_collection_trg on public.geckos;
create trigger geckos_set_default_collection_trg
  before insert on public.geckos
  for each row execute function public.geckos_set_default_collection();

-- This is a trigger function, not an RPC. Revoke EXECUTE so it can't
-- be invoked via /rest/v1/rpc — Postgres still fires it on inserts
-- because triggers don't check EXECUTE on the underlying function.
revoke execute on function public.geckos_set_default_collection() from anon, authenticated, public;


-- 6. RPC: accept an invitation ---------------------------------------------

create or replace function public.accept_collection_invite(token text)
returns public.collection_members
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.collection_members;
  email text := lower(coalesce(auth.email(), ''));
begin
  if email = '' then
    raise exception 'not authenticated';
  end if;

  select * into row
    from public.collection_members
   where invite_token = token
   limit 1;

  if not found then
    raise exception 'invite not found';
  end if;

  if row.status <> 'pending' then
    raise exception 'invite is %', row.status;
  end if;

  if row.expires_at is not null and row.expires_at < now() then
    raise exception 'invite expired';
  end if;

  if lower(row.member_email) <> email then
    raise exception 'invite was issued to %, you are signed in as %',
      row.member_email, email;
  end if;

  update public.collection_members
     set status = 'accepted',
         accepted_at = now()
   where id = row.id
   returning * into row;

  return row;
end;
$$;

grant execute on function public.accept_collection_invite(text) to authenticated;
revoke execute on function public.accept_collection_invite(text) from anon, public;
