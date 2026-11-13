-- Owner email addresses off rows other members can read, step 1 of 2.
-- Owner decision E16 (docs/OWNER-STEPS.md), taken 13 November 2026.
--
-- Today any signed-in member can read the owner's email address
-- (created_by) on every public gecko, on public breeding plans, and on the
-- weight, feeding, shed, vet and ownership records of a gecko with a
-- public passport. Step 2 takes created_by on those seven tables away from
-- signed-in accounts, the way 20261031061000_member_email_columns_revoke.sql did for
-- photos and forum posts. This step gets everything ready for that and
-- takes nothing away, so it is safe for the app that is already open:
--
--   1. owner_profile_id on breeding_plans, weight_records,
--      feeding_records, shed_records, vet_records and ownership_records,
--      as geckos already has. It holds
--      the owner's profiles.id (not an email), is kept in step with
--      created_by by the same trigger function geckos uses, and is filled
--      in for existing rows. The app uses it to tell "mine" from "theirs"
--      once it can no longer read created_by.
--   2. gecko_row_as_member(id): the gecko row with the columns the caller
--      may read. save_gecko_record returns it, so the same function works
--      before and after step 2.
--   3. The four functions that run with the member's own permissions and
--      read these tables stop reading created_by and whole rows, which
--      step 2 would refuse:
--        save_gecko_record           (also accepts estimated_hatch_year,
--                                     owner decision E13: a hatch year on
--                                     its own)
--        recent_weight_records       (runs as its owner, own rows only)
--        save_morphmarket_listing    (ownership through owns_animal)
--        import_morphmarket_listing  (finds the gecko by owner_profile_id)
--      Each keeps its signature and grants and behaves as before.
--   4. Three row rules on other tables looked up created_by on geckos or
--      ownership_records in a subquery. Postgres checks the reader's column
--      rights inside such a subquery (a table's rule on its own column is
--      not checked), so after step 2 those tables would refuse every read.
--      They now ask the same question through functions that run as their
--      owner: owns_animal (already used by the record tables' rules),
--      gecko_shared_with_caller, and a new owns_ownership_record.
--        gecko_sale_prices          read and clear
--        morphmarket_listing_details  the owner's own listing details
--        ownership_record_prices    read
--      Who passes each rule does not change.
--
-- Bodies start from production as read with pg_get_functiondef on
-- 13 November 2026 (save_gecko_record's matches
-- 20260906164108_atomic_gecko_save_and_private_default.sql).
--
-- Plan and checks: docs/planning/owner-emails-2026-11.md.
-- Regression file: supabase/tests/owner_emails_step1_regressions.sql.
-- Idempotent.

-- 1. owner_profile_id on the six other tables.
alter table public.breeding_plans    add column if not exists owner_profile_id text;
alter table public.weight_records    add column if not exists owner_profile_id text;
alter table public.feeding_records   add column if not exists owner_profile_id text;
alter table public.shed_records      add column if not exists owner_profile_id text;
alter table public.vet_records       add column if not exists owner_profile_id text;
alter table public.ownership_records add column if not exists owner_profile_id text;

-- Fill it in for rows that exist. The weight trigger that refreshes the
-- gecko's latest weight is paused for this one statement: copying an id
-- is not a new weigh-in.
update public.breeding_plans t set owner_profile_id = p.id
  from public.profiles p
 where p.email = t.created_by and t.owner_profile_id is distinct from p.id;

do $$
declare
  v_paused boolean := false;
begin
  if exists (select 1 from pg_trigger
              where tgrelid = 'public.weight_records'::regclass
                and tgname = 'weight_records_bump_parent' and tgenabled <> 'D') then
    alter table public.weight_records disable trigger weight_records_bump_parent;
    v_paused := true;
  end if;
  update public.weight_records t set owner_profile_id = p.id
    from public.profiles p
   where p.email = t.created_by and t.owner_profile_id is distinct from p.id;
  if v_paused then
    alter table public.weight_records enable trigger weight_records_bump_parent;
  end if;
end
$$;

update public.feeding_records t set owner_profile_id = p.id
  from public.profiles p
 where p.email = t.created_by and t.owner_profile_id is distinct from p.id;
update public.shed_records t set owner_profile_id = p.id
  from public.profiles p
 where p.email = t.created_by and t.owner_profile_id is distinct from p.id;
update public.vet_records t set owner_profile_id = p.id
  from public.profiles p
 where p.email = t.created_by and t.owner_profile_id is distinct from p.id;
update public.ownership_records t set owner_profile_id = p.id
  from public.profiles p
 where p.email = t.created_by and t.owner_profile_id is distinct from p.id;

-- From now on the database sets it, from created_by, on every insert and
-- whenever created_by or owner_profile_id is written (so a value sent by
-- the browser is replaced by the true one).
drop trigger if exists breeding_plans_set_owner_profile_id on public.breeding_plans;
create trigger breeding_plans_set_owner_profile_id
  before insert or update of created_by, owner_profile_id on public.breeding_plans
  for each row execute function public.set_owner_profile_id();
drop trigger if exists weight_records_set_owner_profile_id on public.weight_records;
create trigger weight_records_set_owner_profile_id
  before insert or update of created_by, owner_profile_id on public.weight_records
  for each row execute function public.set_owner_profile_id();
drop trigger if exists feeding_records_set_owner_profile_id on public.feeding_records;
create trigger feeding_records_set_owner_profile_id
  before insert or update of created_by, owner_profile_id on public.feeding_records
  for each row execute function public.set_owner_profile_id();
drop trigger if exists shed_records_set_owner_profile_id on public.shed_records;
create trigger shed_records_set_owner_profile_id
  before insert or update of created_by, owner_profile_id on public.shed_records
  for each row execute function public.set_owner_profile_id();
drop trigger if exists vet_records_set_owner_profile_id on public.vet_records;
create trigger vet_records_set_owner_profile_id
  before insert or update of created_by, owner_profile_id on public.vet_records
  for each row execute function public.set_owner_profile_id();
drop trigger if exists ownership_records_set_owner_profile_id on public.ownership_records;
create trigger ownership_records_set_owner_profile_id
  before insert or update of created_by, owner_profile_id on public.ownership_records
  for each row execute function public.set_owner_profile_id();

-- "Mine" is read by owner_profile_id.
create index if not exists breeding_plans_owner_profile_id_idx    on public.breeding_plans (owner_profile_id);
create index if not exists weight_records_owner_profile_id_idx    on public.weight_records (owner_profile_id);
create index if not exists feeding_records_owner_profile_id_idx   on public.feeding_records (owner_profile_id);
create index if not exists shed_records_owner_profile_id_idx      on public.shed_records (owner_profile_id);
create index if not exists vet_records_owner_profile_id_idx       on public.vet_records (owner_profile_id);
create index if not exists ownership_records_owner_profile_id_idx on public.ownership_records (owner_profile_id);

-- 2. A gecko row with only the columns the caller may read. Runs as the
-- caller, so the row rules and the column grants both apply: today that is
-- every column; after step 2 created_by comes back null.
create or replace function public.gecko_row_as_member(p_id text)
returns public.geckos
language plpgsql
stable
set search_path to ''
as $function$
declare
  v_cols text;
  v_json jsonb;
begin
  select pg_catalog.string_agg(pg_catalog.format('g.%I', a.attname), ', ' order by a.attnum)
    into v_cols
    from pg_catalog.pg_attribute a
   where a.attrelid = 'public.geckos'::regclass
     and a.attnum > 0
     and not a.attisdropped
     and pg_catalog.has_column_privilege('public.geckos'::regclass, a.attnum, 'SELECT');
  if v_cols is null then
    return null;
  end if;
  execute pg_catalog.format('select pg_catalog.to_jsonb(x) from (select %s from public.geckos g where g.id = $1) x', v_cols)
    into v_json using p_id;
  if v_json is null then
    return null;
  end if;
  return pg_catalog.jsonb_populate_record(null::public.geckos, v_json);
end
$function$;

revoke all on function public.gecko_row_as_member(text) from public, anon;
grant execute on function public.gecko_row_as_member(text) to authenticated, service_role;

-- 3. The four functions.

create or replace function public.save_gecko_record(p_record jsonb, p_request_id uuid, p_gecko_id text default null::text, p_record_weight boolean default false, p_record_date date default current_date)
 returns public.geckos
 language plpgsql
 set search_path to ''
as $function$
declare
  v_saved_id text;
  v_existing_id text;
  v_existing_owner text;
  v_me text;
  v_id text := coalesce(p_gecko_id, p_request_id::text);
  v_columns text;
  v_values text;
  v_assignments text;
  v_payload jsonb;
  v_allowed constant text[] := array[
    'name','gecko_id_code','hatch_date','weight_grams','sex','sire_id','dam_id',
    'sire_name','dam_name','morphs_traits','morph_tags','feeding_group_id','notes',
    'status','image_urls','asking_price','marketplace_description','image_crop_data',
    'species','collection_id','is_gravid','gravid_since','egg_drop_date','quality_score',
    'pattern_grade','tail_status','growth_slideshow_enabled','is_public','gallery_display','placeholder_style',
    'estimated_hatch_year'
  ];
begin
  if auth.uid() is null or auth.email() is null then raise exception 'Sign in to save an animal'; end if;
  if p_request_id is null or jsonb_typeof(p_record) is distinct from 'object' then
    raise exception 'Invalid save request';
  end if;
  if exists (select 1 from jsonb_object_keys(p_record) k where not (k = any(v_allowed))) then
    raise exception 'Unsupported animal field';
  end if;
  if nullif(btrim(p_record->>'name'), '') is null then raise exception 'Animal name is required'; end if;
  if (p_record->>'weight_grams')::numeric < 0 then raise exception 'Weight cannot be negative'; end if;
  if p_record_weight and ((p_record->>'weight_grams') is null or p_record_date is null) then
    raise exception 'A weight and date are required for a measurement';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_id, 0));
  -- Who owns a row is read from owner_profile_id, never from the owner's
  -- email, which step 2 takes away from members.
  select p.id into v_me from public.profiles p where p.email = auth.email();
  select g.id, g.owner_profile_id into v_existing_id, v_existing_owner
    from public.geckos g where g.id = v_id;
  if p_gecko_id is null and v_existing_id is not null then
    if v_existing_owner is distinct from v_me then raise exception 'Save request already used'; end if;
    -- A completed new-animal request is immutable on retry.
    return public.gecko_row_as_member(v_existing_id);
  end if;
  if p_gecko_id is not null and v_existing_id is null then raise exception 'Animal not found or unavailable'; end if;
  v_payload := p_record || jsonb_build_object('updated_date', now());
  if p_gecko_id is null then
    v_payload := v_payload || jsonb_build_object('id', v_id, 'created_by', auth.email(), 'is_public', coalesce((p_record->>'is_public')::boolean, false));
    select string_agg(format('%I', k), ', '), string_agg(format('r.%I', k), ', ')
      into v_columns, v_values from jsonb_object_keys(v_payload) k;
    execute format('insert into public.geckos (%s) select %s from jsonb_populate_record(null::public.geckos, $1) r returning id', v_columns, v_values)
      into v_saved_id using v_payload;
  else
    select string_agg(format('%I = r.%I', k, k), ', ')
      into v_assignments from jsonb_object_keys(v_payload) k;
    execute format('update public.geckos g set %s from jsonb_populate_record(null::public.geckos, $1) r where g.id = $2 returning g.id', v_assignments)
      into v_saved_id using v_payload, v_id;
    if v_saved_id is null then raise exception 'You cannot edit this animal'; end if;
  end if;
  if p_record_weight then
    if exists (select 1 from public.weight_records where id = p_request_id::text and gecko_id <> v_saved_id) then
      raise exception 'Measurement request already used';
    end if;
    insert into public.weight_records(id, gecko_id, weight_grams, record_date, created_by)
      values (p_request_id::text, v_saved_id, (p_record->>'weight_grams')::numeric, p_record_date, auth.email())
      on conflict (id) do nothing;
  end if;
  return public.gecko_row_as_member(v_saved_id);
end;
$function$;

-- The member's own recent weigh-ins. It runs as its owner now, so it can
-- still match created_by after step 2; it returns only the caller's rows.
create or replace function public.recent_weight_records(p_per_gecko integer default 8)
 returns setof public.weight_records
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select (ranked.r).*
  from (
    select wr as r,
           row_number() over (
             partition by wr.gecko_id
             order by wr.record_date desc, wr.created_date desc nulls last, wr.id desc
           ) as rn
    from public.weight_records wr
    where wr.created_by = auth.email()
  ) ranked
  where ranked.rn <= least(greatest(coalesce(p_per_gecko, 8), 1), 50)
  order by (ranked.r).gecko_id, (ranked.r).record_date desc, (ranked.r).id desc;
$function$;

create or replace function public.save_morphmarket_listing(p_gecko_id text, p_source_fields jsonb, p_draft_fields jsonb, p_source_extra jsonb, p_source_name text, p_expected_updated_date timestamp with time zone default null::timestamp with time zone)
 returns public.morphmarket_listing_details
 language plpgsql
 set search_path to ''
as $function$
declare
  v_existing public.morphmarket_listing_details;
  v_saved public.morphmarket_listing_details;
  v_code text;
begin
  if auth.uid() is null then raise exception 'Sign in to save listing details'; end if;
  if not coalesce(public.owns_animal(p_gecko_id), false) then
    raise exception 'You can only save listing details for your own geckos';
  end if;
  select coalesce(nullif(g.gecko_id_code,''), g.id) into v_code from public.geckos g
    where g.id = p_gecko_id;
  if not found then raise exception 'You can only save listing details for your own geckos'; end if;
  if not coalesce(public.valid_morphmarket_listing_fields(p_source_fields),false)
     or not coalesce(public.valid_morphmarket_listing_fields(p_draft_fields),false) then
    raise exception 'A complete set of 33 MorphMarket fields is required';
  end if;
  if v_code is distinct from p_source_fields->>'Animal_ID'
     or p_source_fields->>'Animal_ID' is distinct from p_draft_fields->>'Animal_ID'
     or p_source_fields->>'Category' is distinct from p_draft_fields->>'Category'
     or p_source_fields->>'Category' <> 'Crested Geckos' then
    raise exception 'The existing Animal ID and category must match';
  end if;
  if exists (select 1 from jsonb_each_text(p_source_fields) s
    where btrim(s.value) <> '' and btrim(p_draft_fields->>s.key) = '') then
    raise exception 'Cannot erase an existing MorphMarket field';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_gecko_id,0));
  select * into v_existing from public.morphmarket_listing_details
    where user_id = auth.uid() and gecko_id = p_gecko_id for update;
  if v_existing.updated_date is distinct from p_expected_updated_date then
    raise exception 'Listing details changed in another session. Reload before saving';
  end if;
  insert into public.morphmarket_listing_details(user_id,gecko_id,source_fields,draft_fields,source_extra,source_name)
    values(auth.uid(),p_gecko_id,p_source_fields,p_draft_fields,p_source_extra,p_source_name)
    on conflict(user_id,gecko_id) do update set source_fields=excluded.source_fields,
      draft_fields=excluded.draft_fields,source_extra=excluded.source_extra,
      source_name=excluded.source_name,updated_date=clock_timestamp()
    returning * into v_saved;
  return v_saved;
end;
$function$;

create or replace function public.import_morphmarket_listing(p_record jsonb, p_source_fields jsonb, p_source_extra jsonb, p_source_name text, p_request_id uuid)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare
  v_gecko public.geckos;
  v_gecko_id text;
  v_me text;
  v_listing public.morphmarket_listing_details;
  v_saved public.morphmarket_listing_details;
  v_draft jsonb := p_source_fields;
  v_key text;
  v_count integer;
  v_created boolean := false;
  v_id text := p_source_fields->>'Animal_ID';
begin
  if auth.uid() is null then raise exception 'Sign in to import'; end if;
  if nullif(btrim(v_id),'') is null then raise exception 'Set an Animal ID on MorphMarket before importing listing details'; end if;
  if p_record->>'gecko_id_code' is distinct from v_id then raise exception 'Animal ID does not match the source'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':mm-id:' || v_id,0));
  select p.id into v_me from public.profiles p where p.email = auth.email();
  if v_me is null then raise exception 'Account setup incomplete'; end if;
  select count(*) into v_count from public.geckos g where g.owner_profile_id = v_me and g.gecko_id_code = v_id;
  if v_count > 1 then raise exception 'More than one gecko has this Animal ID'; end if;
  select g.id into v_gecko_id from public.geckos g where g.owner_profile_id = v_me and g.gecko_id_code = v_id;
  if v_gecko_id is null then
    v_gecko := public.save_gecko_record(p_record || '{"is_public":false}'::jsonb, p_request_id);
    v_gecko_id := v_gecko.id;
    v_created := true;
  end if;
  select * into v_listing from public.morphmarket_listing_details
    where user_id=auth.uid() and gecko_id=v_gecko_id;
  if found then
    for v_key in select key from jsonb_each_text(v_listing.draft_fields) loop
      if v_listing.draft_fields->>v_key is distinct from v_listing.source_fields->>v_key then
        if p_source_fields->>v_key is distinct from v_listing.source_fields->>v_key
           and p_source_fields->>v_key is distinct from v_listing.draft_fields->>v_key then
          raise exception 'Saved edits conflict with MorphMarket. Resolve them in the listing workspace';
        end if;
        v_draft := jsonb_set(v_draft,array[v_key],v_listing.draft_fields->v_key);
      end if;
    end loop;
  end if;
  v_saved := public.save_morphmarket_listing(v_gecko_id,p_source_fields,v_draft,p_source_extra,p_source_name,v_listing.updated_date);
  return jsonb_build_object('gecko_id',v_gecko_id,'created',v_created);
end;
$function$;

-- 4. Row rules on other tables, rewritten so they read no owner email.

-- True when the caller is the member an ownership record belongs to, the
-- question ownership_record_prices_read asked of created_by and
-- owner_user_id.
create or replace function public.owns_ownership_record(p_record_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.ownership_records o
     where o.id = p_record_id
       and (o.created_by = auth.email() or o.owner_user_id = auth.uid())
  );
$function$;

revoke all on function public.owns_ownership_record(uuid) from public, anon;
grant execute on function public.owns_ownership_record(uuid) to authenticated, service_role;

alter policy gecko_sale_prices_read on public.gecko_sale_prices
  using (
    public.owns_animal(gecko_id)
    or public.gecko_shared_with_caller(gecko_id)
    or (select public.is_admin())
  );

alter policy gecko_sale_prices_clear on public.gecko_sale_prices
  using (
    public.owns_animal(gecko_id)
    or exists (
      select 1 from public.geckos g
       where g.id = gecko_sale_prices.gecko_id
         and public.is_collection_editor(g.collection_id, (select auth.email()))
    )
    or (select public.is_admin())
  );

alter policy "Owner manages private listing details" on public.morphmarket_listing_details
  using (user_id = (select auth.uid()) and public.owns_animal(gecko_id))
  with check (user_id = (select auth.uid()) and public.owns_animal(gecko_id));

alter policy ownership_record_prices_read on public.ownership_record_prices
  using (
    public.owns_ownership_record(record_id)
    or (select public.is_admin())
  );

-- create or replace keeps each function's grants; restated so the file
-- says who may run them.
revoke all on function public.save_gecko_record(jsonb, uuid, text, boolean, date) from public, anon;
grant execute on function public.save_gecko_record(jsonb, uuid, text, boolean, date) to authenticated, service_role;
revoke all on function public.recent_weight_records(integer) from public, anon;
grant execute on function public.recent_weight_records(integer) to authenticated, service_role;
revoke all on function public.save_morphmarket_listing(text, jsonb, jsonb, jsonb, text, timestamp with time zone) from public, anon;
grant execute on function public.save_morphmarket_listing(text, jsonb, jsonb, jsonb, text, timestamp with time zone) to authenticated, service_role;
revoke all on function public.import_morphmarket_listing(jsonb, jsonb, jsonb, text, uuid) from public, anon;
grant execute on function public.import_morphmarket_listing(jsonb, jsonb, jsonb, text, uuid) to authenticated, service_role;
