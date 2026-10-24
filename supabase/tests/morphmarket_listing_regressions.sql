-- Local harness only. Owner privacy, atomic imports and concurrent-edit protection.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  source jsonb;
  saved public.morphmarket_listing_details;
  result jsonb;
  rejected boolean;
  n integer;
begin
  insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
    values(owner_id,'mm-owner@example.com','{}','{}'),(other_id,'mm-other@example.com','{}','{}');
  update public.profiles set membership_tier='breeder' where email='mm-owner@example.com';
  insert into public.geckos(id,created_by,name,gecko_id_code,is_public,status)
    values('mm-test-owned','mm-owner@example.com','Collection name','MM-A',true,'Pet');
  select jsonb_object_agg(k,'') into source from unnest(array['Animal_ID','Category','Title','State','Visibility','Enabled','Sex','DOB','Weight','Maturity','Traits','Origin','Diet','Length','Length_Type','Proven_Breeder','Price','Min_Shipping','Max_Shipping','Is_Negotiable','Is_For_Trade','Enable ''Buy Now''','Quantity','Group_Id','Is_Group','Photo_Urls','Video_Url','Is_Rep_Photo','Desc','Wholesale_Price','Wholesale_Only','Wholesale_Description','Private_Notes']) k;
  source := source || '{"Animal_ID":"MM-A","Category":"Crested Geckos","Title":"Listing name","Price":"125","Private_Notes":"private"}'::jsonb;
  if public.valid_morphmarket_listing_fields('[]') or public.valid_morphmarket_listing_fields('{}') then raise exception 'FAIL: incomplete source accepted'; end if;
  if has_table_privilege('anon','public.morphmarket_listing_details','select') then raise exception 'FAIL: anon can read'; end if;
  if has_function_privilege('anon','public.save_morphmarket_listing(text,jsonb,jsonb,jsonb,text,timestamptz)','execute') then raise exception 'FAIL: anon can save'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'email','mm-owner@example.com','role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  saved := public.save_morphmarket_listing('mm-test-owned',source,source,'{}','animals.csv',null);
  if saved.draft_fields->>'Private_Notes' <> 'private' then raise exception 'FAIL: note lost'; end if;
  rejected := false;
  begin
    perform public.save_morphmarket_listing('mm-test-owned',source,source || '{"Price":""}','{}','animals.csv',saved.updated_date);
  exception when others then rejected := sqlerrm like '%Cannot erase%'; end;
  if not rejected then raise exception 'FAIL: allowed blanking price'; end if;
  rejected := false;
  begin
    perform public.save_morphmarket_listing('mm-test-owned',source,source || '{"Animal_ID":"MM-B"}','{}','animals.csv',saved.updated_date);
  exception when others then rejected := sqlerrm like '%must match%'; end;
  if not rejected then raise exception 'FAIL: allowed identity change'; end if;
  rejected := false;
  begin
    perform public.save_morphmarket_listing('mm-test-owned',source,source,'{}','animals.csv',null);
  exception when others then rejected := sqlerrm like '%another session%'; end;
  if not rejected then raise exception 'FAIL: allowed stale save'; end if;
  result := public.import_morphmarket_listing('{"gecko_id_code":"MM-A","name":"Do not replace collection"}',source,'{}','animals.csv',gen_random_uuid());
  if (result->>'created')::boolean then raise exception 'FAIL: duplicate animal created'; end if;
  if (select name from public.geckos where id='mm-test-owned') <> 'Collection name' then raise exception 'FAIL: native data overwritten'; end if;
  rejected := false;
  begin
    perform public.import_morphmarket_listing('{"gecko_id_code":"MM-BAD","name":"Rollback test","status":"Pet"}',(source || '{"Animal_ID":"MM-BAD"}') - 'Category','{}','animals.csv',gen_random_uuid());
  exception when others then rejected := sqlerrm like '%33 MorphMarket fields%'; end;
  if not rejected then raise exception 'FAIL: malformed import accepted'; end if;
  if exists(select 1 from public.geckos where gecko_id_code='MM-BAD') then raise exception 'FAIL: partial import survived'; end if;
  result := public.import_morphmarket_listing('{"gecko_id_code":"MM-B","name":"Private imported animal","status":"Pet","is_public":true}',source || '{"Animal_ID":"MM-B"}','{}','animals.csv',gen_random_uuid());
  if not (result->>'created')::boolean then raise exception 'FAIL: new import not created'; end if;
  if (select is_public from public.geckos where id=result->>'gecko_id') then raise exception 'FAIL: import published animal'; end if;
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',other_id,'email','mm-other@example.com','role','authenticated')::text,true);
  perform set_config('role','authenticated',true);
  select count(*) into n from public.morphmarket_listing_details;
  if n <> 0 then raise exception 'FAIL: another member can read private details'; end if;
  update public.morphmarket_listing_details set source_name='attack.csv';
  get diagnostics n=row_count;
  if n <> 0 then raise exception 'FAIL: another member can edit private details'; end if;
  rejected := false;
  begin
    perform public.save_morphmarket_listing('mm-test-owned',source,source,'{}','animals.csv',null);
  exception when others then rejected := sqlerrm like '%your own geckos%'; end;
  if not rejected then raise exception 'FAIL: RPC allows another owner'; end if;
  perform set_config('role','postgres',true);
  raise notice 'PASS: MorphMarket privacy, no erasure, identity, concurrency, matching and atomic imports';
end;
$$;
rollback;
