-- MorphMarket notes and wholesale data must never ride on public gecko rows.
create or replace function public.valid_morphmarket_listing_fields(p_fields jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p_fields) = 'object' then p_fields ?& array['Animal_ID','Category','Title','State','Visibility','Enabled','Sex','DOB','Weight','Maturity','Traits','Origin','Diet','Length','Length_Type','Proven_Breeder','Price','Min_Shipping','Max_Shipping','Is_Negotiable','Is_For_Trade','Enable ''Buy Now''','Quantity','Group_Id','Is_Group','Photo_Urls','Video_Url','Is_Rep_Photo','Desc','Wholesale_Price','Wholesale_Only','Wholesale_Description','Private_Notes']
    and (select count(*) = 33 and bool_and(jsonb_typeof(value) = 'string') from jsonb_each(p_fields))
    and octet_length(p_fields::text) <= 200000 else false end;
$$;
revoke all on function public.valid_morphmarket_listing_fields(jsonb) from public, anon;
grant execute on function public.valid_morphmarket_listing_fields(jsonb) to authenticated, service_role;

create table if not exists public.morphmarket_listing_details (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  gecko_id text not null references public.geckos(id) on delete cascade,
  source_fields jsonb not null check (public.valid_morphmarket_listing_fields(source_fields)),
  draft_fields jsonb not null check (public.valid_morphmarket_listing_fields(draft_fields)),
  source_extra jsonb not null default '{}'::jsonb check (jsonb_typeof(source_extra) = 'object' and octet_length(source_extra::text) <= 200000),
  source_name text not null check (length(source_name) <= 255),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  primary key (user_id, gecko_id)
);
create index if not exists morphmarket_listing_details_gecko_idx on public.morphmarket_listing_details(gecko_id);
alter table public.morphmarket_listing_details enable row level security;
revoke all on public.morphmarket_listing_details from public, anon, authenticated;
grant select, insert, update on public.morphmarket_listing_details to authenticated;
grant all on public.morphmarket_listing_details to service_role;
drop policy if exists "Owner manages private listing details" on public.morphmarket_listing_details;
create policy "Owner manages private listing details" on public.morphmarket_listing_details
for all to authenticated
using (user_id = (select auth.uid()) and exists (
  select 1 from public.geckos g where g.id = gecko_id and g.created_by = (select auth.email())
))
with check (user_id = (select auth.uid()) and exists (
  select 1 from public.geckos g where g.id = gecko_id and g.created_by = (select auth.email())
));

create or replace function public.save_morphmarket_listing(
  p_gecko_id text, p_source_fields jsonb, p_draft_fields jsonb,
  p_source_extra jsonb, p_source_name text, p_expected_updated_date timestamptz default null
) returns public.morphmarket_listing_details
language plpgsql security invoker set search_path = '' as $$
declare
  v_existing public.morphmarket_listing_details;
  v_saved public.morphmarket_listing_details;
  v_code text;
begin
  if auth.uid() is null then raise exception 'Sign in to save listing details'; end if;
  select coalesce(nullif(gecko_id_code,''),id) into v_code from public.geckos
    where id = p_gecko_id and created_by = auth.email();
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
$$;
revoke all on function public.save_morphmarket_listing(text,jsonb,jsonb,jsonb,text,timestamptz) from public, anon;
grant execute on function public.save_morphmarket_listing(text,jsonb,jsonb,jsonb,text,timestamptz) to authenticated;

-- Importing an animal and its private listing details succeeds or rolls back together.
create or replace function public.import_morphmarket_listing(
  p_record jsonb, p_source_fields jsonb, p_source_extra jsonb, p_source_name text, p_request_id uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_gecko public.geckos;
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
  select count(*) into v_count from public.geckos where created_by=auth.email() and gecko_id_code=v_id;
  if v_count > 1 then raise exception 'More than one gecko has this Animal ID'; end if;
  select * into v_gecko from public.geckos where created_by=auth.email() and gecko_id_code=v_id;
  if not found then
    v_gecko := public.save_gecko_record(p_record || '{"is_public":false}'::jsonb, p_request_id);
    v_created := true;
  end if;
  select * into v_listing from public.morphmarket_listing_details
    where user_id=auth.uid() and gecko_id=v_gecko.id;
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
  v_saved := public.save_morphmarket_listing(v_gecko.id,p_source_fields,v_draft,p_source_extra,p_source_name,v_listing.updated_date);
  return jsonb_build_object('gecko_id',v_gecko.id,'created',v_created);
end;
$$;
revoke all on function public.import_morphmarket_listing(jsonb,jsonb,jsonb,text,uuid) from public, anon;
grant execute on function public.import_morphmarket_listing(jsonb,jsonb,jsonb,text,uuid) to authenticated;
notify pgrst, 'reload schema';
