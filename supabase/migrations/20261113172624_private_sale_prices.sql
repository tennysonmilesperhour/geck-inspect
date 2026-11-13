-- Sale prices out of rows that other members can read.
--
-- Before: what a gecko sold for sat on public.geckos.sold_price, and every
-- signed-in member can read the whole row of a public gecko
-- (geckos_read_visible: is_public = true). On 13 November 2026 nine geckos
-- had a sale price and all nine were public, so any member with an account
-- could read them through the API. No screen showed another member's sale
-- price; the data was readable all the same. ownership_records.sale_price
-- (the price written when a transfer is claimed) had the same problem, wider:
-- anyone, signed in or not, can read the ownership records of a gecko whose
-- passport is public (ownership_records_read). No record had a price yet.
--
-- After:
--   * public.gecko_sale_prices holds what a gecko sold for. The gecko's owner,
--     the members of a shared collection it sits in, and admins can read it.
--     The owner, collection editors and admins can delete it (the app clears
--     a price that way). Nobody writes it directly: see the next point.
--   * Triggers move a price written to the old columns into the new tables
--     and leave the old columns null. So the app saves a price exactly as it
--     did, and a copy of the app that was open before this change keeps
--     working: its saves land, and until it reloads it reads null where it
--     used to read the price (Business then counts the asking price). Nothing
--     it asks for is refused, unlike a column revoke, which would fail every
--     `select *` on geckos.
--   * A gecko's price is cleared when its sale is undone (the gecko is
--     unarchived, which is when My Geckos and the record page cleared it
--     before) and when the gecko changes owner (a claimed transfer or a
--     deleted account, both of which set the column to null before).
--   * public.ownership_record_prices holds the price on an ownership record,
--     readable by the member the record belongs to (the buyer) and admins.
--     The seller still sees the price on the transfer request.
--
-- The old columns stay and always read null. Dropping them would break any
-- client that still names them. The app puts the price back on the gecko
-- objects it reads (src/lib/geckoSalePrices.js).
--
-- Plan, checks and what is left: docs/planning/private-sale-prices-2026-11.md.
-- Regression file: supabase/tests/private_sale_prices_regressions.sql.
--
-- Idempotent: every object is created with "if not exists" or replaced, and
-- the data move only touches rows that still hold a price.

-- 1. Where a gecko's sale price lives now.
--
-- The foreign key is checked at commit, not at once: the trigger on geckos
-- writes the price before a new gecko row exists (a gecko added with a sale
-- price already on it). Deleting a gecko still deletes its price at once.
create table if not exists public.gecko_sale_prices (
  gecko_id text primary key
    references public.geckos (id) on delete cascade
    deferrable initially deferred,
  sold_price numeric not null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

comment on table public.gecko_sale_prices is
  'What a gecko sold for. Readable by its owner, members of a shared collection it is in, and admins. '
  'Written only by the trigger on geckos (a price written to geckos.sold_price lands here). '
  'See supabase/migrations/20261113172624_private_sale_prices.sql.';

alter table public.gecko_sale_prices enable row level security;

drop policy if exists gecko_sale_prices_read on public.gecko_sale_prices;
create policy gecko_sale_prices_read on public.gecko_sale_prices
  for select to authenticated
  using (
    exists (
      select 1
        from public.geckos g
       where g.id = gecko_sale_prices.gecko_id
         and (g.created_by = (select auth.email())
              or public.is_collection_member(g.collection_id, (select auth.email())))
    )
    or (select public.is_admin())
  );

-- The same people who may edit the gecko (geckos_update_own,
-- geckos_update_admin) may clear its price.
drop policy if exists gecko_sale_prices_clear on public.gecko_sale_prices;
create policy gecko_sale_prices_clear on public.gecko_sale_prices
  for delete to authenticated
  using (
    exists (
      select 1
        from public.geckos g
       where g.id = gecko_sale_prices.gecko_id
         and (g.created_by = (select auth.email())
              or public.is_collection_editor(g.collection_id, (select auth.email())))
    )
    or (select public.is_admin())
  );

revoke all on table public.gecko_sale_prices from public, anon, authenticated;
grant select, delete on table public.gecko_sale_prices to authenticated;
grant all on table public.gecko_sale_prices to service_role;

-- 2. Where an ownership record's price lives now.
create table if not exists public.ownership_record_prices (
  record_id uuid primary key
    references public.ownership_records (id) on delete cascade
    deferrable initially deferred,
  sale_price numeric not null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

comment on table public.ownership_record_prices is
  'The price on an ownership record (what the buyer paid). Readable by the member the record belongs to and admins. '
  'Written only by the trigger on ownership_records. '
  'See supabase/migrations/20261113172624_private_sale_prices.sql.';

alter table public.ownership_record_prices enable row level security;

drop policy if exists ownership_record_prices_read on public.ownership_record_prices;
create policy ownership_record_prices_read on public.ownership_record_prices
  for select to authenticated
  using (
    exists (
      select 1
        from public.ownership_records o
       where o.id = ownership_record_prices.record_id
         and (o.created_by = (select auth.email()) or o.owner_user_id = (select auth.uid()))
    )
    or (select public.is_admin())
  );

revoke all on table public.ownership_record_prices from public, anon, authenticated;
grant select on table public.ownership_record_prices to authenticated;
grant all on table public.ownership_record_prices to service_role;

-- 3. The triggers.

-- Set by keep_gecko_sale_price_private around the deletes it makes when a
-- sale is undone or the owner changes, so the activity feed (below) does not
-- add a "sale price" entry on top of the "restored" or "moved" entry those
-- changes already write.
create or replace function geck_private.keep_gecko_sale_price_private()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
       -- The sale is undone: the gecko is back in the collection.
       (coalesce(old.archived, false) and not coalesce(new.archived, false))
       -- A new owner (a claimed transfer, a deleted account): what the last
       -- owner sold it for is not theirs to see.
    or lower(coalesce(new.created_by, '')) <> lower(coalesce(old.created_by, ''))
       -- A price cleared on a row that still carried one in the old column.
    or (old.sold_price is not null and new.sold_price is null)
  ) then
    perform set_config('geck.sale_price_quiet', 'on', true);
    delete from public.gecko_sale_prices where gecko_id = old.id;
    perform set_config('geck.sale_price_quiet', 'off', true);
  end if;

  if new.sold_price is not null then
    -- On an insert, only for a gecko that is really new. When a row with
    -- this id already exists, the insert is about to fail or to do nothing
    -- ("on conflict do nothing"), and this trigger runs before either: a
    -- member could otherwise set the price of a gecko that is not theirs.
    if tg_op = 'UPDATE' or not exists (select 1 from public.geckos g where g.id = new.id) then
      insert into public.gecko_sale_prices as p (gecko_id, sold_price, updated_date)
      values (new.id, new.sold_price, now())
      on conflict (gecko_id) do update
        set sold_price = excluded.sold_price,
            updated_date = excluded.updated_date
        where p.sold_price is distinct from excluded.sold_price;
    end if;
    new.sold_price := null;
  end if;
  return new;
end
$$;

create or replace function geck_private.keep_ownership_sale_price_private()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sale_price is not null then
    -- As for geckos: on an insert, only for a record that is really new.
    if tg_op = 'UPDATE' or not exists (select 1 from public.ownership_records o where o.id = new.id) then
      insert into public.ownership_record_prices as p (record_id, sale_price, updated_date)
      values (new.id, new.sale_price, now())
      on conflict (record_id) do update
        set sale_price = excluded.sale_price,
            updated_date = excluded.updated_date
        where p.sale_price is distinct from excluded.sale_price;
    end if;
    new.sale_price := null;
  end if;
  return new;
end
$$;

-- A shared collection's activity feed listed "sale price" when a member
-- changed one (collection_activity_on_gecko compared the old column, which
-- now always reads null). This keeps that entry. log_collection_activity
-- writes nothing for a collection that is not shared, and folds it into the
-- same person's other edits to the gecko within ten minutes.
create or replace function geck_private.log_gecko_sale_price_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gecko_id text := coalesce(new.gecko_id, old.gecko_id);
  v_collection uuid;
  v_name text;
begin
  if current_setting('geck.sale_price_quiet', true) = 'on' then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.sold_price is not distinct from old.sold_price then
    return null;
  end if;
  select g.collection_id, g.name into v_collection, v_name
    from public.geckos g
   where g.id = v_gecko_id;
  if found then
    perform public.log_collection_activity(v_collection, v_gecko_id, v_name, 'edited', 'sale price');
  end if;
  return null;
end
$$;

revoke all on function geck_private.keep_gecko_sale_price_private() from public, anon, authenticated;
revoke all on function geck_private.keep_ownership_sale_price_private() from public, anon, authenticated;
revoke all on function geck_private.log_gecko_sale_price_change() from public, anon, authenticated;

-- 4. Move what is there now, before the triggers exist (once they do, a
-- price set to null on the old column counts as cleared). The two triggers
-- that react to any change of a gecko row are paused for this one statement:
-- the "last changed" stamp and the shared-collection activity feed. Moving a
-- price is not an edit anyone made.
insert into public.gecko_sale_prices (gecko_id, sold_price, updated_date)
select g.id, g.sold_price, coalesce(g.updated_date, now())
  from public.geckos g
 where g.sold_price is not null
on conflict (gecko_id) do update
  set sold_price = excluded.sold_price;

do $$
declare
  v_paused text[] := array[]::text[];
  v_trigger text;
begin
  if not exists (select 1 from public.geckos where sold_price is not null) then
    return;
  end if;
  foreach v_trigger in array array['geckos_bump_change_ts', 'geckos_collection_activity'] loop
    if exists (select 1 from pg_trigger
                where tgrelid = 'public.geckos'::regclass and tgname = v_trigger and tgenabled <> 'D') then
      execute format('alter table public.geckos disable trigger %I', v_trigger);
      v_paused := v_paused || v_trigger;
    end if;
  end loop;
  -- On a second run the trigger below already exists; keep it from treating
  -- this as a cleared price.
  if exists (select 1 from pg_trigger
              where tgrelid = 'public.geckos'::regclass and tgname = 'geckos_keep_sale_price_private') then
    alter table public.geckos disable trigger geckos_keep_sale_price_private;
    v_paused := v_paused || 'geckos_keep_sale_price_private'::text;
  end if;
  update public.geckos set sold_price = null where sold_price is not null;
  foreach v_trigger in array v_paused loop
    execute format('alter table public.geckos enable trigger %I', v_trigger);
  end loop;
end
$$;

insert into public.ownership_record_prices (record_id, sale_price, updated_date)
select o.id, o.sale_price, coalesce(o.updated_date, now())
  from public.ownership_records o
 where o.sale_price is not null
on conflict (record_id) do update
  set sale_price = excluded.sale_price;

update public.ownership_records set sale_price = null where sale_price is not null;

-- 5. From now on.
drop trigger if exists geckos_keep_sale_price_private on public.geckos;
create trigger geckos_keep_sale_price_private
  before insert or update of sold_price, archived, created_by on public.geckos
  for each row execute function geck_private.keep_gecko_sale_price_private();

drop trigger if exists ownership_records_keep_sale_price_private on public.ownership_records;
create trigger ownership_records_keep_sale_price_private
  before insert or update of sale_price on public.ownership_records
  for each row execute function geck_private.keep_ownership_sale_price_private();

drop trigger if exists gecko_sale_prices_activity on public.gecko_sale_prices;
create trigger gecko_sale_prices_activity
  after insert or update or delete on public.gecko_sale_prices
  for each row execute function geck_private.log_gecko_sale_price_change();

comment on column public.geckos.sold_price is
  'Always null since 20261113172624. Writes still work: the trigger geckos_keep_sale_price_private moves the price to gecko_sale_prices, which other members cannot read.';
comment on column public.ownership_records.sale_price is
  'Always null since 20261113172624. Writes still work: the trigger ownership_records_keep_sale_price_private moves the price to ownership_record_prices.';
