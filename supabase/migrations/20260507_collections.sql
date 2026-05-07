-- =============================================================================
-- Collections + per-collection collaborators
-- =============================================================================
-- Adds two tables:
--   collections           — a named bucket of geckos owned by one user
--   collection_members    — invitation + role records linking a user to a
--                           collection (roles: owner / editor / viewer)
--
-- Adds one column:
--   geckos.collection_id  — every gecko belongs to exactly one collection
--
-- Backfill strategy: for every existing user that owns at least one
-- gecko, create a default collection ("My collection") and reparent all
-- their geckos into it. The owner is also written into collection_members
-- with role='owner', so future code paths can treat ownership uniformly
-- by reading collection_members rather than special-casing the owner.
--
-- RLS posture:
--   collections           — owner can read/write; accepted members can read.
--                           Pending invitees can also read so the invite
--                           landing page can show them what they're joining.
--   collection_members    — owner can read/write all rows for their owned
--                           collections; users can read+modify their own
--                           membership row (to accept/decline/leave).
--   geckos                — UNCHANGED for now. A later migration will
--                           update the geckos SELECT policy to include
--                           "auth.uid() in (SELECT member_id FROM
--                           collection_members WHERE collection_id =
--                           geckos.collection_id AND status='accepted')".
--                           Holding off here so existing app queries that
--                           filter by created_by stay correct until the
--                           UI is updated to honor collaborator access.
--
-- Apply order:
--   1. CREATE TABLE collections + collection_members
--   2. ADD COLUMN geckos.collection_id (nullable)
--   3. Backfill default collections + member rows
--   4. After verifying the app still works, a follow-up migration can
--      flip geckos.collection_id NOT NULL and update the geckos RLS.
-- =============================================================================

-- 1. collections -----------------------------------------------------------

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists collections_owner_idx on public.collections(owner_id);

-- One default collection per owner, enforced at the DB so the
-- "find-or-create default" backfill below is idempotent.
create unique index if not exists collections_one_default_per_owner
  on public.collections(owner_id) where is_default = true;

alter table public.collections enable row level security;

drop policy if exists "Owners read their collections" on public.collections;
create policy "Owners read their collections"
  on public.collections
  for select
  using (owner_id = auth.uid());

drop policy if exists "Members read collections they belong to" on public.collections;
create policy "Members read collections they belong to"
  on public.collections
  for select
  using (
    exists (
      select 1 from public.collection_members cm
      where cm.collection_id = collections.id
        and cm.member_id = auth.uid()
        and cm.status in ('pending', 'accepted')
    )
  );

drop policy if exists "Owners write their collections" on public.collections;
create policy "Owners write their collections"
  on public.collections
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());


-- 2. collection_members ----------------------------------------------------

create table if not exists public.collection_members (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  -- member_id is null until the invitation is accepted by a real user.
  -- We track member_email at invite time so the row can be linked once
  -- the invitee signs up.
  member_id uuid references auth.users(id) on delete cascade,
  member_email text not null,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  invite_token text unique,
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  expires_at timestamptz
);

create index if not exists collection_members_collection_idx
  on public.collection_members(collection_id);
create index if not exists collection_members_member_idx
  on public.collection_members(member_id) where member_id is not null;
create index if not exists collection_members_email_idx
  on public.collection_members(lower(member_email));
create unique index if not exists collection_members_unique_invite
  on public.collection_members(collection_id, lower(member_email));

alter table public.collection_members enable row level security;

-- Owner of the collection can read every row tied to it.
drop policy if exists "Owners read members of their collections" on public.collection_members;
create policy "Owners read members of their collections"
  on public.collection_members
  for select
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_members.collection_id
        and c.owner_id = auth.uid()
    )
  );

-- Members can read their own row (to see role/status, claim invite, etc).
drop policy if exists "Members read their own membership" on public.collection_members;
create policy "Members read their own membership"
  on public.collection_members
  for select
  using (
    member_id = auth.uid()
    or lower(member_email) = lower(coalesce(auth.email(), ''))
  );

-- Owners can insert/update/delete any member row for collections they own.
drop policy if exists "Owners write members of their collections" on public.collection_members;
create policy "Owners write members of their collections"
  on public.collection_members
  for all
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_members.collection_id
        and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_members.collection_id
        and c.owner_id = auth.uid()
    )
  );

-- Members can update their OWN row to accept / decline / leave.
-- They cannot change role, collection_id, or invited_by from the client;
-- those fields are validated on the server in the accept-invite flow.
drop policy if exists "Members update their own membership" on public.collection_members;
create policy "Members update their own membership"
  on public.collection_members
  for update
  using (
    member_id = auth.uid()
    or lower(member_email) = lower(coalesce(auth.email(), ''))
  )
  with check (
    member_id = auth.uid()
    or lower(member_email) = lower(coalesce(auth.email(), ''))
  );

-- Auto-touch updated_at on the parent collection when membership rows
-- change, so admin dashboards can sort by activity.
create or replace function public.bump_collection_updated_at()
returns trigger
language plpgsql
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


-- 4. Backfill: default collection per existing owner ----------------------

-- For every distinct created_by (email) that owns at least one gecko,
-- look up the matching auth.user, create a default collection, link
-- the owner as a member, and reparent the user's geckos into it.
do $$
declare
  rec record;
  cid uuid;
begin
  for rec in
    select distinct g.created_by as email,
                    u.id as uid
      from public.geckos g
      join auth.users u on lower(u.email) = lower(g.created_by)
     where g.collection_id is null
  loop
    -- Look up an existing default collection for this user, or insert one.
    select id into cid
      from public.collections
     where owner_id = rec.uid and is_default = true
     limit 1;

    if cid is null then
      insert into public.collections (owner_id, name, description, is_default)
        values (rec.uid, 'My collection', 'Default collection — created during the multi-collection migration.', true)
        returning id into cid;
    end if;

    -- Owner row in collection_members so we can read membership uniformly.
    insert into public.collection_members
        (collection_id, member_id, member_email, role, status, accepted_at)
      values
        (cid, rec.uid, rec.email, 'owner', 'accepted', now())
      on conflict (collection_id, lower(member_email)) do nothing;

    -- Reparent all of this user's unparented geckos.
    update public.geckos
       set collection_id = cid
     where created_by = rec.email
       and collection_id is null;
  end loop;
end $$;


-- 5. Convenience: trigger that auto-fills collection_id on insert ---------

-- New geckos created by users that already have a default collection
-- inherit it automatically. New users without a default collection
-- still need application code to call ensure_default_collection() at
-- profile creation time.
create or replace function public.geckos_set_default_collection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  uid uuid := auth.uid();
begin
  if new.collection_id is not null then
    return new;
  end if;
  if uid is null then
    return new;
  end if;
  select id into cid
    from public.collections
   where owner_id = uid and is_default = true
   limit 1;

  if cid is null then
    insert into public.collections (owner_id, name, description, is_default)
      values (uid, 'My collection', 'Default collection.', true)
      returning id into cid;

    insert into public.collection_members
        (collection_id, member_id, member_email, role, status, accepted_at)
      values
        (cid, uid, coalesce(auth.email(), ''), 'owner', 'accepted', now())
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


-- 6. RPC: accept an invitation ---------------------------------------------

-- Server-side accept so the client doesn't need permission to mutate
-- arbitrary collection_members rows. Caller passes the invite token.
-- The RPC matches the token against the auth.uid() / auth.email() of
-- the caller; mismatches return a clear error rather than silently
-- accepting under a different identity.
create or replace function public.accept_collection_invite(token text)
returns public.collection_members
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.collection_members;
  uid uuid := auth.uid();
  email text := lower(coalesce(auth.email(), ''));
begin
  if uid is null then
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
     set member_id = uid,
         status = 'accepted',
         accepted_at = now()
   where id = row.id
   returning * into row;

  return row;
end;
$$;

grant execute on function public.accept_collection_invite(text) to authenticated;
