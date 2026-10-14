-- Null preserves the existing automatic style for every gecko.
-- An explicit preference travels with the animal across devices and public cards.
set local lock_timeout = '5s';

alter table public.geckos add column if not exists placeholder_style text
  constraint geckos_placeholder_style_valid
  check (placeholder_style in ('engraving', 'woodcut', 'nouveau', 'celestial', 'terracotta'));

comment on column public.geckos.placeholder_style is
  'Illustrated placeholder preference. Null uses the stable automatic style; uploaded photos take priority.';

-- Public cards can read the artwork preference through the existing row policies.
grant select (placeholder_style) on public.geckos to anon;

-- Extend only the accepted fields. Keep the invoker rights, collection policies,
-- atomic weight handling, and retry behavior of the existing save function.
CREATE OR REPLACE FUNCTION public.save_gecko_record(p_record jsonb, p_request_id uuid, p_gecko_id text DEFAULT NULL::text, p_record_weight boolean DEFAULT false, p_record_date date DEFAULT CURRENT_DATE)
 RETURNS public.geckos
 LANGUAGE plpgsql SECURITY INVOKER
 SET search_path TO ''
AS $function$
declare
  v_saved public.geckos;
  v_existing public.geckos;
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
    'pattern_grade','tail_status','growth_slideshow_enabled','is_public','gallery_display','placeholder_style'
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
  select * into v_existing from public.geckos where id = v_id;
  if p_gecko_id is null and found then
    if v_existing.created_by is distinct from auth.email() then raise exception 'Save request already used'; end if;
    -- A completed new-animal request is immutable on retry.
    return v_existing;
  end if;
  if p_gecko_id is not null and v_existing.id is null then raise exception 'Animal not found or unavailable'; end if;
  v_payload := p_record || jsonb_build_object('updated_date', now());
  if p_gecko_id is null then
    v_payload := v_payload || jsonb_build_object('id', v_id, 'created_by', auth.email(), 'is_public', coalesce((p_record->>'is_public')::boolean, false));
    select string_agg(format('%I', k), ', '), string_agg(format('r.%I', k), ', ')
      into v_columns, v_values from jsonb_object_keys(v_payload) k;
    execute format('insert into public.geckos (%s) select %s from jsonb_populate_record(null::public.geckos, $1) r returning *', v_columns, v_values)
      into v_saved using v_payload;
  else
    select string_agg(format('%I = r.%I', k, k), ', ')
      into v_assignments from jsonb_object_keys(v_payload) k;
    execute format('update public.geckos g set %s from jsonb_populate_record(null::public.geckos, $1) r where g.id = $2 returning g.*', v_assignments)
      into v_saved using v_payload, v_id;
    if v_saved.id is null then raise exception 'You cannot edit this animal'; end if;
  end if;
  if p_record_weight then
    if exists (select 1 from public.weight_records where id = p_request_id::text and gecko_id <> v_saved.id) then
      raise exception 'Measurement request already used';
    end if;
    insert into public.weight_records(id, gecko_id, weight_grams, record_date, created_by)
      values (p_request_id::text, v_saved.id, (p_record->>'weight_grams')::numeric, p_record_date, auth.email())
      on conflict (id) do nothing;
  end if;
  return v_saved;
end;
$function$;

notify pgrst, 'reload schema';
