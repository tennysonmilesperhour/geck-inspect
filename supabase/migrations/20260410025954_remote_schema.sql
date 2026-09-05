


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE SCHEMA IF NOT EXISTS "geck_data";


ALTER SCHEMA "geck_data" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";






CREATE TYPE "public"."blog_post_status" AS ENUM (
    'draft',
    'scheduled',
    'published',
    'archived'
);


ALTER TYPE "public"."blog_post_status" OWNER TO "postgres";


CREATE TYPE "public"."store_fulfillment_mode" AS ENUM (
    'direct_self',
    'direct_pod',
    'dropship_wholesale',
    'affiliate_redirect'
);


ALTER TYPE "public"."store_fulfillment_mode" OWNER TO "postgres";


CREATE TYPE "public"."store_fulfillment_status" AS ENUM (
    'pending',
    'processing',
    'shipped',
    'delivered',
    'refunded',
    'cancelled'
);


ALTER TYPE "public"."store_fulfillment_status" OWNER TO "postgres";


CREATE TYPE "public"."store_order_status" AS ENUM (
    'pending',
    'paid',
    'processing',
    'shipped',
    'delivered',
    'refunded',
    'partial_refund',
    'cancelled'
);


ALTER TYPE "public"."store_order_status" OWNER TO "postgres";


CREATE TYPE "public"."store_pricing_constraint" AS ENUM (
    'none',
    'map'
);


ALTER TYPE "public"."store_pricing_constraint" OWNER TO "postgres";


CREATE TYPE "public"."store_product_status" AS ENUM (
    'draft',
    'active',
    'archived'
);


ALTER TYPE "public"."store_product_status" OWNER TO "postgres";


CREATE TYPE "public"."store_shipping_class" AS ENUM (
    'standard',
    'oversized',
    'live_animal',
    'live_insect',
    'digital'
);


ALTER TYPE "public"."store_shipping_class" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."_combo_id_from_traits"("traits" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'geck_data', 'extensions'
    AS $$
  with t as (
    select lower(regexp_replace(coalesce(traits, ''), '[^a-zA-Z0-9 |,/;]', ' ', 'g')) as norm
  )
  select case
    when norm like '%lilly white%' and norm like '%axanthic%'        then 'lw-axa'
    when norm like '%lilly white%' and norm like '%cappuccino%'      then 'lw-cap'
    when norm like '%cappuccino%'  and norm like '%full pinstripe%'  then 'cap-pin'
    when norm like '%axanthic%'    and norm like '%full pinstripe%'  then 'axa-pin'
    when norm like '%sable%'       and norm like '%extreme harlequin%' then 'sable-harl'
    when norm like '%frappuccino%' and norm like '%pinstripe%'       then 'frap-pin'
    when norm like '%moonglow%'    and norm like '%super dalmatian%' then 'moonglow-dal'
    when norm like '%lilly white%' and norm like '%soft scale%'      then 'lw-soft'
    when norm like '%axanthic%'    and norm like '%extreme harlequin%' then 'axa-harl'
    when norm like '%cappuccino%'  and norm like '%super dalmatian%' then 'cap-dal'
    when norm like '%red%'         and norm like '%harlequin%'       then 'red-harl'
    when norm like '%tiger%'       and norm like '%pinstripe%'       then 'tiger-pin'
    else null
  end
  from t;
$$;


ALTER FUNCTION "geck_data"."_combo_id_from_traits"("traits" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."_looks_like_group_lot"("title" "text", "is_auction" boolean DEFAULT false) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'geck_data', 'extensions'
    AS $$
  select coalesce(
    title ~* '\m(lot|lots|pack|packs|wholesale|bundle|colony|pair|pairs|trio|trios|quad|group)\M'
    or title ~* '\m(x\s*[2-9]|[2-9]\s*x)\M'
    or title ~* '\m(two|three|four|five|six)\s+(pack|lot|group|of)\M'
    or title ~* '\mgroup\s+of\s+[0-9]+\M',
  false);
$$;


ALTER FUNCTION "geck_data"."_looks_like_group_lot"("title" "text", "is_auction" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "geck_data"."_looks_like_group_lot"("title" "text", "is_auction" boolean) IS 'Heuristic: does this listing title describe more than one animal (lot/pack/pair/trio/group/xN)? Used to keep group pricing out of single-animal comps. Eager by design.';



CREATE OR REPLACE FUNCTION "geck_data"."_normalize_trait_csv"("raw" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'geck_data', 'extensions'
    AS $_$
  select nullif(string_agg(tok, ', ' order by ord), '')
  from (
    select distinct on (lower(trim(both ' ' from parts.tok)))
           trim(both ' ' from parts.tok) as tok,
           parts.ord
    from (
      -- Property segments first; a dropped segment takes its values with it.
      select s.tok, (t.ord * 1000 + s.ord) as ord
      from regexp_split_to_table(coalesce(raw, ''), '\s*\|\s*')
           with ordinality as t(seg, ord)
      cross join lateral regexp_split_to_table(t.seg, '\s*,\s*')
           with ordinality as s(tok, ord)
      where trim(both ' ' from t.seg) !~*
            '^(diet|proven breeder|sex|maturity|weight|birth date|birthdate|hatched|origin|pet only|lineage|shipping|payment|scientific name|category)\s*(:|$)'
    ) parts
    where trim(both ' ' from parts.tok) <> ''
    order by lower(trim(both ' ' from parts.tok)), parts.ord
  ) k;
$_$;


ALTER FUNCTION "geck_data"."_normalize_trait_csv"("raw" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "geck_data"."_normalize_trait_csv"("raw" "text") IS 'Normalize a raw scraper/extension trait string to comma-delimited morph tokens. Pipes separate properties, commas list values within a property: a non-trait property (Diet, Proven breeder, ...) is dropped whole, values included. De-dupes case-insensitively. Returns null when nothing survives.';



CREATE OR REPLACE FUNCTION "geck_data"."_sanitize_cached_traits"("input" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'geck_data', 'extensions'
    AS $_$
declare
  segs text[];
  kept text[] := '{}';
  s text;
  re text := '^\s*(diet|proven breeder|sex|maturity|weight|birth date|birthdate|hatched|origin|pet only|lineage|shipping|payment|scientific name|category)\s*(:|$|\|)';
begin
  if input is null or btrim(input) = '' then return null; end if;
  if position('|' in input) > 0 then
    segs := string_to_array(input, '|');
  else
    segs := array[input];
  end if;
  foreach s in array segs loop
    s := btrim(s);
    if s = '' then continue; end if;
    if s ~* re then continue; end if;
    kept := array_append(kept, s);
  end loop;
  if cardinality(kept) = 0 then return null; end if;
  return array_to_string(kept, ' | ');
end;
$_$;


ALTER FUNCTION "geck_data"."_sanitize_cached_traits"("input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."_sanitize_norm_traits"("input" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'geck_data', 'extensions'
    AS $$
declare
  segs text[];
  kept text[] := '{}';
  s text;
begin
  if input is null or btrim(input) = '' then return null; end if;
  segs := string_to_array(input, ',');
  foreach s in array segs loop
    s := btrim(s);
    if s = '' or position(':' in s) > 0 then continue; end if;
    kept := array_append(kept, s);
  end loop;
  if cardinality(kept) = 0 then return null; end if;
  return array_to_string(kept, ', ');
end;
$$;


ALTER FUNCTION "geck_data"."_sanitize_norm_traits"("input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."_trait_root"("label" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'geck_data', 'extensions'
    AS $$
  select nullif(
    trim(both ' ' from
      regexp_replace(
        lower(coalesce(label, '')),
        '^(super\s+extreme|super|extreme|partial|full|het|poss|pos|possible|reduced|high|low)\s+',
        '',
        'g'
      )
    ),
  '');
$$;


ALTER FUNCTION "geck_data"."_trait_root"("label" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "geck_data"."_trait_root"("label" "text") IS 'Trait label with qualifier prefixes (super, extreme, partial, full, het, pos, ...) removed, so expression levels and zygosity states collapse onto the trait they qualify.';



CREATE OR REPLACE FUNCTION "geck_data"."_traits_are_redundant"("a" "text", "b" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog', 'geck_data', 'extensions'
    AS $$
  select case
    when a is null or b is null then false
    when lower(trim(a)) = lower(trim(b)) then true
    when geck_data._trait_root(a) is not null
     and geck_data._trait_root(a) = geck_data._trait_root(b) then true
    else exists (
      select 1 from geck_data.trait_relations r
      where (r.trait_a = lower(trim(a)) and r.trait_b = lower(trim(b)))
         or (r.trait_a = lower(trim(b)) and r.trait_b = lower(trim(a)))
         or (r.trait_a = geck_data._trait_root(a) and r.trait_b = geck_data._trait_root(b))
         or (r.trait_a = geck_data._trait_root(b) and r.trait_b = geck_data._trait_root(a))
    )
  end;
$$;


ALTER FUNCTION "geck_data"."_traits_are_redundant"("a" "text", "b" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "geck_data"."_traits_are_redundant"("a" "text", "b" "text") IS 'True when two trait labels describe the same underlying trait (same root after stripping qualifiers, or a seeded allelic/overlapping relation). Such a pair is not a combo.';



CREATE OR REPLACE FUNCTION "geck_data"."canonical_trait"("p_trait" "text") RETURNS TABLE("canonical_id" "text", "trait_kind" "text")
    LANGUAGE "sql" STABLE PARALLEL SAFE
    SET "search_path" TO 'geck_data'
    AS $$
  with norm as (
    select lower(trim(p_trait)) as n
  )
  select m.canonical_id, m.trait_kind
  from geck_data.crested_morph_taxonomy m, norm
  where m.canonical_id is not null
    and (
      m.norm_name = norm.n
      or norm.n = any (array(select lower(s) from unnest(m.synonyms) s))
    )
  limit 1;
$$;


ALTER FUNCTION "geck_data"."canonical_trait"("p_trait" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "geck_data"."batch_jobs" (
    "id" bigint NOT NULL,
    "listing_id" "text" NOT NULL,
    "model" "text" NOT NULL,
    "surface" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "error_summary" "text",
    "result" "jsonb",
    "invocation_id" bigint,
    CONSTRAINT "batch_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'running'::"text", 'done'::"text", 'failed'::"text"])))
);


ALTER TABLE "geck_data"."batch_jobs" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."claim_batch_jobs"("p_limit" integer, "p_worker" "text") RETURNS SETOF "geck_data"."batch_jobs"
    LANGUAGE "sql"
    SET "search_path" TO 'pg_catalog', 'geck_data', 'extensions'
    AS $$
  with claimed as (
    select id from geck_data.batch_jobs
     where status = 'pending'
     order by created_at
     for update skip locked
     limit p_limit
  )
  update geck_data.batch_jobs bj
     set status = 'running',
         started_at = now(),
         error_summary = coalesce(error_summary, p_worker)
   where bj.id in (select id from claimed)
  returning bj.*;
$$;


ALTER FUNCTION "geck_data"."claim_batch_jobs"("p_limit" integer, "p_worker" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."clutches_default_hatch"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'geck_data', 'extensions'
    AS $$
begin
  if new.expected_hatch_on is null then
    new.expected_hatch_on := new.laid_on + interval '65 days';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "geck_data"."clutches_default_hatch"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."combo_index_health"() RETURNS TABLE("mv_max_day" "date", "newest_eligible_day" "date", "lag_days" integer, "mv_rows" bigint, "mv_combos" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'geck_data'
    AS $$
  with mv as (
    select
      max(day)                    as mv_max_day,
      count(*)::bigint            as mv_rows,
      count(distinct combo_id)::bigint as mv_combos
    from geck_data.combo_index_daily
  ),
  -- Listings the view can actually build a combo from: same filters as the
  -- MV's listing_traits CTE (0037), so this cannot drift into false alarms.
  listing_ok as (
    select ml.id
    from geck_data.market_listings ml,
         lateral unnest(string_to_array(ml.cached_traits, ',')) t(t)
    where ml.cached_traits is not null
      and ml.species in ('crested','unknown')
    group by ml.id
    having count(distinct trim(both ' ' from t.t))
             filter (where length(trim(both ' ' from t.t)) between 2 and 60) >= 2
  ),
  eligible as (
    select max(date_trunc('day', ph.observed_at)::date) as newest_eligible_day
    from geck_data.price_history ph
    join listing_ok lo on lo.id = ph.listing_id
    where ph.observed_at >= now() - interval '365 days'
      and coalesce(ph.price_usd_equivalent, ph.price) is not null
      and coalesce(ph.price_usd_equivalent, ph.price) > 0
      and coalesce(ph.price_usd_equivalent, ph.price) < 100000
  )
  select
    mv.mv_max_day,
    e.newest_eligible_day,
    case
      when e.newest_eligible_day is null or mv.mv_max_day is null then null
      else (e.newest_eligible_day - mv.mv_max_day)::integer
    end as lag_days,
    mv.mv_rows,
    mv.mv_combos
  from mv, eligible e;
$$;


ALTER FUNCTION "geck_data"."combo_index_health"() OWNER TO "postgres";


COMMENT ON FUNCTION "geck_data"."combo_index_health"() IS 'Health probe for combo_index_daily: newest day held vs newest day buildable from price_history. lag_days > 0 means the view is behind its inputs (refresh not running, or not reaching this database).';



CREATE OR REPLACE FUNCTION "geck_data"."combo_index_movers"("lookback_days" integer DEFAULT 90, "min_n" integer DEFAULT 5, "max_rows" integer DEFAULT 20) RETURNS TABLE("combo_id" "text", "from_day" "date", "to_day" "date", "from_value" numeric, "to_value" numeric, "from_n" bigint, "to_n" bigint, "pct_change" numeric, "span_days" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  with params as (
    select least(greatest(coalesce(lookback_days, 90), 1), 1825) as lookback,
           greatest(coalesce(min_n, 5), 1)                       as floor_n,
           least(greatest(coalesce(max_rows, 20), 1), 200)       as cap
  ),
  latest as (
    select combo_id, max(day) as d
    from geck_data.combo_index_daily
    group by combo_id
  ),
  cur as (
    select c.combo_id, c.day, c.median_price, c.n
    from geck_data.combo_index_daily c
    join latest l on l.combo_id = c.combo_id and l.d = c.day
  ),
  -- The newest observed day at or before the lookback horizon, bounded below
  -- so a baseline cannot silently drift years back when the index has a gap.
  -- Half the lookback is the slack, matching the bounding rule the index
  -- summary view uses for its own deltas.
  base as (
    select distinct on (c.combo_id)
      c.combo_id, c.day, c.median_price, c.n
    from geck_data.combo_index_daily c
    join latest l on l.combo_id = c.combo_id
    cross join params p
    where c.day <= l.d - p.lookback
      and c.day >= l.d - (p.lookback + greatest(14, p.lookback / 2))
    order by c.combo_id, c.day desc
  )
  select
    cur.combo_id,
    base.day,
    cur.day,
    base.median_price,
    cur.median_price,
    base.n,
    cur.n,
    round(100.0 * (cur.median_price - base.median_price) / base.median_price, 1),
    (cur.day - base.day)::integer
  from cur
  join base on base.combo_id = cur.combo_id
  cross join params p
  where base.median_price > 0
    and cur.n >= p.floor_n
    and base.n >= p.floor_n
  order by abs((cur.median_price - base.median_price) / base.median_price) desc
  limit (select cap from params);
$$;


ALTER FUNCTION "geck_data"."combo_index_movers"("lookback_days" integer, "min_n" integer, "max_rows" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "geck_data"."combo_index_movers"("lookback_days" integer, "min_n" integer, "max_rows" integer) IS 'Largest moves in the combo asking-price index between two disjoint observed days: each combo latest observed day against the newest day at least lookback_days earlier. Both endpoints must carry at least min_n listings, since ungated the list is dominated by combos priced off a single ad. Returns both dates and both counts so a caller can show what the move rests on.';



CREATE OR REPLACE FUNCTION "geck_data"."combo_match"("p_traits" "text") RETURNS "text"
    LANGUAGE "sql" STABLE PARALLEL SAFE
    SET "search_path" TO 'geck_data'
    AS $$
  select combo_name
  from geck_data.combo_catalog
  where (
    select bool_and(
      position(token in lower(coalesce(p_traits, ''))) > 0
    )
    from unnest(tokens) as token
  )
  order by array_length(tokens, 1) desc, combo_name
  limit 1;
$$;


ALTER FUNCTION "geck_data"."combo_match"("p_traits" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."combo_maturity_baselines"("fresh_hours" integer DEFAULT 48, "window_days" integer DEFAULT 365, "min_fresh" integer DEFAULT 5, "min_sellers" integer DEFAULT 3) RETURNS TABLE("combo_id" "text", "trait_a" "text", "trait_b" "text", "maturity" "text", "n_fresh" bigint, "n_fresh_sellers" bigint, "median_fresh_ask" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  with bounds as (
    select
      timezone('UTC', now())
        - make_interval(hours => least(greatest(coalesce(fresh_hours, 48), 1), 8760)) as fresh_since,
      timezone('UTC', now())
        - make_interval(days => least(greatest(coalesce(window_days, 365), 1), 1825)) as window_since
  ),
  lt as (
    select
      ml.id,
      ml.seller_id,
      ml.price_usd_equivalent as price,
      ml.maturity,
      array_agg(distinct trim(both ' ' from t.t))
        filter (where length(trim(both ' ' from t.t)) between 2 and 60) as traits
    from geck_data.market_listings ml
    cross join bounds b,
         lateral unnest(string_to_array(ml.cached_traits, ',')) t(t)
    where ml.cached_traits is not null
      and ml.maturity is not null
      and ml.species in ('crested', 'unknown')
      and not ml.is_group_lot
      and not coalesce(ml.is_auction, false)
      and ml.current_status = 'live'
      and ml.last_seen_at >= b.fresh_since
      and ml.price_usd_equivalent is not null
      and ml.price_usd_equivalent > 0
      and ml.price_usd_equivalent < 100000
      and coalesce(ml.first_listed_at, ml.first_seen_at) >= b.window_since
    group by ml.id, ml.seller_id, ml.price_usd_equivalent, ml.maturity
  ),
  pairs as (
    select
      (least(lt.traits[i.i], lt.traits[j.j]) || ' x ' || greatest(lt.traits[i.i], lt.traits[j.j])) as combo_id,
      least(lt.traits[i.i], lt.traits[j.j])    as trait_a,
      greatest(lt.traits[i.i], lt.traits[j.j]) as trait_b,
      lt.maturity, lt.id, lt.seller_id, lt.price
    from lt,
         lateral generate_subscripts(lt.traits, 1) i(i),
         lateral generate_subscripts(lt.traits, 1) j(j)
    where i.i < j.j
      and array_length(lt.traits, 1) >= 2
  )
  select
    combo_id,
    min(trait_a),
    min(trait_b),
    maturity,
    count(*)::bigint,
    count(distinct seller_id)::bigint,
    round(percentile_cont(0.5) within group (order by price)::numeric, 2)
  from pairs
  group by combo_id, maturity
  having count(*) >= greatest(coalesce(min_fresh, 5), 2)
     and count(distinct seller_id) >= greatest(coalesce(min_sellers, 3), 2)
     and not geck_data._traits_are_redundant(min(trait_a), min(trait_b));
$$;


ALTER FUNCTION "geck_data"."combo_maturity_baselines"("fresh_hours" integer, "window_days" integer, "min_fresh" integer, "min_sellers" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "geck_data"."combo_maturity_baselines"("fresh_hours" integer, "window_days" integer, "min_fresh" integer, "min_sellers" integer) IS 'Median asking price per (trait combo, maturity) over freshly re-confirmed live single-animal listings, excluding group lots and auctions. Only cells with real depth are returned: at least min_fresh asks from at least min_sellers distinct sellers, and never a pair whose two traits are redundant with each other.';



CREATE OR REPLACE FUNCTION "geck_data"."combo_weekly_prices"("p_trait_a" "text", "p_trait_b" "text", "window_days" integer DEFAULT 180) RETURNS TABLE("week_start" "date", "median_price" numeric, "n_listings" bigint, "observed_days" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  with bounds as (
    select date_trunc('week', timezone('UTC', now())
      - make_interval(days => least(greatest(coalesce(window_days, 180), 1), 730)))::date as from_week
  ),
  members as (
    select ml.id
    from geck_data.market_listings ml
    where ml.cached_traits is not null
      and ml.species in ('crested', 'unknown')
      and not ml.is_group_lot
      and ml.cached_traits ilike '%' || p_trait_a || '%'
      and ml.cached_traits ilike '%' || p_trait_b || '%'
  )
  select
    w.week_start,
    round(percentile_cont(0.5) within group (order by w.price)::numeric, 2) as median_price,
    count(distinct w.listing_id)::bigint as n_listings,
    count(distinct w.observed_day)::bigint as observed_days
  from geck_data.v_listing_week_price w
  join members m on m.id = w.listing_id
  cross join bounds b
  where w.week_start >= b.from_week
  group by w.week_start
  order by w.week_start;
$$;


ALTER FUNCTION "geck_data"."combo_weekly_prices"("p_trait_a" "text", "p_trait_b" "text", "window_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "geck_data"."combo_weekly_prices"("p_trait_a" "text", "p_trait_b" "text", "window_days" integer) IS 'Weekly median observed ASK for every listing that has carried both traits, live or not, one observation per listing per week, group lots excluded. Sold prices are deliberately not mixed in.';



CREATE OR REPLACE FUNCTION "geck_data"."extract_listing_image_urls"("raw" "jsonb") RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'geck_data', 'extensions'
    AS $$
  with candidates as (
    select coalesce(elem->>'url', elem->>'src', elem->>'href', elem #>> '{}') as u
      from jsonb_array_elements(coalesce(raw->'images', '[]'::jsonb)) as elem
      where jsonb_typeof(raw->'images') = 'array'
    union all
    select coalesce(elem->>'url', elem->>'src', elem->>'href', elem #>> '{}') as u
      from jsonb_array_elements(coalesce(raw->'photos', '[]'::jsonb)) as elem
      where jsonb_typeof(raw->'photos') = 'array'
    union all
    select coalesce(elem->>'url', elem->>'src', elem->>'href', elem #>> '{}') as u
      from jsonb_array_elements(coalesce(raw->'media', '[]'::jsonb)) as elem
      where jsonb_typeof(raw->'media') = 'array'
  )
  select array_agg(distinct u)
  from candidates
  where u is not null and u like 'http%';
$$;


ALTER FUNCTION "geck_data"."extract_listing_image_urls"("raw" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."extract_listing_traits"("raw" "jsonb") RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'geck_data', 'extensions'
    AS $$
  with candidates as (
    -- shape: raw->'traits' is an array of {name: "..."} objects
    select geck_data.normalize_trait_name(elem->>'name') as t
      from jsonb_array_elements(coalesce(raw->'traits', '[]'::jsonb)) as elem
      where jsonb_typeof(raw->'traits') = 'array'
    union all
    -- shape: raw->'trait_list' is an array of strings
    select geck_data.normalize_trait_name(elem #>> '{}') as t
      from jsonb_array_elements(coalesce(raw->'trait_list', '[]'::jsonb)) as elem
      where jsonb_typeof(raw->'trait_list') = 'array'
    union all
    -- shape: raw->'genetics'->'traits' is an array of {name: "..."} objects
    select geck_data.normalize_trait_name(elem->>'name') as t
      from jsonb_array_elements(coalesce(raw#>'{genetics,traits}', '[]'::jsonb)) as elem
      where jsonb_typeof(raw#>'{genetics,traits}') = 'array'
    union all
    -- shape: raw->'morphs' is an array of strings or {name: "..."}
    select geck_data.normalize_trait_name(coalesce(elem->>'name', elem #>> '{}')) as t
      from jsonb_array_elements(coalesce(raw->'morphs', '[]'::jsonb)) as elem
      where jsonb_typeof(raw->'morphs') = 'array'
  )
  select array_agg(distinct t order by t)
  from candidates
  where t is not null;
$$;


ALTER FUNCTION "geck_data"."extract_listing_traits"("raw" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'geck_data'
    AS $$
begin
  insert into geck_data.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;


ALTER FUNCTION "geck_data"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'geck_data'
    AS $$
  select exists (
    select 1 from geck_data.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;


ALTER FUNCTION "geck_data"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."is_training_trait"("p_trait" "text") RETURNS boolean
    LANGUAGE "sql" STABLE PARALLEL SAFE
    SET "search_path" TO 'geck_data'
    AS $$
  with input as (
    select lower(trim(p_trait)) as norm
  ),
  match as (
    select exists (
      select 1 from geck_data.crested_morph_taxonomy m, input i
      where m.norm_name = i.norm
         or i.norm = any(array(select lower(s) from unnest(m.synonyms) s))
    ) as is_match
  )
  select case
    when p_trait is null then false
    when p_trait ilike 'Diet:%'             then false
    when p_trait ilike 'Proven breeder%'    then false
    else (select is_match from match)
  end;
$$;


ALTER FUNCTION "geck_data"."is_training_trait"("p_trait" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."listings_needing_detail_scrape"("stale_after_days" integer DEFAULT 7) RETURNS TABLE("listing_id" "text", "listing_url" "text", "reason" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'geck_data', 'extensions'
    AS $$
    SELECT l.listing_id, l.listing_url,
        CASE
            WHEN l.description IS NULL THEN 'never_scraped_details'
            ELSE 'stale'
        END AS reason
    FROM listings l
    WHERE l.is_active = TRUE
      AND (
          l.description IS NULL
          OR l.last_updated_at < NOW() - (stale_after_days || ' days')::INTERVAL
      );
$$;


ALTER FUNCTION "geck_data"."listings_needing_detail_scrape"("stale_after_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."listings_needing_image_download"() RETURNS TABLE("listing_id" "text", "primary_image_url" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'geck_data', 'extensions'
    AS $$
    SELECT l.listing_id, l.primary_image_url
    FROM listings l
    WHERE l.is_active = TRUE
      AND l.primary_image_url IS NOT NULL
      AND l.primary_image_url LIKE 'https://%cloudfront%';
$$;


ALTER FUNCTION "geck_data"."listings_needing_image_download"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."mark_unseen_listings_inactive"("target_run_id" bigint) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'geck_data', 'extensions'
    AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE listings
    SET is_active = FALSE,
        sold_at = NOW()
    WHERE is_active = TRUE
      AND last_seen_at < (
          SELECT started_at FROM scrape_runs WHERE id = target_run_id
      );
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;


ALTER FUNCTION "geck_data"."mark_unseen_listings_inactive"("target_run_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."market_coverage"("fresh_hours" integer DEFAULT 48) RETURNS TABLE("total_live" bigint, "fresh_live" bigint, "stale_live" bigint, "coverage_pct" numeric, "newest_observation_at" timestamp with time zone, "observation_age_hours" numeric, "last_complete_pass_at" timestamp with time zone, "observed_days_30" bigint, "observed_days_90" bigint, "newest_sold_at" timestamp with time zone, "sold_age_days" numeric, "captured_sold_events" bigint, "inferred_sold_records" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  with cutoff as (
    select timezone('UTC', now())
      - make_interval(hours => least(greatest(coalesce(fresh_hours, 48), 1), 8760)) as fresh_since
  ),
  live as (
    select ml.last_seen_at, (ml.last_seen_at >= c.fresh_since) as is_fresh
    from geck_data.market_listings ml, cutoff c
    where ml.current_status = 'live'
      and ml.species in ('crested', 'unknown')
  ),
  agg as (
    select
      count(*)::bigint                          as total_live,
      count(*) filter (where is_fresh)::bigint  as fresh_live,
      count(*) filter (where not is_fresh)::bigint as stale_live,
      max(last_seen_at)                         as newest_observation_at
    from live
  ),
  runs as (
    select max(started_at) as last_complete_pass_at
    from geck_data.scrape_runs
    where status = 'success' and scrape_type = 'listings'
  ),
  days as (
    select
      count(distinct ph.observed_at::date) filter (
        where ph.observed_at >= timezone('UTC', now()) - interval '30 days')::bigint as observed_days_30,
      count(distinct ph.observed_at::date) filter (
        where ph.observed_at >= timezone('UTC', now()) - interval '90 days')::bigint as observed_days_90
    from geck_data.price_history ph
    where ph.observed_at >= timezone('UTC', now()) - interval '90 days'
  ),
  sold as (
    select
      (select max(observed_at) from geck_data.listing_status_events where status = 'sold') as newest_event_at,
      (select count(*) from geck_data.listing_status_events where status = 'sold')::bigint as captured_sold_events,
      (select count(*) from geck_data.listings where sold_at is not null)::bigint          as inferred_sold_records,
      (select max(sold_at) from geck_data.listings)                                        as newest_inferred_at
  )
  select
    a.total_live,
    a.fresh_live,
    a.stale_live,
    case when a.total_live = 0 then null
         else round(a.fresh_live::numeric * 100 / a.total_live, 1) end as coverage_pct,
    a.newest_observation_at,
    case when a.newest_observation_at is null then null
         else round(extract(epoch from (timezone('UTC', now()) - a.newest_observation_at)) / 3600.0, 1)
    end as observation_age_hours,
    r.last_complete_pass_at,
    d.observed_days_30,
    d.observed_days_90,
    greatest(s.newest_event_at, s.newest_inferred_at) as newest_sold_at,
    case when greatest(s.newest_event_at, s.newest_inferred_at) is null then null
         else round(extract(epoch from (timezone('UTC', now()) - greatest(s.newest_event_at, s.newest_inferred_at))) / 86400.0, 1)
    end as sold_age_days,
    s.captured_sold_events,
    s.inferred_sold_records
  from agg a, runs r, days d, sold s;
$$;


ALTER FUNCTION "geck_data"."market_coverage"("fresh_hours" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "geck_data"."market_coverage"("fresh_hours" integer) IS 'Feed health as coverage, not recency: how much of the live catalog the newest pass re-observed, how old the newest observation and newest sale are, and how many days were observed in the last 30/90. Backs the stale banner and the header status so they cannot disagree.';



CREATE OR REPLACE FUNCTION "geck_data"."market_price_summary"("fresh_hours" integer DEFAULT 48) RETURNS TABLE("fresh_listings" bigint, "stale_listings" bigint, "fresh_median_ask" numeric, "fresh_p25_ask" numeric, "fresh_p75_ask" numeric, "stale_median_ask" numeric, "newest_seen_at" timestamp with time zone, "oldest_stale_seen_at" timestamp with time zone, "sellers" bigint, "group_lots_excluded" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  with cutoff as (
    select timezone('UTC', now())
      - make_interval(hours => least(greatest(coalesce(fresh_hours, 48), 1), 8760)) as fresh_since
  ),
  live as (
    select ml.*, (ml.last_seen_at >= c.fresh_since) as is_fresh
    from geck_data.market_listings ml, cutoff c
    where ml.current_status = 'live'
      and ml.species in ('crested', 'unknown')
  ),
  priced as (
    select * from live
    where price_usd_equivalent is not null
      and price_usd_equivalent > 0
      and price_usd_equivalent < 100000
      and not is_group_lot
  )
  select
    (select count(*) from live where is_fresh)::bigint,
    (select count(*) from live where not is_fresh)::bigint,
    (select round(percentile_cont(0.5) within group (order by price_usd_equivalent)::numeric, 2) from priced where is_fresh),
    (select round(percentile_cont(0.25) within group (order by price_usd_equivalent)::numeric, 2) from priced where is_fresh),
    (select round(percentile_cont(0.75) within group (order by price_usd_equivalent)::numeric, 2) from priced where is_fresh),
    (select round(percentile_cont(0.5) within group (order by price_usd_equivalent)::numeric, 2) from priced where not is_fresh),
    (select max(last_seen_at) from live),
    (select min(last_seen_at) from live where not is_fresh),
    (select count(distinct seller_id) from live where seller_id is not null)::bigint,
    (select count(*) from live where is_group_lot)::bigint;
$$;


ALTER FUNCTION "geck_data"."market_price_summary"("fresh_hours" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "geck_data"."market_price_summary"("fresh_hours" integer) IS 'Landing KPIs with fresh and stale live listings kept apart. A median over the blended population describes a market that no longer exists.';



CREATE OR REPLACE FUNCTION "geck_data"."normalize_trait_name"("raw" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'geck_data', 'extensions'
    AS $$
  select nullif(
    regexp_replace(lower(btrim(coalesce(raw, ''))), '\s+', ' ', 'g'),
    ''
  );
$$;


ALTER FUNCTION "geck_data"."normalize_trait_name"("raw" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."observation_span"() RETURNS TABLE("first_observed_at" timestamp with time zone, "last_observed_at" timestamp with time zone, "observed_days" integer, "span_days" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select
    min(ph.observed_at),
    max(ph.observed_at),
    count(distinct ph.observed_at::date)::integer,
    case
      when min(ph.observed_at) is null then 0
      else (max(ph.observed_at)::date - min(ph.observed_at)::date)::integer
    end
  from geck_data.price_history ph;
$$;


ALTER FUNCTION "geck_data"."observation_span"() OWNER TO "postgres";


COMMENT ON FUNCTION "geck_data"."observation_span"() IS 'Oldest and newest price observation, the number of distinct days carrying one, and the calendar span between the ends. Used to disable timeframe options longer than the archive can distinguish. Deliberately reads price_history rather than listing dates: a listing advertised in 2023 is not evidence this warehouse watched anything in 2023.';



CREATE OR REPLACE FUNCTION "geck_data"."prune_ingest_audit"("p_keep_days" integer DEFAULT 90) RETURNS integer
    LANGUAGE "sql"
    SET "search_path" TO 'pg_catalog', 'geck_data', 'extensions'
    AS $$
  with deleted as (
    delete from geck_data.ingest_audit
     where received_at < now() - (p_keep_days::text || ' days')::interval
     returning 1
  )
  select count(*)::int from deleted;
$$;


ALTER FUNCTION "geck_data"."prune_ingest_audit"("p_keep_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."refresh_combo_index_daily"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'geck_data', 'extensions'
    AS $$
  refresh materialized view concurrently geck_data.combo_index_daily;
$$;


ALTER FUNCTION "geck_data"."refresh_combo_index_daily"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."region_of"("p_loc" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO 'geck_data'
    AS $_$
  select case
    when p_loc is null then null

    -- Direct country matches
    when p_loc ~* '\mUSA\M|\munited states\M|\mU\.S\.|\mUS\M' then 'US'
    when p_loc ~* '\mCA\M|\mcanada\M|\bca$|ontario|quebec|alberta|british columbia' then 'CA'
    when p_loc ~* '\muk\M|united kingdom|england|scotland|wales|northern ireland' then 'UK'
    when p_loc ~* '\mAU\M|\maustralia\M|new south wales|victoria|queensland|tasmania' then 'AU'
    when p_loc ~* '\mJP\M|\mjapan\M|tokyo|osaka|kyoto|hokkaido' then 'JP'
    when p_loc ~* '\mSE\M|sweden|stockholm|gothenburg' then 'SE'
    when p_loc ~* 'singapore|malaysia|thailand|indonesia|vietnam|philippines|kuala lumpur|bangkok|jakarta|manila' then 'SEA'

    -- European fall-through
    when p_loc ~* 'germany|france|netherlands|belgium|italy|spain|austria|switzerland|poland|czech|greece|portugal|ireland|finland|norway|denmark|eu' then 'EU'

    -- US state abbreviations in brackets (common MorphMarket format)
    when p_loc ~* ',\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\M' then 'US'

    else null
  end;
$_$;


ALTER FUNCTION "geck_data"."region_of"("p_loc" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."runtime_config_audit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'geck_data', 'extensions'
    AS $$
begin
  if (tg_op = 'INSERT') then
    insert into geck_data.runtime_config_history (key, old_value, new_value, changed_by)
    values (new.key, null, new.value, new.updated_by);
    return new;
  elsif (tg_op = 'UPDATE') then
    if old.value is distinct from new.value then
      insert into geck_data.runtime_config_history (key, old_value, new_value, changed_by)
      values (new.key, old.value, new.value, new.updated_by);
    end if;
    return new;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "geck_data"."runtime_config_audit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."sold_activity_weekly"("p_weeks" integer DEFAULT 26) RETURNS TABLE("week_start" "date", "sold_count" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  with bounds as (
    select
      date_trunc('week', timezone('UTC', now()))
        - make_interval(weeks => least(greatest(coalesce(p_weeks, 26), 1), 104) - 1)
        as starts_at
  )
  select
    date_trunc('week', timezone('UTC', events.observed_at))::date as week_start,
    count(*)::bigint as sold_count
  from geck_data.listing_status_events as events
  cross join bounds
  where events.status = 'sold'
    and events.observed_at >= bounds.starts_at at time zone 'UTC'
  group by 1
  order by 1;
$$;


ALTER FUNCTION "geck_data"."sold_activity_weekly"("p_weeks" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "geck_data"."sold_activity_weekly"("p_weeks" integer) IS 'Weekly sold-event counts for the public cumulative-sales chart; bounded to 1-104 weeks.';



CREATE OR REPLACE FUNCTION "geck_data"."sold_price_band"("p_traits" "text"[], "p_lookback_days" integer DEFAULT 180, "p_include_inferred" boolean DEFAULT true) RETURNS TABLE("n" bigint, "n_captured" bigint, "n_inferred" bigint, "p10" numeric, "p25" numeric, "p50" numeric, "p75" numeric, "p90" numeric, "mean_usd" numeric, "newest_sold_at" timestamp with time zone, "oldest_sold_at" timestamp with time zone, "n_sellers" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $_$
  with matched as (
    select
      s.price_usd_equivalent as price_usd,
      s.sold_basis,
      s.sold_at,
      s.seller_id
    from geck_data.v_sold_reconciled s
    where s.sold_at >= timezone('UTC', now())
      - make_interval(days => least(greatest(coalesce(p_lookback_days, 180), 1), 1825))
      and not s.is_group_lot
      and s.price_usd_equivalent is not null
      and s.price_usd_equivalent > 0
      and s.price_usd_equivalent < 100000
      and (p_include_inferred or s.sold_basis = 'captured_event')
      and (
        p_traits is null
        or cardinality(p_traits) = 0
        or not exists (
          select 1 from unnest(p_traits) t
          where coalesce(s.cached_traits, '') !~* ('(^|[|,;/ ])' || t || '($|[|,;/ ])')
        )
      )
  )
  select
    count(*)::bigint,
    count(*) filter (where sold_basis = 'captured_event')::bigint,
    count(*) filter (where sold_basis = 'inferred_unseen')::bigint,
    round(percentile_cont(0.10) within group (order by price_usd)::numeric, 2),
    round(percentile_cont(0.25) within group (order by price_usd)::numeric, 2),
    round(percentile_cont(0.50) within group (order by price_usd)::numeric, 2),
    round(percentile_cont(0.75) within group (order by price_usd)::numeric, 2),
    round(percentile_cont(0.90) within group (order by price_usd)::numeric, 2),
    round(avg(price_usd)::numeric, 2),
    max(sold_at),
    min(sold_at),
    count(distinct seller_id)::bigint
  from matched;
$_$;


ALTER FUNCTION "geck_data"."sold_price_band"("p_traits" "text"[], "p_lookback_days" integer, "p_include_inferred" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "geck_data"."sold_price_band"("p_traits" "text"[], "p_lookback_days" integer, "p_include_inferred" boolean) IS 'Price band across BOTH sold pools for listings carrying every requested trait. Returns captured and inferred counts separately, plus the date range and seller breadth, so the caller can disclose what the band rests on. Prices are last observed asks, not negotiated sale prices. Group lots excluded.';



CREATE OR REPLACE FUNCTION "geck_data"."touch_listing_seen"("p_id" "text", "p_observed" timestamp with time zone) RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'pg_catalog', 'geck_data', 'extensions'
    AS $$
  update geck_data.market_listings set
    first_seen_at = least(coalesce(first_seen_at, p_observed), p_observed),
    last_seen_at  = greatest(coalesce(last_seen_at,  p_observed), p_observed),
    current_status = case
      when current_status in ('sold','removed') then current_status
      else 'live'
    end
  where id = p_id;
$$;


ALTER FUNCTION "geck_data"."touch_listing_seen"("p_id" "text", "p_observed" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."trends_arrivals_weekly"("window_days" integer DEFAULT 90) RETURNS TABLE("week_start" "date", "arrivals" bigint, "arrivals_dated" bigint, "observed_days" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  with bounds as (
    select
      date_trunc('week', timezone('UTC', now())
        - make_interval(days => least(greatest(coalesce(window_days, 90), 1), 730)))::date as from_week,
      date_trunc('week', timezone('UTC', now()))::date as to_week
  ),
  weeks as (
    select generate_series(b.from_week, b.to_week, interval '1 week')::date as week_start
    from bounds b
  ),
  arrivals as (
    select date_trunc('week', coalesce(ml.first_listed_at, ml.first_seen_at))::date as week_start,
           count(*)::bigint as arrivals,
           count(*) filter (where ml.first_listed_at is not null)::bigint as arrivals_dated
    from geck_data.market_listings ml, bounds b
    where coalesce(ml.first_listed_at, ml.first_seen_at) >= b.from_week
      and ml.species in ('crested', 'unknown')
    group by 1
  ),
  cover as (
    select date_trunc('week', ph.observed_at)::date as week_start,
           count(distinct ph.observed_at::date)::bigint as observed_days
    from geck_data.price_history ph, bounds b
    where ph.observed_at >= b.from_week
    group by 1
  )
  select
    wk.week_start,
    coalesce(a.arrivals, 0)::bigint,
    coalesce(a.arrivals_dated, 0)::bigint,
    coalesce(c.observed_days, 0)::bigint
  from weeks wk
  left join arrivals a on a.week_start = wk.week_start
  left join cover c on c.week_start = wk.week_start
  order by wk.week_start;
$$;


ALTER FUNCTION "geck_data"."trends_arrivals_weekly"("window_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "geck_data"."trends_arrivals_weekly"("window_days" integer) IS 'New listings per week bucketed on first_listed_at when present (real MorphMarket listing date), else first_seen_at. observed_days lets the UI tell an empty market apart from a dead feed.';



CREATE OR REPLACE FUNCTION "geck_data"."trends_maturity_mix"("window_days" integer DEFAULT 90) RETURNS TABLE("maturity" "text", "n_listings" bigint, "median_price" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  with bounds as (
    select timezone('UTC', now())
      - make_interval(days => least(greatest(coalesce(window_days, 90), 1), 730)) as since
  )
  select
    coalesce(nullif(trim(ml.maturity), ''), 'unreported') as maturity,
    count(*)::bigint as n_listings,
    round(percentile_cont(0.5) within group (order by ml.price_usd_equivalent)::numeric, 2) as median_price
  from geck_data.market_listings ml, bounds b
  where coalesce(ml.first_listed_at, ml.first_seen_at) >= b.since
    and ml.species in ('crested', 'unknown')
    and not ml.is_group_lot
    and ml.price_usd_equivalent is not null
    and ml.price_usd_equivalent > 0
    and ml.price_usd_equivalent < 100000
  group by 1
  order by count(*) desc;
$$;


ALTER FUNCTION "geck_data"."trends_maturity_mix"("window_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "geck_data"."trends_maturity_mix"("window_days" integer) IS 'Maturity distribution for listings that ARRIVED inside the window, not the whole live catalog. "unreported" is its own bucket because only ~12% of rows carry maturity.';



CREATE OR REPLACE FUNCTION "geck_data"."trends_weekly_prices"("window_days" integer DEFAULT 90) RETURNS TABLE("week_start" "date", "median_price" numeric, "p25_price" numeric, "p75_price" numeric, "n_listings" bigint, "n_observations" bigint, "observed_days" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  with bounds as (
    select
      date_trunc('week', timezone('UTC', now())
        - make_interval(days => least(greatest(coalesce(window_days, 90), 1), 730)))::date as from_week,
      date_trunc('week', timezone('UTC', now()))::date as to_week
  ),
  weeks as (
    select generate_series(b.from_week, b.to_week, interval '1 week')::date as week_start
    from bounds b
  ),
  obs as (
    select w.week_start, w.listing_id, w.price, w.observed_day
    from geck_data.v_listing_week_price w, bounds b
    where w.week_start >= b.from_week
  ),
  raw as (
    select date_trunc('week', ph.observed_at)::date as week_start,
           count(*)::bigint as n_observations,
           count(distinct ph.observed_at::date)::bigint as observed_days
    from geck_data.price_history ph, bounds b
    where ph.observed_at >= b.from_week
    group by 1
  )
  select
    wk.week_start,
    round(percentile_cont(0.5) within group (order by o.price)::numeric, 2) as median_price,
    round(percentile_cont(0.25) within group (order by o.price)::numeric, 2) as p25_price,
    round(percentile_cont(0.75) within group (order by o.price)::numeric, 2) as p75_price,
    count(o.listing_id)::bigint as n_listings,
    coalesce(max(r.n_observations), 0)::bigint as n_observations,
    coalesce(max(r.observed_days), 0)::bigint as observed_days
  from weeks wk
  left join obs o on o.week_start = wk.week_start
  left join raw r on r.week_start = wk.week_start
  group by wk.week_start
  order by wk.week_start;
$$;


ALTER FUNCTION "geck_data"."trends_weekly_prices"("window_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "geck_data"."trends_weekly_prices"("window_days" integer) IS 'Weekly median/p25/p75 USD ask, one observation per listing per week, single animals only. Emits every week in the window; observed_days = 0 marks an outage week whose metrics are null.';



CREATE OR REPLACE FUNCTION "geck_data"."v_breeder_concentration"("top_n" integer DEFAULT 12) RETURNS json
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  with attributed as (
    select seller_id, seller_name
    from geck_data.market_listings
    where current_status = 'live' and seller_id is not null
  ),
  tally as (
    select seller_id, max(seller_name) as name, count(*) as listings
    from attributed
    group by seller_id
  ),
  tot as (
    select
      (select count(*) from attributed) as total_attributed,
      (select count(*) from tally)      as seller_count,
      (select count(*) from geck_data.market_listings where current_status = 'live')
        as live_total
  ),
  ranked as (
    select
      seller_id,
      coalesce(name, seller_id) as name,
      listings,
      round(100.0 * listings / nullif((select total_attributed from tot), 0), 1)
        as share_pct
    from tally
    order by listings desc
  )
  select json_build_object(
    'rows', coalesce(
      (select json_agg(json_build_object(
          'id', seller_id,
          'name', name,
          'listings', listings,
          'sharePct', share_pct))
       from (select * from ranked limit greatest(coalesce(top_n, 12), 1)) r),
      '[]'::json),
    'totalAttributed', (select total_attributed from tot),
    'sellerCount',     (select seller_count from tot),
    'liveTotal',       (select live_total from tot),
    'top10Pct', coalesce(
      (select round(sum(share_pct), 1)
       from (select share_pct from ranked limit 10) t), 0)
  );
$$;


ALTER FUNCTION "geck_data"."v_breeder_concentration"("top_n" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."v_combo_profitability"("p_window_days" integer DEFAULT 90, "p_min_top_trait_n" integer DEFAULT 25, "p_min_pair_listings" integer DEFAULT 20, "p_min_sold_count" integer DEFAULT 3) RETURNS TABLE("combo_name" "text", "combo_source" "text", "sold_count" integer, "live_count" integer, "median_sold" numeric, "median_ask" numeric, "sell_through_rate" numeric, "effective_price" numeric, "score" numeric, "confidence" integer, "combo_rank" integer, "is_incidental" boolean, "primary_token" "text")
    LANGUAGE "sql" STABLE PARALLEL SAFE
    SET "search_path" TO 'geck_data'
    AS $$
with
listing_tokens as (
  select
    l.id,
    l.price_usd_equivalent,
    l.current_status,
    lower(trim(both ' ' from tok)) as token
  from geck_data.market_listings l,
       lateral regexp_split_to_table(
         coalesce(l.cached_traits, replace(coalesce(l.norm_traits, ''), ',', '|')),
         '\s*[|,]\s*'
       ) as tok
  where l.price_usd_equivalent is not null
    and l.price_usd_equivalent between 50 and 10000
    and tok is not null
    and lower(trim(both ' ' from tok)) <> ''
    and length(trim(both ' ' from tok)) >= 3
    and position(':' in tok) = 0
),
sold_events as (
  select distinct lse.listing_id
  from geck_data.listing_status_events lse
  where lse.status = 'sold'
    and lse.observed_at >= now() - make_interval(days => p_window_days)
),
in_window_listings as (
  select id from geck_data.market_listings
  where first_seen_at >= now() - make_interval(days => p_window_days)
),
anchor_classified as (
  select
    c.combo_name,
    'anchor'::text as combo_source,
    l.id,
    l.price_usd_equivalent,
    case when se.listing_id is not null then 'sold' else l.current_status end as effective_status
  from geck_data.combo_catalog c
  cross join lateral (
    select id, price_usd_equivalent, current_status, cached_traits, norm_traits
    from geck_data.market_listings
    where price_usd_equivalent is not null
      and price_usd_equivalent between 50 and 10000
      and (
        select bool_and(
          position(token in lower(coalesce(cached_traits, '') || ' ' || coalesce(norm_traits, ''))) > 0
        )
        from unnest(c.tokens) as token
      )
  ) l
  left join sold_events se on se.listing_id = l.id
  where l.id in (select id from in_window_listings)
     or se.listing_id is not null
),
anchor_rollup as (
  select
    combo_name,
    combo_source,
    count(*) filter (where effective_status = 'sold')::int as sold_count,
    count(*) filter (where effective_status = 'live')::int as live_count,
    percentile_cont(0.5) within group (order by price_usd_equivalent)
      filter (where effective_status = 'sold') as median_sold,
    percentile_cont(0.5) within group (order by price_usd_equivalent)
      filter (where effective_status = 'live') as median_ask,
    -- Anchor combo_rank = sum of tiers of its tokens, clamped to the
    -- same 2..6 range pairs use so they sort together.
    least(6, greatest(2,
      (select coalesce(sum(coalesce(tt.tier, 3)), 6)::int
       from geck_data.combo_catalog cc
       cross join lateral unnest(cc.tokens) as token
       left join geck_data.trait_tiers tt on tt.trait_token = token
       where cc.combo_name = anchor_classified.combo_name
       limit 1
      )
    )) as combo_rank,
    false as is_incidental,
    null::text as primary_token
  from anchor_classified
  group by combo_name, combo_source
),
top_traits as (
  select token, count(*) as n
  from listing_tokens
  group by token
  having count(*) >= p_min_top_trait_n
),
listing_pairs as (
  select
    t1.id,
    t1.price_usd_equivalent,
    case when se.listing_id is not null then 'sold' else t1.current_status end as effective_status,
    -- Primary token = lower tier (more value-driving). Tie-break on
    -- alphabetic so the same pair always renders with the same name.
    case
      when coalesce(tier1.tier, 3) < coalesce(tier2.tier, 3) then t1.token
      when coalesce(tier1.tier, 3) > coalesce(tier2.tier, 3) then t2.token
      else least(t1.token, t2.token)
    end as primary_token,
    case
      when coalesce(tier1.tier, 3) < coalesce(tier2.tier, 3) then t2.token
      when coalesce(tier1.tier, 3) > coalesce(tier2.tier, 3) then t1.token
      else greatest(t1.token, t2.token)
    end as secondary_token,
    coalesce(tier1.tier, 3) + coalesce(tier2.tier, 3) as combo_rank,
    (coalesce(tier1.tier, 3) = 3 and coalesce(tier2.tier, 3) = 3) as is_incidental
  from listing_tokens t1
  join listing_tokens t2 on t1.id = t2.id and t1.token < t2.token
  join top_traits ta on ta.token = t1.token
  join top_traits tb on tb.token = t2.token
  left join geck_data.trait_tiers tier1 on tier1.trait_token = t1.token
  left join geck_data.trait_tiers tier2 on tier2.trait_token = t2.token
  left join sold_events se on se.listing_id = t1.id
  where t1.id in (select id from in_window_listings)
     or se.listing_id is not null
),
pair_rollup as (
  select
    coalesce(td_primary.display_name, initcap(primary_token))
      || ' × '
      || coalesce(td_secondary.display_name, initcap(secondary_token)) as combo_name,
    'discovered'::text as combo_source,
    count(*) filter (where effective_status = 'sold')::int as sold_count,
    count(*) filter (where effective_status = 'live')::int as live_count,
    percentile_cont(0.5) within group (order by price_usd_equivalent)
      filter (where effective_status = 'sold') as median_sold,
    percentile_cont(0.5) within group (order by price_usd_equivalent)
      filter (where effective_status = 'live') as median_ask,
    min(combo_rank)::int as combo_rank,
    bool_and(is_incidental) as is_incidental,
    primary_token
  from listing_pairs
  left join geck_data.trait_tiers td_primary on td_primary.trait_token = primary_token
  left join geck_data.trait_tiers td_secondary on td_secondary.trait_token = secondary_token
  group by primary_token, secondary_token, td_primary.display_name, td_secondary.display_name
  having count(*) >= p_min_pair_listings
),
anchor_keyed as (
  select
    ar.*,
    (select string_agg(trim(both ' ' from t), '|' order by trim(both ' ' from t))
     from regexp_split_to_table(lower(ar.combo_name), '×') as t) as dedup_key
  from anchor_rollup ar
),
pair_keyed as (
  select
    pr.*,
    (select string_agg(trim(both ' ' from t), '|' order by trim(both ' ' from t))
     from regexp_split_to_table(lower(pr.combo_name), '×') as t) as dedup_key
  from pair_rollup pr
),
combined as (
  select combo_name, combo_source, sold_count, live_count, median_sold, median_ask,
         combo_rank, is_incidental, primary_token
  from anchor_keyed
  union all
  select combo_name, combo_source, sold_count, live_count, median_sold, median_ask,
         combo_rank, is_incidental, primary_token
  from pair_keyed
  where dedup_key not in (select dedup_key from anchor_keyed)
)
select
  c.combo_name,
  c.combo_source,
  c.sold_count,
  c.live_count,
  round(c.median_sold::numeric, 0)              as median_sold,
  round(c.median_ask::numeric, 0)               as median_ask,
  round(
    (case when (c.sold_count + c.live_count) = 0 then 0
          else c.sold_count::numeric / (c.sold_count + c.live_count)
     end)::numeric,
    4
  ) as sell_through_rate,
  round(
    (coalesce(c.median_sold, c.median_ask * 0.8))::numeric,
    0
  ) as effective_price,
  round(
    (coalesce(c.median_sold, c.median_ask * 0.8)
     * (case when (c.sold_count + c.live_count) = 0 then 0
             else c.sold_count::numeric / (c.sold_count + c.live_count)
        end)
    )::numeric,
    2
  ) as score,
  least(99,
    greatest(1,
      round((10 + c.sold_count * 4 + c.live_count * 0.4)::numeric)
    )
  )::int as confidence,
  c.combo_rank,
  c.is_incidental,
  c.primary_token
from combined c
where c.sold_count >= p_min_sold_count;
$$;


ALTER FUNCTION "geck_data"."v_combo_profitability"("p_window_days" integer, "p_min_top_trait_n" integer, "p_min_pair_listings" integer, "p_min_sold_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."v_combo_rollups"("window_days" integer) RETURNS TABLE("combo_name" "text", "sold_count" integer, "live_count" integer, "median_sold" numeric, "median_ask" numeric, "spread_pct" numeric, "avg_days_to_sell" numeric, "confidence_score" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  with bounds as (
    select timezone('UTC', now())
      - make_interval(days => least(greatest(coalesce(window_days, 365), 1), 1825)) as window_since
  ),
  live_lt as (
    select
      ml.id,
      ml.price_usd_equivalent as price,
      array_agg(distinct trim(both ' ' from t.t))
        filter (where length(trim(both ' ' from t.t)) between 2 and 60) as traits
    from geck_data.market_listings ml,
         lateral unnest(string_to_array(ml.cached_traits, ',')) t(t)
    where ml.cached_traits is not null
      and ml.species in ('crested', 'unknown')
      and not ml.is_group_lot
      and ml.current_status = 'live'
      and ml.price_usd_equivalent is not null
      and ml.price_usd_equivalent > 0
      and ml.price_usd_equivalent < 100000
    group by ml.id, ml.price_usd_equivalent
  ),
  live_pairs as (
    select
      least(lt.traits[i.i], lt.traits[j.j])    as ta,
      greatest(lt.traits[i.i], lt.traits[j.j]) as tb,
      lt.price
    from live_lt lt,
         lateral generate_subscripts(lt.traits, 1) i(i),
         lateral generate_subscripts(lt.traits, 1) j(j)
    where i.i < j.j and array_length(lt.traits, 1) >= 2
  ),
  live_agg as (
    select ta, tb,
      count(*)::int as live_count,
      percentile_cont(0.5) within group (order by price) as median_ask
    from live_pairs group by ta, tb
  ),
  sold_lt as (
    select
      s.id,
      s.price_usd_equivalent as price,
      s.days_to_sell,
      array_agg(distinct trim(both ' ' from t.t))
        filter (where length(trim(both ' ' from t.t)) between 2 and 60) as traits
    from geck_data.v_sold_reconciled s
    cross join bounds b,
         lateral unnest(string_to_array(s.cached_traits, ',')) t(t)
    where s.cached_traits is not null
      and not s.is_group_lot
      and s.price_usd_equivalent is not null
      and s.price_usd_equivalent > 0
      and s.price_usd_equivalent < 100000
      and s.sold_at >= b.window_since
    group by s.id, s.price_usd_equivalent, s.days_to_sell
  ),
  sold_pairs as (
    select
      least(lt.traits[i.i], lt.traits[j.j])    as ta,
      greatest(lt.traits[i.i], lt.traits[j.j]) as tb,
      lt.price, lt.days_to_sell
    from sold_lt lt,
         lateral generate_subscripts(lt.traits, 1) i(i),
         lateral generate_subscripts(lt.traits, 1) j(j)
    where i.i < j.j and array_length(lt.traits, 1) >= 2
  ),
  sold_agg as (
    select ta, tb,
      count(*)::int as sold_count,
      percentile_cont(0.5) within group (order by price) as median_sold,
      avg(days_to_sell) as avg_days
    from sold_pairs group by ta, tb
  ),
  merged as (
    select
      coalesce(l.ta, s.ta) as ta,
      coalesce(l.tb, s.tb) as tb,
      coalesce(l.live_count, 0) as live_count,
      coalesce(s.sold_count, 0) as sold_count,
      l.median_ask, s.median_sold, s.avg_days
    from live_agg l
    full outer join sold_agg s on s.ta = l.ta and s.tb = l.tb
  )
  select
    (ta || ' x ' || tb) as combo_name,
    sold_count,
    live_count,
    round(median_sold::numeric, 2),
    round(median_ask::numeric, 2),
    case when median_sold is null or median_sold = 0 then null
         else round((((median_ask - median_sold) / median_sold) * 100)::numeric, 1) end,
    round(avg_days::numeric, 1),
    least(99, greatest(1, round((20 + sold_count * 2 + live_count * 0.5)::numeric)))::int
  from merged
  where not geck_data._traits_are_redundant(ta, tb)
    and (live_count >= 2 or sold_count >= 2)
  order by (live_count + sold_count) desc
  limit 600;
$$;


ALTER FUNCTION "geck_data"."v_combo_rollups"("window_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "geck_data"."v_combo_rollups"("window_days" integer) IS 'Per-combo live/sold rollup over auto-discovered trait pairs (every 2-trait combination in the catalogue), not the 12 curated combos combo_match knew. Sold side reads v_sold_reconciled. Redundant pairs and group lots excluded; depth-floored and capped at the 600 deepest combos to stay under the PostgREST response cap.';



CREATE OR REPLACE FUNCTION "geck_data"."v_combo_source_blend"("p_combo" "text", "window_days" integer) RETURNS TABLE("source" "text", "n" integer, "avg_price" numeric, "pct" numeric)
    LANGUAGE "sql" STABLE PARALLEL SAFE
    SET "search_path" TO 'geck_data'
    AS $$
with
classified as (
  select l.id
  from geck_data.market_listings l
  where combo_match(coalesce(l.norm_traits, l.cached_traits)) = p_combo
),
obs as (
  select
    coalesce(ph.source, 'gi_listings') as source,
    ph.price_usd_equivalent
  from geck_data.price_history ph
  join classified c on c.id = ph.listing_id
  where ph.observed_at >= now() - make_interval(days => window_days)
    and ph.price_usd_equivalent > 0
),
per_source as (
  select
    source,
    count(*)::int as n,
    avg(price_usd_equivalent) as avg_price
  from obs
  group by source
),
totals as (
  select sum(n)::numeric as total_n from per_source
)
select
  ps.source,
  ps.n,
  round(ps.avg_price::numeric, 2) as avg_price,
  case
    when t.total_n = 0 then 0::numeric
    else round(((ps.n::numeric / t.total_n) * 100)::numeric, 1)
  end as pct
from per_source ps
cross join totals t
order by ps.n desc;
$$;


ALTER FUNCTION "geck_data"."v_combo_source_blend"("p_combo" "text", "window_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."v_market_index"("window_days" integer) RETURNS TABLE("week_start" timestamp with time zone, "value" numeric, "combos_in" integer)
    LANGUAGE "sql" STABLE PARALLEL SAFE
    SET "search_path" TO 'public'
    AS $$
  with weekly as (
    -- One row per (week, anchor): the weekly median asking price for each of
    -- the four anchor morphs, straight from the sub-index source view.
    select week_start, anchor, median_price, n
    from geck_data.v_market_sub_index_weekly
    where week_start >= (current_date - make_interval(days => window_days))
      and median_price > 0
  ),
  per_week as (
    -- Basket level for the week = geometric mean of the anchor medians. The
    -- geometric mean keeps a single high-priced anchor from dominating the
    -- level the way an arithmetic mean would.
    select
      week_start,
      exp(avg(ln(median_price)))       as geo_avg,
      count(distinct anchor)::int      as combos_in
    from weekly
    group by week_start
  ),
  anchored as (
    -- Index the basket to 1,000 at the earliest week in view.
    select
      week_start,
      combos_in,
      (geo_avg / first_value(geo_avg) over (order by week_start)) * 1000 as value
    from per_week
  )
  select
    week_start::timestamptz,
    round(value::numeric, 1),
    combos_in
  from anchored
  order by week_start;
$$;


ALTER FUNCTION "geck_data"."v_market_index"("window_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "geck_data"."v_market_sub_index"("window_days" integer DEFAULT 365) RETURNS TABLE("anchor" "text", "week_start" "date", "value" numeric, "median_price" numeric, "n" bigint)
    LANGUAGE "sql" STABLE PARALLEL SAFE
    SET "search_path" TO 'geck_data'
    AS $$
  with windowed as (
    select anchor, week_start, median_price, n
    from geck_data.v_market_sub_index_weekly
    where week_start >= current_date - make_interval(days => window_days)
  ),
  anchored as (
    select
      anchor,
      week_start,
      median_price,
      n,
      first_value(median_price) over (
        partition by anchor order by week_start
        rows between unbounded preceding and unbounded following
      ) as base
    from windowed
  )
  select
    anchor,
    week_start,
    case when base is null or base = 0
         then null
         else round((median_price / base) * 1000, 1)
    end as value,
    round(median_price, 2) as median_price,
    n
  from anchored
  order by anchor, week_start;
$$;


ALTER FUNCTION "geck_data"."v_market_sub_index"("window_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "geck_data"."v_market_sub_index"("window_days" integer) IS 'Anchor sub-index rebased to 1000 at window start. Used by /indices and /market.';



CREATE OR REPLACE FUNCTION "geck_data"."v_regional_heatmap"("window_days" integer) RETURNS TABLE("combo_name" "text", "region" "text", "n" integer, "median_sold" numeric, "median_ask" numeric, "confidence_score" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  with bounds as (
    select timezone('UTC', now())
      - make_interval(days => least(greatest(coalesce(window_days, 365), 1), 1825)) as window_since
  ),
  live_lt as (
    select
      ml.id,
      geck_data.region_of(sel.seller_location) as region,
      ml.price_usd_equivalent as price,
      array_agg(distinct trim(both ' ' from t.t))
        filter (where length(trim(both ' ' from t.t)) between 2 and 60) as traits
    from geck_data.market_listings ml
    left join geck_data.market_sellers sel on sel.seller_id = ml.seller_id,
         lateral unnest(string_to_array(ml.cached_traits, ',')) t(t)
    where ml.cached_traits is not null
      and ml.species in ('crested', 'unknown')
      and not ml.is_group_lot
      and ml.current_status = 'live'
      and ml.price_usd_equivalent is not null
      and ml.price_usd_equivalent > 0
      and ml.price_usd_equivalent < 100000
      and geck_data.region_of(sel.seller_location) is not null
    group by ml.id, geck_data.region_of(sel.seller_location), ml.price_usd_equivalent
  ),
  live_pairs as (
    select
      least(lt.traits[i.i], lt.traits[j.j])    as ta,
      greatest(lt.traits[i.i], lt.traits[j.j]) as tb,
      lt.region, lt.price
    from live_lt lt,
         lateral generate_subscripts(lt.traits, 1) i(i),
         lateral generate_subscripts(lt.traits, 1) j(j)
    where i.i < j.j and array_length(lt.traits, 1) >= 2
  ),
  live_agg as (
    select ta, tb, region,
      count(*)::int as n,
      percentile_cont(0.5) within group (order by price) as median_ask
    from live_pairs group by ta, tb, region
  ),
  sold_lt as (
    select
      s.id,
      geck_data.region_of(sel.seller_location) as region,
      s.price_usd_equivalent as price,
      array_agg(distinct trim(both ' ' from t.t))
        filter (where length(trim(both ' ' from t.t)) between 2 and 60) as traits
    from geck_data.v_sold_reconciled s
    left join geck_data.market_sellers sel on sel.seller_id = s.seller_id
    cross join bounds b,
         lateral unnest(string_to_array(s.cached_traits, ',')) t(t)
    where s.cached_traits is not null
      and not s.is_group_lot
      and s.price_usd_equivalent is not null
      and s.price_usd_equivalent > 0
      and s.price_usd_equivalent < 100000
      and s.sold_at >= b.window_since
      and geck_data.region_of(sel.seller_location) is not null
    group by s.id, geck_data.region_of(sel.seller_location), s.price_usd_equivalent
  ),
  sold_pairs as (
    select
      least(lt.traits[i.i], lt.traits[j.j])    as ta,
      greatest(lt.traits[i.i], lt.traits[j.j]) as tb,
      lt.region, lt.price
    from sold_lt lt,
         lateral generate_subscripts(lt.traits, 1) i(i),
         lateral generate_subscripts(lt.traits, 1) j(j)
    where i.i < j.j and array_length(lt.traits, 1) >= 2
  ),
  sold_agg as (
    select ta, tb, region,
      percentile_cont(0.5) within group (order by price) as median_sold
    from sold_pairs group by ta, tb, region
  )
  select
    (la.ta || ' x ' || la.tb) as combo_name,
    la.region,
    la.n,
    round(sa.median_sold::numeric, 2),
    round(la.median_ask::numeric, 2),
    least(99, greatest(1, round((20 + la.n * 5)::numeric)))::int
  from live_agg la
  left join sold_agg sa
    on sa.ta = la.ta and sa.tb = la.tb and sa.region = la.region
  where not geck_data._traits_are_redundant(la.ta, la.tb)
    and la.n >= 2;
$$;


ALTER FUNCTION "geck_data"."v_regional_heatmap"("window_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "geck_data"."v_regional_heatmap"("window_days" integer) IS 'Per (auto-discovered combo, region) live/sold medians. Combos are every trait pair (not the 8 combo_match knew); region is region_of(seller_location), which resolves only the ~15% of listings with a mappable seller location (US/CA today); sold median reads v_sold_reconciled. Redundant pairs and group lots excluded, cells floored at 2 live listings.';



CREATE OR REPLACE FUNCTION "public"."_blog_touch_updated_date"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_date := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_blog_touch_updated_date"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collection_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "collection_id" "uuid" NOT NULL,
    "member_email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invite_token" "text",
    "invited_by_email" "text",
    "invited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_at" timestamp with time zone,
    "declined_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    CONSTRAINT "collection_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'editor'::"text", 'viewer'::"text"]))),
    CONSTRAINT "collection_members_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."collection_members" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_collection_invite"("token" "text") RETURNS "public"."collection_members"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."accept_collection_invite"("token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_tasks_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_date := now();
  if new.status = 'done' and old.status <> 'done' then
    new.completed_at := coalesce(new.completed_at, now());
  end if;
  if new.status <> 'done' and old.status = 'done' then
    new.completed_at := null;
    new.completed_by := null;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."admin_tasks_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_verify_gecko_image"("p_image_id" "text", "p_primary_morph" "text", "p_secondary_traits" "text"[] DEFAULT NULL::"text"[], "p_genetic_traits" "text"[] DEFAULT NULL::"text"[], "p_base_color" "text" DEFAULT NULL::"text", "p_pattern_intensity" "text" DEFAULT NULL::"text", "p_white_amount" "text" DEFAULT NULL::"text", "p_fired_state" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_email TEXT := auth.jwt() ->> 'email';
  v_role  TEXT;
  v_edits JSONB;
  v_secondary_jsonb JSONB := to_jsonb(COALESCE(p_secondary_traits, '{}'::text[]));
  v_genetic_jsonb JSONB := CASE
    WHEN p_genetic_traits IS NULL THEN NULL
    ELSE to_jsonb(p_genetic_traits)
  END;
BEGIN
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT role INTO v_role FROM profiles WHERE email = v_email;
  IF v_role <> 'admin' THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  IF p_primary_morph IS NULL OR p_primary_morph = '' THEN
    RAISE EXCEPTION 'primary_morph is required';
  END IF;

  v_edits := jsonb_build_object(
    'genetic_traits',    COALESCE(p_genetic_traits,    '{}'::text[]),
    'base_color',        p_base_color,
    'pattern_intensity', p_pattern_intensity,
    'white_amount',      p_white_amount,
    'fired_state',       p_fired_state,
    'verified_via',      'admin_verify'
  );

  INSERT INTO classification_votes (
    gecko_image_id, reviewer_email, verdict,
    primary_morph, secondary_traits, edits, notes
  ) VALUES (
    p_image_id, v_email, 'approve',
    p_primary_morph, v_secondary_jsonb, v_edits, p_notes
  )
  ON CONFLICT (gecko_image_id, reviewer_email) DO UPDATE
    SET verdict          = 'approve',
        primary_morph    = EXCLUDED.primary_morph,
        secondary_traits = EXCLUDED.secondary_traits,
        edits            = EXCLUDED.edits,
        notes            = EXCLUDED.notes,
        created_date     = now();

  INSERT INTO classification_votes (
    gecko_image_id, reviewer_email, verdict,
    primary_morph, secondary_traits, edits, notes
  ) VALUES (
    p_image_id, '__admin_consensus__', 'approve',
    p_primary_morph, v_secondary_jsonb, v_edits,
    'auto-vote from admin_verify_gecko_image by ' || v_email
  )
  ON CONFLICT (gecko_image_id, reviewer_email) DO UPDATE
    SET verdict          = 'approve',
        primary_morph    = EXCLUDED.primary_morph,
        secondary_traits = EXCLUDED.secondary_traits,
        edits            = EXCLUDED.edits,
        notes            = EXCLUDED.notes,
        created_date     = now();

  UPDATE gecko_images
    SET verified          = TRUE,
        primary_morph     = p_primary_morph,
        secondary_traits  = CASE
          WHEN p_secondary_traits IS NULL THEN secondary_traits
          ELSE v_secondary_jsonb
        END,
        base_color        = COALESCE(p_base_color, base_color),
        pattern_intensity = COALESCE(p_pattern_intensity, pattern_intensity),
        white_amount      = COALESCE(p_white_amount, white_amount),
        fired_state       = COALESCE(p_fired_state, fired_state),
        training_meta = COALESCE(training_meta, '{}'::jsonb)
          || jsonb_build_object(
            'genetic_traits',
            COALESCE(v_genetic_jsonb, training_meta -> 'genetic_traits'),
            'verified_via', 'admin_verify',
            'verified_by',  v_email
          ),
        updated_date      = now()
    WHERE id = p_image_id;

  RETURN jsonb_build_object(
    'image_id', p_image_id,
    'verdict',  'approve',
    'verified', true,
    'fast_path', true
  );
END;
$$;


ALTER FUNCTION "public"."admin_verify_gecko_image"("p_image_id" "text", "p_primary_morph" "text", "p_secondary_traits" "text"[], "p_genetic_traits" "text"[], "p_base_color" "text", "p_pattern_intensity" "text", "p_white_amount" "text", "p_fired_state" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_settings_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."app_settings_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_referral_code"("p_code" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_email text := auth.email();
  v_code text := lower(trim(coalesce(p_code, '')));
  v_current text;
  v_referrer_email text;
begin
  if v_email is null or v_code = '' then
    return false;
  end if;

  select referred_by into v_current
    from public.profiles
   where email = v_email
   limit 1;
  if not found then
    return false;
  end if;
  if v_current is not null then
    return false;
  end if;

  select email into v_referrer_email
    from public.profiles
   where referral_code = v_code
   limit 1;
  if v_referrer_email is null or lower(v_referrer_email) = lower(v_email) then
    return false;
  end if;

  perform set_config('geck.referral_bypass', 'on', true);
  update public.profiles
     set referred_by = v_code,
         updated_date = now()
   where email = v_email;
  return true;
end;
$$;


ALTER FUNCTION "public"."apply_referral_code"("p_code" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referral_rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "referrer_email" "text" NOT NULL,
    "referred_email" "text" NOT NULL,
    "referred_tier" "text",
    "referrer_tier_at_award" "text",
    "referrer_stripe_customer_id" "text",
    "reward_kind" "text" NOT NULL,
    "grant_until" timestamp with time zone,
    "amount_cents" integer,
    "currency" "text",
    "stripe_invoice_id" "text",
    "stripe_balance_transaction_id" "text",
    "applied_at" timestamp with time zone,
    "note" "text",
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "referral_rewards_reward_kind_check" CHECK (("reward_kind" = ANY (ARRAY['keeper_month'::"text", 'stripe_credit'::"text", 'needs_manual'::"text"])))
);


ALTER TABLE "public"."referral_rewards" OWNER TO "postgres";


COMMENT ON TABLE "public"."referral_rewards" IS 'One row per referred member who paid a first invoice. reward_kind says how the referrer was rewarded; applied_at is null until the reward is actually delivered.';



CREATE OR REPLACE FUNCTION "public"."award_referral_reward"("p_referred_email" "text", "p_referred_tier" "text", "p_stripe_invoice_id" "text") RETURNS "public"."referral_rewards"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_referred public.profiles%rowtype;
  v_referrer public.profiles%rowtype;
  v_reward public.referral_rewards%rowtype;
  v_kind text;
  v_until timestamptz;
  v_note text;
  v_content text;
  v_on_grant boolean;
begin
  if p_referred_email is null or p_referred_email = '' then
    return null;
  end if;

  select * into v_referred
    from public.profiles
   where lower(email) = lower(p_referred_email)
   limit 1;
  if not found or v_referred.referred_by is null then
    return null;
  end if;

  -- One reward per referred member, ever. A second paid invoice from the
  -- same member returns the row that already exists.
  select * into v_reward
    from public.referral_rewards
   where lower(referred_email) = lower(v_referred.email)
   limit 1;
  if found then
    return v_reward;
  end if;

  select * into v_referrer
    from public.profiles
   where referral_code = v_referred.referred_by
   limit 1;
  if not found or lower(v_referrer.email) = lower(v_referred.email) then
    return null;
  end if;

  perform set_config('geck.referral_bypass', 'on', true);

  v_on_grant := v_referrer.referral_grant_until is not null
                and v_referrer.referral_grant_until > now();

  if v_referrer.stripe_customer_id is not null
     and coalesce(v_referrer.subscription_status, '') in ('active', 'trialing', 'past_due') then
    v_kind := 'stripe_credit';
    v_note := 'stripe-webhook credits one month of the referrer''s plan to their Stripe customer balance.';
  elsif (coalesce(v_referrer.membership_tier, 'free') = 'free' or v_on_grant)
        and v_referrer.stripe_subscription_id is null
        and coalesce(v_referrer.subscription_status, '') not in ('active', 'trialing', 'grandfathered') then
    v_kind := 'keeper_month';
    v_until := greatest(coalesce(v_referrer.referral_grant_until, now()), now()) + interval '30 days';
    update public.profiles
       set membership_tier = 'keeper',
           referral_grant_until = v_until,
           updated_date = now()
     where email = v_referrer.email;
  else
    v_kind := 'needs_manual';
    v_note := 'Referrer is not on Stripe and not on the free tier (grandfathered, App Store, or lifetime). Settle by hand.';
  end if;

  update public.profiles
     set referral_signup_count = coalesce(referral_signup_count, 0) + 1,
         updated_date = now()
   where email = v_referrer.email;

  insert into public.referral_rewards (
    referrer_email, referred_email, referred_tier, referrer_tier_at_award,
    referrer_stripe_customer_id, reward_kind, grant_until, stripe_invoice_id,
    applied_at, note
  ) values (
    v_referrer.email, v_referred.email, p_referred_tier, v_referrer.membership_tier,
    v_referrer.stripe_customer_id, v_kind, v_until, p_stripe_invoice_id,
    case when v_kind = 'keeper_month' then now() else null end, v_note
  )
  returning * into v_reward;

  v_content := case v_kind
    when 'keeper_month' then
      format('A keeper you referred just started a paid plan. Your free month of Keeper is active until %s.',
             to_char(v_until, 'DD Mon YYYY'))
    when 'stripe_credit' then
      'A keeper you referred just started a paid plan. One month of your subscription has been credited to your next bill.'
    else
      'A keeper you referred just started a paid plan. We will apply your free month by hand and let you know.'
  end;

  insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
  values (
    v_referrer.email, 'referral_reward', v_content, '/Membership',
    jsonb_build_object('reward_id', v_reward.id, 'reward_kind', v_kind, 'source', 'stripe-webhook'),
    false, v_referrer.email
  );

  return v_reward;
end;
$$;


ALTER FUNCTION "public"."award_referral_reward"("p_referred_email" "text", "p_referred_tier" "text", "p_stripe_invoice_id" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_referral_bonuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "referrer_user_id" "uuid",
    "referrer_email" "text",
    "referred_user_id" "uuid",
    "referred_email" "text",
    "referrer_tier_at_award" "text",
    "referred_user_tier" "text" NOT NULL,
    "free_month_tier" "text",
    "free_month_applied_at" timestamp with time zone,
    "credits_granted" integer DEFAULT 0 NOT NULL,
    "stripe_invoice_id" "text",
    "source_event_type" "text" DEFAULT 'first_paid_invoice'::"text" NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."social_referral_bonuses" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_referral_signup_bonus"("p_referred_user_id" "uuid", "p_referred_email" "text", "p_referred_tier" "text", "p_stripe_invoice_id" "text") RETURNS "public"."social_referral_bonuses"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_referrer_user_id uuid;
  v_referrer_email text;
  v_referrer_tier text;
  v_free_month_tier text;
  v_credits integer;
  v_bonus public.social_referral_bonuses%rowtype;
  v_credits_for_referred_tier integer;
begin
  -- Idempotency
  select * into v_bonus
    from public.social_referral_bonuses
   where stripe_invoice_id = p_stripe_invoice_id
   limit 1;
  if found then return v_bonus; end if;

  -- Find the referrer for this referred user.
  select referrer_user_id, email, membership_tier
    into v_referrer_user_id, v_referrer_email, v_referrer_tier
    from public.profiles p
    join public.profiles r on r.id = p.referrer_user_id::text
                          or r.referral_code = p.referred_by
   where p.id = p_referred_user_id::text
   limit 1;

  -- Older schema: referrer_user_id is on the referred user's row directly.
  if v_referrer_user_id is null then
    select referrer_user_id into v_referrer_user_id
      from public.profiles
     where id = p_referred_user_id::text;
    if v_referrer_user_id is not null then
      select email, membership_tier into v_referrer_email, v_referrer_tier
        from public.profiles
       where id = v_referrer_user_id::text;
    end if;
  end if;

  if v_referrer_user_id is null then
    return null;
  end if;

  -- Determine credit count based on referred user's tier.
  v_credits_for_referred_tier := case
    when p_referred_tier = 'enterprise' then 30
    when p_referred_tier = 'breeder' then 12
    when p_referred_tier = 'keeper' then 4
    else 1
  end;

  -- Determine free-month tier per the rules:
  --   Free referrer       -> free month of Keeper + 1 credit
  --   Keeper / Breeder    -> free month of their tier + N credits matching referred tier
  --   Enterprise          -> free month ONLY when referred user subbed Enterprise
  if coalesce(v_referrer_tier, 'free') = 'free' then
    v_free_month_tier := 'keeper';
    v_credits := 1;
  elsif v_referrer_tier in ('keeper', 'breeder') then
    v_free_month_tier := v_referrer_tier;
    v_credits := v_credits_for_referred_tier;
  elsif v_referrer_tier = 'enterprise' then
    if p_referred_tier = 'enterprise' then
      v_free_month_tier := 'enterprise';
    else
      v_free_month_tier := null;
    end if;
    v_credits := v_credits_for_referred_tier;
  else
    v_free_month_tier := null;
    v_credits := v_credits_for_referred_tier;
  end if;

  -- Award credits to referrer.
  update public.profiles
     set social_post_credits = coalesce(social_post_credits, 0) + v_credits,
         updated_date = now()
   where id = v_referrer_user_id::text;

  -- Insert bonus ledger row.
  insert into public.social_referral_bonuses (
    referrer_user_id, referrer_email, referred_user_id, referred_email,
    referrer_tier_at_award, referred_user_tier, free_month_tier,
    credits_granted, stripe_invoice_id, source_event_type
  ) values (
    v_referrer_user_id, v_referrer_email, p_referred_user_id, p_referred_email,
    v_referrer_tier, p_referred_tier, v_free_month_tier,
    v_credits, p_stripe_invoice_id, 'first_paid_invoice'
  )
  returning * into v_bonus;

  return v_bonus;
end;
$$;


ALTER FUNCTION "public"."award_referral_signup_bonus"("p_referred_user_id" "uuid", "p_referred_email" "text", "p_referred_tier" "text", "p_stripe_invoice_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_collection_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  update public.collections
     set updated_at = now()
   where id = coalesce(new.collection_id, old.collection_id);
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."bump_collection_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_gecko_change_ts_for"("p_gecko_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_gecko_id is null then return; end if;
  update public.geckos
     set last_meaningful_change_at = now()
   where id = p_gecko_id;
end;
$$;


ALTER FUNCTION "public"."bump_gecko_change_ts_for"("p_gecko_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_gecko_change_ts_self"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if (TG_OP = 'UPDATE') then
    new.last_meaningful_change_at := now();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."bump_gecko_change_ts_self"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cgd_reorder_reminder_run"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r record;
  v_estimate jsonb;
  v_runs_out_at timestamptz;
  v_days_left int;
begin
  for r in
    select p.email
      from public.profiles p
     where coalesce(p.cgd_reorder_reminders_enabled, true)
       and p.email is not null
  loop
    v_estimate := public.estimate_food_runout(r.email);
    if not coalesce((v_estimate->>'has_food_history')::boolean, false) then
      continue;
    end if;
    v_runs_out_at := (v_estimate->>'runs_out_at')::timestamptz;
    v_days_left := coalesce((v_estimate->>'days_until_runout')::int, 999);

    if v_days_left between 13 and 15 then
      perform 1
        from public.profiles p2
       where p2.email = r.email
         and p2.cgd_reorder_last_estimated_runout_at is not null
         and abs(extract(day from p2.cgd_reorder_last_estimated_runout_at - v_runs_out_at)::int) < 3;
      if found then
        continue;
      end if;

      insert into public.notifications (user_email, type, content, link, metadata, is_read)
      values (
        r.email,
        'cgd_reorder_reminder',
        format('You have about %s days of CGD left for your collection. Time to reorder?', v_days_left),
        '/Store/c/diet',
        jsonb_build_object('days_left', v_days_left, 'runs_out_at', v_runs_out_at, 'gecko_count', v_estimate->'gecko_count'),
        false
      );

      update public.profiles
         set cgd_reorder_last_reminder_at = now(),
             cgd_reorder_last_estimated_runout_at = v_runs_out_at
       where email = r.email;
    end if;
  end loop;
end;
$$;


ALTER FUNCTION "public"."cgd_reorder_reminder_run"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."charge_social_publish"("p_user_id" "uuid", "p_tier" "text", "p_posts_included" integer, "p_overage_cents_per_post" integer) RETURNS TABLE("charged_credit" boolean, "charged_included" boolean, "charged_overage" boolean, "posts_published" integer, "credits_remaining" integer, "overage_cents_total" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_month_key text := public.month_key_now();
  v_usage public.social_post_usage%rowtype;
  v_credits integer;
  v_used_credit boolean := false;
  v_used_included boolean := false;
  v_used_overage boolean := false;
begin
  -- Ensure usage row exists.
  insert into public.social_post_usage (user_id, month_key, tier_at_start, posts_included)
  values (p_user_id, v_month_key, p_tier, p_posts_included)
  on conflict (user_id, month_key) do update
    set tier_at_start = excluded.tier_at_start,
        posts_included = greatest(public.social_post_usage.posts_included, excluded.posts_included),
        updated_date = now();

  -- Lock row.
  select * into v_usage
    from public.social_post_usage
   where user_id = p_user_id and month_key = v_month_key
   for update;

  -- Read current credit balance (also lock profile row).
  select coalesce(social_post_credits, 0) into v_credits
    from public.profiles
   where id = p_user_id::text
   for update;

  if v_credits is null then
    -- profile id may be stored as the auth user id (text form); also try email-keyed lookup.
    v_credits := 0;
  end if;

  -- Burn order: credit > included > overage
  if v_credits > 0 then
    v_used_credit := true;
    update public.profiles
       set social_post_credits = greatest(0, social_post_credits - 1),
           updated_date = now()
     where id = p_user_id::text;
    update public.social_post_usage
       set credits_used = credits_used + 1,
           updated_date = now()
     where user_id = p_user_id and month_key = v_month_key;
  elsif v_usage.posts_published < v_usage.posts_included then
    v_used_included := true;
    update public.social_post_usage
       set posts_published = posts_published + 1,
           updated_date = now()
     where user_id = p_user_id and month_key = v_month_key;
  else
    v_used_overage := true;
    update public.social_post_usage
       set posts_published = posts_published + 1,
           overage_posts = overage_posts + 1,
           overage_cents = overage_cents + p_overage_cents_per_post,
           updated_date = now()
     where user_id = p_user_id and month_key = v_month_key;
  end if;

  -- Return the after-state.
  select * into v_usage
    from public.social_post_usage
   where user_id = p_user_id and month_key = v_month_key;

  select coalesce(social_post_credits, 0) into v_credits
    from public.profiles
   where id = p_user_id::text;

  charged_credit := v_used_credit;
  charged_included := v_used_included;
  charged_overage := v_used_overage;
  posts_published := v_usage.posts_published;
  credits_remaining := coalesce(v_credits, 0);
  overage_cents_total := v_usage.overage_cents;
  return next;
end;
$$;


ALTER FUNCTION "public"."charge_social_publish"("p_user_id" "uuid", "p_tier" "text", "p_posts_included" integer, "p_overage_cents_per_post" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_transfer"("p_token" "text", "p_contribute" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_email text := auth.jwt() ->> 'email';
  v_uid   uuid := auth.uid();
  v_name  text;
  v_tr    transfer_requests%rowtype;
  v_now   timestamptz := now();
  v_cid   uuid;
begin
  if v_email is null or v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_tr
  from transfer_requests
  where token = p_token
  for update;

  if not found then
    raise exception 'transfer not found';
  end if;
  if v_tr.status = 'claimed' then
    raise exception 'already claimed';
  end if;
  if v_tr.status = 'cancelled' then
    raise exception 'transfer cancelled';
  end if;
  if v_tr.status = 'expired' or v_tr.expires_at < v_now then
    raise exception 'transfer expired';
  end if;
  if lower(coalesce(v_tr.to_email, '')) <> lower(v_email) then
    raise exception 'not the intended recipient';
  end if;

  select coalesce(full_name, v_email) into v_name
  from profiles where email = v_email;
  v_name := coalesce(v_name, v_email);

  update transfer_requests
  set status = 'claimed',
      to_user_id = v_uid,
      claimed_at = v_now,
      updated_date = v_now
  where id = v_tr.id;

  if v_tr.animal_type = 'other_reptile' then
    update other_reptiles
    set created_by = v_email,
        archived = false,
        archived_date = null,
        updated_date = v_now
    where id = v_tr.animal_id;
  else
    select id into v_cid
    from collections
    where lower(owner_email) = lower(v_email) and is_default = true
    limit 1;

    if v_cid is null then
      insert into collections (owner_email, name, description, is_default)
      values (v_email, 'My collection', 'Default collection.', true)
      returning id into v_cid;

      insert into collection_members
          (collection_id, member_email, role, status, accepted_at)
      values (v_cid, v_email, 'owner', 'accepted', v_now)
      on conflict (collection_id, lower(member_email)) do nothing;
    end if;

    update geckos
    set created_by = v_email,
        collection_id = v_cid,
        status = 'Owned',
        updated_date = v_now
    where id = v_tr.animal_id;
  end if;

  insert into ownership_records (
    animal_id, owner_user_id, owner_name, acquired_date,
    transfer_method, sale_price, contributed_to_market_data,
    created_by, created_date, updated_date
  ) values (
    v_tr.animal_id, v_uid, v_name, v_now::date,
    'purchased', v_tr.sale_price,
    (p_contribute and v_tr.sale_price is not null),
    v_email, v_now, v_now
  );

  return jsonb_build_object(
    'ok', true,
    'animal_id', v_tr.animal_id,
    'animal_type', v_tr.animal_type
  );
end;
$$;


ALTER FUNCTION "public"."claim_transfer"("p_token" "text", "p_contribute" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_transfer_requests_on_animal_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM transfer_requests
   WHERE animal_id = OLD.id
     AND animal_type = TG_ARGV[0];
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."cleanup_transfer_requests_on_animal_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."community_feed"("p_limit" integer DEFAULT 25) RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
WITH uploads AS (
  SELECT
    'upload'::text AS event_type,
    gi.id::text AS event_id,
    gi.created_date,
    gi.created_by AS actor_email,
    coalesce(p.full_name, p.business_name, split_part(p.email, '@', 1)) AS actor_name,
    p.profile_image_url AS actor_avatar,
    p.id::text AS actor_id,
    'shared a photo of ' || coalesce(replace(gi.primary_morph, '_', ' '), 'a crested gecko') AS summary,
    gi.image_url,
    '/Gallery'::text AS href
  FROM public.gecko_images gi
  INNER JOIN public.profiles p ON p.email = gi.created_by
  WHERE gi.created_date IS NOT NULL
    AND gi.image_url IS NOT NULL
    AND gi.created_by IS NOT NULL
    AND coalesce(p.is_public_profile, true) = true
  ORDER BY gi.created_date DESC
  LIMIT 30
),
posts AS (
  SELECT
    'forum_post'::text AS event_type,
    fp.id::text AS event_id,
    fp.created_date,
    fp.created_by AS actor_email,
    coalesce(p.full_name, p.business_name, split_part(p.email, '@', 1)) AS actor_name,
    p.profile_image_url AS actor_avatar,
    p.id::text AS actor_id,
    'posted "' || left(coalesce(fp.title, 'a new thread'), 80) || '"' AS summary,
    NULL::text AS image_url,
    '/Forum'::text AS href
  FROM public.forum_posts fp
  INNER JOIN public.profiles p ON p.email = fp.created_by
  WHERE fp.created_date IS NOT NULL
    AND fp.created_by IS NOT NULL
    AND coalesce(p.is_public_profile, true) = true
  ORDER BY fp.created_date DESC
  LIMIT 30
),
plans AS (
  SELECT
    'breeding_plan'::text AS event_type,
    bp.id::text AS event_id,
    bp.created_date,
    bp.created_by AS actor_email,
    coalesce(p.full_name, p.business_name, split_part(p.email, '@', 1)) AS actor_name,
    p.profile_image_url AS actor_avatar,
    p.id::text AS actor_id,
    'planned a new pairing' AS summary,
    NULL::text AS image_url,
    '/Breeding'::text AS href
  FROM public.breeding_plans bp
  INNER JOIN public.profiles p ON p.email = bp.created_by
  WHERE bp.created_date IS NOT NULL
    AND bp.created_by IS NOT NULL
    AND coalesce(bp.is_public, false) = true
    AND coalesce(p.is_public_profile, true) = true
  ORDER BY bp.created_date DESC
  LIMIT 30
),
hatched AS (
  SELECT
    'hatched'::text AS event_type,
    e.id::text AS event_id,
    e.hatch_date_actual::timestamptz AS created_date,
    e.created_by AS actor_email,
    coalesce(p.full_name, p.business_name, split_part(p.email, '@', 1)) AS actor_name,
    p.profile_image_url AS actor_avatar,
    p.id::text AS actor_id,
    'just hatched a new gecko' AS summary,
    NULL::text AS image_url,
    '/Breeding'::text AS href
  FROM public.eggs e
  INNER JOIN public.profiles p ON p.email = e.created_by
  INNER JOIN public.breeding_plans bp ON bp.id = e.breeding_plan_id
  WHERE e.status = 'Hatched'
    AND e.hatch_date_actual IS NOT NULL
    AND coalesce(e.archived, false) = false
    AND coalesce(p.is_public_profile, true) = true
    AND coalesce(bp.is_public, false) = true
  ORDER BY e.hatch_date_actual DESC
  LIMIT 30
),
joins AS (
  SELECT
    'join'::text AS event_type,
    p.id::text AS event_id,
    p.created_date,
    p.email AS actor_email,
    coalesce(p.full_name, p.business_name, split_part(p.email, '@', 1)) AS actor_name,
    p.profile_image_url AS actor_avatar,
    p.id::text AS actor_id,
    'joined the community' AS summary,
    NULL::text AS image_url,
    ('/PublicProfile?userId=' || p.id::text)::text AS href
  FROM public.profiles p
  WHERE p.created_date IS NOT NULL
    AND coalesce(p.is_public_profile, true) = true
    AND p.created_date > now() - interval '30 days'
  ORDER BY p.created_date DESC
  LIMIT 30
),
combined AS (
  SELECT * FROM uploads
  UNION ALL SELECT * FROM posts
  UNION ALL SELECT * FROM plans
  UNION ALL SELECT * FROM hatched
  UNION ALL SELECT * FROM joins
),
ranked AS (
  SELECT * FROM combined
  ORDER BY created_date DESC
  LIMIT p_limit
)
SELECT coalesce(json_agg(row_to_json(ranked) ORDER BY ranked.created_date DESC), '[]'::json)
FROM ranked;
$$;


ALTER FUNCTION "public"."community_feed"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."community_gecko_counts"() RETURNS TABLE("created_by" "text", "keeping" integer, "selling" integer, "breeding" integer, "cover_image" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select
    g.created_by,
    count(*) filter (where g.status is distinct from 'Sold')::int as keeping,
    count(*) filter (where g.status = 'For Sale')::int as selling,
    count(*) filter (where g.status in ('Ready to Breed', 'Proven', 'Future Breeder'))::int as breeding,
    (array_agg(g.image_urls ->> 0 order by g.created_date)
       filter (where jsonb_typeof(g.image_urls) = 'array' and jsonb_array_length(g.image_urls) > 0))[1] as cover_image
  from public.geckos g
  where g.created_by is not null
    and coalesce(g.is_public, true)
    and not coalesce(g.archived, false)
  group by g.created_by
$$;


ALTER FUNCTION "public"."community_gecko_counts"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feature_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "feature" "text" NOT NULL,
    "month_key" "text" NOT NULL,
    "tier_at_start" "text" DEFAULT 'free'::"text" NOT NULL,
    "credits_included" integer,
    "credits_consumed" integer DEFAULT 0 NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."feature_usage" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_feature_credit"("p_feature" "text", "p_tier" "text", "p_included" integer, "p_cost" integer DEFAULT 1) RETURNS "public"."feature_usage"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_month text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_tier text;
  v_included integer;
  v_known boolean;
  v_row public.feature_usage;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  if p_cost is null or p_cost < 1 then
    p_cost := 1;
  end if;

  v_tier := public.effective_tier_for_current_user();
  select true, a.included into v_known, v_included
  from public.feature_credit_allotments a
  where a.feature = p_feature and a.tier = v_tier;
  if v_known is not true then
    raise exception 'unknown_feature';
  end if;

  if v_included is not null and v_included <= 0 then
    raise exception 'feature_credits_exhausted';
  end if;

  insert into public.feature_usage (user_id, feature, month_key, tier_at_start, credits_included)
  values (v_user, p_feature, v_month, v_tier, v_included)
  on conflict (user_id, feature, month_key) do nothing;

  select * into v_row
  from public.feature_usage
  where user_id = v_user and feature = p_feature and month_key = v_month
  for update;

  if v_included is null then
    v_row.credits_included := null;
  elsif v_row.credits_included is not null and v_included > v_row.credits_included then
    v_row.credits_included := v_included;
  end if;

  if v_row.credits_included is not null
     and v_row.credits_consumed + p_cost > v_row.credits_included then
    raise exception 'feature_credits_exhausted';
  end if;

  update public.feature_usage
  set credits_consumed = credits_consumed + p_cost,
      credits_included = v_row.credits_included,
      tier_at_start = v_tier,
      updated_date = now()
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."consume_feature_credit"("p_feature" "text", "p_tier" "text", "p_included" integer, "p_cost" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."morph_id_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "month_key" "text" NOT NULL,
    "tier_at_start" "text" DEFAULT 'free'::"text" NOT NULL,
    "credits_included" integer DEFAULT 1 NOT NULL,
    "credits_consumed" integer DEFAULT 0 NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."morph_id_usage" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_morph_id_credit"("p_user_id" "uuid", "p_tier" "text", "p_credits_included" integer) RETURNS "public"."morph_id_usage"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  rec public.morph_id_usage%rowtype;
  mk text := public.month_key_now();
  v_included integer := case when coalesce(p_tier, 'free') = 'free' then 0 else p_credits_included end;
begin
  if v_included <= 0 then
    raise exception 'morph_id_credits_exhausted'
      using errcode = 'P0001';
  end if;

  insert into public.morph_id_usage (
    user_id, month_key, tier_at_start, credits_included, credits_consumed
  )
  values (p_user_id, mk, p_tier, v_included, 1)
  on conflict (user_id, month_key) do update
    set tier_at_start = excluded.tier_at_start,
        credits_included = greatest(public.morph_id_usage.credits_included, excluded.credits_included),
        credits_consumed = public.morph_id_usage.credits_consumed + 1,
        updated_date = now()
    returning * into rec;

  if rec.credits_consumed > rec.credits_included then
    update public.morph_id_usage
      set credits_consumed = rec.credits_included,
          updated_date = now()
      where id = rec.id;
    raise exception 'morph_id_credits_exhausted'
      using errcode = 'P0001';
  end if;

  return rec;
end;
$$;


ALTER FUNCTION "public"."consume_morph_id_credit"("p_user_id" "uuid", "p_tier" "text", "p_credits_included" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."effective_tier_for_current_user"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_email text := auth.email();
  v_uid uuid := auth.uid();
  v_prof record;
  v_rc boolean := false;
begin
  if v_email is null then
    return 'free';
  end if;
  select id, role, subscription_status, membership_tier
    into v_prof
  from profiles where email = v_email limit 1;

  if v_prof.role = 'admin' then return 'enterprise'; end if;
  if v_prof.subscription_status = 'grandfathered' then return 'breeder'; end if;

  -- app_user_id is the Supabase auth uuid the app hands to
  -- Purchases.configure, so match it as a uuid. profiles.id is legacy
  -- text, so that one comparison casts.
  select exists (
    select 1 from revenuecat_entitlements e
    where e.is_active = true
      and (e.expires_at is null or e.expires_at > now())
      and (e.app_user_id = v_uid or e.app_user_id::text = v_prof.id)
  ) into v_rc;
  if v_rc then return 'breeder'; end if;

  if v_prof.membership_tier in ('free', 'keeper', 'breeder', 'enterprise') then
    return v_prof.membership_tier;
  end if;
  return 'free';
end;
$$;


ALTER FUNCTION "public"."effective_tier_for_current_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_hatch_alerts"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r record;
  v_count integer := 0;
  v_days_incubating integer;
  v_days_to_expected integer;
  v_body text;
begin
  for r in
    select e.id, e.created_by, e.lay_date, e.hatch_date_expected
      from public.eggs e
      left join public.profiles p on p.email = e.created_by
     where e.status = 'Incubating'
       and coalesce(e.archived, false) = false
       and e.lay_date is not null
       and e.created_by is not null
       and (current_date - e.lay_date) >= coalesce(p.hatch_alert_days, 60)
       and not exists (
         select 1 from public.notifications n
          where n.user_email = e.created_by
            and n.type = 'hatch_alert'
            and n.metadata ->> 'egg_id' = e.id
            and n.created_date > now() - interval '7 days'
       )
  loop
    v_days_incubating := current_date - r.lay_date;
    v_days_to_expected := case when r.hatch_date_expected is null then null
                               else r.hatch_date_expected - current_date end;
    v_body := case
      when v_days_to_expected is not null and v_days_to_expected >= 0 then
        format('An egg in your incubator is due to hatch in %s day%s (incubating for %s days). Time to check on it.',
               v_days_to_expected, case when v_days_to_expected = 1 then '' else 's' end, v_days_incubating)
      when v_days_to_expected is not null then
        format('An egg in your incubator is %s day%s past its expected hatch date. Check on it as soon as you can.',
               abs(v_days_to_expected), case when abs(v_days_to_expected) = 1 then '' else 's' end)
      else
        format('An egg has been incubating for %s days, within the hatch window.', v_days_incubating)
    end;

    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.created_by, 'hatch_alert', v_body, '/Breeding',
      jsonb_build_object(
        'egg_id', r.id,
        'lay_date', r.lay_date,
        'hatch_date_expected', r.hatch_date_expected,
        'days_incubating', v_days_incubating,
        'source', 'cron'
      ),
      false, r.created_by
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."enqueue_hatch_alerts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_weighin_reminders"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select g.created_by, count(*) as stale
      from public.geckos g
      join lateral (
        select max(w.record_date) as last_weighed
          from public.weight_records w
         where w.gecko_id = g.id
      ) lw on true
     where coalesce(g.archived, false) = false
       and g.created_by is not null
       and coalesce(g.status, '') not in ('Sold')
       and lw.last_weighed is not null
       and lw.last_weighed < current_date - 30
       and not exists (
         select 1 from public.notifications n
          where n.user_email = g.created_by
            and n.type = 'weighin_reminder'
            and n.created_date > now() - interval '6 days'
       )
     group by g.created_by
  loop
    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.created_by, 'weighin_reminder',
      format('%s of your geckos %s not been weighed in over 30 days. A quick weigh-in keeps growth charts and breeding readiness accurate.',
             r.stale, case when r.stale = 1 then 'has' else 'have' end),
      '/MyGeckos',
      jsonb_build_object('stale_count', r.stale, 'source', 'cron'),
      false, r.created_by
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."enqueue_weighin_reminders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."estimate_food_runout"("p_user_email" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_caller text := auth.jwt() ->> 'email';
  v_privileged boolean := coalesce(auth.role(), '') = 'service_role' or public.is_admin();
begin
  if v_privileged and p_user_email is not null then
    return public.estimate_food_runout_unscoped(p_user_email);
  end if;
  if v_caller is null then
    return jsonb_build_object('has_food_history', false, 'reason', 'no_user');
  end if;
  return public.estimate_food_runout_unscoped(v_caller);
end;
$$;


ALTER FUNCTION "public"."estimate_food_runout"("p_user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."estimate_food_runout_unscoped"("p_user_email" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_email text := coalesce(p_user_email, (auth.jwt() ->> 'email'));
  v_gecko_count int;
  v_last_order_at timestamptz;
  v_last_grams int := 0;
  v_calibrated numeric;
  v_per_gecko_per_week numeric := 10;
  v_daily numeric;
  v_days_since_last int;
  v_grams_remaining int;
  v_runs_out_at timestamptz;
begin
  if v_email is null then
    return jsonb_build_object('has_food_history', false, 'reason', 'no_user');
  end if;

  select count(*) into v_gecko_count
    from public.geckos g
   where g.created_by = v_email;

  if coalesce(v_gecko_count, 0) = 0 then
    return jsonb_build_object('has_food_history', false, 'reason', 'no_geckos');
  end if;

  select o.paid_at, sum(coalesce(p.food_quantity_grams, 0) * oi.quantity)::int
    into v_last_order_at, v_last_grams
    from public.store_orders o
    join public.store_order_items oi on oi.order_id = o.id
    join public.store_products p on p.id = oi.product_id
   where o.customer_email = v_email
     and o.status in ('paid', 'processing', 'shipped', 'delivered')
     and p.is_consumable_food
   group by o.id
   order by o.paid_at desc nulls last
   limit 1;

  if v_last_order_at is null or v_last_grams is null or v_last_grams = 0 then
    return jsonb_build_object('has_food_history', false, 'reason', 'no_food_orders', 'gecko_count', v_gecko_count);
  end if;

  select cgd_reorder_grams_per_gecko_per_week into v_calibrated
    from public.profiles where email = v_email;
  if v_calibrated is not null and v_calibrated > 0 then
    v_per_gecko_per_week := v_calibrated;
  else
    select avg(p.food_grams_per_gecko_per_week) into v_per_gecko_per_week
      from public.store_orders o
      join public.store_order_items oi on oi.order_id = o.id
      join public.store_products p on p.id = oi.product_id
     where o.customer_email = v_email
       and p.is_consumable_food
       and p.food_grams_per_gecko_per_week is not null;
    v_per_gecko_per_week := coalesce(v_per_gecko_per_week, 10);
  end if;

  v_daily := (v_per_gecko_per_week * v_gecko_count) / 7.0;
  if v_daily <= 0 then
    return jsonb_build_object('has_food_history', false, 'reason', 'invalid_consumption');
  end if;

  v_days_since_last := greatest(0, extract(day from now() - v_last_order_at)::int);
  v_grams_remaining := greatest(0, v_last_grams - (v_days_since_last * v_daily)::int);
  v_runs_out_at := v_last_order_at + ((v_last_grams / v_daily) || ' days')::interval;

  return jsonb_build_object(
    'has_food_history', true,
    'gecko_count', v_gecko_count,
    'grams_remaining', v_grams_remaining,
    'daily_consumption_grams', round(v_daily, 2),
    'per_gecko_per_week_grams', round(v_per_gecko_per_week, 2),
    'runs_out_at', v_runs_out_at,
    'days_until_runout', greatest(0, extract(day from v_runs_out_at - now())::int),
    'last_food_order_at', v_last_order_at,
    'last_food_grams_total', v_last_grams
  );
end;
$$;


ALTER FUNCTION "public"."estimate_food_runout_unscoped"("p_user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_referral_grants"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_count integer := 0;
  r record;
begin
  perform set_config('geck.referral_bypass', 'on', true);

  for r in
    select p.email
      from public.profiles p
     where p.referral_grant_until is not null
       and p.referral_grant_until < now()
       and p.stripe_subscription_id is null
       and coalesce(p.subscription_status, '') not in ('active', 'trialing', 'past_due', 'grandfathered')
       and not exists (
         select 1
           from public.revenuecat_entitlements e
           join auth.users u on u.id = e.app_user_id
          where lower(u.email) = lower(p.email)
            and e.is_active = true
            and (e.expires_at is null or e.expires_at > now())
       )
  loop
    update public.profiles
       set membership_tier = case when membership_tier = 'keeper' then 'free' else membership_tier end,
           referral_grant_until = null,
           updated_date = now()
     where email = r.email;

    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.email, 'referral_grant_ended',
      'Your free month of Keeper from a referral has ended. Refer another crested gecko keeper to earn the next one, or keep Keeper going from the Membership page.',
      '/Membership', jsonb_build_object('source', 'cron'), false, r.email
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


ALTER FUNCTION "public"."expire_referral_grants"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gecko_image_stats"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH base AS (
    SELECT
      id,
      primary_morph,
      secondary_morph,
      verified,
      confidence_score,
      created_date,
      training_meta
    FROM public.gecko_images
  ),
  totals AS (
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE verified IS TRUE)::bigint AS verified,
      COUNT(*) FILTER (WHERE created_date > now() - interval '7 days')::bigint
        AS recent_week,
      COUNT(DISTINCT primary_morph) FILTER (WHERE primary_morph IS NOT NULL)::bigint
        AS morph_categories_seen,
      AVG(confidence_score) FILTER (WHERE confidence_score IS NOT NULL)::numeric
        AS avg_confidence
    FROM base
  ),
  morph_counts AS (
    SELECT primary_morph, COUNT(*)::bigint AS count
    FROM base
    WHERE primary_morph IS NOT NULL
    GROUP BY primary_morph
  ),
  top AS (
    SELECT jsonb_agg(jsonb_build_object('id', primary_morph, 'count', count)
                     ORDER BY count DESC) AS top_morphs
    FROM (
      SELECT primary_morph, count FROM morph_counts
      ORDER BY count DESC LIMIT 8
    ) t
  ),
  undersampled AS (
    SELECT jsonb_agg(jsonb_build_object('id', primary_morph, 'count', count)
                     ORDER BY count ASC) AS undersampled_morphs
    FROM morph_counts WHERE count < 5
  ),
  genetics AS (
    SELECT jsonb_agg(DISTINCT g) AS seen_genetic_traits
    FROM (
      SELECT secondary_morph AS g FROM base WHERE secondary_morph IS NOT NULL
      UNION ALL
      SELECT jsonb_array_elements_text(training_meta -> 'genetic_traits') AS g
      FROM base
      WHERE training_meta ? 'genetic_traits'
    ) x
    WHERE g IS NOT NULL
  )
  SELECT jsonb_build_object(
    'total',                   COALESCE(t.total, 0),
    'verified',                COALESCE(t.verified, 0),
    'recent_week',             COALESCE(t.recent_week, 0),
    'morph_categories_seen',   COALESCE(t.morph_categories_seen, 0),
    'avg_confidence',          t.avg_confidence,
    'top_morphs',              COALESCE(top.top_morphs, '[]'::jsonb),
    'undersampled_morphs',     COALESCE(undersampled.undersampled_morphs, '[]'::jsonb),
    'seen_genetic_traits',     COALESCE(genetics.seen_genetic_traits, '[]'::jsonb)
  )
  FROM totals t, top, undersampled, genetics;
$$;


ALTER FUNCTION "public"."gecko_image_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gecko_passport_is_public"("p_animal_id" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.geckos g
     where g.id = p_animal_id
       and g.passport_code is not null
       and g.is_public = true
  );
$$;


ALTER FUNCTION "public"."gecko_passport_is_public"("p_animal_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."geckos_set_default_collection"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  cid uuid;
  email text := lower(coalesce(auth.email(), ''));
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


ALTER FUNCTION "public"."geckos_set_default_collection"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_referral_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  candidate text;
  attempt integer := 0;
begin
  loop
    candidate := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    perform 1 from public.profiles where referral_code = candidate;
    if not found then
      return candidate;
    end if;
    attempt := attempt + 1;
    if attempt > 10 then
      raise exception 'generate_referral_code: no unique code after 10 attempts';
    end if;
  end loop;
end;
$$;


ALTER FUNCTION "public"."generate_referral_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_transfer_preview"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_tr transfer_requests%rowtype;
  v_local text;
  v_domain text;
  v_masked text;
begin
  if p_token is null or length(p_token) < 8 then
    return null;
  end if;
  select * into v_tr from transfer_requests where token = p_token;
  if not found then
    return null;
  end if;
  v_local := split_part(coalesce(v_tr.to_email, ''), '@', 1);
  v_domain := split_part(coalesce(v_tr.to_email, ''), '@', 2);
  v_masked := case
    when v_local = '' then null
    else left(v_local, 1) || repeat('*', greatest(length(v_local) - 1, 2)) || '@' || v_domain
  end;
  return jsonb_build_object(
    'id', v_tr.id,
    'status', v_tr.status,
    'expires_at', v_tr.expires_at,
    'animal_id', v_tr.animal_id,
    'animal_type', v_tr.animal_type,
    'message', v_tr.message,
    'sale_price', v_tr.sale_price,
    'to_email_masked', v_masked
  );
end;
$$;


ALTER FUNCTION "public"."get_transfer_preview"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_storage_bytes"() RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'storage'
    AS $$
declare
  total bigint;
  uid uuid := auth.uid();
begin
  if uid is null then
    return 0;
  end if;

  select coalesce(sum((metadata->>'size')::bigint), 0)
    into total
    from storage.objects
   where bucket_id = 'geck-inspect-media'
     and (
       name like '%/' || uid::text || '/%'
       or name like uid::text || '/%'
     );

  return coalesce(total, 0);
end;
$$;


ALTER FUNCTION "public"."get_user_storage_bytes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_notification_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_role text := auth.role();
  v_email text := auth.email();
  v_is_admin boolean := false;
begin
  if v_role is null or v_role = '' or v_role = 'service_role' then
    return new;
  end if;
  if v_email is not null then
    select exists (
      select 1 from public.profiles p
      where p.email = v_email and p.role = 'admin'
    ) into v_is_admin;
  end if;
  if v_is_admin then
    return new;
  end if;
  new.created_by := v_email;
  if new.link is not null and new.link !~ '^/' then
    new.link := '/';
  end if;
  if new.content is not null and length(new.content) > 500 then
    new.content := left(new.content, 500);
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."guard_notification_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.email is null or new.email = '' then
    return new;
  end if;

  insert into public.profiles (email, full_name, created_by, created_date, updated_date)
  values (
    new.email,
    nullif(trim(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )), ''),
    new.email,
    now(),
    now()
  )
  on conflict (email) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_auth_user"() IS 'Creates the public.profiles row for a new auth user. Without it the account is invisible to billing, tier checks, and every table that joins on profiles.email.';



CREATE OR REPLACE FUNCTION "public"."increment_social_usage_spend"("p_user_id" "uuid", "p_month_key" "text", "p_cents" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.social_post_usage (user_id, month_key, api_cents_spent, generations_count, posts_included)
  values (p_user_id, p_month_key, p_cents, 1, 0)
  on conflict (user_id, month_key) do update
    set api_cents_spent = public.social_post_usage.api_cents_spent + excluded.api_cents_spent,
        generations_count = public.social_post_usage.generations_count + 1,
        updated_date = now();
end;
$$;


ALTER FUNCTION "public"."increment_social_usage_spend"("p_user_id" "uuid", "p_month_key" "text", "p_cents" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email' AND profiles.role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_blog_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
     WHERE email = auth.jwt() ->> 'email'
       AND role  = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_blog_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_collection_editor"("p_collection_id" "uuid", "p_email" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
      from public.collection_members
     where collection_id = p_collection_id
       and lower(member_email) = lower(coalesce(p_email, ''))
       and status = 'accepted'
       and role in ('owner', 'editor')
  );
$$;


ALTER FUNCTION "public"."is_collection_editor"("p_collection_id" "uuid", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_collection_member"("p_collection_id" "uuid", "p_email" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
      from public.collection_members
     where collection_id = p_collection_id
       and lower(member_email) = lower(coalesce(p_email, ''))
       and status in ('pending', 'accepted')
  );
$$;


ALTER FUNCTION "public"."is_collection_member"("p_collection_id" "uuid", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_collection_owner"("p_collection_id" "uuid", "p_email" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
      from public.collections
     where id = p_collection_id
       and lower(owner_email) = lower(coalesce(p_email, ''))
  );
$$;


ALTER FUNCTION "public"."is_collection_owner"("p_collection_id" "uuid", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_expert_reviewer"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
      AND profiles.role IN ('admin', 'expert_reviewer')
  );
$$;


ALTER FUNCTION "public"."is_expert_reviewer"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."landing_stats"() RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select json_build_object(
    'keepers',  (select count(*) from auth.users where email_confirmed_at is not null and deleted_at is null),
    'geckos',   (select count(*) from public.geckos),
    'pairings', (select count(*) from public.breeding_plans)
  );
$$;


ALTER FUNCTION "public"."landing_stats"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."landing_stats"() IS 'Aggregate counts for the public landing page. Returns {keepers, geckos, pairings}. No row data exposed. Safe for anon.';



CREATE TABLE IF NOT EXISTS "geck_data"."listing_images" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "listing_id" "text",
    "storage_bucket" "text" DEFAULT 'listing-images'::"text" NOT NULL,
    "storage_path" "text",
    "file_name" "text",
    "file_size" bigint,
    "mime_type" "text",
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_url" "text",
    "species" "text" DEFAULT 'unknown'::"text",
    "phash" "bytea",
    "phash_algo" "text"
);


ALTER TABLE "geck_data"."listing_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."market_listings" (
    "id" "text" NOT NULL,
    "morphmarket_key" integer,
    "url" "text",
    "title" "text",
    "price" real,
    "price_usd_equivalent" real,
    "sex" "text",
    "maturity" "text",
    "description" "text",
    "first_listed" "text",
    "store_name" "text",
    "seller_id" "text",
    "seller_name" "text",
    "seller_location" "text",
    "seller_rating" integer,
    "seller_sales" integer,
    "five_star_rating" real,
    "membership" "text",
    "likes_count" integer,
    "is_renewed" boolean,
    "is_auction" boolean,
    "fixed_shipping" real,
    "min_shipping" real,
    "max_shipping" real,
    "birth_year" integer,
    "birth_month" integer,
    "birth_day" integer,
    "weight" "text",
    "proven_breeder" boolean,
    "diet" "text",
    "item_origin" "text",
    "price_flexibility" "text",
    "cached_traits" "text",
    "norm_traits" "text",
    "has_dams" boolean DEFAULT false,
    "has_sires" boolean DEFAULT false,
    "page_number" integer,
    "imported_at" timestamp with time zone,
    "detail_collected" boolean DEFAULT false,
    "price_flagged" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_renewal" "text",
    "last_seen" "text",
    "saved_count" integer,
    "is_sold" boolean DEFAULT false,
    "is_on_hold" boolean DEFAULT false,
    "total_followers" integer,
    "seller_created_year" integer,
    "seller_feedback_count" integer,
    "bpg_tier" "text",
    "original_price" real,
    "source" "text" DEFAULT 'manual'::"text",
    "first_seen_at" timestamp with time zone,
    "last_seen_at" timestamp with time zone,
    "current_status" "text",
    "first_listed_at" timestamp with time zone,
    "species" "text" DEFAULT 'unknown'::"text",
    "canonical_listing_id" "text",
    "is_group_lot" boolean DEFAULT false NOT NULL,
    "kind" "text",
    "raw" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "market_listings_current_status_check" CHECK (("current_status" = ANY (ARRAY['live'::"text", 'sold'::"text", 'hold'::"text", 'removed'::"text", 'returned'::"text"])))
);


ALTER TABLE "geck_data"."market_listings" OWNER TO "postgres";


COMMENT ON COLUMN "geck_data"."market_listings"."is_group_lot" IS 'True when the title describes multiple animals (lot, pack, pair, trio, group, xN). Such listings price a group, so they must be excluded from per-animal medians, comps and discount calculations.';



CREATE OR REPLACE VIEW "public"."listing_images" WITH ("security_invoker"='true') AS
 SELECT "id",
    "listing_id",
    "storage_bucket",
    "storage_path",
    "file_name",
    "file_size",
    "mime_type",
    "uploaded_by",
    "uploaded_at",
    "image_url",
    "species",
    "phash",
    "phash_algo"
   FROM "geck_data"."listing_images";


ALTER VIEW "public"."listing_images" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."market_listings" WITH ("security_invoker"='true') AS
 SELECT "id",
    "morphmarket_key",
    "url",
    "title",
    "price",
    "price_usd_equivalent",
    "sex",
    "maturity",
    "description",
    "first_listed",
    "store_name",
    "seller_id",
    "seller_name",
    "seller_location",
    "seller_rating",
    "seller_sales",
    "five_star_rating",
    "membership",
    "likes_count",
    "is_renewed",
    "is_auction",
    "fixed_shipping",
    "min_shipping",
    "max_shipping",
    "birth_year",
    "birth_month",
    "birth_day",
    "weight",
    "proven_breeder",
    "diet",
    "item_origin",
    "price_flexibility",
    "cached_traits",
    "norm_traits",
    "has_dams",
    "has_sires",
    "page_number",
    "imported_at",
    "detail_collected",
    "price_flagged",
    "created_at",
    "last_renewal",
    "last_seen",
    "saved_count",
    "is_sold",
    "is_on_hold",
    "total_followers",
    "seller_created_year",
    "seller_feedback_count",
    "bpg_tier",
    "original_price",
    "source",
    "first_seen_at",
    "last_seen_at",
    "current_status",
    "first_listed_at",
    "species",
    "canonical_listing_id",
    "is_group_lot",
    "kind",
    "raw",
    "updated_at"
   FROM "geck_data"."market_listings";


ALTER VIEW "public"."market_listings" OWNER TO "postgres";


COMMENT ON VIEW "public"."market_listings" IS 'Read-only App Store compatibility view for the consolidated geck_data schema.';



CREATE OR REPLACE FUNCTION "public"."listing_images"("public"."market_listings") RETURNS SETOF "public"."listing_images"
    LANGUAGE "sql" STABLE ROWS 10
    SET "search_path" TO ''
    AS $_$
  select images.*
  from public.listing_images as images
  where images.listing_id = $1.id
$_$;


ALTER FUNCTION "public"."listing_images"("public"."market_listings") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."month_key_now"() RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
  select to_char(now() at time zone 'utc', 'YYYY-MM');
$$;


ALTER FUNCTION "public"."month_key_now"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."morph_visual_neighbors"("query_embedding" "extensions"."vector", "match_count" integer DEFAULT 32) RETURNS TABLE("id" "text", "image_url" "text", "primary_morph" "text", "genetic_traits" "jsonb", "secondary_traits" "jsonb", "base_color" "text", "similarity" double precision, "label_weight" double precision, "label_source" "text", "source_cluster" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  with nearest as materialized (
    select
      g.id,
      g.image_url,
      g.primary_morph,
      coalesce(g.training_meta->'genetic_traits', '[]'::jsonb) as genetic_traits,
      coalesce(g.secondary_traits, '[]'::jsonb) as secondary_traits,
      g.base_color,
      g.image_embedding operator(extensions.<=>) query_embedding as distance,
      case
        when g.training_meta->>'verification_tier' = 'hero_anchor' then 1.0
        when g.training_meta->>'provenance' in ('expert_owner', 'expert_reviewed') then 0.95
        when g.training_meta->>'provenance' = 'ai_then_expert' then 0.85
        when g.training_meta->>'provenance' = 'community' then 0.60
        when g.training_meta->>'verification_tier' = 'auto_bulk_approved' then 0.40
        when g.training_meta->>'provenance' = 'geck-data-scraper' then 0.40
        else 0.50
      end::double precision as label_weight,
      coalesce(
        nullif(g.training_meta->>'verification_tier', ''),
        nullif(g.training_meta->>'provenance', ''),
        'unclassified'
      ) as label_source,
      case
        when nullif(trim(g.training_meta->>'geck_data_seller_slug'), '') is not null
          then 'seller:' || lower(trim(g.training_meta->>'geck_data_seller_slug'))
        when nullif(trim(g.training_meta->>'geck_data_seller_name'), '') is not null
          then 'seller:' || lower(trim(g.training_meta->>'geck_data_seller_name'))
        when nullif(g.training_meta->>'listing_id', '') is not null
          then 'listing:' || (g.training_meta->>'listing_id')
        when nullif(g.training_meta->>'geck_data_listing_id', '') is not null
          then 'listing:' || (g.training_meta->>'geck_data_listing_id')
        when nullif(g.training_meta->>'gecko_id', '') is not null
          then 'gecko:' || (g.training_meta->>'gecko_id')
        else g.id
      end as source_cluster
    from public.gecko_images as g
    where g.image_embedding is not null
      and g.embedding_status = 'ready'
      and g.verified is true
      and g.primary_morph is not null
      and g.image_url is not null
    order by g.image_embedding operator(extensions.<=>) query_embedding
    limit greatest(96, least(greatest(match_count, 1) * 24, 2000))
  ), independent as (
    select nearest.*,
      row_number() over (
        partition by nearest.source_cluster
        order by nearest.distance, nearest.id
      ) as source_rank
    from nearest
  )
  select
    independent.id,
    independent.image_url,
    independent.primary_morph,
    independent.genetic_traits,
    independent.secondary_traits,
    independent.base_color,
    1 - independent.distance as similarity,
    independent.label_weight,
    independent.label_source,
    independent.source_cluster
  from independent
  where independent.source_rank = 1
  order by independent.distance, independent.id
  limit greatest(1, least(match_count, 96));
$$;


ALTER FUNCTION "public"."morph_visual_neighbors"("query_embedding" "extensions"."vector", "match_count" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."morph_visual_neighbors"("query_embedding" "extensions"."vector", "match_count" integer) IS 'Service-only Morph ID retrieval. Returns at most one neighbor per independent seller/listing source and exposes provenance weights.';



CREATE OR REPLACE FUNCTION "public"."nearest_training_samples"("query_embedding" "extensions"."vector", "match_count" integer DEFAULT 6, "verified_only" boolean DEFAULT true) RETURNS TABLE("id" "text", "image_url" "text", "primary_morph" "text", "secondary_traits" "jsonb", "base_color" "text", "similarity" double precision)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  SELECT
    g.id,
    g.image_url,
    g.primary_morph,
    g.secondary_traits,
    g.base_color,
    1 - (g.image_embedding <=> query_embedding) AS similarity
  FROM public.gecko_images g
  WHERE g.image_embedding IS NOT NULL
    AND (NOT verified_only OR g.verified IS TRUE)
  ORDER BY g.image_embedding <=> query_embedding
  LIMIT GREATEST(1, LEAST(match_count, 24));
$$;


ALTER FUNCTION "public"."nearest_training_samples"("query_embedding" "extensions"."vector", "match_count" integer, "verified_only" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_unvoted_id_candidates"("reviewer" "text", "lim" integer DEFAULT 20) RETURNS TABLE("id" "text", "image_url" "text", "primary_morph" "text", "base_color" "text", "created_date" timestamp with time zone, "verified" boolean)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT g.id, g.image_url, g.primary_morph, g.base_color, g.created_date, g.verified
  FROM public.gecko_images g
  WHERE g.primary_morph IS NOT NULL
    AND g.image_url IS NOT NULL
    AND g.created_by IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.classification_votes v
      WHERE v.gecko_image_id = g.id
        AND v.reviewer_email = reviewer
    )
  ORDER BY g.created_date DESC NULLS LAST
  LIMIT GREATEST(lim, 1);
$$;


ALTER FUNCTION "public"."next_unvoted_id_candidates"("reviewer" "text", "lim" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_dispatch_on_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'vault'
    AS $$
declare
  v_push_url  constant text :=
    'https://mmuglfphhwlaluyfyxsp.supabase.co/functions/v1/send-push';
  v_email_url constant text :=
    'https://mmuglfphhwlaluyfyxsp.supabase.co/functions/v1/send-email';
  v_key       text;
  v_title     text;
  v_body      text;
  v_link      text;
  v_payload   jsonb;
  v_headers   jsonb;
begin
  -- Pull the service-role key from Vault. If it's not configured,
  -- skip both channels cleanly so the notifications INSERT itself
  -- still succeeds.
  select decrypted_secret
    into v_key
    from vault.decrypted_secrets
   where name = 'notification_service_role_key'
   limit 1;

  if v_key is null or v_key = '' then
    return NEW;
  end if;

  v_title := case NEW.type
    when 'new_message'            then 'New message'
    when 'marketplace_inquiry'    then 'Marketplace inquiry'
    when 'hatch_alert'            then 'Hatch alert'
    when 'feeding_due'            then 'Feeding due'
    when 'new_comment'            then 'New comment'
    when 'new_reply'              then 'New reply'
    when 'new_follower'           then 'New follower'
    when 'new_gecko_listing'      then 'New gecko listed'
    when 'new_breeding_plan'      then 'New breeding plan'
    when 'future_breeding_ready'  then 'Breeding window ready'
    when 'gecko_of_the_day'       then 'Gecko of the Day'
    when 'level_up'               then 'Level up!'
    when 'expert_status'          then 'Expert status update'
    when 'submission_approved'    then 'Submission approved'
    when 'announcement'           then 'Geck Inspect announcement'
    when 'role_change'            then 'Role updated'
    else 'Geck Inspect'
  end;
  v_body := coalesce(NEW.content, '');
  v_link := coalesce(NEW.link, '/');

  v_headers := jsonb_build_object(
    'Content-Type',  'application/json',
    'Authorization', 'Bearer ' || v_key
  );

  v_payload := jsonb_build_object(
    'user_email', NEW.user_email,
    'type',       NEW.type,
    'title',      v_title,
    'body',       v_body,
    'url',        v_link,
    'tag',        NEW.type
  );

  begin
    perform net.http_post(url := v_push_url, headers := v_headers, body := v_payload);
  exception when others then
    raise warning 'notify_dispatch_on_insert: send-push pg_net call failed: %', sqlerrm;
  end;

  begin
    perform net.http_post(url := v_email_url, headers := v_headers, body := v_payload);
  exception when others then
    raise warning 'notify_dispatch_on_insert: send-email pg_net call failed: %', sqlerrm;
  end;

  return NEW;
end;
$$;


ALTER FUNCTION "public"."notify_dispatch_on_insert"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_dispatch_on_insert"() IS 'Fires pg_net POSTs to send-push and send-email on every new notification. Reads the service-role key from vault.decrypted_secrets["notification_service_role_key"]. URLs are hardcoded to this project ref.';



CREATE OR REPLACE FUNCTION "public"."process_scheduled_blog_posts"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  promoted_count INTEGER := 0;
BEGIN
  WITH promoted AS (
    UPDATE public.blog_posts
       SET status       = 'published',
           published_at = COALESCE(published_at, scheduled_at, now()),
           updated_date = now()
     WHERE status = 'scheduled'
       AND scheduled_at IS NOT NULL
       AND scheduled_at <= now()
    RETURNING id, user_id
  )
  INSERT INTO public.blog_logs (user_id, event_type, related_post_id, status, message)
  SELECT user_id, 'post_published', id, 'success',
         'Scheduled post auto-published by process_scheduled_blog_posts()'
    FROM promoted;

  GET DIAGNOSTICS promoted_count = ROW_COUNT;
  RETURN promoted_count;
END;
$$;


ALTER FUNCTION "public"."process_scheduled_blog_posts"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."process_scheduled_blog_posts"() IS 'Promotes any blog_posts row with status=scheduled and scheduled_at<=now() to status=published. Logs each promotion into blog_logs. Returns the count promoted. Called every minute by pg_cron.';



CREATE OR REPLACE FUNCTION "public"."protect_profile_privileged_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_role text := auth.role();
  v_email text := auth.email();
  v_is_admin boolean := false;
begin
  if v_role is null or v_role = '' or v_role = 'service_role' then
    return new;
  end if;

  if v_email is not null then
    select exists (
      select 1 from public.profiles p
      where p.email = v_email and p.role = 'admin'
    ) into v_is_admin;
  end if;
  if v_is_admin then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.role := old.role;
    new.is_expert := old.is_expert;
    new.is_featured_breeder := old.is_featured_breeder;
    new.membership_tier := old.membership_tier;
    new.membership_billing_cycle := old.membership_billing_cycle;
    new.membership_expires_at := old.membership_expires_at;
    new.subscription_status := old.subscription_status;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.keeper_trial_used := old.keeper_trial_used;
    new.free_trial_used := old.free_trial_used;
    new.free_trial_started_at := old.free_trial_started_at;
    new.paid_membership_started_at := old.paid_membership_started_at;
    new.social_post_credits := old.social_post_credits;
  else
    new.role := 'user';
    new.is_expert := false;
    new.is_featured_breeder := false;
    new.membership_tier := 'free';
    new.membership_billing_cycle := null;
    new.membership_expires_at := null;
    new.subscription_status := null;
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
    new.keeper_trial_used := false;
    new.free_trial_used := false;
    new.free_trial_started_at := null;
    new.paid_membership_started_at := null;
    new.social_post_credits := 0;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."protect_profile_privileged_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_profile_referral_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_role text := auth.role();
  v_email text := auth.email();
  v_is_admin boolean := false;
begin
  if current_setting('geck.referral_bypass', true) = 'on' then
    return new;
  end if;
  if v_role is null or v_role = '' or v_role = 'service_role' then
    return new;
  end if;
  if v_email is not null then
    select exists (
      select 1 from public.profiles p
      where p.email = v_email and p.role = 'admin'
    ) into v_is_admin;
  end if;
  if v_is_admin then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.referral_code := old.referral_code;
    new.referred_by := old.referred_by;
    new.referral_signup_count := old.referral_signup_count;
    new.referral_grant_until := old.referral_grant_until;
  else
    new.referral_code := null;
    new.referred_by := null;
    new.referral_signup_count := 0;
    new.referral_grant_until := null;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."protect_profile_referral_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prune_stale_push_subscriptions"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  deleted_count integer;
begin
  with pruned as (
    delete from public.push_subscriptions
     where last_seen_at < now() - interval '56 days'
    returning id
  )
  select count(*) into deleted_count from pruned;
  return deleted_count;
end;
$$;


ALTER FUNCTION "public"."prune_stale_push_subscriptions"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."prune_stale_push_subscriptions"() IS 'Deletes push_subscriptions rows not touched in >56 days (iOS silent expiry window).';



CREATE OR REPLACE FUNCTION "public"."publish_due_scheduled_posts"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  due_row record;
  fn_url text := 'https://mmuglfphhwlaluyfyxsp.supabase.co/functions/v1/publish-social-post';
  service_jwt text;
begin
  -- Service-role JWT lives in vault under the name set up by Supabase
  -- by default. If unavailable, the function no-ops and logs.
  begin
    select decrypted_secret into service_jwt
      from vault.decrypted_secrets
     where name = 'service_role_jwt'
     limit 1;
  exception when others then
    service_jwt := null;
  end;

  if service_jwt is null then
    raise notice 'publish_due_scheduled_posts: no service_role_jwt in vault, skipping';
    return;
  end if;

  -- Atomically claim due posts so a second cron tick doesn't double-fire.
  for due_row in
    update public.social_posts p
       set status = 'publishing',
           updated_date = now()
     where p.status = 'scheduled'
       and p.scheduled_at is not null
       and p.scheduled_at <= now()
     returning p.id, p.primary_variant_id, (
        select v.id from public.social_post_variants v
         where v.post_id = p.id and v.status = 'draft'
         order by v.created_date asc
         limit 1
     ) as fallback_variant_id
  loop
    declare
      variant_id uuid := coalesce(due_row.primary_variant_id, due_row.fallback_variant_id);
    begin
      if variant_id is null then
        update public.social_posts
           set status = 'failed', updated_date = now()
         where id = due_row.id;
        continue;
      end if;
      -- Fire-and-forget HTTP call. publish-social-post will flip the
      -- variant/post status on success/failure.
      perform net.http_post(
        url := fn_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_jwt
        ),
        body := jsonb_build_object('variant_id', variant_id)
      );
    end;
  end loop;
end;
$$;


ALTER FUNCTION "public"."publish_due_scheduled_posts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_signup_grant"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_grant public.store_signup_grants%rowtype;
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_current_expiry timestamptz;
  v_new_expiry timestamptz;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select email into v_user_email from auth.users where id = v_user_id;
  if v_user_email is null then
    return jsonb_build_object('ok', false, 'reason', 'user_email_missing');
  end if;

  select * into v_grant from public.store_signup_grants
   where token = p_token
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'token_not_found');
  end if;

  if v_grant.voided_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'voided');
  end if;

  if v_grant.redeemed_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_redeemed');
  end if;

  if v_grant.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if lower(trim(v_grant.granted_email)) <> lower(trim(v_user_email)) then
    return jsonb_build_object('ok', false, 'reason', 'email_mismatch');
  end if;

  select membership_expires_at into v_current_expiry from public.profiles
   where email = v_user_email;

  v_new_expiry := greatest(
    coalesce(v_current_expiry, now()),
    now() + (v_grant.granted_duration_days || ' days')::interval
  );

  update public.profiles
     set membership_tier = case
           when membership_tier in ('breeder', 'enterprise') then membership_tier
           else v_grant.granted_tier
         end,
         membership_expires_at = v_new_expiry,
         updated_date = now()
   where email = v_user_email;

  update public.store_signup_grants
     set redeemed_at = now(),
         redeemed_by_user_id = v_user_id
   where id = v_grant.id;

  return jsonb_build_object(
    'ok', true,
    'tier', v_grant.granted_tier,
    'duration_days', v_grant.granted_duration_days,
    'expires_at', v_new_expiry
  );
end;
$$;


ALTER FUNCTION "public"."redeem_signup_grant"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refund_morph_id_credit"("p_user_id" "uuid") RETURNS "public"."morph_id_usage"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  rec public.morph_id_usage%rowtype;
BEGIN
  UPDATE public.morph_id_usage
    SET credits_consumed = GREATEST(credits_consumed - 1, 0),
        updated_date = now()
    WHERE user_id = p_user_id
      AND month_key = public.month_key_now()
      AND credits_consumed > 0
    RETURNING * INTO rec;
  RETURN rec;
END;
$$;


ALTER FUNCTION "public"."refund_morph_id_credit"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_gecko_image"("p_image_id" "text", "p_verdict" "text", "p_primary_morph" "text" DEFAULT NULL::"text", "p_secondary_traits" "text"[] DEFAULT NULL::"text"[], "p_edits" "jsonb" DEFAULT '{}'::"jsonb", "p_notes" "text" DEFAULT NULL::"text", "p_genetic_traits" "text"[] DEFAULT NULL::"text"[], "p_base_color" "text" DEFAULT NULL::"text", "p_pattern_intensity" "text" DEFAULT NULL::"text", "p_white_amount" "text" DEFAULT NULL::"text", "p_fired_state" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_email text := auth.jwt() ->> 'email';
  v_role text;
  v_edits jsonb;
  v_secondary_jsonb jsonb := to_jsonb(COALESCE(p_secondary_traits, '{}'::text[]));
  v_genetic_jsonb jsonb := to_jsonb(COALESCE(p_genetic_traits, '{}'::text[]));
  v_sorted_secondary jsonb;
  v_sorted_genetics jsonb;
  v_label jsonb;
  v_fingerprint text;
  v_matching_count int := 0;
  v_total_approve_count int := 0;
  v_required_approve_count int := 1;
  v_verified boolean := false;
  v_review_status text := 'pending_review';
  v_already_verified boolean := false;
BEGIN
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT role INTO v_role FROM profiles WHERE email = v_email;
  IF v_role IS NULL OR v_role NOT IN ('admin', 'expert_reviewer') THEN
    RAISE EXCEPTION 'not an expert reviewer';
  END IF;

  IF p_verdict NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'verdict must be approve or reject';
  END IF;

  IF p_verdict = 'approve' AND COALESCE(p_primary_morph, '') = '' THEN
    RAISE EXCEPTION 'primary_morph is required for approval';
  END IF;

  SELECT verified INTO v_already_verified
    FROM public.gecko_images
    WHERE id = p_image_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gecko image not found';
  END IF;
  IF COALESCE(v_already_verified, false) THEN
    RAISE EXCEPTION 'gecko image is already verified';
  END IF;

  SELECT COALESCE(jsonb_agg(value ORDER BY value), '[]'::jsonb)
    INTO v_sorted_secondary
    FROM jsonb_array_elements_text(v_secondary_jsonb);
  SELECT COALESCE(jsonb_agg(value ORDER BY value), '[]'::jsonb)
    INTO v_sorted_genetics
    FROM jsonb_array_elements_text(v_genetic_jsonb);

  v_label := jsonb_build_object(
    'primary_morph', COALESCE(p_primary_morph, ''),
    'secondary_traits', v_sorted_secondary,
    'genetic_traits', v_sorted_genetics,
    'base_color', COALESCE(p_base_color, ''),
    'pattern_intensity', COALESCE(p_pattern_intensity, ''),
    'white_amount', COALESCE(p_white_amount, ''),
    'fired_state', COALESCE(p_fired_state, '')
  );
  v_fingerprint := md5(v_label::text);
  v_edits := COALESCE(p_edits, '{}'::jsonb) || jsonb_build_object(
    'genetic_traits', v_genetic_jsonb,
    'base_color', p_base_color,
    'pattern_intensity', p_pattern_intensity,
    'white_amount', p_white_amount,
    'fired_state', p_fired_state,
    'label_set', v_label
  );

  INSERT INTO classification_votes (
    gecko_image_id, reviewer_email, verdict, primary_morph,
    secondary_traits, edits, notes, label_fingerprint
  ) VALUES (
    p_image_id, v_email, p_verdict, p_primary_morph,
    v_secondary_jsonb, v_edits, p_notes, v_fingerprint
  )
  ON CONFLICT (gecko_image_id, reviewer_email) DO UPDATE
    SET verdict = EXCLUDED.verdict,
        primary_morph = EXCLUDED.primary_morph,
        secondary_traits = EXCLUDED.secondary_traits,
        edits = EXCLUDED.edits,
        notes = EXCLUDED.notes,
        label_fingerprint = EXCLUDED.label_fingerprint,
        created_date = now();

  IF p_verdict = 'reject' THEN
    v_review_status := 'rejected';
  ELSE
    SELECT COUNT(*) INTO v_total_approve_count
      FROM classification_votes
      WHERE gecko_image_id = p_image_id AND verdict = 'approve';
    SELECT COUNT(*) INTO v_matching_count
      FROM classification_votes
      WHERE gecko_image_id = p_image_id
        AND verdict = 'approve'
        AND label_fingerprint = v_fingerprint;

    IF v_matching_count >= v_required_approve_count THEN
      v_verified := true;
      v_review_status := 'verified';
    END IF;
  END IF;

  UPDATE gecko_images
    SET verified = CASE WHEN v_verified THEN true ELSE verified END,
        primary_morph = CASE WHEN v_verified THEN p_primary_morph ELSE primary_morph END,
        secondary_traits = CASE WHEN v_verified THEN v_secondary_jsonb ELSE secondary_traits END,
        base_color = CASE WHEN v_verified THEN p_base_color ELSE base_color END,
        pattern_intensity = CASE WHEN v_verified THEN p_pattern_intensity ELSE pattern_intensity END,
        white_amount = CASE WHEN v_verified THEN p_white_amount ELSE white_amount END,
        fired_state = CASE WHEN v_verified THEN p_fired_state ELSE fired_state END,
        training_meta = COALESCE(training_meta, '{}'::jsonb) || jsonb_build_object(
          'review_status', v_review_status,
          'verification_policy', 'single_expert_interim',
          'required_approve_count', v_required_approve_count,
          'matching_approve_count', v_matching_count,
          'total_approve_count', v_total_approve_count,
          'verified_by', CASE WHEN v_verified THEN v_email ELSE training_meta ->> 'verified_by' END,
          'genetic_traits', CASE
            WHEN v_verified THEN v_genetic_jsonb
            ELSE COALESCE(training_meta -> 'genetic_traits', '[]'::jsonb)
          END
        ),
        notes = CASE
          WHEN p_verdict = 'reject' THEN COALESCE(notes, '') || E'\n[expert rejected: ' || COALESCE(p_notes, 'no reason supplied') || ']'
          ELSE notes
        END,
        updated_date = now()
    WHERE id = p_image_id;

  RETURN jsonb_build_object(
    'image_id', p_image_id,
    'verdict', p_verdict,
    'matching_approve_count', v_matching_count,
    'required_approve_count', v_required_approve_count,
    'total_approve_count', v_total_approve_count,
    'approve_count', v_matching_count,
    'review_status', v_review_status,
    'verification_policy', 'single_expert_interim',
    'verified', v_verified
  );
END;
$$;


ALTER FUNCTION "public"."review_gecko_image"("p_image_id" "text", "p_verdict" "text", "p_primary_morph" "text", "p_secondary_traits" "text"[], "p_edits" "jsonb", "p_notes" "text", "p_genetic_traits" "text"[], "p_base_color" "text", "p_pattern_intensity" "text", "p_white_amount" "text", "p_fired_state" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_default_referral_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.referral_code is null or new.referral_code = '' then
    new.referral_code := public.generate_referral_code();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_default_referral_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_testimonials_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_testimonials_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."similar_gecko_images_by_url"("p_image_url" "text", "match_count" integer DEFAULT 12) RETURNS TABLE("id" "text", "image_url" "text", "primary_morph" "text", "secondary_traits" "jsonb", "base_color" "text", "created_by" "text", "similarity" double precision)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  with q as (
    select image_embedding
    from public.gecko_images
    where image_url = p_image_url
      and image_embedding is not null
    limit 1
  )
  select
    g.id,
    g.image_url,
    g.primary_morph,
    g.secondary_traits,
    g.base_color,
    g.created_by,
    1 - (g.image_embedding <=> q.image_embedding) as similarity
  from public.gecko_images g, q
  where g.image_embedding is not null
    and g.image_url <> p_image_url
  order by g.image_embedding <=> q.image_embedding
  limit greatest(1, least(match_count, 24));
$$;


ALTER FUNCTION "public"."similar_gecko_images_by_url"("p_image_url" "text", "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."store_products_update_search_vector"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.search_vector :=
      setweight(to_tsvector('english', coalesce(new.name, '')), 'A')
   || setweight(to_tsvector('english', coalesce(new.short_description, '')), 'B')
   || setweight(to_tsvector('english', coalesce(new.long_description_md, '')), 'C');
  new.updated_date := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."store_products_update_search_vector"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."throttle_error_logs"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_key text;
  v_recent integer;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  new.message    := left(coalesce(new.message, ''), 1000);
  new.stack      := left(new.stack, 4000);
  new.url        := left(new.url, 500);
  new.user_agent := left(new.user_agent, 300);
  if new.context is not null and pg_column_size(new.context) > 4000 then
    new.context := jsonb_build_object('truncated', true);
  end if;

  v_key := coalesce(new.user_email, new.created_by, new.user_agent, '');

  select count(*) into v_recent
    from public.error_logs
   where created_date > now() - interval '1 minute'
     and coalesce(user_email, created_by, user_agent, '') = v_key;
  if v_recent >= 20 then
    return null;  -- drop silently; the client must never see an error about errors
  end if;

  select count(*) into v_recent
    from public.error_logs
   where created_date > now() - interval '1 minute';
  if v_recent >= 200 then
    return null;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."throttle_error_logs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_bump_gecko_from_image"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Historical parent-bump removed: gecko_images.gecko_id column is gone.
  -- If a future schema reintroduces it, restore the original body here.
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."trg_bump_gecko_from_image"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_bump_gecko_from_weight"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.bump_gecko_change_ts_for(coalesce(new.gecko_id, old.gecko_id));
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."trg_bump_gecko_from_weight"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_post_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "month_key" "text" NOT NULL,
    "tier_at_start" "text" DEFAULT 'free'::"text" NOT NULL,
    "posts_included" integer DEFAULT 1 NOT NULL,
    "posts_published" integer DEFAULT 0 NOT NULL,
    "credits_used" integer DEFAULT 0 NOT NULL,
    "overage_posts" integer DEFAULT 0 NOT NULL,
    "overage_cents" integer DEFAULT 0 NOT NULL,
    "api_cents_spent" integer DEFAULT 0 NOT NULL,
    "generations_count" integer DEFAULT 0 NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_usage_record_id" "text"
);


ALTER TABLE "public"."social_post_usage" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_social_usage"("p_user_id" "uuid", "p_tier" "text", "p_posts_included" integer) RETURNS "public"."social_post_usage"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  rec public.social_post_usage%rowtype;
  mk text := public.month_key_now();
begin
  insert into public.social_post_usage (
    user_id, month_key, tier_at_start, posts_included
  )
  values (p_user_id, mk, p_tier, p_posts_included)
  on conflict (user_id, month_key) do update
    set tier_at_start = excluded.tier_at_start,
        posts_included = greatest(public.social_post_usage.posts_included, excluded.posts_included),
        updated_date = now()
    returning * into rec;
  return rec;
end;
$$;


ALTER FUNCTION "public"."upsert_social_usage"("p_user_id" "uuid", "p_tier" "text", "p_posts_included" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_notification_dispatch_secret"("p_secret" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'vault'
    AS $$
declare
  v_secret text;
begin
  if p_secret is null or p_secret = '' then
    return false;
  end if;
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'notification_service_role_key'
  limit 1;
  if v_secret is null then
    return false;
  end if;
  return md5(v_secret) = md5(p_secret);
end;
$$;


ALTER FUNCTION "public"."verify_notification_dispatch_secret"("p_secret" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."welcome_shelf"("p_limit" integer DEFAULT 6) RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
SELECT coalesce(json_agg(row_to_json(rows) ORDER BY rows.created_date DESC), '[]'::json)
FROM (
  SELECT
    p.id::text AS id,
    p.email,
    coalesce(p.full_name, p.business_name, split_part(p.email, '@', 1)) AS display_name,
    p.profile_image_url,
    p.created_date
  FROM public.profiles p
  WHERE p.created_date IS NOT NULL
    AND coalesce(p.is_public_profile, true) = true
    AND p.created_date > now() - interval '7 days'
  ORDER BY p.created_date DESC
  LIMIT p_limit
) rows;
$$;


ALTER FUNCTION "public"."welcome_shelf"("p_limit" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."_backup_0028_trait_rows" (
    "id" "text",
    "cached_traits" "text",
    "norm_traits" "text",
    "backed_up_at" timestamp with time zone
);


ALTER TABLE "geck_data"."_backup_0028_trait_rows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."alert_delivery_attempts" (
    "id" bigint NOT NULL,
    "match_id" "uuid" NOT NULL,
    "channel_id" "uuid",
    "attempt_no" integer DEFAULT 1 NOT NULL,
    "status" "text" NOT NULL,
    "http_status" integer,
    "error_summary" "text",
    "attempted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "alert_delivery_attempts_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'sent'::"text", 'failed'::"text", 'retrying'::"text"])))
);


ALTER TABLE "geck_data"."alert_delivery_attempts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "geck_data"."alert_delivery_attempts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "geck_data"."alert_delivery_attempts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "geck_data"."alert_delivery_attempts_id_seq" OWNED BY "geck_data"."alert_delivery_attempts"."id";



CREATE TABLE IF NOT EXISTS "geck_data"."alert_matches" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "alert_id" "uuid" NOT NULL,
    "listing_id" "text",
    "cross_platform_listing_id" "uuid",
    "matched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload" "jsonb",
    "acknowledged_at" timestamp with time zone,
    "snoozed_until" timestamp with time zone,
    CONSTRAINT "alert_matches_check" CHECK ((("listing_id" IS NOT NULL) OR ("cross_platform_listing_id" IS NOT NULL)))
);


ALTER TABLE "geck_data"."alert_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."alerts" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "owner_id" "uuid",
    "name" "text" NOT NULL,
    "query" "jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "geck_data"."alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."anthropic_billing_daily" (
    "day" "date" NOT NULL,
    "cost_cents" numeric DEFAULT 0 NOT NULL,
    "by_model" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "by_token_type" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "raw" "jsonb",
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "geck_data"."anthropic_billing_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."auction_results" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "listing_id" "text",
    "final_price" numeric,
    "final_price_usd" numeric,
    "currency" "text",
    "bid_count" integer,
    "winning_bidder" "text",
    "closed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "observed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text"
);


ALTER TABLE "geck_data"."auction_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."auction_state" (
    "id" bigint NOT NULL,
    "listing_id" "text" NOT NULL,
    "current_price" numeric,
    "current_price_usd" numeric,
    "currency" "text",
    "bid_count" integer,
    "ends_at" timestamp with time zone,
    "observed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'extension'::"text"
);


ALTER TABLE "geck_data"."auction_state" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "geck_data"."auction_state_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "geck_data"."auction_state_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "geck_data"."auction_state_id_seq" OWNED BY "geck_data"."auction_state"."id";



CREATE SEQUENCE IF NOT EXISTS "geck_data"."batch_jobs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "geck_data"."batch_jobs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "geck_data"."batch_jobs_id_seq" OWNED BY "geck_data"."batch_jobs"."id";



CREATE TABLE IF NOT EXISTS "geck_data"."breeding_pairs" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "nickname" "text",
    "female_name" "text",
    "female_morph" "text",
    "male_name" "text",
    "male_morph" "text",
    "combo_name" "text",
    "active" boolean DEFAULT true NOT NULL,
    "paired_at" "date" DEFAULT CURRENT_DATE,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "geck_data"."breeding_pairs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."clutches" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "pair_id" "uuid" NOT NULL,
    "laid_on" "date" NOT NULL,
    "expected_hatch_on" "date",
    "egg_count" integer DEFAULT 2 NOT NULL,
    "fertile_count" integer,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "clutches_check" CHECK ((("fertile_count" IS NULL) OR (("fertile_count" >= 0) AND ("fertile_count" <= "egg_count")))),
    CONSTRAINT "clutches_egg_count_check" CHECK ((("egg_count" >= 0) AND ("egg_count" <= 6)))
);


ALTER TABLE "geck_data"."clutches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."combo_catalog" (
    "combo_name" "text" NOT NULL,
    "tokens" "text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "geck_data"."combo_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."price_history" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "listing_id" "text" NOT NULL,
    "price" numeric,
    "price_usd_equivalent" numeric,
    "currency" "text",
    "observed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text",
    "usd_rate_used" numeric
);


ALTER TABLE "geck_data"."price_history" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "geck_data"."combo_index_daily" AS
 WITH "listing_traits" AS (
         SELECT "ml"."id",
            "array_agg"(DISTINCT TRIM(BOTH FROM "t"."t")) FILTER (WHERE (("length"(TRIM(BOTH FROM "t"."t")) >= 2) AND ("length"(TRIM(BOTH FROM "t"."t")) <= 60))) AS "traits"
           FROM "geck_data"."market_listings" "ml",
            LATERAL "unnest"("string_to_array"("ml"."cached_traits", ','::"text")) "t"("t")
          WHERE (("ml"."cached_traits" IS NOT NULL) AND ("ml"."species" = ANY (ARRAY['crested'::"text", 'unknown'::"text"])))
          GROUP BY "ml"."id"
        ), "exploded" AS (
         SELECT ((LEAST("lt"."traits"["i"."i"], "lt"."traits"["j"."j"]) || ' x '::"text") || GREATEST("lt"."traits"["i"."i"], "lt"."traits"["j"."j"])) AS "combo_id",
            ("date_trunc"('day'::"text", "ph"."observed_at"))::"date" AS "day",
            COALESCE("ph"."price_usd_equivalent", "ph"."price") AS "price"
           FROM ("listing_traits" "lt"
             JOIN "geck_data"."price_history" "ph" ON (("ph"."listing_id" = "lt"."id"))),
            LATERAL "generate_subscripts"("lt"."traits", 1) "i"("i"),
            LATERAL "generate_subscripts"("lt"."traits", 1) "j"("j")
          WHERE (("i"."i" < "j"."j") AND ("array_length"("lt"."traits", 1) >= 2) AND ("ph"."observed_at" >= ("now"() - '365 days'::interval)) AND (COALESCE("ph"."price_usd_equivalent", "ph"."price") IS NOT NULL) AND (COALESCE("ph"."price_usd_equivalent", "ph"."price") > (0)::numeric) AND (COALESCE("ph"."price_usd_equivalent", "ph"."price") < (100000)::numeric))
        )
 SELECT "combo_id",
    "day",
    ("percentile_cont"((0.5)::double precision) WITHIN GROUP (ORDER BY (("price")::double precision)))::numeric AS "median_price",
    "count"(*) AS "n"
   FROM "exploded"
  GROUP BY "combo_id", "day"
 HAVING ("count"(*) >= 1)
  WITH NO DATA;


ALTER MATERIALIZED VIEW "geck_data"."combo_index_daily" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "geck_data"."combo_index_daily" IS 'Per-combo (sorted-trait-pair) daily median observed market price over 365 days. Auto-discovered from cached_traits, no hardcoded combo list. Refresh nightly.';



CREATE TABLE IF NOT EXISTS "geck_data"."crested_morph_taxonomy" (
    "canonical_name" "text" NOT NULL,
    "norm_name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "synonyms" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "is_morph" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "canonical_id" "text",
    "trait_kind" "text",
    CONSTRAINT "crested_morph_taxonomy_category_check" CHECK (("category" = ANY (ARRAY['pattern'::"text", 'color'::"text", 'dorsal'::"text", 'eye'::"text", 'scale'::"text", 'other'::"text", 'base'::"text"])))
);


ALTER TABLE "geck_data"."crested_morph_taxonomy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."cross_platform_listing_images" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "cross_platform_listing_id" "uuid" NOT NULL,
    "storage_bucket" "text" DEFAULT 'listing-images'::"text" NOT NULL,
    "storage_path" "text",
    "file_name" "text",
    "file_size" bigint,
    "mime_type" "text",
    "image_url" "text" NOT NULL,
    "caption" "text",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "phash" "bytea",
    "phash_algo" "text"
);


ALTER TABLE "geck_data"."cross_platform_listing_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."cross_platform_listings" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "platform" "text" NOT NULL,
    "external_id" "text" NOT NULL,
    "title" "text",
    "description" "text",
    "price" numeric,
    "price_usd_equivalent" numeric,
    "currency" "text",
    "seller_name" "text",
    "seller_location" "text",
    "url" "text",
    "traits_raw" "text",
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload" "jsonb",
    "species" "text" DEFAULT 'unknown'::"text"
);


ALTER TABLE "geck_data"."cross_platform_listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."error_logs" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "level" "text" DEFAULT 'error'::"text" NOT NULL,
    "message" "text" NOT NULL,
    "stack" "text",
    "url" "text",
    "user_email" "text",
    "user_agent" "text",
    "source" "text",
    "context" "jsonb",
    "resolved" boolean DEFAULT false NOT NULL,
    "resolved_by" "uuid",
    "resolved_date" timestamp with time zone,
    "created_by" "uuid",
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "error_logs_level_check" CHECK (("level" = ANY (ARRAY['error'::"text", 'warning'::"text", 'info'::"text"])))
);


ALTER TABLE "geck_data"."error_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."external_reference_images" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "source_kind" "text" NOT NULL,
    "source_id" "text" NOT NULL,
    "source_url" "text",
    "species" "text",
    "morph_label" "text",
    "norm_morph_label" "text",
    "license" "text",
    "attribution" "text",
    "storage_bucket" "text" DEFAULT 'listing-images'::"text",
    "storage_path" "text",
    "image_url" "text",
    "width" integer,
    "height" integer,
    "captured_at" timestamp with time zone,
    "imported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "raw" "jsonb",
    CONSTRAINT "external_reference_images_source_kind_check" CHECK (("source_kind" = ANY (ARRAY['inaturalist'::"text", 'leopard_gecko_wiki'::"text", 'reptidex'::"text", 'breeder_partner'::"text", 'other'::"text"])))
);


ALTER TABLE "geck_data"."external_reference_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."hatchlings" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "clutch_id" "uuid" NOT NULL,
    "hatched_on" "date" DEFAULT CURRENT_DATE NOT NULL,
    "morph_guess" "text",
    "sex" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "hatchlings_sex_check" CHECK ((("sex" IS NULL) OR ("sex" = ANY (ARRAY['male'::"text", 'female'::"text", 'unknown'::"text"]))))
);


ALTER TABLE "geck_data"."hatchlings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."ingest_audit" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_tag" "text",
    "content_type" "text",
    "event_count" integer DEFAULT 0 NOT NULL,
    "ok_count" integer DEFAULT 0 NOT NULL,
    "failed_count" integer DEFAULT 0 NOT NULL,
    "duration_ms" integer,
    "status_code" integer,
    "error_summary" "text",
    "event_types" "text"[],
    "file_count" integer,
    "client_ip_hash" "text",
    "user_agent" "text"
);


ALTER TABLE "geck_data"."ingest_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."ingest_events" (
    "id" bigint NOT NULL,
    "kind" "text" NOT NULL,
    "source" "text",
    "received" integer DEFAULT 0 NOT NULL,
    "written" integer DEFAULT 0 NOT NULL,
    "skipped" integer DEFAULT 0 NOT NULL,
    "errors" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "geck_data"."ingest_events" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "geck_data"."ingest_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "geck_data"."ingest_events_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "geck_data"."ingest_events_id_seq" OWNED BY "geck_data"."ingest_events"."id";



CREATE TABLE IF NOT EXISTS "geck_data"."listing_favorites" (
    "id" bigint NOT NULL,
    "listing_id" "text" NOT NULL,
    "anon_hash" "text",
    "observed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text"
);


ALTER TABLE "geck_data"."listing_favorites" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "geck_data"."listing_favorites_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "geck_data"."listing_favorites_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "geck_data"."listing_favorites_id_seq" OWNED BY "geck_data"."listing_favorites"."id";



CREATE TABLE IF NOT EXISTS "geck_data"."listing_image_phash_pairs" (
    "id" bigint NOT NULL,
    "left_image_id" "uuid" NOT NULL,
    "right_image_id" "uuid" NOT NULL,
    "left_kind" "text" NOT NULL,
    "right_kind" "text" NOT NULL,
    "hamming_distance" integer NOT NULL,
    "confidence" numeric,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "listing_image_phash_pairs_left_kind_check" CHECK (("left_kind" = ANY (ARRAY['listing'::"text", 'cross_platform'::"text"]))),
    CONSTRAINT "listing_image_phash_pairs_right_kind_check" CHECK (("right_kind" = ANY (ARRAY['listing'::"text", 'cross_platform'::"text"])))
);


ALTER TABLE "geck_data"."listing_image_phash_pairs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "geck_data"."listing_image_phash_pairs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "geck_data"."listing_image_phash_pairs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "geck_data"."listing_image_phash_pairs_id_seq" OWNED BY "geck_data"."listing_image_phash_pairs"."id";



CREATE TABLE IF NOT EXISTS "geck_data"."listing_lineage" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "listing_id" "text" NOT NULL,
    "role" "text" NOT NULL,
    "parent_id" "text",
    "parent_label" "text",
    "parent_traits" "jsonb",
    "parent_url" "text",
    "observed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "listing_lineage_role_check" CHECK (("role" = ANY (ARRAY['dam'::"text", 'sire'::"text", 'parent'::"text"])))
);


ALTER TABLE "geck_data"."listing_lineage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."listing_status_events" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "listing_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "observed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text",
    "days_since_first_seen" integer,
    "inference_confidence" numeric,
    CONSTRAINT "listing_status_events_status_check" CHECK (("status" = ANY (ARRAY['live'::"text", 'sold'::"text", 'hold'::"text", 'removed'::"text", 'returned'::"text"])))
);


ALTER TABLE "geck_data"."listing_status_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."listing_views" (
    "id" bigint NOT NULL,
    "listing_id" "text" NOT NULL,
    "anon_hash" "text",
    "observed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "view_day" "date" GENERATED ALWAYS AS ((("observed_at" AT TIME ZONE 'UTC'::"text"))::"date") STORED,
    "referrer_kind" "text",
    "source" "text"
);


ALTER TABLE "geck_data"."listing_views" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "geck_data"."listing_views_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "geck_data"."listing_views_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "geck_data"."listing_views_id_seq" OWNED BY "geck_data"."listing_views"."id";



CREATE TABLE IF NOT EXISTS "geck_data"."listings" (
    "listing_id" "text" NOT NULL,
    "name" "text",
    "price" numeric,
    "currency" "text",
    "seller_name" "text",
    "sex" "text",
    "weight" "text",
    "weight_grams" numeric,
    "maturity" "text",
    "scientific_name" "text",
    "birth_date" "text",
    "origin" "text",
    "pet_only" "text",
    "lineage" "text",
    "traits" "text",
    "trait_array" "text"[],
    "trait_count" integer,
    "category" "text",
    "description" "text",
    "primary_image_url" "text",
    "all_image_urls" "text"[],
    "image_count" integer,
    "listing_url" "text" DEFAULT ''::"text" NOT NULL,
    "availability" "text",
    "shipping_label" "text",
    "shipping_rate" numeric,
    "shipping_currency" "text",
    "payment_method" "text",
    "sku" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sold_at" timestamp with time zone,
    "species" "text" DEFAULT 'crested-gecko'::"text",
    "seller_slug" "text"
);


ALTER TABLE "geck_data"."listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."listings_history" (
    "id" bigint NOT NULL,
    "listing_id" "text" NOT NULL,
    "scrape_run_id" bigint,
    "observed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "price" numeric,
    "is_active" boolean,
    "raw_snapshot" "jsonb"
);


ALTER TABLE "geck_data"."listings_history" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "geck_data"."listings_history_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "geck_data"."listings_history_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "geck_data"."listings_history_id_seq" OWNED BY "geck_data"."listings_history"."id";



CREATE TABLE IF NOT EXISTS "geck_data"."market_auctions" (
    "auction_id" integer NOT NULL,
    "listing_key" integer,
    "starting_bid" real,
    "highest_bid" real,
    "bid_count" integer,
    "end_time" timestamp with time zone,
    "shipping_price" real,
    "captured_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "geck_data"."market_auctions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."market_galleries" (
    "listing_key" integer NOT NULL,
    "images" "jsonb",
    "image_count" integer,
    "captured_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "geck_data"."market_galleries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."market_lineage" (
    "listing_key" integer NOT NULL,
    "dams" "jsonb",
    "sires" "jsonb",
    "captured_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "geck_data"."market_lineage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."market_raw_captures" (
    "id" bigint NOT NULL,
    "type" "text",
    "key" "text",
    "data" "jsonb",
    "captured_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "geck_data"."market_raw_captures" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "geck_data"."market_raw_captures_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "geck_data"."market_raw_captures_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "geck_data"."market_raw_captures_id_seq" OWNED BY "geck_data"."market_raw_captures"."id";



CREATE TABLE IF NOT EXISTS "geck_data"."market_sellers" (
    "seller_id" "text" NOT NULL,
    "seller_name" "text",
    "seller_location" "text",
    "membership" "text",
    "five_star_rating" real,
    "feedback_count" integer,
    "seller_rating_score" integer,
    "total_listings" integer,
    "total_listings_with_price" integer,
    "avg_price" real,
    "median_price" real,
    "min_price" real,
    "max_price" real,
    "total_proven_breeder" integer,
    "total_with_dams" integer,
    "total_with_sires" integer,
    "total_auctions" integer,
    "top_traits" "text",
    "morph_specialization" "text",
    "sex_breakdown" "jsonb",
    "maturity_breakdown" "jsonb",
    "avg_weight_grams" real,
    "avg_likes" real,
    "pct_renewed" real,
    "first_seen_listing" "text",
    "last_seen_listing" "text",
    "price_tier" "text",
    "volume_tier" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "total_followers" integer,
    "created_year" integer,
    "can_ship" boolean,
    "is_away" boolean,
    "payment_methods" "text",
    "about_text" "text",
    "policy_text" "text",
    "instagram_url" "text",
    "tiktok_url" "text",
    "facebook_url" "text",
    "youtube_url" "text",
    "raw" "jsonb"
);


ALTER TABLE "geck_data"."market_sellers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."model_invocations" (
    "id" bigint NOT NULL,
    "called_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "surface" "text" NOT NULL,
    "model" "text" NOT NULL,
    "input_tokens" integer,
    "output_tokens" integer,
    "cache_read_tokens" integer,
    "cache_creation_tokens" integer,
    "est_cost_cents" numeric(12,4),
    "user_id" "uuid",
    "tier" "text",
    "is_admin" boolean DEFAULT false,
    "photo_count" integer,
    "few_shot_count" integer,
    "http_status" integer,
    "error_code" "text",
    "duration_ms" integer,
    "request_id" "text",
    "ip_hash" "text",
    "confidence" numeric,
    "predicted_combo_id" "text"
);


ALTER TABLE "geck_data"."model_invocations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "geck_data"."model_invocations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "geck_data"."model_invocations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "geck_data"."model_invocations_id_seq" OWNED BY "geck_data"."model_invocations"."id";



CREATE TABLE IF NOT EXISTS "geck_data"."morph_eval_runs" (
    "id" bigint NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "model" "text",
    "taxonomy_version" "text",
    "split" "text" DEFAULT 'test'::"text" NOT NULL,
    "eval_set_size" integer DEFAULT 0 NOT NULL,
    "primary_morph_top1_accuracy" numeric,
    "primary_morph_top3_accuracy" numeric,
    "genetic_jaccard_avg" numeric,
    "base_color_accuracy" numeric,
    "per_trait_metrics" "jsonb" DEFAULT '{}'::"jsonb",
    "top_confusions" "jsonb" DEFAULT '[]'::"jsonb",
    "prompt_fingerprint" "text",
    "notes" "text",
    "triggered_by" "text" DEFAULT 'manual'::"text",
    "error_message" "text",
    CONSTRAINT "morph_eval_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'failed'::"text"])))
);


ALTER TABLE "geck_data"."morph_eval_runs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "geck_data"."morph_eval_runs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "geck_data"."morph_eval_runs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "geck_data"."morph_eval_runs_id_seq" OWNED BY "geck_data"."morph_eval_runs"."id";



CREATE TABLE IF NOT EXISTS "geck_data"."morph_human_labels" (
    "id" bigint NOT NULL,
    "listing_id" "text",
    "invocation_id" bigint,
    "combo_id" "text",
    "traits" "text"[],
    "labeler" "text" NOT NULL,
    "notes" "text",
    "labeled_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "geck_data"."morph_human_labels" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "geck_data"."morph_human_labels_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "geck_data"."morph_human_labels_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "geck_data"."morph_human_labels_id_seq" OWNED BY "geck_data"."morph_human_labels"."id";



CREATE TABLE IF NOT EXISTS "geck_data"."morph_taxonomy" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "species" "text" NOT NULL,
    "canonical_name" "text" NOT NULL,
    "norm_name" "text" NOT NULL,
    "inheritance" "text",
    "allele_group" "text",
    "parent_morphs" "text"[],
    "synonyms" "text"[],
    "description" "text",
    "source_kind" "text" NOT NULL,
    "source_id" "text",
    "source_url" "text",
    "imported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "geck_data"."morph_taxonomy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."morph_taxonomy_synonyms" (
    "id" bigint NOT NULL,
    "alias" "text" NOT NULL,
    "canonical" "text" NOT NULL,
    "weight" numeric DEFAULT 1.0 NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "added_by" "text"
);


ALTER TABLE "geck_data"."morph_taxonomy_synonyms" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "geck_data"."morph_taxonomy_synonyms_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "geck_data"."morph_taxonomy_synonyms_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "geck_data"."morph_taxonomy_synonyms_id_seq" OWNED BY "geck_data"."morph_taxonomy_synonyms"."id";



CREATE TABLE IF NOT EXISTS "geck_data"."morphs" (
    "id" bigint NOT NULL,
    "canonical_name" "text" NOT NULL,
    "category" "text",
    "description" "text",
    "aliases" "text"[]
);


ALTER TABLE "geck_data"."morphs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "geck_data"."morphs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "geck_data"."morphs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "geck_data"."morphs_id_seq" OWNED BY "geck_data"."morphs"."id";



CREATE TABLE IF NOT EXISTS "geck_data"."price_adjustment_factors" (
    "id" bigint NOT NULL,
    "category" "text" NOT NULL,
    "bucket" "text" NOT NULL,
    "multiplier" numeric NOT NULL,
    "source" "text" DEFAULT 'seed'::"text" NOT NULL,
    "n_samples" integer,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "price_adjustment_factors_category_check" CHECK (("category" = ANY (ARRAY['age'::"text", 'sex'::"text", 'proven'::"text", 'weight_bucket'::"text"]))),
    CONSTRAINT "price_adjustment_factors_multiplier_check" CHECK (("multiplier" > (0)::numeric))
);


ALTER TABLE "geck_data"."price_adjustment_factors" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "geck_data"."price_adjustment_factors_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "geck_data"."price_adjustment_factors_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "geck_data"."price_adjustment_factors_id_seq" OWNED BY "geck_data"."price_adjustment_factors"."id";



CREATE TABLE IF NOT EXISTS "geck_data"."price_drops" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "listing_id" "text" NOT NULL,
    "old_price" numeric,
    "new_price" numeric,
    "old_price_usd" numeric,
    "new_price_usd" numeric,
    "currency" "text",
    "pct_change" numeric,
    "observed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text"
);


ALTER TABLE "geck_data"."price_drops" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."price_history_dupes_archive" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "listing_id" "text" NOT NULL,
    "price" numeric,
    "price_usd_equivalent" numeric,
    "currency" "text",
    "observed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text",
    "usd_rate_used" numeric,
    "archived_at" timestamp with time zone DEFAULT "timezone"('UTC'::"text", "now"()) NOT NULL,
    "archived_by" "text" DEFAULT 'migration_0050'::"text" NOT NULL
);


ALTER TABLE "geck_data"."price_history_dupes_archive" OWNER TO "postgres";


COMMENT ON TABLE "geck_data"."price_history_dupes_archive" IS 'Rows removed from price_history when the (listing_id, observed_at) unique key was introduced. Every archived row had a surviving twin identical in every column but id.';



CREATE TABLE IF NOT EXISTS "geck_data"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'admin'::"text"])))
);


ALTER TABLE "geck_data"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."runtime_config" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "value_kind" "text" NOT NULL,
    "description" "text",
    "min_value" numeric,
    "max_value" numeric,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "text",
    CONSTRAINT "runtime_config_value_kind_check" CHECK (("value_kind" = ANY (ARRAY['integer'::"text", 'number'::"text", 'boolean'::"text", 'string'::"text", 'json'::"text"])))
);


ALTER TABLE "geck_data"."runtime_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."runtime_config_history" (
    "id" bigint NOT NULL,
    "key" "text" NOT NULL,
    "old_value" "jsonb",
    "new_value" "jsonb",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "changed_by" "text"
);


ALTER TABLE "geck_data"."runtime_config_history" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "geck_data"."runtime_config_history_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "geck_data"."runtime_config_history_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "geck_data"."runtime_config_history_id_seq" OWNED BY "geck_data"."runtime_config_history"."id";



CREATE TABLE IF NOT EXISTS "geck_data"."scrape_runs" (
    "id" bigint NOT NULL,
    "scrape_type" "text" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "triggered_by" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "records_attempted" integer DEFAULT 0 NOT NULL,
    "records_succeeded" integer DEFAULT 0 NOT NULL,
    "records_failed" integer DEFAULT 0 NOT NULL,
    "error_message" "text"
);


ALTER TABLE "geck_data"."scrape_runs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "geck_data"."scrape_runs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "geck_data"."scrape_runs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "geck_data"."scrape_runs_id_seq" OWNED BY "geck_data"."scrape_runs"."id";



CREATE TABLE IF NOT EXISTS "geck_data"."seller_snapshots" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "seller_id" "text" NOT NULL,
    "observed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "feedback_count" integer,
    "seller_rating_score" numeric,
    "five_star_rating" numeric,
    "total_listings" integer,
    "avg_price" numeric,
    "membership" "text",
    "source" "text"
);


ALTER TABLE "geck_data"."seller_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."sellers" (
    "seller_slug" "text" NOT NULL,
    "store_name" "text",
    "owner_name" "text",
    "location_raw" "text",
    "member_since" "text",
    "listings_count" integer,
    "avatar_url" "text",
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "geck_data"."sellers" OWNER TO "postgres";


CREATE OR REPLACE VIEW "geck_data"."sellers_needing_scrape" WITH ("security_invoker"='true') AS
 SELECT DISTINCT "l"."seller_slug"
   FROM ("geck_data"."listings" "l"
     LEFT JOIN "geck_data"."sellers" "s" ON (("s"."seller_slug" = "l"."seller_slug")))
  WHERE (("l"."seller_slug" IS NOT NULL) AND ("l"."is_active" = true) AND (("s"."seller_slug" IS NULL) OR ("s"."last_updated_at" < ("now"() - '7 days'::interval))));


ALTER VIEW "geck_data"."sellers_needing_scrape" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."show_mentions" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "listing_id" "text",
    "seller_id" "text",
    "show_name" "text" NOT NULL,
    "show_date" "date",
    "context" "text",
    "source_url" "text",
    "observed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "geck_data"."show_mentions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "geck_data"."sold_listings_v" WITH ("security_invoker"='true') AS
 SELECT "l"."id",
    "l"."seller_id",
    "l"."title",
    "l"."price",
    "l"."price_usd_equivalent",
    "l"."maturity",
    "l"."sex",
    "l"."cached_traits",
    "l"."norm_traits",
    "l"."first_seen_at",
    "lse"."observed_at" AS "sold_at",
    "lse"."days_since_first_seen" AS "days_to_sell",
    "lse"."source" AS "sold_source"
   FROM ("geck_data"."market_listings" "l"
     JOIN "geck_data"."listing_status_events" "lse" ON (("lse"."listing_id" = "l"."id")))
  WHERE ("lse"."status" = 'sold'::"text");


ALTER VIEW "geck_data"."sold_listings_v" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."trait_relations" (
    "trait_a" "text" NOT NULL,
    "trait_b" "text" NOT NULL,
    "relation" "text" NOT NULL,
    "note" "text"
);


ALTER TABLE "geck_data"."trait_relations" OWNER TO "postgres";


COMMENT ON TABLE "geck_data"."trait_relations" IS 'Pairs of trait labels that must not be treated as an independent two-trait combo. relation: allelic (same locus), overlapping_label (two names for one feature), expression_level (same trait, different degree).';



CREATE TABLE IF NOT EXISTS "geck_data"."trait_tiers" (
    "trait_token" "text" NOT NULL,
    "tier" integer NOT NULL,
    "display_name" "text" NOT NULL,
    "notes" "text",
    CONSTRAINT "trait_tiers_tier_check" CHECK ((("tier" >= 1) AND ("tier" <= 3)))
);


ALTER TABLE "geck_data"."trait_tiers" OWNER TO "postgres";


COMMENT ON TABLE "geck_data"."trait_tiers" IS 'Classification of trait tokens for combo profitability ranking. Tier 1 = genetic value-driver, Tier 2 = premium pattern, Tier 3 = cosmetic descriptor.';



CREATE TABLE IF NOT EXISTS "geck_data"."user_events" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "event_name" "text" NOT NULL,
    "user_email" "text",
    "page" "text",
    "session_id" "text",
    "source" "text",
    "properties" "jsonb",
    "created_by" "uuid",
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "geck_data"."user_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "geck_data"."user_notification_channels" (
    "id" "uuid" DEFAULT "extensions"."gen_random_uuid"() NOT NULL,
    "owner_id" "uuid",
    "kind" "text" NOT NULL,
    "endpoint" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_notification_channels_kind_check" CHECK (("kind" = ANY (ARRAY['discord_webhook'::"text", 'generic_webhook'::"text", 'email'::"text"])))
);


ALTER TABLE "geck_data"."user_notification_channels" OWNER TO "postgres";


CREATE OR REPLACE VIEW "geck_data"."v_combo_breadth" WITH ("security_invoker"='true') AS
 WITH "lt" AS (
         SELECT "ml"."id",
            "ml"."seller_id",
            "array_agg"(DISTINCT TRIM(BOTH ' '::"text" FROM "t"."t")) FILTER (WHERE (("length"(TRIM(BOTH ' '::"text" FROM "t"."t")) >= 2) AND ("length"(TRIM(BOTH ' '::"text" FROM "t"."t")) <= 60))) AS "traits"
           FROM "geck_data"."market_listings" "ml",
            LATERAL "unnest"("string_to_array"("ml"."cached_traits", ','::"text")) "t"("t")
          WHERE (("ml"."cached_traits" IS NOT NULL) AND ("ml"."species" = ANY (ARRAY['crested'::"text", 'unknown'::"text"])) AND (NOT "ml"."is_group_lot"))
          GROUP BY "ml"."id", "ml"."seller_id"
        ), "pairs" AS (
         SELECT ((LEAST("lt"."traits"["i"."i"], "lt"."traits"["j"."j"]) || ' x '::"text") || GREATEST("lt"."traits"["i"."i"], "lt"."traits"["j"."j"])) AS "combo_id",
            LEAST("lt"."traits"["i"."i"], "lt"."traits"["j"."j"]) AS "trait_a",
            GREATEST("lt"."traits"["i"."i"], "lt"."traits"["j"."j"]) AS "trait_b",
            "lt"."id",
            "lt"."seller_id"
           FROM "lt",
            LATERAL "generate_subscripts"("lt"."traits", 1) "i"("i"),
            LATERAL "generate_subscripts"("lt"."traits", 1) "j"("j")
          WHERE (("i"."i" < "j"."j") AND ("array_length"("lt"."traits", 1) >= 2))
        )
 SELECT "combo_id",
    "min"("trait_a") AS "trait_a",
    "min"("trait_b") AS "trait_b",
    "count"(DISTINCT "id") AS "n_listings",
    "count"(DISTINCT "seller_id") AS "n_sellers",
    "geck_data"."_traits_are_redundant"("min"("trait_a"), "min"("trait_b")) AS "is_redundant_pair"
   FROM "pairs"
  GROUP BY "combo_id";


ALTER VIEW "geck_data"."v_combo_breadth" OWNER TO "postgres";


COMMENT ON VIEW "geck_data"."v_combo_breadth" IS 'Evidence breadth per observed trait pair: unique listings and unique sellers, single animals only, plus is_redundant_pair for pairs that are really one trait. Read paths should require a real pair and a minimum breadth before charting a combo.';



CREATE OR REPLACE VIEW "geck_data"."v_combo_index_summary" WITH ("security_invoker"='true') AS
 WITH "latest" AS (
         SELECT DISTINCT ON ("combo_index_daily"."combo_id") "combo_index_daily"."combo_id",
            "combo_index_daily"."day" AS "latest_day",
            "combo_index_daily"."median_price" AS "current_value",
            "combo_index_daily"."n" AS "latest_n"
           FROM "geck_data"."combo_index_daily"
          ORDER BY "combo_index_daily"."combo_id", "combo_index_daily"."day" DESC
        ), "totals" AS (
         SELECT "combo_index_daily"."combo_id",
            ("sum"("combo_index_daily"."n"))::bigint AS "total_n",
            "count"(*) AS "observed_days",
            "min"("combo_index_daily"."day") AS "first_day"
           FROM "geck_data"."combo_index_daily"
          GROUP BY "combo_index_daily"."combo_id"
        )
 SELECT "l"."combo_id",
    "l"."latest_day",
    "l"."current_value",
    "l"."latest_n",
    COALESCE("t"."total_n", "l"."latest_n") AS "total_n",
        CASE
            WHEN ("l"."latest_day" < (CURRENT_DATE - 14)) THEN NULL::numeric
            WHEN (("b7"."median_price" IS NULL) OR ("b7"."median_price" = (0)::numeric)) THEN NULL::numeric
            ELSE "round"(((("l"."current_value" - "b7"."median_price") / "b7"."median_price") * (100)::numeric), 2)
        END AS "delta_7d",
        CASE
            WHEN ("l"."latest_day" < (CURRENT_DATE - 14)) THEN NULL::numeric
            WHEN (("b30"."median_price" IS NULL) OR ("b30"."median_price" = (0)::numeric)) THEN NULL::numeric
            ELSE "round"(((("l"."current_value" - "b30"."median_price") / "b30"."median_price") * (100)::numeric), 2)
        END AS "delta_30d",
        CASE
            WHEN ("l"."latest_day" < (CURRENT_DATE - 14)) THEN NULL::numeric
            WHEN (("b90"."median_price" IS NULL) OR ("b90"."median_price" = (0)::numeric)) THEN NULL::numeric
            ELSE "round"(((("l"."current_value" - "b90"."median_price") / "b90"."median_price") * (100)::numeric), 2)
        END AS "delta_90d",
    "t"."observed_days",
    "t"."first_day",
    ("l"."latest_day" < (CURRENT_DATE - 14)) AS "is_stale",
    (CURRENT_DATE - "l"."latest_day") AS "latest_age_days",
    "b7"."day" AS "baseline_7d_day",
    "b30"."day" AS "baseline_30d_day",
    "b90"."day" AS "baseline_90d_day",
        CASE
            WHEN ("b7"."day" IS NOT NULL) THEN ("l"."latest_day" - "b7"."day")
            ELSE NULL::integer
        END AS "baseline_7d_lag_days",
        CASE
            WHEN ("b30"."day" IS NOT NULL) THEN ("l"."latest_day" - "b30"."day")
            ELSE NULL::integer
        END AS "baseline_30d_lag_days",
        CASE
            WHEN ("b90"."day" IS NOT NULL) THEN ("l"."latest_day" - "b90"."day")
            ELSE NULL::integer
        END AS "baseline_90d_lag_days"
   FROM (((("latest" "l"
     LEFT JOIN "totals" "t" ON (("t"."combo_id" = "l"."combo_id")))
     LEFT JOIN LATERAL ( SELECT "c"."day",
            "c"."median_price"
           FROM "geck_data"."combo_index_daily" "c"
          WHERE (("c"."combo_id" = "l"."combo_id") AND ("c"."day" <= ("l"."latest_day" - 7)) AND ("c"."day" >= ("l"."latest_day" - (7 + GREATEST(7, (7 / 2))))))
          ORDER BY "c"."day" DESC
         LIMIT 1) "b7" ON (true))
     LEFT JOIN LATERAL ( SELECT "c"."day",
            "c"."median_price"
           FROM "geck_data"."combo_index_daily" "c"
          WHERE (("c"."combo_id" = "l"."combo_id") AND ("c"."day" <= ("l"."latest_day" - 30)) AND ("c"."day" >= ("l"."latest_day" - (30 + GREATEST(7, (30 / 2))))))
          ORDER BY "c"."day" DESC
         LIMIT 1) "b30" ON (true))
     LEFT JOIN LATERAL ( SELECT "c"."day",
            "c"."median_price"
           FROM "geck_data"."combo_index_daily" "c"
          WHERE (("c"."combo_id" = "l"."combo_id") AND ("c"."day" <= ("l"."latest_day" - 90)) AND ("c"."day" >= ("l"."latest_day" - (90 + GREATEST(7, (90 / 2))))))
          ORDER BY "c"."day" DESC
         LIMIT 1) "b90" ON (true));


ALTER VIEW "geck_data"."v_combo_index_summary" OWNER TO "postgres";


COMMENT ON VIEW "geck_data"."v_combo_index_summary" IS 'Per-combo latest value with 7/30/90d deltas anchored on the combo latest_day and bounded by baseline age. A null delta means no baseline inside the labeled horizon, which is not the same as no change. baseline_*_day and baseline_*_lag_days say what each delta was measured against.';



CREATE OR REPLACE VIEW "geck_data"."v_combo_price_distribution" WITH ("security_invoker"='true') AS
 SELECT "geck_data"."_combo_id_from_traits"(COALESCE("ml"."cached_traits", "ml"."norm_traits")) AS "combo_id",
    "count"(*) AS "n",
    "percentile_cont"((0.10)::double precision) WITHIN GROUP (ORDER BY ((COALESCE("ml"."price_usd_equivalent", "ml"."price"))::double precision)) AS "p10",
    "percentile_cont"((0.25)::double precision) WITHIN GROUP (ORDER BY ((COALESCE("ml"."price_usd_equivalent", "ml"."price"))::double precision)) AS "p25",
    "percentile_cont"((0.50)::double precision) WITHIN GROUP (ORDER BY ((COALESCE("ml"."price_usd_equivalent", "ml"."price"))::double precision)) AS "p50",
    "percentile_cont"((0.75)::double precision) WITHIN GROUP (ORDER BY ((COALESCE("ml"."price_usd_equivalent", "ml"."price"))::double precision)) AS "p75",
    "percentile_cont"((0.90)::double precision) WITHIN GROUP (ORDER BY ((COALESCE("ml"."price_usd_equivalent", "ml"."price"))::double precision)) AS "p90",
    "avg"(COALESCE("ml"."price_usd_equivalent", "ml"."price")) AS "mean_usd",
    "stddev"(COALESCE("ml"."price_usd_equivalent", "ml"."price")) AS "stddev_usd"
   FROM ("geck_data"."market_listings" "ml"
     JOIN "geck_data"."listing_status_events" "lse" ON ((("lse"."listing_id" = "ml"."id") AND ("lse"."status" = 'sold'::"text") AND ("lse"."observed_at" >= ("now"() - '180 days'::interval)))))
  WHERE (("ml"."species" = ANY (ARRAY['crested'::"text", 'unknown'::"text"])) AND (COALESCE("ml"."price_usd_equivalent", "ml"."price") IS NOT NULL) AND (COALESCE("ml"."price_usd_equivalent", "ml"."price") > (0)::double precision))
  GROUP BY ("geck_data"."_combo_id_from_traits"(COALESCE("ml"."cached_traits", "ml"."norm_traits")))
 HAVING ("geck_data"."_combo_id_from_traits"(COALESCE("ml"."cached_traits", "ml"."norm_traits")) IS NOT NULL);


ALTER VIEW "geck_data"."v_combo_price_distribution" OWNER TO "postgres";


CREATE OR REPLACE VIEW "geck_data"."v_cross_platform_arbitrage_pairs" WITH ("security_invoker"='true') AS
 SELECT "li"."listing_id",
    "xpl"."platform" AS "cross_platform",
    "xpl"."external_id" AS "cross_external_id",
    "xpli"."cross_platform_listing_id" AS "cross_listing_uuid",
    "ml"."price_usd_equivalent" AS "mm_price_usd",
    "xpl"."price_usd_equivalent" AS "xpl_price_usd",
        CASE
            WHEN (COALESCE("ml"."price_usd_equivalent", (0)::real) > (0)::double precision) THEN (((("xpl"."price_usd_equivalent")::double precision - "ml"."price_usd_equivalent") / "ml"."price_usd_equivalent") * (100.0)::double precision)
            ELSE NULL::double precision
        END AS "pct_delta",
    "abs"((COALESCE("ml"."price_usd_equivalent", (0)::real) - (COALESCE("xpl"."price_usd_equivalent", (0)::numeric))::double precision)) AS "abs_delta_usd",
    "li"."phash",
    "ml"."url" AS "mm_url",
    "xpl"."url" AS "xpl_url"
   FROM ((("geck_data"."listing_images" "li"
     JOIN "geck_data"."cross_platform_listing_images" "xpli" ON ((("xpli"."phash" = "li"."phash") AND ("xpli"."phash" IS NOT NULL))))
     JOIN "geck_data"."cross_platform_listings" "xpl" ON (("xpl"."id" = "xpli"."cross_platform_listing_id")))
     JOIN "geck_data"."market_listings" "ml" ON (("ml"."id" = "li"."listing_id")))
  WHERE ("li"."phash" IS NOT NULL);


ALTER VIEW "geck_data"."v_cross_platform_arbitrage_pairs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "geck_data"."v_daily_activity" WITH ("security_invoker"='true') AS
 SELECT "date_trunc"('day'::"text", "created_date") AS "day",
    "count"(DISTINCT "user_email") FILTER (WHERE ("user_email" IS NOT NULL)) AS "active_users",
    "count"(*) AS "event_count"
   FROM "geck_data"."user_events"
  WHERE ("created_date" >= ("now"() - '90 days'::interval))
  GROUP BY ("date_trunc"('day'::"text", "created_date"))
  ORDER BY ("date_trunc"('day'::"text", "created_date")) DESC;


ALTER VIEW "geck_data"."v_daily_activity" OWNER TO "postgres";


CREATE OR REPLACE VIEW "geck_data"."v_demand_index" WITH ("security_invoker"='true') AS
 WITH "views_7d" AS (
         SELECT "listing_views"."listing_id",
            "count"(*) AS "views"
           FROM "geck_data"."listing_views"
          WHERE ("listing_views"."observed_at" >= ("now"() - '7 days'::interval))
          GROUP BY "listing_views"."listing_id"
        ), "favs_7d" AS (
         SELECT "listing_favorites"."listing_id",
            "count"(*) AS "favs"
           FROM "geck_data"."listing_favorites"
          WHERE ("listing_favorites"."observed_at" >= ("now"() - '7 days'::interval))
          GROUP BY "listing_favorites"."listing_id"
        )
 SELECT "ml"."id" AS "listing_id",
    "geck_data"."_combo_id_from_traits"(COALESCE("ml"."cached_traits", "ml"."norm_traits")) AS "combo_id",
    COALESCE("v"."views", (0)::bigint) AS "views_7d",
    COALESCE("f"."favs", (0)::bigint) AS "favorites_7d",
    ("ln"(((COALESCE("v"."views", (0)::bigint) + 1))::double precision) * (((1)::numeric + ((COALESCE("f"."favs", (0)::bigint))::numeric / (GREATEST(COALESCE("v"."views", (0)::bigint), (1)::bigint))::numeric)))::double precision) AS "demand_score"
   FROM (("geck_data"."market_listings" "ml"
     LEFT JOIN "views_7d" "v" ON (("v"."listing_id" = "ml"."id")))
     LEFT JOIN "favs_7d" "f" ON (("f"."listing_id" = "ml"."id")))
  WHERE ("ml"."species" = ANY (ARRAY['crested'::"text", 'unknown'::"text"]));


ALTER VIEW "geck_data"."v_demand_index" OWNER TO "postgres";


CREATE OR REPLACE VIEW "geck_data"."v_ingest_daily" WITH ("security_invoker"='true') AS
 SELECT "date_trunc"('day'::"text", "received_at") AS "day",
    "count"(*) AS "requests",
    "sum"("event_count") AS "events",
    "sum"("ok_count") AS "ok",
    "sum"("failed_count") AS "failed",
    "round"(
        CASE
            WHEN ("sum"("event_count") = 0) THEN (100)::numeric
            ELSE ((100.0 * ("sum"("ok_count"))::numeric) / (NULLIF("sum"("event_count"), 0))::numeric)
        END, 1) AS "ok_pct",
    ("avg"("duration_ms"))::integer AS "avg_duration_ms"
   FROM "geck_data"."ingest_audit"
  WHERE ("received_at" >= ("now"() - '30 days'::interval))
  GROUP BY ("date_trunc"('day'::"text", "received_at"))
  ORDER BY ("date_trunc"('day'::"text", "received_at")) DESC;


ALTER VIEW "geck_data"."v_ingest_daily" OWNER TO "postgres";


CREATE OR REPLACE VIEW "geck_data"."v_ingest_health_24h" WITH ("security_invoker"='true') AS
 SELECT "count"(*) AS "total_requests",
    "count"(*) FILTER (WHERE (("status_code" >= 200) AND ("status_code" <= 299))) AS "ok_requests",
    "count"(*) FILTER (WHERE ("status_code" >= 400)) AS "error_requests",
    "sum"(COALESCE("event_count", 0)) AS "total_events",
    "sum"(COALESCE("ok_count", 0)) AS "events_ok",
    "sum"(COALESCE("failed_count", 0)) AS "events_failed",
    "percentile_cont"((0.5)::double precision) WITHIN GROUP (ORDER BY (("duration_ms")::double precision)) AS "p50_duration_ms",
    "percentile_cont"((0.95)::double precision) WITHIN GROUP (ORDER BY (("duration_ms")::double precision)) AS "p95_duration_ms",
    "max"("received_at") AS "last_ingest_at"
   FROM "geck_data"."ingest_audit"
  WHERE ("received_at" >= ("now"() - '24:00:00'::interval));


ALTER VIEW "geck_data"."v_ingest_health_24h" OWNER TO "postgres";


CREATE OR REPLACE VIEW "geck_data"."v_listing_labels" WITH ("security_invoker"='true') AS
 SELECT "id" AS "listing_id",
    "kind",
    "geck_data"."extract_listing_traits"("raw") AS "traits",
    ("raw" ->> 'species'::"text") AS "species",
    ("raw" ->> 'sex'::"text") AS "sex",
    (("raw" ->> 'price'::"text"))::numeric AS "price",
    NULLIF(("raw" ->> 'seller_id'::"text"), ''::"text") AS "seller_id",
    "updated_at"
   FROM "geck_data"."market_listings" "l";


ALTER VIEW "geck_data"."v_listing_labels" OWNER TO "postgres";


CREATE OR REPLACE VIEW "geck_data"."v_listing_week_price" WITH ("security_invoker"='true') AS
 SELECT DISTINCT ON ("ph"."listing_id", ("date_trunc"('week'::"text", "ph"."observed_at"))) ("date_trunc"('week'::"text", "ph"."observed_at"))::"date" AS "week_start",
    ("ph"."observed_at")::"date" AS "observed_day",
    "ph"."listing_id",
    "ph"."price_usd_equivalent" AS "price"
   FROM ("geck_data"."price_history" "ph"
     JOIN "geck_data"."market_listings" "ml" ON (("ml"."id" = "ph"."listing_id")))
  WHERE (("ph"."price_usd_equivalent" IS NOT NULL) AND ("ph"."price_usd_equivalent" > (0)::numeric) AND ("ph"."price_usd_equivalent" < (100000)::numeric) AND ("ml"."species" = ANY (ARRAY['crested'::"text", 'unknown'::"text"])) AND (NOT "ml"."is_group_lot"))
  ORDER BY "ph"."listing_id", ("date_trunc"('week'::"text", "ph"."observed_at")), "ph"."observed_at" DESC;


ALTER VIEW "geck_data"."v_listing_week_price" OWNER TO "postgres";


COMMENT ON VIEW "geck_data"."v_listing_week_price" IS 'Last USD-equivalent ask observed per listing per week, single animals only. The unit of a cross-sectional market median is a listing, not a scrape tick.';



CREATE OR REPLACE VIEW "geck_data"."v_market_sub_index_weekly" WITH ("security_invoker"='true') AS
 WITH "obs" AS (
         SELECT ("date_trunc"('week'::"text", "ph"."observed_at"))::"date" AS "week_start",
            COALESCE("ph"."price_usd_equivalent", "ph"."price") AS "price",
            "lower"(COALESCE("ml"."cached_traits", "ml"."norm_traits", ''::"text")) AS "traits_lower"
           FROM ("geck_data"."price_history" "ph"
             JOIN "geck_data"."market_listings" "ml" ON (("ml"."id" = "ph"."listing_id")))
          WHERE (("ph"."observed_at" >= ("now"() - '364 days'::interval)) AND ("ml"."species" = ANY (ARRAY['crested'::"text", 'unknown'::"text"])) AND (COALESCE("ph"."price_usd_equivalent", "ph"."price") IS NOT NULL) AND (COALESCE("ph"."price_usd_equivalent", "ph"."price") > (0)::numeric) AND (COALESCE("ph"."price_usd_equivalent", "ph"."price") < (100000)::numeric))
        ), "exploded" AS (
         SELECT "obs"."week_start",
            "obs"."price",
            'Lilly White'::"text" AS "anchor"
           FROM "obs"
          WHERE ("obs"."traits_lower" ~~ '%lilly white%'::"text")
        UNION ALL
         SELECT "obs"."week_start",
            "obs"."price",
            'Axanthic'::"text" AS "text"
           FROM "obs"
          WHERE ("obs"."traits_lower" ~~ '%axanthic%'::"text")
        UNION ALL
         SELECT "obs"."week_start",
            "obs"."price",
            'Harlequin'::"text" AS "text"
           FROM "obs"
          WHERE (("obs"."traits_lower" ~~ '%harlequin%'::"text") OR ("obs"."traits_lower" ~~ '%extreme harlequin%'::"text"))
        UNION ALL
         SELECT "obs"."week_start",
            "obs"."price",
            'Cappuccino'::"text" AS "text"
           FROM "obs"
          WHERE (("obs"."traits_lower" ~~ '%cappuccino%'::"text") OR ("obs"."traits_lower" ~~ '%sable%'::"text") OR ("obs"."traits_lower" ~~ '%frappuccino%'::"text"))
        )
 SELECT "week_start",
    "anchor",
    ("percentile_cont"((0.5)::double precision) WITHIN GROUP (ORDER BY (("price")::double precision)))::numeric AS "median_price",
    "count"(*) AS "n"
   FROM "exploded"
  GROUP BY "week_start", "anchor";


ALTER VIEW "geck_data"."v_market_sub_index_weekly" OWNER TO "postgres";


COMMENT ON VIEW "geck_data"."v_market_sub_index_weekly" IS 'Weekly median observed market price per anchor morph family. Sourced from price_history (live observations). Crested only.';



CREATE OR REPLACE VIEW "geck_data"."v_market_temperature" WITH ("security_invoker"='true') AS
 WITH "weeks" AS (
         SELECT ("generate_series"(("date_trunc"('week'::"text", "now"()) - '364 days'::interval), "date_trunc"('week'::"text", "now"()), '7 days'::interval))::"date" AS "week_start"
        ), "listings_per_week" AS (
         SELECT ("date_trunc"('week'::"text", "market_listings"."first_seen_at"))::"date" AS "week_start",
            ("count"(*))::numeric AS "listed_n"
           FROM "geck_data"."market_listings"
          WHERE (("market_listings"."species" = ANY (ARRAY['crested'::"text", 'unknown'::"text"])) AND ("market_listings"."first_seen_at" >= ("now"() - '364 days'::interval)))
          GROUP BY (("date_trunc"('week'::"text", "market_listings"."first_seen_at"))::"date")
        ), "sold_per_week" AS (
         SELECT ("date_trunc"('week'::"text", "lse"."observed_at"))::"date" AS "week_start",
            ("count"(*))::numeric AS "sold_n",
            "percentile_cont"((0.5)::double precision) WITHIN GROUP (ORDER BY ((COALESCE("ml"."price_usd_equivalent", "ml"."price"))::double precision)) AS "median_sold_usd",
            "percentile_cont"((0.5)::double precision) WITHIN GROUP (ORDER BY (("lse"."days_since_first_seen")::double precision)) AS "median_days_to_sell"
           FROM ("geck_data"."listing_status_events" "lse"
             JOIN "geck_data"."market_listings" "ml" ON (("ml"."id" = "lse"."listing_id")))
          WHERE (("lse"."status" = 'sold'::"text") AND ("ml"."species" = ANY (ARRAY['crested'::"text", 'unknown'::"text"])) AND ("lse"."observed_at" >= ("now"() - '364 days'::interval)))
          GROUP BY (("date_trunc"('week'::"text", "lse"."observed_at"))::"date")
        )
 SELECT "w"."week_start",
    COALESCE("lpw"."listed_n", (0)::numeric) AS "listed_n",
    COALESCE("spw"."sold_n", (0)::numeric) AS "sold_n",
        CASE
            WHEN (COALESCE("lpw"."listed_n", (0)::numeric) = (0)::numeric) THEN NULL::numeric
            ELSE (COALESCE("spw"."sold_n", (0)::numeric) / "lpw"."listed_n")
        END AS "sell_through",
    "spw"."median_sold_usd",
    "spw"."median_days_to_sell"
   FROM (("weeks" "w"
     LEFT JOIN "listings_per_week" "lpw" ON (("lpw"."week_start" = "w"."week_start")))
     LEFT JOIN "sold_per_week" "spw" ON (("spw"."week_start" = "w"."week_start")))
  ORDER BY "w"."week_start";


ALTER VIEW "geck_data"."v_market_temperature" OWNER TO "postgres";


CREATE OR REPLACE VIEW "geck_data"."v_model_spend_7d" WITH ("security_invoker"='true') AS
 SELECT "date_trunc"('day'::"text", "called_at") AS "day",
    "surface",
    "model",
    "count"(*) AS "call_count",
    "sum"(COALESCE("input_tokens", 0)) AS "input_tokens",
    "sum"(COALESCE("output_tokens", 0)) AS "output_tokens",
    "sum"(COALESCE("est_cost_cents", (0)::numeric)) AS "cost_cents",
    "count"(*) FILTER (WHERE ("error_code" IS NOT NULL)) AS "error_count"
   FROM "geck_data"."model_invocations"
  WHERE ("called_at" >= ("now"() - '7 days'::interval))
  GROUP BY ("date_trunc"('day'::"text", "called_at")), "surface", "model"
  ORDER BY ("date_trunc"('day'::"text", "called_at")) DESC, ("sum"(COALESCE("est_cost_cents", (0)::numeric))) DESC;


ALTER VIEW "geck_data"."v_model_spend_7d" OWNER TO "postgres";


CREATE OR REPLACE VIEW "geck_data"."v_morph_training" WITH ("security_invoker"='true') AS
 WITH "listing_traits" AS (
         SELECT "l"."listing_id",
            "l"."primary_image_url",
            "l"."all_image_urls",
            "l"."sex",
            "l"."maturity",
            "l"."price",
            "l"."currency",
            ( SELECT COALESCE("array_agg"("t"."t" ORDER BY "t"."t"), '{}'::"text"[]) AS "coalesce"
                   FROM "unnest"(COALESCE("l"."trait_array", '{}'::"text"[])) "t"("t")
                  WHERE "geck_data"."is_training_trait"("t"."t")) AS "traits",
                CASE (((('x'::"text" || "substr"("md5"("l"."listing_id"), 1, 2)))::bit(8))::integer % 100)
                    WHEN 0 THEN 'train'::"text"
                    WHEN 1 THEN 'train'::"text"
                    WHEN 2 THEN 'train'::"text"
                    WHEN 3 THEN 'train'::"text"
                    WHEN 4 THEN 'train'::"text"
                    WHEN 5 THEN 'train'::"text"
                    WHEN 6 THEN 'train'::"text"
                    WHEN 7 THEN 'train'::"text"
                    WHEN 8 THEN 'train'::"text"
                    WHEN 9 THEN 'train'::"text"
                    ELSE
                    CASE
                        WHEN ((((('x'::"text" || "substr"("md5"("l"."listing_id"), 1, 2)))::bit(8))::integer % 100) < 70) THEN 'train'::"text"
                        WHEN ((((('x'::"text" || "substr"("md5"("l"."listing_id"), 1, 2)))::bit(8))::integer % 100) < 85) THEN 'val'::"text"
                        ELSE 'test'::"text"
                    END
                END AS "split"
           FROM "geck_data"."listings" "l"
          WHERE (("l"."primary_image_url" IS NOT NULL) AND ("l"."is_active" IS NOT FALSE))
        )
 SELECT "listing_traits"."primary_image_url" AS "image_url",
    "listing_traits"."listing_id",
    "listing_traits"."traits",
    "listing_traits"."sex",
    "listing_traits"."maturity",
    "listing_traits"."price",
    "listing_traits"."currency",
    'scraper_primary'::"text" AS "source",
    "listing_traits"."split"
   FROM "listing_traits"
  WHERE ("listing_traits"."primary_image_url" IS NOT NULL)
UNION ALL
 SELECT "url"."url" AS "image_url",
    "lt"."listing_id",
    "lt"."traits",
    "lt"."sex",
    "lt"."maturity",
    "lt"."price",
    "lt"."currency",
    'scraper_array'::"text" AS "source",
    "lt"."split"
   FROM "listing_traits" "lt",
    LATERAL "unnest"(COALESCE("lt"."all_image_urls", '{}'::"text"[])) "url"("url")
  WHERE (("url"."url" IS NOT NULL) AND ("url"."url" <> "lt"."primary_image_url"))
UNION ALL
 SELECT ((('https://mmuglfphhwlaluyfyxsp.supabase.co/storage/v1/object/public/'::"text" || "li"."storage_bucket") || '/'::"text") || "li"."storage_path") AS "image_url",
        CASE
            WHEN ("li"."listing_id" ~~ 'mm_%'::"text") THEN SUBSTRING("li"."listing_id" FROM 4)
            ELSE "li"."listing_id"
        END AS "listing_id",
    ( SELECT COALESCE("array_agg"("t"."t" ORDER BY "t"."t"), '{}'::"text"[]) AS "coalesce"
           FROM "unnest"(COALESCE("l"."trait_array", '{}'::"text"[])) "t"("t")
          WHERE "geck_data"."is_training_trait"("t"."t")) AS "traits",
    "l"."sex",
    "l"."maturity",
    "l"."price",
    "l"."currency",
    'uploaded'::"text" AS "source",
        CASE (((('x'::"text" || "substr"("md5"("li"."listing_id"), 1, 2)))::bit(8))::integer % 100)
            WHEN 0 THEN 'train'::"text"
            WHEN 1 THEN 'train'::"text"
            WHEN 2 THEN 'train'::"text"
            WHEN 3 THEN 'train'::"text"
            WHEN 4 THEN 'train'::"text"
            WHEN 5 THEN 'train'::"text"
            WHEN 6 THEN 'train'::"text"
            WHEN 7 THEN 'train'::"text"
            WHEN 8 THEN 'train'::"text"
            WHEN 9 THEN 'train'::"text"
            ELSE
            CASE
                WHEN ((((('x'::"text" || "substr"("md5"("li"."listing_id"), 1, 2)))::bit(8))::integer % 100) < 70) THEN 'train'::"text"
                WHEN ((((('x'::"text" || "substr"("md5"("li"."listing_id"), 1, 2)))::bit(8))::integer % 100) < 85) THEN 'val'::"text"
                ELSE 'test'::"text"
            END
        END AS "split"
   FROM ("geck_data"."listing_images" "li"
     LEFT JOIN "geck_data"."listings" "l" ON (("l"."listing_id" =
        CASE
            WHEN ("li"."listing_id" ~~ 'mm_%'::"text") THEN SUBSTRING("li"."listing_id" FROM 4)
            ELSE "li"."listing_id"
        END)));


ALTER VIEW "geck_data"."v_morph_training" OWNER TO "postgres";


CREATE OR REPLACE VIEW "geck_data"."v_morph_training_canonical" WITH ("security_invoker"='true') AS
 WITH "rows" AS (
         SELECT "v"."image_url",
            "v"."listing_id",
            "v"."traits",
            "v"."sex",
            "v"."maturity",
            "v"."price",
            "v"."currency",
            "v"."source",
            "v"."split",
            "l"."seller_name",
            "l"."seller_slug"
           FROM ("geck_data"."v_morph_training" "v"
             LEFT JOIN "geck_data"."listings" "l" ON (("l"."listing_id" = "v"."listing_id")))
          WHERE ("array_length"(COALESCE("v"."traits", '{}'::"text"[]), 1) > 0)
        ), "mapped" AS (
         SELECT "r"."image_url",
            "r"."listing_id",
            "r"."traits",
            "r"."sex",
            "r"."maturity",
            "r"."price",
            "r"."currency",
            "r"."source",
            "r"."split",
            "r"."seller_name",
            "r"."seller_slug",
            ( SELECT "array_agg"(DISTINCT "c"."canonical_id") AS "array_agg"
                   FROM ("unnest"("r"."traits") "t"("t")
                     JOIN "geck_data"."crested_morph_taxonomy" "c" ON (("c"."canonical_name" = "t"."t")))
                  WHERE (("c"."canonical_id" IS NOT NULL) AND ("c"."trait_kind" = 'primary_morph'::"text"))) AS "primary_morph_ids",
            ( SELECT "array_agg"(DISTINCT "c"."canonical_id") AS "array_agg"
                   FROM ("unnest"("r"."traits") "t"("t")
                     JOIN "geck_data"."crested_morph_taxonomy" "c" ON (("c"."canonical_name" = "t"."t")))
                  WHERE (("c"."canonical_id" IS NOT NULL) AND ("c"."trait_kind" = 'genetic_trait'::"text"))) AS "genetic_trait_ids",
            ( SELECT "array_agg"(DISTINCT "c"."canonical_id") AS "array_agg"
                   FROM ("unnest"("r"."traits") "t"("t")
                     JOIN "geck_data"."crested_morph_taxonomy" "c" ON (("c"."canonical_name" = "t"."t")))
                  WHERE (("c"."canonical_id" IS NOT NULL) AND ("c"."trait_kind" = 'secondary_trait'::"text"))) AS "secondary_trait_ids",
            ( SELECT "c"."canonical_id"
                   FROM ("unnest"("r"."traits") "t"("t")
                     JOIN "geck_data"."crested_morph_taxonomy" "c" ON (("c"."canonical_name" = "t"."t")))
                  WHERE (("c"."canonical_id" IS NOT NULL) AND ("c"."trait_kind" = 'base_color'::"text"))
                 LIMIT 1) AS "base_color_id"
           FROM "rows" "r"
        )
 SELECT "image_url",
    "listing_id",
    "primary_morph_ids"[1] AS "primary_morph",
    COALESCE("genetic_trait_ids", '{}'::"text"[]) AS "genetic_traits",
    COALESCE("secondary_trait_ids", '{}'::"text"[]) AS "secondary_traits",
    "base_color_id" AS "base_color",
    "sex",
    "maturity",
    "price",
    "currency",
    "source",
    "split",
    "traits" AS "original_traits",
    "seller_name",
    "seller_slug"
   FROM "mapped"
  WHERE ("primary_morph_ids"[1] IS NOT NULL);


ALTER VIEW "geck_data"."v_morph_training_canonical" OWNER TO "postgres";


COMMENT ON VIEW "geck_data"."v_morph_training_canonical" IS 'Canonical weak-label Morph ID rows with listing and breeder provenance for source-independent retrieval and evaluation.';



CREATE OR REPLACE VIEW "geck_data"."v_morph_training_stats" WITH ("security_invoker"='true') AS
 WITH "images_by_split" AS (
         SELECT "v_morph_training"."split",
            "count"(*) AS "n"
           FROM "geck_data"."v_morph_training"
          WHERE (("v_morph_training"."traits" IS NOT NULL) AND ("array_length"("v_morph_training"."traits", 1) > 0))
          GROUP BY "v_morph_training"."split"
        ), "per_trait" AS (
         SELECT "t"."t" AS "trait",
            "count"(*) AS "image_count",
            "count"(DISTINCT "v_morph_training"."listing_id") AS "listing_count"
           FROM "geck_data"."v_morph_training",
            LATERAL "unnest"(COALESCE("v_morph_training"."traits", '{}'::"text"[])) "t"("t")
          WHERE ("array_length"("v_morph_training"."traits", 1) > 0)
          GROUP BY "t"."t"
        )
 SELECT 'split'::"text" AS "kind",
    "images_by_split"."split" AS "key",
    "images_by_split"."n" AS "image_count",
    NULL::integer AS "listing_count"
   FROM "images_by_split"
UNION ALL
 SELECT 'trait'::"text" AS "kind",
    "per_trait"."trait" AS "key",
    "per_trait"."image_count",
    "per_trait"."listing_count"
   FROM "per_trait";


ALTER VIEW "geck_data"."v_morph_training_stats" OWNER TO "postgres";


CREATE OR REPLACE VIEW "geck_data"."v_observed_combos" WITH ("security_invoker"='true') AS
 WITH "traits_per_listing" AS (
         SELECT "ml"."id",
            COALESCE("ml"."price_usd_equivalent", "ml"."price") AS "price",
            "array_agg"(DISTINCT TRIM(BOTH FROM "t"."t")) FILTER (WHERE (("length"(TRIM(BOTH FROM "t"."t")) >= 2) AND ("length"(TRIM(BOTH FROM "t"."t")) <= 60))) AS "traits"
           FROM "geck_data"."market_listings" "ml",
            LATERAL "unnest"("string_to_array"("ml"."cached_traits", ','::"text")) "t"("t")
          WHERE (("ml"."cached_traits" IS NOT NULL) AND ("ml"."species" = ANY (ARRAY['crested'::"text", 'unknown'::"text"])) AND (COALESCE("ml"."price_usd_equivalent", "ml"."price") IS NOT NULL) AND (COALESCE("ml"."price_usd_equivalent", "ml"."price") > (0)::double precision) AND (COALESCE("ml"."price_usd_equivalent", "ml"."price") < (100000)::double precision))
          GROUP BY "ml"."id", COALESCE("ml"."price_usd_equivalent", "ml"."price")
        ), "pairs" AS (
         SELECT ((LEAST("t"."traits"["i"."i"], "t"."traits"["j"."j"]) || ' x '::"text") || GREATEST("t"."traits"["i"."i"], "t"."traits"["j"."j"])) AS "combo_name",
            "t"."price"
           FROM "traits_per_listing" "t",
            LATERAL "generate_subscripts"("t"."traits", 1) "i"("i"),
            LATERAL "generate_subscripts"("t"."traits", 1) "j"("j")
          WHERE (("i"."i" < "j"."j") AND ("array_length"("t"."traits", 1) >= 2))
        )
 SELECT "combo_name",
    "count"(*) AS "n",
    ("percentile_cont"((0.5)::double precision) WITHIN GROUP (ORDER BY (("price")::double precision)))::numeric AS "median_price"
   FROM "pairs"
  GROUP BY "combo_name"
 HAVING ("count"(*) >= 3)
  ORDER BY ("count"(*)) DESC;


ALTER VIEW "geck_data"."v_observed_combos" OWNER TO "postgres";


COMMENT ON VIEW "geck_data"."v_observed_combos" IS 'Every observed two-trait combination with >= 3 crested listings. Auto-discovered from cached_traits; not curated. Used by /indices.';



CREATE OR REPLACE VIEW "geck_data"."v_observed_traits" WITH ("security_invoker"='true') AS
 WITH "split" AS (
         SELECT TRIM(BOTH FROM "t"."t") AS "trait",
            COALESCE("ml"."price_usd_equivalent", "ml"."price") AS "price"
           FROM "geck_data"."market_listings" "ml",
            LATERAL "unnest"("string_to_array"("ml"."cached_traits", ','::"text")) "t"("t")
          WHERE (("ml"."cached_traits" IS NOT NULL) AND ("ml"."species" = ANY (ARRAY['crested'::"text", 'unknown'::"text"])) AND (COALESCE("ml"."price_usd_equivalent", "ml"."price") IS NOT NULL) AND (COALESCE("ml"."price_usd_equivalent", "ml"."price") > (0)::double precision) AND (COALESCE("ml"."price_usd_equivalent", "ml"."price") < (100000)::double precision))
        )
 SELECT "trait",
    "count"(*) AS "n",
    ("percentile_cont"((0.5)::double precision) WITHIN GROUP (ORDER BY (("price")::double precision)))::numeric AS "median_price"
   FROM "split"
  WHERE (("length"("trait") >= 2) AND ("length"("trait") <= 60))
  GROUP BY "trait"
 HAVING ("count"(*) >= 3)
  ORDER BY ("count"(*)) DESC;


ALTER VIEW "geck_data"."v_observed_traits" OWNER TO "postgres";


COMMENT ON VIEW "geck_data"."v_observed_traits" IS 'Every distinct trait token observed in market_listings.cached_traits with >= 3 listings. Sourced live; no curation. Used by /indices and Pulse anchor tiles.';



CREATE OR REPLACE VIEW "geck_data"."v_recent_combo_sales" WITH ("security_invoker"='true') AS
 SELECT "geck_data"."_combo_id_from_traits"(COALESCE("ml"."cached_traits", "ml"."norm_traits")) AS "combo_id",
    "ml"."id" AS "listing_id",
    COALESCE("ml"."price_usd_equivalent", "ml"."price") AS "sold_usd",
    "lse"."observed_at" AS "sold_at",
    "lse"."days_since_first_seen" AS "days_to_sell",
    "ml"."seller_name",
    "ml"."url" AS "source_url"
   FROM ("geck_data"."market_listings" "ml"
     JOIN "geck_data"."listing_status_events" "lse" ON ((("lse"."listing_id" = "ml"."id") AND ("lse"."status" = 'sold'::"text") AND ("lse"."observed_at" >= ("now"() - '180 days'::interval)))))
  WHERE (("ml"."species" = ANY (ARRAY['crested'::"text", 'unknown'::"text"])) AND (COALESCE("ml"."price_usd_equivalent", "ml"."price") IS NOT NULL) AND (COALESCE("ml"."price_usd_equivalent", "ml"."price") > (0)::double precision) AND ("geck_data"."_combo_id_from_traits"(COALESCE("ml"."cached_traits", "ml"."norm_traits")) IS NOT NULL))
  ORDER BY "lse"."observed_at" DESC;


ALTER VIEW "geck_data"."v_recent_combo_sales" OWNER TO "postgres";


CREATE OR REPLACE VIEW "geck_data"."v_seller_reputation" WITH ("security_invoker"='true') AS
 WITH "latest_snap" AS (
         SELECT DISTINCT ON ("seller_snapshots"."seller_id") "seller_snapshots"."seller_id",
            "seller_snapshots"."observed_at",
            "seller_snapshots"."feedback_count",
            "seller_snapshots"."seller_rating_score",
            "seller_snapshots"."five_star_rating",
            "seller_snapshots"."total_listings",
            "seller_snapshots"."avg_price",
            "seller_snapshots"."membership"
           FROM "geck_data"."seller_snapshots"
          ORDER BY "seller_snapshots"."seller_id", "seller_snapshots"."observed_at" DESC
        ), "sold_30d" AS (
         SELECT "ml"."seller_id",
            "count"(*) AS "sold_30d"
           FROM ("geck_data"."listing_status_events" "lse"
             JOIN "geck_data"."market_listings" "ml" ON (("ml"."id" = "lse"."listing_id")))
          WHERE (("lse"."status" = 'sold'::"text") AND ("lse"."observed_at" >= ("now"() - '30 days'::interval)) AND ("ml"."seller_id" IS NOT NULL))
          GROUP BY "ml"."seller_id"
        )
 SELECT "snap"."seller_id",
    "snap"."feedback_count",
    "snap"."seller_rating_score",
    "snap"."five_star_rating",
    "snap"."total_listings",
    "snap"."avg_price",
    "snap"."membership",
    COALESCE("sold_30d"."sold_30d", (0)::bigint) AS "sold_30d",
    "snap"."observed_at" AS "snapshot_at"
   FROM ("latest_snap" "snap"
     LEFT JOIN "sold_30d" ON (("sold_30d"."seller_id" = "snap"."seller_id")));


ALTER VIEW "geck_data"."v_seller_reputation" OWNER TO "postgres";


CREATE OR REPLACE VIEW "geck_data"."v_sold_reconciled" WITH ("security_invoker"='true') AS
 SELECT "ml"."id",
    "ml"."seller_id",
    "ml"."title",
    "ml"."price",
    "ml"."price_usd_equivalent",
    "ml"."maturity",
    "ml"."sex",
    "ml"."cached_traits",
    "ml"."first_seen_at",
    "lse"."observed_at" AS "sold_at",
    'captured_event'::"text" AS "sold_basis",
    "lse"."source" AS "sold_source",
    "ml"."is_group_lot",
        CASE
            WHEN ("ml"."first_seen_at" IS NULL) THEN NULL::integer
            WHEN (("lse"."observed_at" - "ml"."first_seen_at") < '01:00:00'::interval) THEN NULL::integer
            ELSE ("round"((EXTRACT(epoch FROM ("lse"."observed_at" - "ml"."first_seen_at")) / 86400.0)))::integer
        END AS "days_to_sell"
   FROM ("geck_data"."market_listings" "ml"
     JOIN "geck_data"."listing_status_events" "lse" ON ((("lse"."listing_id" = "ml"."id") AND ("lse"."status" = 'sold'::"text"))))
UNION ALL
 SELECT "ml"."id",
    "ml"."seller_id",
    "ml"."title",
    "ml"."price",
    "ml"."price_usd_equivalent",
    "ml"."maturity",
    "ml"."sex",
    "ml"."cached_traits",
    "ml"."first_seen_at",
    "l"."sold_at",
    'inferred_unseen'::"text" AS "sold_basis",
    'scraper'::"text" AS "sold_source",
    "ml"."is_group_lot",
        CASE
            WHEN ("ml"."first_seen_at" IS NULL) THEN NULL::integer
            WHEN (("l"."sold_at" - "ml"."first_seen_at") < '01:00:00'::interval) THEN NULL::integer
            ELSE ("round"((EXTRACT(epoch FROM ("l"."sold_at" - "ml"."first_seen_at")) / 86400.0)))::integer
        END AS "days_to_sell"
   FROM ("geck_data"."listings" "l"
     JOIN "geck_data"."market_listings" "ml" ON (("ml"."id" = ('mm_'::"text" || "l"."listing_id"))))
  WHERE (("l"."sold_at" IS NOT NULL) AND (NOT (EXISTS ( SELECT 1
           FROM "geck_data"."listing_status_events" "e"
          WHERE (("e"."listing_id" = "ml"."id") AND ("e"."status" = 'sold'::"text"))))));


ALTER VIEW "geck_data"."v_sold_reconciled" OWNER TO "postgres";


COMMENT ON VIEW "geck_data"."v_sold_reconciled" IS 'Both sold pools with explicit provenance. sold_basis = captured_event (the pipeline saw the transition) or inferred_unseen (the catalog walk stopped seeing the listing, so a sale is inferred). Prices are last observed asks in both cases, never negotiated prices. days_to_sell is null when first_seen and sold were stamped in the same import.';



CREATE OR REPLACE VIEW "geck_data"."v_supply_pipeline_monthly" WITH ("security_invoker"='true') AS
 WITH "months" AS (
         SELECT ("generate_series"((("date_trunc"('month'::"text", "now"()))::"date")::timestamp with time zone, ((("date_trunc"('month'::"text", "now"()) + '8 mons'::interval))::"date")::timestamp with time zone, '1 mon'::interval))::"date" AS "month_start"
        ), "confirmed" AS (
         SELECT ("date_trunc"('month'::"text", ("c"."expected_hatch_on")::timestamp with time zone))::"date" AS "month_start",
            COALESCE("p"."combo_name", 'Unknown'::"text") AS "combo_name",
            "sum"(COALESCE("c"."fertile_count", ((("c"."egg_count")::numeric * 0.8))::integer)) AS "projected"
           FROM ("geck_data"."clutches" "c"
             JOIN "geck_data"."breeding_pairs" "p" ON (("p"."id" = "c"."pair_id")))
          WHERE (("c"."expected_hatch_on" >= ("date_trunc"('month'::"text", "now"()))::"date") AND ("c"."expected_hatch_on" < (("date_trunc"('month'::"text", "now"()) + '9 mons'::interval))::"date"))
          GROUP BY (("date_trunc"('month'::"text", ("c"."expected_hatch_on")::timestamp with time zone))::"date"), COALESCE("p"."combo_name", 'Unknown'::"text")
        ), "active_pair_counts" AS (
         SELECT COALESCE("p"."combo_name", 'Unknown'::"text") AS "combo_name",
            "count"(*) AS "pair_n"
           FROM "geck_data"."breeding_pairs" "p"
          WHERE "p"."active"
          GROUP BY "p"."combo_name"
        ), "seasonal" AS (
         SELECT "m"."month_start",
            (EXTRACT(month FROM "m"."month_start"))::integer AS "mo",
                CASE (EXTRACT(month FROM "m"."month_start"))::integer
                    WHEN 4 THEN 0.9
                    WHEN 5 THEN 1.0
                    WHEN 6 THEN 0.9
                    WHEN 7 THEN 0.7
                    WHEN 8 THEN 0.45
                    WHEN 3 THEN 0.6
                    WHEN 9 THEN 0.25
                    ELSE 0.1
                END AS "clutch_rate"
           FROM "months" "m"
        ), "projected" AS (
         SELECT "s"."month_start",
            "a"."combo_name",
            ("round"((((("a"."pair_n")::numeric * "s"."clutch_rate") * 2.0) * 0.8)))::integer AS "projected"
           FROM ("seasonal" "s"
             CROSS JOIN "active_pair_counts" "a")
        )
 SELECT "month_start",
    "combo_name",
    (COALESCE("sum"("projected"), (0)::numeric))::integer AS "projected_juveniles"
   FROM ( SELECT "confirmed"."month_start",
            "confirmed"."combo_name",
            "confirmed"."projected"
           FROM "confirmed"
        UNION ALL
         SELECT "projected"."month_start",
            "projected"."combo_name",
            "projected"."projected"
           FROM "projected") "u"
  GROUP BY "month_start", "combo_name"
  ORDER BY "month_start", "combo_name";


ALTER VIEW "geck_data"."v_supply_pipeline_monthly" OWNER TO "postgres";


CREATE OR REPLACE VIEW "geck_data"."v_training_pairs" WITH ("security_invoker"='true') AS
 SELECT 'uploaded'::"text" AS "image_source",
    (((("current_setting"('app.supabase_public_url'::"text", true) || '/storage/v1/object/public/'::"text") || "i"."storage_bucket") || '/'::"text") || "i"."storage_path") AS "image_url",
    "i"."listing_id",
    "lab"."traits",
    "lab"."species",
    "lab"."sex",
    "lab"."price",
    "lab"."seller_id",
    "i"."uploaded_at" AS "captured_at"
   FROM ("geck_data"."listing_images" "i"
     LEFT JOIN "geck_data"."v_listing_labels" "lab" ON (("lab"."listing_id" = "i"."listing_id")))
UNION ALL
 SELECT 'morphmarket_cdn'::"text" AS "image_source",
    "url"."url" AS "image_url",
    "lab"."listing_id",
    "lab"."traits",
    "lab"."species",
    "lab"."sex",
    "lab"."price",
    "lab"."seller_id",
    "lab"."updated_at" AS "captured_at"
   FROM ("geck_data"."v_listing_labels" "lab"
     CROSS JOIN LATERAL "unnest"(COALESCE("geck_data"."extract_listing_image_urls"(( SELECT "market_listings"."raw"
           FROM "geck_data"."market_listings"
          WHERE ("market_listings"."id" = "lab"."listing_id"))), '{}'::"text"[])) "url"("url"));


ALTER VIEW "geck_data"."v_training_pairs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "geck_data"."v_trait_frequencies" WITH ("security_invoker"='true') AS
 SELECT "t"."t" AS "trait",
    "count"(*) AS "listing_count"
   FROM "geck_data"."v_listing_labels",
    LATERAL "unnest"(COALESCE("v_listing_labels"."traits", '{}'::"text"[])) "t"("t")
  GROUP BY "t"."t"
  ORDER BY ("count"(*)) DESC;


ALTER VIEW "geck_data"."v_trait_frequencies" OWNER TO "postgres";


CREATE OR REPLACE VIEW "geck_data"."v_trait_recognition_metrics" WITH ("security_invoker"='true') AS
 WITH "pairs" AS (
         SELECT "mi"."id" AS "invocation_id",
            "mi"."predicted_combo_id" AS "predicted",
            "mhl"."combo_id" AS "actual",
            "mhl"."traits" AS "actual_traits",
            "mi"."called_at"
           FROM ("geck_data"."model_invocations" "mi"
             JOIN "geck_data"."morph_human_labels" "mhl" ON (("mhl"."invocation_id" = "mi"."id")))
          WHERE ("mi"."called_at" >= ("now"() - '30 days'::interval))
        ), "agg" AS (
         SELECT "unnest"(COALESCE("pairs"."actual_traits", ARRAY[]::"text"[])) AS "trait",
            "count"(*) AS "samples",
            "count"(*) FILTER (WHERE ("pairs"."predicted" = "pairs"."actual")) AS "combo_correct",
            "count"(*) FILTER (WHERE ("pairs"."predicted" IS NULL)) AS "model_silent"
           FROM "pairs"
          GROUP BY ("unnest"(COALESCE("pairs"."actual_traits", ARRAY[]::"text"[])))
        )
 SELECT "trait",
    "samples",
    "combo_correct",
    "model_silent",
        CASE
            WHEN ("samples" > 0) THEN (("combo_correct")::numeric / ("samples")::numeric)
            ELSE NULL::numeric
        END AS "combo_accuracy"
   FROM "agg"
  ORDER BY "samples" DESC;


ALTER VIEW "geck_data"."v_trait_recognition_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description_md" "text",
    "category" "text" DEFAULT 'manual'::"text" NOT NULL,
    "source_key" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "priority" integer DEFAULT 50 NOT NULL,
    "link_url" "text",
    "link_label" "text",
    "due_date" "date",
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "created_by" "uuid",
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    CONSTRAINT "admin_tasks_category_check" CHECK (("category" = ANY (ARRAY['launch'::"text", 'auto'::"text", 'manual'::"text", 'misc'::"text"]))),
    CONSTRAINT "admin_tasks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'done'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."admin_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."answers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question_id" "uuid" NOT NULL,
    "author_id" "uuid",
    "body" "text" NOT NULL,
    "upvote_count" integer DEFAULT 0,
    "is_best_answer" boolean DEFAULT false,
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."answers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "is_public" boolean DEFAULT false NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blog_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."blog_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blog_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "event_type" "text" NOT NULL,
    "related_post_id" "uuid",
    "status" "text",
    "message" "text",
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."blog_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blog_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "excerpt" "text",
    "content_markdown" "text",
    "content_html" "text",
    "status" "public"."blog_post_status" DEFAULT 'draft'::"public"."blog_post_status" NOT NULL,
    "target_keyword" "text",
    "category_id" "uuid",
    "tag_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "author_name" "text",
    "author_bio" "text",
    "author_avatar_url" "text",
    "featured_image_url" "text",
    "featured_image_alt" "text",
    "meta_title" "text",
    "meta_description" "text",
    "canonical_url" "text",
    "reading_time_minutes" integer DEFAULT 0 NOT NULL,
    "word_count" integer DEFAULT 0 NOT NULL,
    "scheduled_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."blog_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blog_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "blog_enabled" boolean DEFAULT true NOT NULL,
    "blog_name" "text" DEFAULT 'Geck Inspect Blog'::"text" NOT NULL,
    "blog_description" "text" DEFAULT ''::"text" NOT NULL,
    "default_author_name" "text",
    "default_author_bio" "text",
    "default_author_avatar_url" "text",
    "default_blog_route" "text" DEFAULT '/blog'::"text" NOT NULL,
    "posts_per_page" integer DEFAULT 12 NOT NULL,
    "show_author_box" boolean DEFAULT true NOT NULL,
    "show_related_posts" boolean DEFAULT true NOT NULL,
    "enable_ai_generation" boolean DEFAULT true NOT NULL,
    "enable_scheduled_publishing" boolean DEFAULT true NOT NULL,
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "blog_settings_posts_per_page_check" CHECK ((("posts_per_page" > 0) AND ("posts_per_page" <= 100)))
);


ALTER TABLE "public"."blog_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blog_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."blog_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."breeder_inquiries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "breeder_email" "text" NOT NULL,
    "breeder_slug" "text",
    "buyer_email" "text" NOT NULL,
    "buyer_name" "text",
    "buyer_phone" "text",
    "gecko_id" "text",
    "gecko_name" "text",
    "gecko_passport_code" "text",
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read_at" timestamp with time zone,
    "replied_at" timestamp with time zone
);


ALTER TABLE "public"."breeder_inquiries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."breeder_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "display_name" "text",
    "custom_slug" "text",
    "bio" "text",
    "location" "text",
    "years_breeding" integer,
    "specialty_morphs" "text"[] DEFAULT '{}'::"text"[],
    "social_links" "jsonb" DEFAULT '{}'::"jsonb",
    "profile_photo" "text",
    "banner_photo" "text",
    "is_verified" boolean DEFAULT false,
    "accepts_inquiries" boolean DEFAULT true,
    "ships_to" "text"[] DEFAULT '{}'::"text"[],
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."breeder_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."breeder_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reviewer_user_id" "uuid",
    "reviewed_user_id" "uuid" NOT NULL,
    "animal_id" "text",
    "rating" integer NOT NULL,
    "title" "text",
    "body" "text",
    "transaction_type" "text",
    "is_verified" boolean DEFAULT false,
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "breeder_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "breeder_reviews_transaction_type_check" CHECK (("transaction_type" = ANY (ARRAY['purchase'::"text", 'breeding_loan'::"text", 'trade'::"text"])))
);


ALTER TABLE "public"."breeder_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."breeder_store_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_email" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "tagline" "text",
    "description" "text",
    "header_image_url" "text",
    "contact_link" "text",
    "secondary_link" "text",
    "is_published" boolean DEFAULT false NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "policies" "text",
    "external_links" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "featured_gecko_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "featured_breeding_plan_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "slug_changed_at" timestamp with time zone,
    "slug_change_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."breeder_store_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."breeding_loans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "animal_id" "text" NOT NULL,
    "lender_user_id" "uuid",
    "borrower_user_id" "uuid",
    "borrower_email" "text",
    "borrower_name" "text",
    "status" "text" DEFAULT 'proposed'::"text",
    "purpose" "text",
    "loan_start" "date",
    "expected_return" "date",
    "actual_return" "date",
    "stud_fee" numeric(10,2),
    "stud_fee_paid" boolean DEFAULT false,
    "offspring_agreement" "text",
    "condition_on_loan" "text",
    "condition_on_return" "text",
    "condition_photos_out" "text"[] DEFAULT '{}'::"text"[],
    "condition_photos_in" "text"[] DEFAULT '{}'::"text"[],
    "breeding_project_id" "uuid",
    "notes" "text",
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "breeding_loans_status_check" CHECK (("status" = ANY (ARRAY['proposed'::"text", 'active'::"text", 'overdue'::"text", 'returned'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."breeding_loans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."breeding_plans" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "sire_id" "text" NOT NULL,
    "dam_id" "text" NOT NULL,
    "breeding_id" "text",
    "pairing_date" "date",
    "copulation_events" "jsonb" DEFAULT '[]'::"jsonb",
    "egg_check_day" numeric,
    "egg_check_count" numeric DEFAULT 0,
    "first_egg_lay_date" "date",
    "expected_lay_interval" numeric DEFAULT 31,
    "laying_active" boolean DEFAULT true,
    "dormant_since" "date",
    "status" "text" DEFAULT 'Planned'::"text",
    "notes" "text",
    "archived" boolean DEFAULT false,
    "archived_date" "date",
    "breeding_season" "text",
    "is_public" boolean DEFAULT false,
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."breeding_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."breeding_projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'planned'::"text",
    "sire_animal_id" "text",
    "sire_name" "text",
    "sire_morph" "text",
    "dam_animal_id" "text",
    "dam_name" "text",
    "dam_morph" "text",
    "planned_start" "date",
    "planned_end" "date",
    "target_clutch_count" integer DEFAULT 3,
    "acquisition_cost_sire" numeric(10,2) DEFAULT 0,
    "acquisition_cost_dam" numeric(10,2) DEFAULT 0,
    "feeding_cost_monthly" numeric(10,2) DEFAULT 0,
    "incubation_cost" numeric(10,2) DEFAULT 0,
    "housing_cost_monthly" numeric(10,2) DEFAULT 0,
    "other_costs" numeric(10,2) DEFAULT 0,
    "project_duration_months" integer DEFAULT 12,
    "actual_clutch_count" integer,
    "actual_total_revenue" numeric(10,2),
    "notes" "text",
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "breeding_projects_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'active'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."breeding_projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."care_guide_sections" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "order_position" numeric NOT NULL,
    "category" "text" NOT NULL,
    "image_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "is_published" boolean DEFAULT true,
    "source_url" "text",
    "last_updated" timestamp with time zone,
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."care_guide_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."change_logs" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "title" "text" NOT NULL,
    "week_label" "text" NOT NULL,
    "bullet_points" "jsonb" DEFAULT '[]'::"jsonb",
    "is_published" boolean DEFAULT false,
    "published_date" timestamp with time zone,
    "raw_notes" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."change_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classification_votes" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "gecko_image_id" "text" NOT NULL,
    "primary_morph" "text" NOT NULL,
    "secondary_traits" "jsonb" DEFAULT '[]'::"jsonb",
    "base_color" "text",
    "notes" "text",
    "verified" boolean DEFAULT false,
    "verified_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text",
    "reviewer_email" "text",
    "verdict" "text",
    "edits" "jsonb" DEFAULT '{}'::"jsonb",
    "label_fingerprint" "text",
    CONSTRAINT "classification_votes_verdict_chk" CHECK ((("verdict" IS NULL) OR ("verdict" = ANY (ARRAY['approve'::"text", 'reject'::"text"]))))
);


ALTER TABLE "public"."classification_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clutches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "clutch_number" integer NOT NULL,
    "laid_date" "date" NOT NULL,
    "egg_count" integer DEFAULT 2 NOT NULL,
    "infertile_count" integer DEFAULT 0,
    "incubation_temp_f" numeric(5,1),
    "expected_hatch_date" "date",
    "actual_hatch_date" "date",
    "status" "text" DEFAULT 'incubating'::"text",
    "hatchling_animal_ids" "text"[] DEFAULT '{}'::"text"[],
    "notes" "text",
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "clutches_status_check" CHECK (("status" = ANY (ARRAY['incubating'::"text", 'hatched'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."clutches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collection_valuations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "snapshot_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "total_value" numeric(12,2),
    "animal_valuations" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."collection_valuations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."collections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_event_reactions" (
    "event_type" "text" NOT NULL,
    "event_id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "reaction" "text" NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "community_event_reactions_reaction_check" CHECK (("reaction" = ANY (ARRAY['heart'::"text", 'congrats'::"text", 'fire'::"text"])))
);


ALTER TABLE "public"."community_event_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."direct_messages" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "sender_email" "text" NOT NULL,
    "recipient_email" "text" NOT NULL,
    "content" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "message_type" "text" DEFAULT 'direct'::"text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."direct_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."eggs" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "breeding_plan_id" "text" NOT NULL,
    "lay_date" "date" NOT NULL,
    "hatch_date_expected" "date",
    "hatch_date_actual" "date",
    "status" "text" DEFAULT 'Incubating'::"text",
    "gecko_id" "text",
    "archived" boolean DEFAULT false,
    "archived_date" "date",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."eggs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."error_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "level" "text" DEFAULT 'error'::"text" NOT NULL,
    "message" "text" NOT NULL,
    "stack" "text",
    "url" "text",
    "user_email" "text",
    "user_agent" "text",
    "context" "jsonb" DEFAULT '{}'::"jsonb",
    "resolved" boolean DEFAULT false,
    "resolved_by" "text",
    "resolved_date" timestamp with time zone,
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."error_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expert_actions" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "expert_email" "text" NOT NULL,
    "action_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."expert_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expert_verification_requests" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "user_email" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "experience_description" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "admin_response" "text",
    "reviewed_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."expert_verification_requests" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."external_reference_images" WITH ("security_invoker"='true') AS
 SELECT "id",
    "source_kind",
    "source_id",
    "source_url",
    "species",
    "morph_label",
    "norm_morph_label",
    "license",
    "attribution",
    "storage_bucket",
    "storage_path",
    "image_url",
    "width",
    "height",
    "captured_at",
    "imported_at",
    "raw"
   FROM "geck_data"."external_reference_images";


ALTER VIEW "public"."external_reference_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feature_credit_allotments" (
    "feature" "text" NOT NULL,
    "tier" "text" NOT NULL,
    "included" integer
);


ALTER TABLE "public"."feature_credit_allotments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feeding_groups" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "label" "text" NOT NULL,
    "name" "text",
    "diet_type" "text" NOT NULL,
    "interval_days" numeric NOT NULL,
    "last_fed_date" "date",
    "color" "text",
    "notes" "text",
    "auto_weight_min_g" numeric,
    "auto_weight_max_g" numeric,
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text",
    "feeding_reminder_enabled" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."feeding_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feeding_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "animal_id" "text" NOT NULL,
    "logged_by" "uuid",
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "food_type" "text",
    "accepted" boolean DEFAULT true,
    "notes" "text",
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."feeding_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_categories" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "order_position" numeric DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."forum_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_comments" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "post_id" "text" NOT NULL,
    "content" "text" NOT NULL,
    "author_name" "text" NOT NULL,
    "image_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "parent_comment_id" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."forum_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_likes" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "target_id" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."forum_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_posts" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "category_id" "text" NOT NULL,
    "author_name" "text" NOT NULL,
    "image_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "is_pinned" boolean DEFAULT false,
    "is_locked" boolean DEFAULT false,
    "view_count" numeric DEFAULT 0,
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."forum_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."future_breeding_plans" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "sire_id" "text" NOT NULL,
    "dam_id" "text" NOT NULL,
    "target_season" "text" NOT NULL,
    "target_year" integer NOT NULL,
    "goals" "text",
    "notes" "text",
    "notified" boolean DEFAULT false NOT NULL,
    "notified_date" timestamp with time zone,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text" NOT NULL,
    CONSTRAINT "future_breeding_plans_target_season_check" CHECK (("target_season" = ANY (ARRAY['spring'::"text", 'summer'::"text", 'fall'::"text", 'winter'::"text"]))),
    CONSTRAINT "future_breeding_plans_target_year_check" CHECK ((("target_year" >= 2020) AND ("target_year" <= 2100)))
);


ALTER TABLE "public"."future_breeding_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gecko_events" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "gecko_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "custom_event_name" "text",
    "event_date" timestamp with time zone NOT NULL,
    "notes" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."gecko_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gecko_images" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "image_url" "text" NOT NULL,
    "user_id" "text",
    "perceptual_hash" "text",
    "primary_morph" "text",
    "secondary_morph" "text",
    "secondary_traits" "jsonb" DEFAULT '[]'::"jsonb",
    "base_color" "text",
    "pattern_intensity" "text",
    "white_amount" "text",
    "confidence_score" numeric,
    "notes" "text",
    "verified" boolean DEFAULT false,
    "age_estimate" "text",
    "fired_state" "text",
    "annotations" "jsonb" DEFAULT '[]'::"jsonb",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text",
    "training_meta" "jsonb" DEFAULT '{}'::"jsonb",
    "image_embedding" "extensions"."vector"(768),
    "embedding_model" "text",
    "embedding_date" timestamp with time zone,
    "embedding_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "embedding_attempts" integer DEFAULT 0 NOT NULL,
    "embedding_error" "text",
    CONSTRAINT "gecko_images_embedding_status_check" CHECK (("embedding_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'ready'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."gecko_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gecko_likes" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "gecko_image_id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "owner_email" "text" NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."gecko_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gecko_of_the_day" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "date" "date" NOT NULL,
    "gecko_image_id" "text" NOT NULL,
    "appreciative_message" "text" NOT NULL,
    "uploader_email" "text" NOT NULL,
    "notification_sent" boolean DEFAULT false,
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."gecko_of_the_day" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gecko_waitlist_signups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "waitlist_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "notes" "text",
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."gecko_waitlist_signups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gecko_waitlists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "breeder_user_id" "uuid" NOT NULL,
    "gecko_id" "text",
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "max_signups" integer,
    "closes_at" timestamp with time zone,
    "is_open" boolean DEFAULT true NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."gecko_waitlists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."geckos" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "name" "text" NOT NULL,
    "species" "text" DEFAULT 'Crested Gecko'::"text",
    "hatch_date" "date",
    "sex" "text",
    "sire_id" "text",
    "dam_id" "text",
    "sire_name" "text",
    "dam_name" "text",
    "morphs_traits" "text",
    "morph_tags" "jsonb" DEFAULT '[]'::"jsonb",
    "notes" "text",
    "status" "text" DEFAULT 'Pet'::"text",
    "image_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "gecko_id_code" "text",
    "display_order" numeric,
    "asking_price" numeric,
    "weight_grams" numeric,
    "market_price_estimate" "jsonb",
    "morphmarket_id" "text",
    "morphmarket_url" "text",
    "palm_street_id" "text",
    "palm_street_url" "text",
    "marketplace_description" "text",
    "is_public" boolean DEFAULT true,
    "gallery_display" boolean DEFAULT false,
    "image_crop_data" "jsonb",
    "incubation_days" numeric,
    "archived" boolean DEFAULT false,
    "archived_date" "date",
    "archive_reason" "text",
    "feeding_group_id" "text",
    "is_gravid" boolean DEFAULT false,
    "gravid_since" "date",
    "egg_drop_date" "date",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text",
    "passport_code" "text",
    "pattern_grade" "text",
    "genetics_notes" "text",
    "breeder_name" "text",
    "breeder_user_id" "uuid",
    "hatch_facility" "text",
    "listing_price" numeric(10,2),
    "estimated_hatch_year" integer,
    "collection_id" "uuid",
    "quality_score" numeric(3,1),
    "last_meaningful_change_at" timestamp with time zone DEFAULT "now"(),
    "tail_status" "text",
    "growth_slideshow_enabled" boolean DEFAULT false NOT NULL,
    CONSTRAINT "geckos_pattern_grade_check" CHECK (("pattern_grade" = ANY (ARRAY['pet'::"text", 'breeder'::"text", 'high_end'::"text", 'investment'::"text"]))),
    CONSTRAINT "geckos_quality_score_check" CHECK ((("quality_score" IS NULL) OR (("quality_score" >= (0)::numeric) AND ("quality_score" <= (10)::numeric)))),
    CONSTRAINT "geckos_tail_status_check" CHECK ((("tail_status" IS NULL) OR ("tail_status" = ANY (ARRAY['intact'::"text", 'dropped'::"text", 'regenerating'::"text"]))))
);


ALTER TABLE "public"."geckos" OWNER TO "postgres";


COMMENT ON COLUMN "public"."geckos"."quality_score" IS 'Owner-set quality grade on the Geck Inspect Standard 0-10 scale. See docs/specs/P11-quality-rubric.md and /QualityScale. Tier (pet/breeder/high_end/investment) is derived; pattern_grade column mirrors the derived tier for backwards compatibility with Market Pricing.';



COMMENT ON COLUMN "public"."geckos"."tail_status" IS 'Tail condition: intact (original tail), dropped (caudal autotomy occurred, no regrowth — crested geckos do not regrow tails), regenerating (rare partial regrowth in juveniles). NULL = unknown / not tracked.';



CREATE TABLE IF NOT EXISTS "public"."genetic_outcome_predictions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "morph_combination" "text" NOT NULL,
    "probability" numeric(5,4) DEFAULT 0,
    "price_low" numeric(10,2) DEFAULT 0,
    "price_mid" numeric(10,2) DEFAULT 0,
    "price_high" numeric(10,2) DEFAULT 0,
    "expected_egg_count" numeric(6,2) DEFAULT 0,
    "sort_order" integer DEFAULT 0,
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."genetic_outcome_predictions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."genetics_trait_overrides" (
    "id" "text" NOT NULL,
    "patch" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."genetics_trait_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."giveaway_entries" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "giveaway_id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "user_name" "text",
    "created_date" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."giveaway_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."giveaways" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "gecko_id" "text",
    "title" "text" NOT NULL,
    "description" "text",
    "entry_method" "text" DEFAULT 'enter_on_site'::"text" NOT NULL,
    "entry_instructions" "text",
    "entry_url" "text",
    "prize_type" "text" DEFAULT 'gecko'::"text",
    "image_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "end_date" timestamp with time zone,
    "max_winners" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "winner_emails" "jsonb" DEFAULT '[]'::"jsonb",
    "created_by" "text" NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."giveaways" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."iot_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'govee'::"text" NOT NULL,
    "api_key" "text" NOT NULL,
    "device_mappings" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_polled_at" timestamp with time zone,
    "last_readings" "jsonb",
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."iot_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lineage_placeholders" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "gecko_id" "text" NOT NULL,
    "parent_type" "text" NOT NULL,
    "name" "text",
    "image_url" "text",
    "breeder_name" "text",
    "breeder_website" "text",
    "notes" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."lineage_placeholders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_costs" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "user_email" "text" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "date" "date" NOT NULL,
    "category" "text" DEFAULT 'other'::"text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."marketplace_costs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_likes" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "gecko_id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."marketplace_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mentor_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "owner_email" "text" NOT NULL,
    "headline" "text" NOT NULL,
    "bio_md" "text",
    "offer_type" "text" DEFAULT 'mentorship'::"text" NOT NULL,
    "specialties" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "years_experience" integer,
    "price_usd" numeric,
    "price_note" "text",
    "duration_minutes" integer,
    "availability_note" "text",
    "contact_method" "text" DEFAULT 'messages'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mentor_offers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."morph_guide_comments" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "morph_guide_id" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "content" "text" NOT NULL,
    "image_url" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "rejection_reason" "text",
    "is_helpful" boolean DEFAULT false,
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."morph_guide_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."morph_guides" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "morph_name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "key_features" "jsonb" DEFAULT '[]'::"jsonb",
    "example_image_url" "text",
    "rarity" "text",
    "breeding_info" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."morph_guides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."morph_price_cache" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "morph_name" "text" NOT NULL,
    "low_price" numeric,
    "high_price" numeric,
    "average_price" numeric NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text",
    "source" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."morph_price_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."morph_price_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "base_morph" "text",
    "morph_traits" "text"[],
    "pattern_grade" "text",
    "sex" "text",
    "age_category" "text",
    "sale_price" numeric(10,2) NOT NULL,
    "sale_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "source" "text" DEFAULT 'user_submitted'::"text",
    "submitted_by" "uuid",
    "is_anonymous" boolean DEFAULT true,
    "verified" boolean DEFAULT false,
    "notes" "text",
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "morph_price_entries_age_category_check" CHECK (("age_category" = ANY (ARRAY['hatchling'::"text", 'juvenile'::"text", 'subadult'::"text", 'adult'::"text"]))),
    CONSTRAINT "morph_price_entries_pattern_grade_check" CHECK (("pattern_grade" = ANY (ARRAY['pet'::"text", 'breeder'::"text", 'high_end'::"text", 'investment'::"text"]))),
    CONSTRAINT "morph_price_entries_sex_check" CHECK (("sex" = ANY (ARRAY['male'::"text", 'female'::"text"]))),
    CONSTRAINT "morph_price_entries_source_check" CHECK (("source" = ANY (ARRAY['user_submitted'::"text", 'curated_guide'::"text"])))
);


ALTER TABLE "public"."morph_price_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."morph_reference_images" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "morph_guide_id" "text" NOT NULL,
    "image_url" "text" NOT NULL,
    "submitted_by_email" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "rejection_reason" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."morph_reference_images" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."morph_taxonomy" WITH ("security_invoker"='true') AS
 SELECT "id",
    "species",
    "canonical_name",
    "norm_name",
    "inheritance",
    "allele_group",
    "parent_morphs",
    "synonyms",
    "description",
    "source_kind",
    "source_id",
    "source_url",
    "imported_at",
    "updated_at"
   FROM "geck_data"."morph_taxonomy";


ALTER VIEW "public"."morph_taxonomy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."morph_traits" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "type" "text" NOT NULL,
    "image_url" "text",
    "color" "text",
    "z_index" numeric DEFAULT 0 NOT NULL,
    "order_position" numeric,
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."morph_traits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."newsletter_subscribers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "source" "text",
    "user_id" "uuid",
    "consent_marketing" boolean DEFAULT true NOT NULL,
    "confirmed_at" timestamp with time zone,
    "unsubscribed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."newsletter_subscribers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "user_email" "text" NOT NULL,
    "type" "text" NOT NULL,
    "content" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "link" "text",
    "metadata" "jsonb",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."other_reptiles" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "name" "text" NOT NULL,
    "species" "text" NOT NULL,
    "morph" "text",
    "sex" "text",
    "birth_date" "date",
    "notes" "text",
    "image_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "feeding_reminder_enabled" boolean DEFAULT false,
    "feeding_interval_days" numeric DEFAULT 7,
    "last_fed_date" "date",
    "feeding_notification_enabled" boolean DEFAULT false,
    "feeding_email_enabled" boolean DEFAULT false,
    "archived" boolean DEFAULT false,
    "archived_date" "date",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."other_reptiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ownership_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "animal_id" "text" NOT NULL,
    "owner_user_id" "uuid",
    "owner_name" "text" NOT NULL,
    "owner_avatar_url" "text",
    "acquired_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "transfer_method" "text",
    "sale_price" numeric(10,2),
    "contributed_to_market_data" boolean DEFAULT false,
    "notes" "text",
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ownership_records_transfer_method_check" CHECK (("transfer_method" = ANY (ARRAY['original_breeder'::"text", 'purchased'::"text", 'gifted'::"text", 'breeding_loan_return'::"text"])))
);


ALTER TABLE "public"."ownership_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."page_config" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "page_name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "category" "text" DEFAULT 'public'::"text",
    "icon" "text" NOT NULL,
    "is_enabled" boolean DEFAULT true,
    "requires_auth" boolean DEFAULT false,
    "order_position" numeric DEFAULT 0,
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text",
    "section" "text"
);


ALTER TABLE "public"."page_config" OWNER TO "postgres";


COMMENT ON COLUMN "public"."page_config"."section" IS 'Top-level section bucket (manage/discover) shown in the admin panel. NULL means fall back to SECTION_FOR_PAGE in src/lib/navItems.js.';



CREATE TABLE IF NOT EXISTS "public"."pairing_outcome_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sire_id" "text",
    "dam_id" "text",
    "sire_label" "text" DEFAULT ''::"text" NOT NULL,
    "dam_label" "text" DEFAULT ''::"text" NOT NULL,
    "pairing_key" "text" NOT NULL,
    "tag_key" "text" DEFAULT ''::"text" NOT NULL,
    "predicted" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "observed" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "eggs" integer DEFAULT 2 NOT NULL,
    "hatched_on" "date",
    "notes" "text",
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pairing_outcome_logs_eggs_check" CHECK ((("eggs" >= 1) AND ("eggs" <= 4)))
);


ALTER TABLE "public"."pairing_outcome_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_events" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "user_email" "text" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_event_id" "text" NOT NULL,
    "stripe_subscription_id" "text",
    "stripe_invoice_id" "text",
    "event_type" "text" NOT NULL,
    "amount_cents" numeric,
    "currency" "text" DEFAULT 'usd'::"text",
    "membership_tier" "text",
    "billing_cycle" "text",
    "status" "text" NOT NULL,
    "failure_reason" "text",
    "raw_stripe_payload" "text",
    "event_timestamp" timestamp with time zone,
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."payment_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pending_sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_email" "text" NOT NULL,
    "gecko_id" "uuid",
    "gecko_name" "text" NOT NULL,
    "buyer_name" "text",
    "reserve_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "amount_paid" numeric(10,2) DEFAULT 0 NOT NULL,
    "payment_schedule" "jsonb" DEFAULT '[]'::"jsonb",
    "target_weight_grams" numeric(6,1),
    "current_weight_grams" numeric(6,1),
    "temp_change_from" "text",
    "temp_change_to" "text",
    "projected_ship_date" "date",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notes" "text",
    "completed_date" timestamp with time zone,
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pending_sales_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."pending_sales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."price_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "morph_query" "text" NOT NULL,
    "target_price" numeric(10,2) NOT NULL,
    "direction" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "last_triggered" timestamp with time zone,
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "price_alerts_direction_check" CHECK (("direction" = ANY (ARRAY['above'::"text", 'below'::"text"])))
);


ALTER TABLE "public"."price_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "role" "text" DEFAULT 'user'::"text",
    "membership_tier" "text" DEFAULT 'free'::"text",
    "membership_billing_cycle" "text",
    "membership_expires_at" timestamp with time zone,
    "profile_image_url" "text",
    "cover_image_url" "text",
    "bio" "text",
    "location" "text",
    "city" "text",
    "state_province" "text",
    "country" "text",
    "region" "text",
    "business_name" "text",
    "website_url" "text",
    "instagram_handle" "text",
    "facebook_url" "text",
    "youtube_url" "text",
    "tiktok_handle" "text",
    "is_expert" boolean DEFAULT false,
    "is_public_profile" boolean DEFAULT true,
    "sidebar_badge_preference" "text" DEFAULT 'collection'::"text",
    "looking_for" "jsonb" DEFAULT '[]'::"jsonb",
    "privacy_show_collection" boolean DEFAULT true,
    "privacy_show_activity" boolean DEFAULT true,
    "notifications_email" boolean DEFAULT true,
    "notifications_follows" boolean DEFAULT true,
    "notifications_messages" boolean DEFAULT true,
    "notifications_marketplace" boolean DEFAULT true,
    "notifications_following_activity" boolean DEFAULT true,
    "email_on_new_follower" boolean DEFAULT true,
    "email_on_new_message" boolean DEFAULT true,
    "email_on_following_activity" boolean DEFAULT true,
    "morphmarket_username" "text",
    "morphmarket_sync_enabled" boolean DEFAULT false,
    "palm_street_username" "text",
    "palm_street_sync_enabled" boolean DEFAULT false,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "subscription_status" "text",
    "total_points" numeric DEFAULT 0,
    "hatch_alert_days" numeric DEFAULT 60,
    "default_breeding_sort" "text",
    "extra_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text",
    "is_featured_breeder" boolean DEFAULT false NOT NULL,
    "store_policy" "text",
    "paid_membership_started_at" timestamp with time zone,
    "cgd_reorder_reminders_enabled" boolean DEFAULT true NOT NULL,
    "cgd_reorder_grams_per_gecko_per_week" numeric(8,2),
    "cgd_reorder_last_reminder_at" timestamp with time zone,
    "cgd_reorder_last_estimated_runout_at" timestamp with time zone,
    "push_notifications_enabled" boolean DEFAULT false NOT NULL,
    "push_notification_types" "text"[] DEFAULT ARRAY['new_message'::"text", 'marketplace_inquiry'::"text", 'hatch_alert'::"text", 'feeding_due'::"text", 'new_comment'::"text", 'new_reply'::"text", 'announcement'::"text"],
    "email_notifications_enabled" boolean DEFAULT true NOT NULL,
    "email_notification_types" "text"[] DEFAULT ARRAY['level_up'::"text", 'expert_status'::"text", 'new_message'::"text", 'new_follower'::"text", 'following_activity'::"text", 'gecko_of_day'::"text", 'forum_replies'::"text", 'breeding_updates'::"text", 'announcements'::"text"],
    "ui_theme" "text",
    "ui_secondary" "text",
    "social_post_credits" integer DEFAULT 0 NOT NULL,
    "keeper_trial_used" boolean DEFAULT false NOT NULL,
    "keeper_trial_started_at" timestamp with time zone,
    "social_brand_voice_default" "text",
    "morph_id_show_value_estimate" boolean DEFAULT false NOT NULL,
    "show_breeders_publicly" boolean DEFAULT true,
    "free_trial_used" boolean DEFAULT false NOT NULL,
    "free_trial_started_at" timestamp with time zone,
    "referral_code" "text",
    "referred_by" "text",
    "referral_signup_count" integer DEFAULT 0 NOT NULL,
    "referral_grant_until" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."membership_tier" IS 'free | keeper | breeder | enterprise. Treat unknown values as free at the app layer.';



COMMENT ON COLUMN "public"."profiles"."push_notifications_enabled" IS 'Master toggle for web push.';



COMMENT ON COLUMN "public"."profiles"."push_notification_types" IS 'Which Notification.type values to deliver via web push. Empty array = none.';



COMMENT ON COLUMN "public"."profiles"."email_notifications_enabled" IS 'Master toggle for transactional + alert emails.';



COMMENT ON COLUMN "public"."profiles"."email_notification_types" IS 'Which email-grouping keys to deliver. Empty array = all email muted (master toggle still rules).';



COMMENT ON COLUMN "public"."profiles"."ui_theme" IS 'Primary UI theme id (e.g. blizzard, normal, halloween-mask). Null = no cloud pref, fall back to localStorage default.';



COMMENT ON COLUMN "public"."profiles"."ui_secondary" IS 'Accent / secondary color id. Null = no cloud pref, fall back to localStorage default.';



COMMENT ON COLUMN "public"."profiles"."social_post_credits" IS 'Pool of post credits granted via the referral signup bonus and similar grants. Burned BEFORE the monthly included-posts allotment so users do not lose their included quota to free credits.';



COMMENT ON COLUMN "public"."profiles"."keeper_trial_used" IS 'True once a user has consumed their one-and-only 30-day Keeper trial. Prevents trial-hopping abuse.';



COMMENT ON COLUMN "public"."profiles"."free_trial_used" IS 'True once the account has started the standard free trial (stripe-checkout intent=trial). One per account, so cancelling and re-subscribing does not hand out a second trial.';



COMMENT ON COLUMN "public"."profiles"."free_trial_started_at" IS 'When the standard free trial was started. Null for accounts that went straight to a billed subscription.';



COMMENT ON COLUMN "public"."profiles"."referral_code" IS 'Short unique code for this member''s referral link (/?ref=<code>). Generated on insert.';



COMMENT ON COLUMN "public"."profiles"."referred_by" IS 'referral_code of the member who referred this account. Set once by apply_referral_code().';



COMMENT ON COLUMN "public"."profiles"."referral_signup_count" IS 'Number of referred members who have paid a first invoice.';



COMMENT ON COLUMN "public"."profiles"."referral_grant_until" IS 'End of the free Keeper month(s) earned through referrals. Null when no grant is active. expire_referral_grants() returns the member to free after this date.';



CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'custom'::"text",
    "related_gecko_id" "text",
    "related_breeding_plan_id" "text",
    "custom_relation" "text",
    "status" "text" DEFAULT 'active'::"text",
    "due_date" "date",
    "color" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promote_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "bytes" integer NOT NULL,
    "mime_type" "text" NOT NULL,
    "width" integer,
    "height" integer,
    "label_tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."promote_images" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."promote_image_usage" WITH ("security_invoker"='true') AS
 SELECT "user_id",
    COALESCE("sum"("bytes"), (0)::bigint) AS "bytes_used",
    ("count"(*))::integer AS "images_count"
   FROM "public"."promote_images"
  GROUP BY "user_id";


ALTER VIEW "public"."promote_image_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_email" "text" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "user_agent" "text",
    "platform" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."question_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "question_id" "uuid",
    "answer_id" "uuid",
    "value" integer DEFAULT 1,
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."question_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid",
    "title" "text" NOT NULL,
    "body" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'open'::"text",
    "best_answer_id" "uuid",
    "view_count" integer DEFAULT 0,
    "upvote_count" integer DEFAULT 0,
    "is_featured" boolean DEFAULT false,
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "questions_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'answered'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reptile_events" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "reptile_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "custom_event_name" "text",
    "event_date" timestamp with time zone NOT NULL,
    "notes" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."reptile_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."revenuecat_entitlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_user_id" "uuid" NOT NULL,
    "entitlement_identifier" "text" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "will_renew" boolean DEFAULT false NOT NULL,
    "period_type" "text",
    "store" "text",
    "product_identifier" "text",
    "latest_purchase_at" timestamp with time zone,
    "original_purchase_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "unsubscribe_detected_at" timestamp with time zone,
    "billing_issue_detected_at" timestamp with time zone,
    "last_event_id" "text",
    "last_event_type" "text",
    "last_event_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."revenuecat_entitlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."revenuecat_webhook_events" (
    "event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "app_user_id" "uuid",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload" "jsonb" NOT NULL
);


ALTER TABLE "public"."revenuecat_webhook_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scraped_training_data" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "image_url" "text" NOT NULL,
    "primary_morph" "text" NOT NULL,
    "secondary_traits" "jsonb" DEFAULT '[]'::"jsonb",
    "base_color" "text",
    "source_website" "text" NOT NULL,
    "confidence_score" numeric,
    "description" "text",
    "status" "text" DEFAULT 'pending_review'::"text",
    "admin_notes" "text",
    "scraped_sources" "jsonb" DEFAULT '[]'::"jsonb",
    "approved_by" "text",
    "gecko_image_id" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."scraped_training_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shed_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "animal_id" "text" NOT NULL,
    "logged_by" "uuid",
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "quality" "text",
    "notes" "text",
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "shed_records_quality_check" CHECK (("quality" = ANY (ARRAY['complete'::"text", 'retained_toes'::"text", 'retained_eye_caps'::"text", 'partial'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."shed_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shipping_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shipment_id" "text",
    "tracking_number" "text",
    "label_url" "text",
    "carrier" "text" DEFAULT 'FedEx'::"text",
    "service" "text",
    "status" "text" DEFAULT 'label_created'::"text",
    "price" numeric(10,2),
    "sender_name" "text",
    "sender_zip" "text",
    "recipient_name" "text",
    "recipient_city" "text",
    "recipient_state" "text",
    "recipient_zip" "text",
    "gecko_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "estimated_delivery" "date",
    "notes" "text",
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "shipping_orders_status_check" CHECK (("status" = ANY (ARRAY['label_created'::"text", 'picked_up'::"text", 'in_transit'::"text", 'out_for_delivery'::"text", 'delivered'::"text", 'arrival_confirmed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."shipping_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_generation_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid",
    "model" "text" NOT NULL,
    "input_tokens" integer DEFAULT 0 NOT NULL,
    "output_tokens" integer DEFAULT 0 NOT NULL,
    "cache_read_tokens" integer DEFAULT 0 NOT NULL,
    "cache_creation_tokens" integer DEFAULT 0 NOT NULL,
    "cents_cost" integer DEFAULT 0 NOT NULL,
    "kind" "text" DEFAULT 'generate'::"text" NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "social_generation_log_kind_check" CHECK (("kind" = ANY (ARRAY['generate'::"text", 'regenerate'::"text", 'voice_cycle'::"text", 'tweak'::"text"])))
);


ALTER TABLE "public"."social_generation_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_platform_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "account_handle" "text",
    "account_id" "text",
    "access_token" "text",
    "refresh_token" "text",
    "expires_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_used_at" timestamp with time zone,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "access_token_ciphertext" "text",
    "access_token_iv" "text",
    "refresh_token_ciphertext" "text",
    "refresh_token_iv" "text",
    CONSTRAINT "social_platform_connections_platform_check" CHECK (("platform" = ANY (ARRAY['bluesky'::"text", 'threads'::"text", 'reddit'::"text", 'facebook_page'::"text", 'instagram'::"text", 'x'::"text", 'tiktok'::"text"])))
);


ALTER TABLE "public"."social_platform_connections" OWNER TO "postgres";


COMMENT ON COLUMN "public"."social_platform_connections"."access_token" IS 'DEPRECATED for new writes. Plaintext token kept for backwards compat with rows written before encryption-at-rest landed. Read path falls back here if access_token_ciphertext is null. The set-platform-connection edge function clears this on every write.';



COMMENT ON COLUMN "public"."social_platform_connections"."access_token_ciphertext" IS 'AES-GCM ciphertext of the platform access token / app password, base64-encoded. Encrypted by set-platform-connection edge function; decrypted by publish-social-post.';



COMMENT ON COLUMN "public"."social_platform_connections"."access_token_iv" IS 'Base64-encoded 12-byte IV used for the AES-GCM encryption of access_token_ciphertext. Stored alongside ciphertext per row.';



CREATE TABLE IF NOT EXISTS "public"."social_post_photo_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "gecko_id" "text" NOT NULL,
    "gecko_image_id" "text" NOT NULL,
    "variant_id" "uuid",
    "platform" "text",
    "published_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."social_post_photo_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_post_variants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "content" "text" NOT NULL,
    "hashtags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "cta" "text",
    "image_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "scheduled_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    "platform_post_id" "text",
    "platform_post_url" "text",
    "publish_error" "text",
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "social_post_variants_platform_check" CHECK (("platform" = ANY (ARRAY['bluesky'::"text", 'threads'::"text", 'reddit'::"text", 'facebook_page'::"text", 'instagram'::"text", 'x'::"text", 'tiktok'::"text", 'youtube_community'::"text", 'clipboard'::"text"]))),
    CONSTRAINT "social_post_variants_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'queued'::"text", 'publishing'::"text", 'published'::"text", 'failed'::"text", 'copied'::"text"])))
);


ALTER TABLE "public"."social_post_variants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."social_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by_user_id" "uuid" NOT NULL,
    "created_by_email" "text" NOT NULL,
    "gecko_id" "text",
    "template" "text" NOT NULL,
    "voice_preset" "text",
    "voice_custom_id" "uuid",
    "tone" "text",
    "length_pref" "text",
    "starting_point" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "iteration_count" integer DEFAULT 0 NOT NULL,
    "scheduled_at" timestamp with time zone,
    "published_at" timestamp with time zone,
    "primary_variant_id" "uuid",
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "social_posts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'scheduled'::"text", 'publishing'::"text", 'published'::"text", 'failed'::"text", 'discarded'::"text"])))
);


ALTER TABLE "public"."social_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_affiliate_clicks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid",
    "vendor_id" "uuid",
    "user_id" "uuid",
    "session_token" "text",
    "source_path" "text",
    "user_agent" "text",
    "destination_url" "text" NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."store_affiliate_clicks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_cart_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cart_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price_cents_snapshot" bigint NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "customization" "jsonb",
    CONSTRAINT "store_cart_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "store_cart_items_unit_price_cents_snapshot_check" CHECK (("unit_price_cents_snapshot" >= 0))
);


ALTER TABLE "public"."store_cart_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."store_cart_items"."customization" IS 'Per-line personalization blob. For custom stickers: {kind:"custom_sticker", version, photo_url, name, hp, element, attacks[], ...}. Null for ordinary catalog lines.';



CREATE TABLE IF NOT EXISTS "public"."store_carts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid",
    "session_token" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "promo_code" "text",
    "notes" "text",
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    CONSTRAINT "cart_owner_xor" CHECK (((("owner_user_id" IS NOT NULL) AND ("session_token" IS NULL)) OR (("owner_user_id" IS NULL) AND ("session_token" IS NOT NULL)))),
    CONSTRAINT "store_carts_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'converted'::"text", 'abandoned'::"text"])))
);


ALTER TABLE "public"."store_carts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "parent_id" "uuid",
    "display_order" integer DEFAULT 100 NOT NULL,
    "is_gift_category" boolean DEFAULT false NOT NULL,
    "hero_image_url" "text",
    "seo_title" "text",
    "seo_description" "text",
    "seo_intro_md" "text",
    "seo_outro_md" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."store_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_fulfillments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "carrier" "text",
    "tracking_number" "text",
    "tracking_url" "text",
    "shipped_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "external_order_id" "text",
    "external_payload" "jsonb",
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."store_fulfillments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "fulfillment_mode" "public"."store_fulfillment_mode" NOT NULL,
    "product_name_snapshot" "text" NOT NULL,
    "vendor_sku_snapshot" "text",
    "quantity" integer NOT NULL,
    "unit_price_cents" bigint NOT NULL,
    "line_total_cents" bigint NOT NULL,
    "fulfillment_status" "public"."store_fulfillment_status" DEFAULT 'pending'::"public"."store_fulfillment_status" NOT NULL,
    "vendor_extra_snapshot" "jsonb",
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "customization" "jsonb",
    CONSTRAINT "store_order_items_line_total_cents_check" CHECK (("line_total_cents" >= 0)),
    CONSTRAINT "store_order_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "store_order_items_unit_price_cents_check" CHECK (("unit_price_cents" >= 0))
);


ALTER TABLE "public"."store_order_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."store_order_items"."customization" IS 'Snapshot of store_cart_items.customization at payment time. This is what production works from when printing a custom sticker.';



CREATE TABLE IF NOT EXISTS "public"."store_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_number" "text" NOT NULL,
    "owner_user_id" "uuid",
    "customer_email" "text" NOT NULL,
    "customer_name" "text",
    "status" "public"."store_order_status" DEFAULT 'pending'::"public"."store_order_status" NOT NULL,
    "stripe_checkout_session_id" "text",
    "stripe_payment_intent_id" "text",
    "stripe_customer_id" "text",
    "subtotal_cents" bigint DEFAULT 0 NOT NULL,
    "shipping_cents" bigint DEFAULT 0 NOT NULL,
    "tax_cents" bigint DEFAULT 0 NOT NULL,
    "discount_cents" bigint DEFAULT 0 NOT NULL,
    "total_cents" bigint DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "loyalty_cgd_sample_added" boolean DEFAULT false NOT NULL,
    "ship_to" "jsonb",
    "signup_grant_id" "uuid",
    "promo_code" "text",
    "notes" "text",
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "paid_at" timestamp with time zone,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."store_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "short_description" "text",
    "long_description_md" "text",
    "vendor_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "fulfillment_mode" "public"."store_fulfillment_mode" NOT NULL,
    "shipping_class" "public"."store_shipping_class" DEFAULT 'standard'::"public"."store_shipping_class" NOT NULL,
    "status" "public"."store_product_status" DEFAULT 'draft'::"public"."store_product_status" NOT NULL,
    "our_price_cents" bigint,
    "our_cost_cents" bigint,
    "compare_at_price_cents" bigint,
    "pricing_constraint" "public"."store_pricing_constraint" DEFAULT 'none'::"public"."store_pricing_constraint" NOT NULL,
    "map_floor_cents" bigint,
    "vendor_sku" "text",
    "vendor_product_url" "text",
    "vendor_extra" "jsonb",
    "inventory_tracked" boolean DEFAULT false NOT NULL,
    "inventory_count" integer DEFAULT 0 NOT NULL,
    "images" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "attributes" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "lifecycle_stage_tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "gift_friendly" boolean DEFAULT false NOT NULL,
    "price_tier" "text",
    "gift_audience" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "search_vector" "tsvector",
    "is_featured" boolean DEFAULT false NOT NULL,
    "weight_grams" integer,
    "free_shipping_eligible" boolean DEFAULT true NOT NULL,
    "ships_only_to_us" boolean DEFAULT true NOT NULL,
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_consumable_food" boolean DEFAULT false NOT NULL,
    "food_grams_per_gecko_per_week" numeric(8,2),
    "food_quantity_grams" integer,
    "food_brand_canonical" "text",
    CONSTRAINT "store_products_compare_at_price_cents_check" CHECK ((("compare_at_price_cents" IS NULL) OR ("compare_at_price_cents" >= 0))),
    CONSTRAINT "store_products_our_cost_cents_check" CHECK ((("our_cost_cents" IS NULL) OR ("our_cost_cents" >= 0))),
    CONSTRAINT "store_products_our_price_cents_check" CHECK ((("our_price_cents" IS NULL) OR ("our_price_cents" >= 0))),
    CONSTRAINT "store_products_price_tier_check" CHECK ((("price_tier" IS NULL) OR ("price_tier" = ANY (ARRAY['under_15'::"text", 'under_25'::"text", 'under_50'::"text", 'under_100'::"text", 'over_100'::"text"]))))
);


ALTER TABLE "public"."store_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_promo_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "description" "text",
    "kind" "text" NOT NULL,
    "amount_cents" bigint,
    "percent" integer,
    "min_subtotal_cents" bigint DEFAULT 0 NOT NULL,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "max_redemptions" integer,
    "redemptions" integer DEFAULT 0 NOT NULL,
    "per_user_limit" integer DEFAULT 1 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "store_promo_codes_kind_check" CHECK (("kind" = ANY (ARRAY['percent_off'::"text", 'amount_off'::"text", 'free_shipping'::"text"]))),
    CONSTRAINT "store_promo_codes_percent_check" CHECK ((("percent" IS NULL) OR (("percent" >= 1) AND ("percent" <= 100))))
);


ALTER TABLE "public"."store_promo_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_signup_grants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "source_order_id" "uuid",
    "granted_email" "text" NOT NULL,
    "granted_tier" "text" DEFAULT 'keeper'::"text" NOT NULL,
    "granted_duration_days" integer DEFAULT 90 NOT NULL,
    "ship_to_postal_hash" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "redeemed_at" timestamp with time zone,
    "redeemed_by_user_id" "uuid",
    "voided_at" timestamp with time zone,
    "void_reason" "text",
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."store_signup_grants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_vendors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "homepage_url" "text",
    "logo_url" "text",
    "affiliate_program" "text",
    "affiliate_default_tag" "text",
    "affiliate_disclosure" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."store_vendors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_webhook_logs" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "stripe_event_id" "text" NOT NULL,
    "stripe_event_type" "text" NOT NULL,
    "processing_status" "text" NOT NULL,
    "raw_payload" "text",
    "processed_at" timestamp with time zone,
    "error_message" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."stripe_webhook_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_messages" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "user_email" "text",
    "subject" "text" NOT NULL,
    "body" "text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "admin_notes" "text",
    "resolved_by" "text",
    "resolved_date" timestamp with time zone,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text",
    "source" "text" DEFAULT 'support'::"text",
    "page" "text",
    "rating" integer,
    CONSTRAINT "support_messages_rating_check" CHECK ((("rating" IS NULL) OR (("rating" >= 1) AND ("rating" <= 5)))),
    CONSTRAINT "support_messages_source_check" CHECK (("source" = ANY (ARRAY['support'::"text", 'feedback'::"text", 'bug_report'::"text", 'feature_request'::"text"]))),
    CONSTRAINT "support_messages_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'in_progress'::"text", 'resolved'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."support_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "project_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "is_completed" boolean DEFAULT false,
    "completed_date" timestamp with time zone,
    "due_date" timestamp with time zone,
    "parent_task_id" "text",
    "order_index" numeric DEFAULT 0,
    "is_recurring" boolean DEFAULT false,
    "recurring_interval_days" numeric,
    "last_completed_date" timestamp with time zone,
    "next_due_date" timestamp with time zone,
    "reminder_enabled" boolean DEFAULT false,
    "reminder_days_before" numeric,
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."testimonials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote" "text" NOT NULL,
    "author_name" "text" NOT NULL,
    "author_role" "text",
    "author_handle" "text",
    "author_url" "text",
    "avatar_url" "text",
    "approved" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "source_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approved_at" timestamp with time zone,
    "approved_by" "uuid"
);


ALTER TABLE "public"."testimonials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transfer_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "animal_id" "text" NOT NULL,
    "from_user_id" "uuid" NOT NULL,
    "to_email" "text" NOT NULL,
    "to_user_id" "uuid",
    "token" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "sale_price" numeric(10,2),
    "message" "text",
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "claimed_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '72:00:00'::interval) NOT NULL,
    "animal_type" "text" DEFAULT 'gecko'::"text" NOT NULL,
    CONSTRAINT "transfer_requests_animal_type_check" CHECK (("animal_type" = ANY (ARRAY['gecko'::"text", 'other_reptile'::"text"]))),
    CONSTRAINT "transfer_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'claimed'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."transfer_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_activity" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "user_email" "text" NOT NULL,
    "activity_type" "text" NOT NULL,
    "points" numeric NOT NULL,
    "related_entity_id" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."user_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_badges" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "user_email" "text" NOT NULL,
    "badge_type" "text" NOT NULL,
    "badge_name" "text" NOT NULL,
    "badge_description" "text" NOT NULL,
    "badge_icon" "text" NOT NULL,
    "requirements_met" "jsonb",
    "rarity" "text" DEFAULT 'common'::"text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."user_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_brand_voice" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "voice_text" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_date" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_brand_voice" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_name" "text" NOT NULL,
    "user_email" "text",
    "page" "text",
    "session_id" "text",
    "properties" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_follows" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "follower_email" "text" NOT NULL,
    "following_email" "text" NOT NULL,
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."user_follows" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_daily_activity" WITH ("security_invoker"='true') AS
 SELECT ("date_trunc"('day'::"text", "created_date"))::"date" AS "day",
    "count"(DISTINCT "user_email") AS "active_users",
    "count"(*) AS "event_count"
   FROM "public"."user_events"
  WHERE (("created_date" > ("now"() - '90 days'::interval)) AND ("user_email" IS NOT NULL))
  GROUP BY (("date_trunc"('day'::"text", "created_date"))::"date")
  ORDER BY (("date_trunc"('day'::"text", "created_date"))::"date") DESC;


ALTER VIEW "public"."v_daily_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vet_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "animal_id" "text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "vet_name" "text",
    "reason" "text",
    "findings" "text",
    "treatment" "text",
    "follow_up" "date",
    "attachments" "text"[] DEFAULT '{}'::"text"[],
    "created_by" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vet_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weight_records" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "gecko_id" "text" NOT NULL,
    "weight_grams" numeric NOT NULL,
    "record_date" "date" NOT NULL,
    "notes" "text",
    "created_date" timestamp with time zone DEFAULT "now"(),
    "updated_date" timestamp with time zone DEFAULT "now"(),
    "created_by" "text"
);


ALTER TABLE "public"."weight_records" OWNER TO "postgres";


ALTER TABLE ONLY "geck_data"."alert_delivery_attempts" ALTER COLUMN "id" SET DEFAULT "nextval"('"geck_data"."alert_delivery_attempts_id_seq"'::"regclass");



ALTER TABLE ONLY "geck_data"."auction_state" ALTER COLUMN "id" SET DEFAULT "nextval"('"geck_data"."auction_state_id_seq"'::"regclass");



ALTER TABLE ONLY "geck_data"."batch_jobs" ALTER COLUMN "id" SET DEFAULT "nextval"('"geck_data"."batch_jobs_id_seq"'::"regclass");



ALTER TABLE ONLY "geck_data"."ingest_events" ALTER COLUMN "id" SET DEFAULT "nextval"('"geck_data"."ingest_events_id_seq"'::"regclass");



ALTER TABLE ONLY "geck_data"."listing_favorites" ALTER COLUMN "id" SET DEFAULT "nextval"('"geck_data"."listing_favorites_id_seq"'::"regclass");



ALTER TABLE ONLY "geck_data"."listing_image_phash_pairs" ALTER COLUMN "id" SET DEFAULT "nextval"('"geck_data"."listing_image_phash_pairs_id_seq"'::"regclass");



ALTER TABLE ONLY "geck_data"."listing_views" ALTER COLUMN "id" SET DEFAULT "nextval"('"geck_data"."listing_views_id_seq"'::"regclass");



ALTER TABLE ONLY "geck_data"."listings_history" ALTER COLUMN "id" SET DEFAULT "nextval"('"geck_data"."listings_history_id_seq"'::"regclass");



ALTER TABLE ONLY "geck_data"."market_raw_captures" ALTER COLUMN "id" SET DEFAULT "nextval"('"geck_data"."market_raw_captures_id_seq"'::"regclass");



ALTER TABLE ONLY "geck_data"."model_invocations" ALTER COLUMN "id" SET DEFAULT "nextval"('"geck_data"."model_invocations_id_seq"'::"regclass");



ALTER TABLE ONLY "geck_data"."morph_eval_runs" ALTER COLUMN "id" SET DEFAULT "nextval"('"geck_data"."morph_eval_runs_id_seq"'::"regclass");



ALTER TABLE ONLY "geck_data"."morph_human_labels" ALTER COLUMN "id" SET DEFAULT "nextval"('"geck_data"."morph_human_labels_id_seq"'::"regclass");



ALTER TABLE ONLY "geck_data"."morph_taxonomy_synonyms" ALTER COLUMN "id" SET DEFAULT "nextval"('"geck_data"."morph_taxonomy_synonyms_id_seq"'::"regclass");



ALTER TABLE ONLY "geck_data"."morphs" ALTER COLUMN "id" SET DEFAULT "nextval"('"geck_data"."morphs_id_seq"'::"regclass");



ALTER TABLE ONLY "geck_data"."price_adjustment_factors" ALTER COLUMN "id" SET DEFAULT "nextval"('"geck_data"."price_adjustment_factors_id_seq"'::"regclass");



ALTER TABLE ONLY "geck_data"."runtime_config_history" ALTER COLUMN "id" SET DEFAULT "nextval"('"geck_data"."runtime_config_history_id_seq"'::"regclass");



ALTER TABLE ONLY "geck_data"."scrape_runs" ALTER COLUMN "id" SET DEFAULT "nextval"('"geck_data"."scrape_runs_id_seq"'::"regclass");



ALTER TABLE ONLY "geck_data"."alert_delivery_attempts"
    ADD CONSTRAINT "alert_delivery_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."alert_matches"
    ADD CONSTRAINT "alert_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."alerts"
    ADD CONSTRAINT "alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."anthropic_billing_daily"
    ADD CONSTRAINT "anthropic_billing_daily_pkey" PRIMARY KEY ("day");



ALTER TABLE ONLY "geck_data"."auction_results"
    ADD CONSTRAINT "auction_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."auction_state"
    ADD CONSTRAINT "auction_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."batch_jobs"
    ADD CONSTRAINT "batch_jobs_listing_id_model_surface_status_key" UNIQUE ("listing_id", "model", "surface", "status");



ALTER TABLE ONLY "geck_data"."batch_jobs"
    ADD CONSTRAINT "batch_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."breeding_pairs"
    ADD CONSTRAINT "breeding_pairs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."clutches"
    ADD CONSTRAINT "clutches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."combo_catalog"
    ADD CONSTRAINT "combo_catalog_pkey" PRIMARY KEY ("combo_name");



ALTER TABLE ONLY "geck_data"."crested_morph_taxonomy"
    ADD CONSTRAINT "crested_morph_taxonomy_pkey" PRIMARY KEY ("canonical_name");



ALTER TABLE ONLY "geck_data"."cross_platform_listing_images"
    ADD CONSTRAINT "cross_platform_listing_images_cross_platform_listing_id_ima_key" UNIQUE ("cross_platform_listing_id", "image_url");



ALTER TABLE ONLY "geck_data"."cross_platform_listing_images"
    ADD CONSTRAINT "cross_platform_listing_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."cross_platform_listings"
    ADD CONSTRAINT "cross_platform_listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."cross_platform_listings"
    ADD CONSTRAINT "cross_platform_listings_platform_external_id_key" UNIQUE ("platform", "external_id");



ALTER TABLE ONLY "geck_data"."error_logs"
    ADD CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."external_reference_images"
    ADD CONSTRAINT "external_reference_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."external_reference_images"
    ADD CONSTRAINT "external_reference_images_source_kind_source_id_key" UNIQUE ("source_kind", "source_id");



ALTER TABLE ONLY "geck_data"."hatchlings"
    ADD CONSTRAINT "hatchlings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."ingest_audit"
    ADD CONSTRAINT "ingest_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."ingest_events"
    ADD CONSTRAINT "ingest_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."listing_favorites"
    ADD CONSTRAINT "listing_favorites_listing_id_anon_hash_key" UNIQUE ("listing_id", "anon_hash");



ALTER TABLE ONLY "geck_data"."listing_favorites"
    ADD CONSTRAINT "listing_favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."listing_image_phash_pairs"
    ADD CONSTRAINT "listing_image_phash_pairs_left_image_id_right_image_id_key" UNIQUE ("left_image_id", "right_image_id");



ALTER TABLE ONLY "geck_data"."listing_image_phash_pairs"
    ADD CONSTRAINT "listing_image_phash_pairs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."listing_images"
    ADD CONSTRAINT "listing_images_listing_image_url_key" UNIQUE ("listing_id", "image_url");



ALTER TABLE ONLY "geck_data"."listing_images"
    ADD CONSTRAINT "listing_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."listing_images"
    ADD CONSTRAINT "listing_images_storage_bucket_storage_path_key" UNIQUE ("storage_bucket", "storage_path");



ALTER TABLE ONLY "geck_data"."listing_lineage"
    ADD CONSTRAINT "listing_lineage_listing_id_role_parent_id_parent_label_key" UNIQUE ("listing_id", "role", "parent_id", "parent_label");



ALTER TABLE ONLY "geck_data"."listing_lineage"
    ADD CONSTRAINT "listing_lineage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."listing_status_events"
    ADD CONSTRAINT "listing_status_events_listing_id_status_observed_at_key" UNIQUE ("listing_id", "status", "observed_at");



ALTER TABLE ONLY "geck_data"."listing_status_events"
    ADD CONSTRAINT "listing_status_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."listing_views"
    ADD CONSTRAINT "listing_views_listing_id_anon_hash_view_day_key" UNIQUE ("listing_id", "anon_hash", "view_day");



ALTER TABLE ONLY "geck_data"."listing_views"
    ADD CONSTRAINT "listing_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."listings_history"
    ADD CONSTRAINT "listings_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."listings"
    ADD CONSTRAINT "listings_pkey" PRIMARY KEY ("listing_id");



ALTER TABLE ONLY "geck_data"."market_auctions"
    ADD CONSTRAINT "market_auctions_pkey" PRIMARY KEY ("auction_id");



ALTER TABLE ONLY "geck_data"."market_galleries"
    ADD CONSTRAINT "market_galleries_pkey" PRIMARY KEY ("listing_key");



ALTER TABLE ONLY "geck_data"."market_lineage"
    ADD CONSTRAINT "market_lineage_pkey" PRIMARY KEY ("listing_key");



ALTER TABLE ONLY "geck_data"."market_listings"
    ADD CONSTRAINT "market_listings_morphmarket_key_key" UNIQUE ("morphmarket_key");



ALTER TABLE ONLY "geck_data"."market_listings"
    ADD CONSTRAINT "market_listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."market_raw_captures"
    ADD CONSTRAINT "market_raw_captures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."market_sellers"
    ADD CONSTRAINT "market_sellers_pkey" PRIMARY KEY ("seller_id");



ALTER TABLE ONLY "geck_data"."model_invocations"
    ADD CONSTRAINT "model_invocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."morph_eval_runs"
    ADD CONSTRAINT "morph_eval_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."morph_human_labels"
    ADD CONSTRAINT "morph_human_labels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."morph_taxonomy"
    ADD CONSTRAINT "morph_taxonomy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."morph_taxonomy"
    ADD CONSTRAINT "morph_taxonomy_species_norm_name_source_kind_key" UNIQUE ("species", "norm_name", "source_kind");



ALTER TABLE ONLY "geck_data"."morph_taxonomy_synonyms"
    ADD CONSTRAINT "morph_taxonomy_synonyms_alias_key" UNIQUE ("alias");



ALTER TABLE ONLY "geck_data"."morph_taxonomy_synonyms"
    ADD CONSTRAINT "morph_taxonomy_synonyms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."morphs"
    ADD CONSTRAINT "morphs_canonical_name_key" UNIQUE ("canonical_name");



ALTER TABLE ONLY "geck_data"."morphs"
    ADD CONSTRAINT "morphs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."price_adjustment_factors"
    ADD CONSTRAINT "price_adjustment_factors_category_bucket_key" UNIQUE ("category", "bucket");



ALTER TABLE ONLY "geck_data"."price_adjustment_factors"
    ADD CONSTRAINT "price_adjustment_factors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."price_drops"
    ADD CONSTRAINT "price_drops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."price_history"
    ADD CONSTRAINT "price_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."runtime_config_history"
    ADD CONSTRAINT "runtime_config_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."runtime_config"
    ADD CONSTRAINT "runtime_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "geck_data"."scrape_runs"
    ADD CONSTRAINT "scrape_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."seller_snapshots"
    ADD CONSTRAINT "seller_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."sellers"
    ADD CONSTRAINT "sellers_pkey" PRIMARY KEY ("seller_slug");



ALTER TABLE ONLY "geck_data"."show_mentions"
    ADD CONSTRAINT "show_mentions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."trait_relations"
    ADD CONSTRAINT "trait_relations_pkey" PRIMARY KEY ("trait_a", "trait_b");



ALTER TABLE ONLY "geck_data"."trait_tiers"
    ADD CONSTRAINT "trait_tiers_pkey" PRIMARY KEY ("trait_token");



ALTER TABLE ONLY "geck_data"."user_events"
    ADD CONSTRAINT "user_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "geck_data"."user_notification_channels"
    ADD CONSTRAINT "user_notification_channels_owner_id_kind_endpoint_key" UNIQUE ("owner_id", "kind", "endpoint");



ALTER TABLE ONLY "geck_data"."user_notification_channels"
    ADD CONSTRAINT "user_notification_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_tasks"
    ADD CONSTRAINT "admin_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_tasks"
    ADD CONSTRAINT "admin_tasks_source_key_key" UNIQUE ("source_key");



ALTER TABLE ONLY "public"."answers"
    ADD CONSTRAINT "answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."blog_categories"
    ADD CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_categories"
    ADD CONSTRAINT "blog_categories_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."blog_logs"
    ADD CONSTRAINT "blog_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."blog_settings"
    ADD CONSTRAINT "blog_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_settings"
    ADD CONSTRAINT "blog_settings_user_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."blog_tags"
    ADD CONSTRAINT "blog_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_tags"
    ADD CONSTRAINT "blog_tags_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."breeder_inquiries"
    ADD CONSTRAINT "breeder_inquiries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."breeder_profiles"
    ADD CONSTRAINT "breeder_profiles_custom_slug_key" UNIQUE ("custom_slug");



ALTER TABLE ONLY "public"."breeder_profiles"
    ADD CONSTRAINT "breeder_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."breeder_profiles"
    ADD CONSTRAINT "breeder_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."breeder_reviews"
    ADD CONSTRAINT "breeder_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."breeder_store_pages"
    ADD CONSTRAINT "breeder_store_pages_owner_email_key" UNIQUE ("owner_email");



ALTER TABLE ONLY "public"."breeder_store_pages"
    ADD CONSTRAINT "breeder_store_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."breeder_store_pages"
    ADD CONSTRAINT "breeder_store_pages_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."breeding_loans"
    ADD CONSTRAINT "breeding_loans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."breeding_plans"
    ADD CONSTRAINT "breeding_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."breeding_projects"
    ADD CONSTRAINT "breeding_projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."care_guide_sections"
    ADD CONSTRAINT "care_guide_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."change_logs"
    ADD CONSTRAINT "change_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classification_votes"
    ADD CONSTRAINT "classification_votes_image_reviewer_uk" UNIQUE ("gecko_image_id", "reviewer_email");



ALTER TABLE ONLY "public"."classification_votes"
    ADD CONSTRAINT "classification_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clutches"
    ADD CONSTRAINT "clutches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collection_members"
    ADD CONSTRAINT "collection_members_invite_token_key" UNIQUE ("invite_token");



ALTER TABLE ONLY "public"."collection_members"
    ADD CONSTRAINT "collection_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collection_valuations"
    ADD CONSTRAINT "collection_valuations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_event_reactions"
    ADD CONSTRAINT "community_event_reactions_pkey" PRIMARY KEY ("event_type", "event_id", "user_email", "reaction");



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."eggs"
    ADD CONSTRAINT "eggs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."error_logs"
    ADD CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expert_actions"
    ADD CONSTRAINT "expert_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expert_verification_requests"
    ADD CONSTRAINT "expert_verification_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feature_credit_allotments"
    ADD CONSTRAINT "feature_credit_allotments_pkey" PRIMARY KEY ("feature", "tier");



ALTER TABLE ONLY "public"."feature_usage"
    ADD CONSTRAINT "feature_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feature_usage"
    ADD CONSTRAINT "feature_usage_user_id_feature_month_key_key" UNIQUE ("user_id", "feature", "month_key");



ALTER TABLE ONLY "public"."feeding_groups"
    ADD CONSTRAINT "feeding_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feeding_records"
    ADD CONSTRAINT "feeding_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_categories"
    ADD CONSTRAINT "forum_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_comments"
    ADD CONSTRAINT "forum_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_likes"
    ADD CONSTRAINT "forum_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_posts"
    ADD CONSTRAINT "forum_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."future_breeding_plans"
    ADD CONSTRAINT "future_breeding_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gecko_events"
    ADD CONSTRAINT "gecko_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gecko_images"
    ADD CONSTRAINT "gecko_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gecko_likes"
    ADD CONSTRAINT "gecko_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gecko_of_the_day"
    ADD CONSTRAINT "gecko_of_the_day_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gecko_waitlist_signups"
    ADD CONSTRAINT "gecko_waitlist_signups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gecko_waitlists"
    ADD CONSTRAINT "gecko_waitlists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gecko_waitlists"
    ADD CONSTRAINT "gecko_waitlists_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."geckos"
    ADD CONSTRAINT "geckos_passport_code_key" UNIQUE ("passport_code");



ALTER TABLE ONLY "public"."geckos"
    ADD CONSTRAINT "geckos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."genetic_outcome_predictions"
    ADD CONSTRAINT "genetic_outcome_predictions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."genetics_trait_overrides"
    ADD CONSTRAINT "genetics_trait_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."giveaway_entries"
    ADD CONSTRAINT "giveaway_entries_giveaway_id_user_email_key" UNIQUE ("giveaway_id", "user_email");



ALTER TABLE ONLY "public"."giveaway_entries"
    ADD CONSTRAINT "giveaway_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."giveaways"
    ADD CONSTRAINT "giveaways_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."iot_connections"
    ADD CONSTRAINT "iot_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."iot_connections"
    ADD CONSTRAINT "iot_connections_user_id_provider_key" UNIQUE ("user_id", "provider");



ALTER TABLE ONLY "public"."lineage_placeholders"
    ADD CONSTRAINT "lineage_placeholders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_costs"
    ADD CONSTRAINT "marketplace_costs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_likes"
    ADD CONSTRAINT "marketplace_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mentor_offers"
    ADD CONSTRAINT "mentor_offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."morph_guide_comments"
    ADD CONSTRAINT "morph_guide_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."morph_guides"
    ADD CONSTRAINT "morph_guides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."morph_id_usage"
    ADD CONSTRAINT "morph_id_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."morph_id_usage"
    ADD CONSTRAINT "morph_id_usage_user_id_month_key_key" UNIQUE ("user_id", "month_key");



ALTER TABLE ONLY "public"."morph_price_cache"
    ADD CONSTRAINT "morph_price_cache_morph_name_key" UNIQUE ("morph_name");



ALTER TABLE ONLY "public"."morph_price_cache"
    ADD CONSTRAINT "morph_price_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."morph_price_entries"
    ADD CONSTRAINT "morph_price_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."morph_reference_images"
    ADD CONSTRAINT "morph_reference_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."morph_traits"
    ADD CONSTRAINT "morph_traits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."other_reptiles"
    ADD CONSTRAINT "other_reptiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ownership_records"
    ADD CONSTRAINT "ownership_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."page_config"
    ADD CONSTRAINT "page_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pairing_outcome_logs"
    ADD CONSTRAINT "pairing_outcome_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_events"
    ADD CONSTRAINT "payment_events_stripe_event_id_key" UNIQUE ("stripe_event_id");



ALTER TABLE ONLY "public"."pending_sales"
    ADD CONSTRAINT "pending_sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_alerts"
    ADD CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promote_images"
    ADD CONSTRAINT "promote_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."question_votes"
    ADD CONSTRAINT "question_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referral_rewards"
    ADD CONSTRAINT "referral_rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referral_rewards"
    ADD CONSTRAINT "referral_rewards_referred_email_key" UNIQUE ("referred_email");



ALTER TABLE ONLY "public"."reptile_events"
    ADD CONSTRAINT "reptile_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."revenuecat_entitlements"
    ADD CONSTRAINT "revenuecat_entitlements_app_user_id_entitlement_identifier_key" UNIQUE ("app_user_id", "entitlement_identifier");



ALTER TABLE ONLY "public"."revenuecat_entitlements"
    ADD CONSTRAINT "revenuecat_entitlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."revenuecat_webhook_events"
    ADD CONSTRAINT "revenuecat_webhook_events_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."scraped_training_data"
    ADD CONSTRAINT "scraped_training_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shed_records"
    ADD CONSTRAINT "shed_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipping_orders"
    ADD CONSTRAINT "shipping_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_generation_log"
    ADD CONSTRAINT "social_generation_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_platform_connections"
    ADD CONSTRAINT "social_platform_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_platform_connections"
    ADD CONSTRAINT "social_platform_connections_user_id_platform_account_handle_key" UNIQUE ("user_id", "platform", "account_handle");



ALTER TABLE ONLY "public"."social_post_photo_usage"
    ADD CONSTRAINT "social_post_photo_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_post_usage"
    ADD CONSTRAINT "social_post_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_post_usage"
    ADD CONSTRAINT "social_post_usage_user_id_month_key_key" UNIQUE ("user_id", "month_key");



ALTER TABLE ONLY "public"."social_post_variants"
    ADD CONSTRAINT "social_post_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_posts"
    ADD CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_referral_bonuses"
    ADD CONSTRAINT "social_referral_bonuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."social_referral_bonuses"
    ADD CONSTRAINT "social_referral_bonuses_stripe_invoice_id_key" UNIQUE ("stripe_invoice_id");



ALTER TABLE ONLY "public"."store_affiliate_clicks"
    ADD CONSTRAINT "store_affiliate_clicks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_cart_items"
    ADD CONSTRAINT "store_cart_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_carts"
    ADD CONSTRAINT "store_carts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_carts"
    ADD CONSTRAINT "store_carts_session_token_key" UNIQUE ("session_token");



ALTER TABLE ONLY "public"."store_categories"
    ADD CONSTRAINT "store_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_categories"
    ADD CONSTRAINT "store_categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."store_fulfillments"
    ADD CONSTRAINT "store_fulfillments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_order_items"
    ADD CONSTRAINT "store_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_orders"
    ADD CONSTRAINT "store_orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."store_orders"
    ADD CONSTRAINT "store_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_orders"
    ADD CONSTRAINT "store_orders_stripe_checkout_session_id_key" UNIQUE ("stripe_checkout_session_id");



ALTER TABLE ONLY "public"."store_products"
    ADD CONSTRAINT "store_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_products"
    ADD CONSTRAINT "store_products_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."store_promo_codes"
    ADD CONSTRAINT "store_promo_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."store_promo_codes"
    ADD CONSTRAINT "store_promo_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_signup_grants"
    ADD CONSTRAINT "store_signup_grants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_signup_grants"
    ADD CONSTRAINT "store_signup_grants_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."store_vendors"
    ADD CONSTRAINT "store_vendors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_vendors"
    ADD CONSTRAINT "store_vendors_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."stripe_webhook_logs"
    ADD CONSTRAINT "stripe_webhook_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."testimonials"
    ADD CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transfer_requests"
    ADD CONSTRAINT "transfer_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transfer_requests"
    ADD CONSTRAINT "transfer_requests_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."user_activity"
    ADD CONSTRAINT "user_activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_badges"
    ADD CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_brand_voice"
    ADD CONSTRAINT "user_brand_voice_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_events"
    ADD CONSTRAINT "user_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_follows"
    ADD CONSTRAINT "user_follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vet_records"
    ADD CONSTRAINT "vet_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weight_records"
    ADD CONSTRAINT "weight_records_pkey" PRIMARY KEY ("id");



CREATE INDEX "combo_index_daily_day_idx" ON "geck_data"."combo_index_daily" USING "btree" ("day");



CREATE INDEX "combo_index_daily_n_idx" ON "geck_data"."combo_index_daily" USING "btree" ("n" DESC);



CREATE UNIQUE INDEX "combo_index_daily_pk" ON "geck_data"."combo_index_daily" USING "btree" ("combo_id", "day");



CREATE INDEX "idx_alert_delivery_match" ON "geck_data"."alert_delivery_attempts" USING "btree" ("match_id");



CREATE INDEX "idx_alert_delivery_status_attempted" ON "geck_data"."alert_delivery_attempts" USING "btree" ("status", "attempted_at" DESC);



CREATE INDEX "idx_alert_matches_alert" ON "geck_data"."alert_matches" USING "btree" ("alert_id");



CREATE INDEX "idx_alert_matches_matched_at" ON "geck_data"."alert_matches" USING "btree" ("matched_at" DESC);



CREATE INDEX "idx_alert_matches_unack" ON "geck_data"."alert_matches" USING "btree" ("matched_at" DESC) WHERE ("acknowledged_at" IS NULL);



CREATE INDEX "idx_alerts_owner" ON "geck_data"."alerts" USING "btree" ("owner_id");



CREATE INDEX "idx_anthropic_billing_daily_day" ON "geck_data"."anthropic_billing_daily" USING "btree" ("day" DESC);



CREATE INDEX "idx_auction_results_closed_at" ON "geck_data"."auction_results" USING "btree" ("closed_at" DESC);



CREATE INDEX "idx_auction_results_listing" ON "geck_data"."auction_results" USING "btree" ("listing_id");



CREATE INDEX "idx_auction_state_listing_observed" ON "geck_data"."auction_state" USING "btree" ("listing_id", "observed_at" DESC);



CREATE INDEX "idx_batch_jobs_listing" ON "geck_data"."batch_jobs" USING "btree" ("listing_id");



CREATE INDEX "idx_batch_jobs_status_created" ON "geck_data"."batch_jobs" USING "btree" ("status", "created_at");



CREATE INDEX "idx_breeding_pairs_active" ON "geck_data"."breeding_pairs" USING "btree" ("active") WHERE "active";



CREATE INDEX "idx_breeding_pairs_combo" ON "geck_data"."breeding_pairs" USING "btree" ("combo_name");



CREATE INDEX "idx_breeding_pairs_owner" ON "geck_data"."breeding_pairs" USING "btree" ("owner_id");



CREATE INDEX "idx_clutches_expected_hatch" ON "geck_data"."clutches" USING "btree" ("expected_hatch_on");



CREATE INDEX "idx_clutches_pair" ON "geck_data"."clutches" USING "btree" ("pair_id");



CREATE INDEX "idx_crested_morph_taxonomy_canonical_id" ON "geck_data"."crested_morph_taxonomy" USING "btree" ("canonical_id") WHERE ("canonical_id" IS NOT NULL);



CREATE INDEX "idx_crested_morph_taxonomy_norm" ON "geck_data"."crested_morph_taxonomy" USING "btree" ("norm_name");



CREATE INDEX "idx_crested_morph_taxonomy_trait_kind" ON "geck_data"."crested_morph_taxonomy" USING "btree" ("trait_kind") WHERE ("trait_kind" IS NOT NULL);



CREATE INDEX "idx_cross_platform_last_seen_at" ON "geck_data"."cross_platform_listings" USING "btree" ("last_seen_at" DESC);



CREATE INDEX "idx_cross_platform_listings_species" ON "geck_data"."cross_platform_listings" USING "btree" ("species");



CREATE INDEX "idx_cross_platform_platform" ON "geck_data"."cross_platform_listings" USING "btree" ("platform");



CREATE INDEX "idx_error_logs_created_date" ON "geck_data"."error_logs" USING "btree" ("created_date" DESC);



CREATE INDEX "idx_error_logs_email" ON "geck_data"."error_logs" USING "btree" ("user_email");



CREATE INDEX "idx_error_logs_resolved_date" ON "geck_data"."error_logs" USING "btree" ("resolved", "created_date" DESC);



CREATE INDEX "idx_error_logs_source_date" ON "geck_data"."error_logs" USING "btree" ("source", "created_date" DESC);



CREATE INDEX "idx_ext_ref_morph" ON "geck_data"."external_reference_images" USING "btree" ("norm_morph_label");



CREATE INDEX "idx_ext_ref_species" ON "geck_data"."external_reference_images" USING "btree" ("species");



CREATE INDEX "idx_hatchlings_clutch" ON "geck_data"."hatchlings" USING "btree" ("clutch_id");



CREATE INDEX "idx_hatchlings_hatched" ON "geck_data"."hatchlings" USING "btree" ("hatched_on" DESC);



CREATE INDEX "idx_ingest_audit_event_types" ON "geck_data"."ingest_audit" USING "gin" ("event_types");



CREATE INDEX "idx_ingest_audit_received_at" ON "geck_data"."ingest_audit" USING "btree" ("received_at" DESC);



CREATE INDEX "idx_ingest_audit_status_code" ON "geck_data"."ingest_audit" USING "btree" ("status_code", "received_at" DESC);



CREATE INDEX "idx_ingest_events_created_at" ON "geck_data"."ingest_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_listing_favorites_listing" ON "geck_data"."listing_favorites" USING "btree" ("listing_id");



CREATE INDEX "idx_listing_images_listing_id" ON "geck_data"."listing_images" USING "btree" ("listing_id");



CREATE INDEX "idx_listing_images_pending_hydrate" ON "geck_data"."listing_images" USING "btree" ("listing_id") WHERE (("storage_path" IS NULL) AND ("image_url" IS NOT NULL));



CREATE INDEX "idx_listing_images_phash" ON "geck_data"."listing_images" USING "btree" ("phash") WHERE ("phash" IS NOT NULL);



CREATE INDEX "idx_listing_images_species" ON "geck_data"."listing_images" USING "btree" ("species");



CREATE INDEX "idx_listing_images_uploaded_at" ON "geck_data"."listing_images" USING "btree" ("uploaded_at" DESC);



CREATE INDEX "idx_listing_lineage_listing_id" ON "geck_data"."listing_lineage" USING "btree" ("listing_id");



CREATE INDEX "idx_listing_lineage_parent_id" ON "geck_data"."listing_lineage" USING "btree" ("parent_id") WHERE ("parent_id" IS NOT NULL);



CREATE INDEX "idx_listing_status_events_listing" ON "geck_data"."listing_status_events" USING "btree" ("listing_id");



CREATE INDEX "idx_listing_status_events_status_observed" ON "geck_data"."listing_status_events" USING "btree" ("status", "observed_at" DESC);



CREATE INDEX "idx_listing_views_day" ON "geck_data"."listing_views" USING "btree" ("view_day" DESC);



CREATE INDEX "idx_listing_views_listing" ON "geck_data"."listing_views" USING "btree" ("listing_id");



CREATE INDEX "idx_listings_history_listing_observed" ON "geck_data"."listings_history" USING "btree" ("listing_id", "observed_at" DESC);



CREATE INDEX "idx_listings_history_scrape_run" ON "geck_data"."listings_history" USING "btree" ("scrape_run_id");



CREATE INDEX "idx_listings_is_active" ON "geck_data"."listings" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_listings_last_seen_at" ON "geck_data"."listings" USING "btree" ("last_seen_at" DESC);



CREATE INDEX "idx_listings_seller_name" ON "geck_data"."listings" USING "btree" ("seller_name");



CREATE INDEX "idx_listings_seller_slug" ON "geck_data"."listings" USING "btree" ("seller_slug") WHERE ("seller_slug" IS NOT NULL);



CREATE INDEX "idx_lse_inference_confidence" ON "geck_data"."listing_status_events" USING "btree" ("inference_confidence") WHERE ("inference_confidence" IS NOT NULL);



CREATE INDEX "idx_market_auctions_listing" ON "geck_data"."market_auctions" USING "btree" ("listing_key");



CREATE INDEX "idx_market_listings_canonical" ON "geck_data"."market_listings" USING "btree" ("canonical_listing_id") WHERE ("canonical_listing_id" IS NOT NULL);



CREATE INDEX "idx_market_listings_current_status" ON "geck_data"."market_listings" USING "btree" ("current_status");



CREATE INDEX "idx_market_listings_group_lot" ON "geck_data"."market_listings" USING "btree" ("is_group_lot") WHERE "is_group_lot";



CREATE INDEX "idx_market_listings_kind" ON "geck_data"."market_listings" USING "btree" ("kind");



CREATE INDEX "idx_market_listings_last_seen_at" ON "geck_data"."market_listings" USING "btree" ("last_seen_at" DESC);



CREATE INDEX "idx_market_listings_morphmarket_key" ON "geck_data"."market_listings" USING "btree" ("morphmarket_key");



CREATE INDEX "idx_market_listings_source" ON "geck_data"."market_listings" USING "btree" ("source");



CREATE INDEX "idx_market_listings_species" ON "geck_data"."market_listings" USING "btree" ("species");



CREATE INDEX "idx_market_listings_updated_at" ON "geck_data"."market_listings" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_market_sellers_updated_at" ON "geck_data"."market_sellers" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_mhl_labeled_at" ON "geck_data"."morph_human_labels" USING "btree" ("labeled_at" DESC);



CREATE INDEX "idx_mhl_listing" ON "geck_data"."morph_human_labels" USING "btree" ("listing_id");



CREATE INDEX "idx_model_invocations_called_at" ON "geck_data"."model_invocations" USING "btree" ("called_at" DESC);



CREATE INDEX "idx_model_invocations_confidence" ON "geck_data"."model_invocations" USING "btree" ("confidence") WHERE ("confidence" IS NOT NULL);



CREATE INDEX "idx_model_invocations_error_code" ON "geck_data"."model_invocations" USING "btree" ("error_code") WHERE ("error_code" IS NOT NULL);



CREATE INDEX "idx_model_invocations_ip_hash_called_at" ON "geck_data"."model_invocations" USING "btree" ("ip_hash", "called_at" DESC) WHERE ("ip_hash" IS NOT NULL);



CREATE INDEX "idx_model_invocations_surface_called_at" ON "geck_data"."model_invocations" USING "btree" ("surface", "called_at" DESC);



CREATE INDEX "idx_model_invocations_user_called_at" ON "geck_data"."model_invocations" USING "btree" ("user_id", "called_at" DESC) WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_morph_eval_runs_model" ON "geck_data"."morph_eval_runs" USING "btree" ("model");



CREATE INDEX "idx_morph_eval_runs_started_at" ON "geck_data"."morph_eval_runs" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_morph_eval_runs_status" ON "geck_data"."morph_eval_runs" USING "btree" ("status");



CREATE INDEX "idx_morph_taxonomy_species_norm" ON "geck_data"."morph_taxonomy" USING "btree" ("species", "norm_name");



CREATE INDEX "idx_morphs_aliases" ON "geck_data"."morphs" USING "gin" ("aliases");



CREATE INDEX "idx_phash_pairs_distance" ON "geck_data"."listing_image_phash_pairs" USING "btree" ("hamming_distance");



CREATE INDEX "idx_phash_pairs_left" ON "geck_data"."listing_image_phash_pairs" USING "btree" ("left_image_id");



CREATE INDEX "idx_phash_pairs_right" ON "geck_data"."listing_image_phash_pairs" USING "btree" ("right_image_id");



CREATE INDEX "idx_price_drops_listing" ON "geck_data"."price_drops" USING "btree" ("listing_id");



CREATE UNIQUE INDEX "idx_price_drops_listing_observed_src" ON "geck_data"."price_drops" USING "btree" ("listing_id", "observed_at", "source");



CREATE INDEX "idx_price_drops_observed_at" ON "geck_data"."price_drops" USING "btree" ("observed_at" DESC);



CREATE INDEX "idx_price_factors_category" ON "geck_data"."price_adjustment_factors" USING "btree" ("category");



CREATE INDEX "idx_price_history_listing_observed" ON "geck_data"."price_history" USING "btree" ("listing_id", "observed_at" DESC);



CREATE INDEX "idx_profiles_role" ON "geck_data"."profiles" USING "btree" ("role");



CREATE INDEX "idx_runtime_config_history_key_time" ON "geck_data"."runtime_config_history" USING "btree" ("key", "changed_at" DESC);



CREATE INDEX "idx_scrape_runs_scrape_type_status" ON "geck_data"."scrape_runs" USING "btree" ("scrape_type", "status");



CREATE INDEX "idx_scrape_runs_started_at" ON "geck_data"."scrape_runs" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_seller_snapshots_seller_observed" ON "geck_data"."seller_snapshots" USING "btree" ("seller_id", "observed_at" DESC);



CREATE INDEX "idx_show_mentions_observed_at" ON "geck_data"."show_mentions" USING "btree" ("observed_at" DESC);



CREATE INDEX "idx_show_mentions_show_name" ON "geck_data"."show_mentions" USING "btree" ("show_name");



CREATE INDEX "idx_synonyms_canonical" ON "geck_data"."morph_taxonomy_synonyms" USING "btree" ("canonical");



CREATE INDEX "idx_unc_enabled" ON "geck_data"."user_notification_channels" USING "btree" ("enabled");



CREATE INDEX "idx_unc_owner" ON "geck_data"."user_notification_channels" USING "btree" ("owner_id");



CREATE INDEX "idx_user_events_created_date" ON "geck_data"."user_events" USING "btree" ("created_date" DESC);



CREATE INDEX "idx_user_events_email_date" ON "geck_data"."user_events" USING "btree" ("user_email", "created_date" DESC);



CREATE INDEX "idx_user_events_name_date" ON "geck_data"."user_events" USING "btree" ("event_name", "created_date" DESC);



CREATE INDEX "idx_user_events_page_date" ON "geck_data"."user_events" USING "btree" ("page", "created_date" DESC);



CREATE INDEX "idx_user_events_session" ON "geck_data"."user_events" USING "btree" ("session_id");



CREATE INDEX "idx_user_events_source_date" ON "geck_data"."user_events" USING "btree" ("source", "created_date" DESC);



CREATE INDEX "idx_xpl_images_listing" ON "geck_data"."cross_platform_listing_images" USING "btree" ("cross_platform_listing_id");



CREATE INDEX "idx_xpl_images_phash" ON "geck_data"."cross_platform_listing_images" USING "btree" ("phash") WHERE ("phash" IS NOT NULL);



CREATE UNIQUE INDEX "price_history_listing_observed_key" ON "geck_data"."price_history" USING "btree" ("listing_id", "observed_at");



COMMENT ON INDEX "geck_data"."price_history_listing_observed_key" IS 'One price observation per listing per instant. Ingest writers rely on this constraint for idempotency: see src/lib/ingest/events.ts.';



CREATE INDEX "admin_tasks_category_idx" ON "public"."admin_tasks" USING "btree" ("category");



CREATE INDEX "admin_tasks_priority_idx" ON "public"."admin_tasks" USING "btree" ("priority");



CREATE INDEX "admin_tasks_status_idx" ON "public"."admin_tasks" USING "btree" ("status");



CREATE INDEX "app_settings_public_idx" ON "public"."app_settings" USING "btree" ("is_public") WHERE ("is_public" = true);



CREATE INDEX "blog_categories_active_idx" ON "public"."blog_categories" USING "btree" ("is_active");



CREATE INDEX "blog_logs_post_idx" ON "public"."blog_logs" USING "btree" ("related_post_id");



CREATE INDEX "blog_logs_recent_idx" ON "public"."blog_logs" USING "btree" ("created_date" DESC);



CREATE INDEX "blog_posts_category_idx" ON "public"."blog_posts" USING "btree" ("category_id");



CREATE INDEX "blog_posts_scheduled_idx" ON "public"."blog_posts" USING "btree" ("scheduled_at") WHERE ("status" = 'scheduled'::"public"."blog_post_status");



CREATE INDEX "blog_posts_status_published_idx" ON "public"."blog_posts" USING "btree" ("status", "published_at" DESC);



CREATE INDEX "blog_posts_tag_ids_idx" ON "public"."blog_posts" USING "gin" ("tag_ids");



CREATE INDEX "blog_tags_active_idx" ON "public"."blog_tags" USING "btree" ("is_active");



CREATE INDEX "breeder_store_pages_owner_email_idx" ON "public"."breeder_store_pages" USING "btree" ("owner_email");



CREATE INDEX "breeder_store_pages_slug_idx" ON "public"."breeder_store_pages" USING "btree" ("slug");



CREATE INDEX "breeding_plans_created_by_idx" ON "public"."breeding_plans" USING "btree" ("created_by");



CREATE INDEX "classification_votes_matching_label_idx" ON "public"."classification_votes" USING "btree" ("gecko_image_id", "verdict", "label_fingerprint");



CREATE INDEX "collection_members_collection_idx" ON "public"."collection_members" USING "btree" ("collection_id");



CREATE INDEX "collection_members_email_idx" ON "public"."collection_members" USING "btree" ("lower"("member_email"));



CREATE UNIQUE INDEX "collection_members_unique_invite" ON "public"."collection_members" USING "btree" ("collection_id", "lower"("member_email"));



CREATE UNIQUE INDEX "collections_one_default_per_owner" ON "public"."collections" USING "btree" ("lower"("owner_email")) WHERE ("is_default" = true);



CREATE INDEX "collections_owner_idx" ON "public"."collections" USING "btree" ("lower"("owner_email"));



CREATE INDEX "community_event_reactions_event_idx" ON "public"."community_event_reactions" USING "btree" ("event_type", "event_id");



CREATE INDEX "direct_messages_recipient_is_read_idx" ON "public"."direct_messages" USING "btree" ("recipient_email", "is_read");



CREATE INDEX "direct_messages_sender_email_idx" ON "public"."direct_messages" USING "btree" ("sender_email");



CREATE INDEX "eggs_breeding_plan_id_idx" ON "public"."eggs" USING "btree" ("breeding_plan_id");



CREATE INDEX "eggs_created_by_idx" ON "public"."eggs" USING "btree" ("created_by");



CREATE INDEX "error_logs_created_date_idx" ON "public"."error_logs" USING "btree" ("created_date" DESC);



CREATE INDEX "error_logs_resolved_idx" ON "public"."error_logs" USING "btree" ("resolved", "created_date" DESC);



CREATE INDEX "error_logs_user_email_idx" ON "public"."error_logs" USING "btree" ("user_email");



CREATE INDEX "feature_usage_user_idx" ON "public"."feature_usage" USING "btree" ("user_id", "feature", "month_key" DESC);



CREATE INDEX "feeding_records_animal_id_idx" ON "public"."feeding_records" USING "btree" ("animal_id");



CREATE INDEX "forum_posts_created_by_idx" ON "public"."forum_posts" USING "btree" ("created_by");



CREATE INDEX "forum_posts_created_date_idx" ON "public"."forum_posts" USING "btree" ("created_date" DESC);



CREATE INDEX "future_breeding_plans_created_by_idx" ON "public"."future_breeding_plans" USING "btree" ("created_by");



CREATE INDEX "future_breeding_plans_target_idx" ON "public"."future_breeding_plans" USING "btree" ("target_year", "target_season", "notified");



CREATE INDEX "gecko_images_created_by_idx" ON "public"."gecko_images" USING "btree" ("created_by");



CREATE INDEX "gecko_images_created_date_idx" ON "public"."gecko_images" USING "btree" ("created_date" DESC);



CREATE INDEX "gecko_images_embedding_backfill_idx" ON "public"."gecko_images" USING "btree" ("embedding_status", "embedding_attempts", "created_date") WHERE ("image_embedding" IS NULL);



CREATE INDEX "gecko_waitlist_signups_waitlist_idx" ON "public"."gecko_waitlist_signups" USING "btree" ("waitlist_id", "created_date" DESC);



CREATE INDEX "gecko_waitlists_breeder_idx" ON "public"."gecko_waitlists" USING "btree" ("breeder_user_id", "created_date" DESC);



CREATE INDEX "gecko_waitlists_slug_idx" ON "public"."gecko_waitlists" USING "btree" ("slug");



CREATE INDEX "geckos_collection_idx" ON "public"."geckos" USING "btree" ("collection_id");



CREATE INDEX "geckos_created_by_idx" ON "public"."geckos" USING "btree" ("created_by");



CREATE INDEX "geckos_dam_id_idx" ON "public"."geckos" USING "btree" ("dam_id");



CREATE INDEX "geckos_last_change_idx" ON "public"."geckos" USING "btree" ("created_by", "last_meaningful_change_at" DESC);



CREATE INDEX "geckos_passport_code_idx" ON "public"."geckos" USING "btree" ("passport_code") WHERE ("passport_code" IS NOT NULL);



CREATE INDEX "geckos_sire_id_idx" ON "public"."geckos" USING "btree" ("sire_id");



CREATE INDEX "giveaway_entries_giveaway_idx" ON "public"."giveaway_entries" USING "btree" ("giveaway_id");



CREATE INDEX "giveaway_entries_user_idx" ON "public"."giveaway_entries" USING "btree" ("user_email");



CREATE INDEX "giveaways_created_by_idx" ON "public"."giveaways" USING "btree" ("created_by");



CREATE INDEX "giveaways_status_idx" ON "public"."giveaways" USING "btree" ("status", "end_date" DESC);



CREATE INDEX "idx_answers_question" ON "public"."answers" USING "btree" ("question_id");



CREATE INDEX "idx_breeder_inquiries_breeder_created" ON "public"."breeder_inquiries" USING "btree" ("breeder_email", "created_at" DESC);



CREATE INDEX "idx_breeder_inquiries_status" ON "public"."breeder_inquiries" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_breeder_profiles_slug" ON "public"."breeder_profiles" USING "btree" ("custom_slug");



CREATE INDEX "idx_breeding_loans_animal" ON "public"."breeding_loans" USING "btree" ("animal_id");



CREATE INDEX "idx_breeding_projects_user" ON "public"."breeding_projects" USING "btree" ("created_by");



CREATE INDEX "idx_classification_votes_image" ON "public"."classification_votes" USING "btree" ("gecko_image_id");



CREATE INDEX "idx_gecko_images_embedding" ON "public"."gecko_images" USING "hnsw" ("image_embedding" "extensions"."vector_cosine_ops") WITH ("m"='16', "ef_construction"='64');



CREATE INDEX "idx_gecko_images_primary_morph" ON "public"."gecko_images" USING "btree" ("primary_morph") WHERE ("primary_morph" IS NOT NULL);



CREATE INDEX "idx_gecko_images_training_meta" ON "public"."gecko_images" USING "gin" ("training_meta");



CREATE INDEX "idx_gecko_images_unverified_queue" ON "public"."gecko_images" USING "btree" ("created_date") WHERE ("verified" IS NOT TRUE);



CREATE INDEX "idx_geckos_passport_code" ON "public"."geckos" USING "btree" ("passport_code");



CREATE INDEX "idx_morph_prices_morph" ON "public"."morph_price_entries" USING "btree" ("base_morph");



CREATE INDEX "idx_newsletter_subscribers_created" ON "public"."newsletter_subscribers" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_newsletter_subscribers_unsub" ON "public"."newsletter_subscribers" USING "btree" ("unsubscribed_at") WHERE ("unsubscribed_at" IS NULL);



CREATE INDEX "idx_pairing_outcome_logs_owner" ON "public"."pairing_outcome_logs" USING "btree" ("created_by");



CREATE INDEX "idx_pairing_outcome_logs_pairing" ON "public"."pairing_outcome_logs" USING "btree" ("pairing_key");



CREATE INDEX "idx_pairing_outcome_logs_tag_key" ON "public"."pairing_outcome_logs" USING "btree" ("tag_key");



CREATE INDEX "idx_pending_sales_gecko" ON "public"."pending_sales" USING "btree" ("gecko_id");



CREATE INDEX "idx_pending_sales_status" ON "public"."pending_sales" USING "btree" ("status");



CREATE INDEX "idx_pending_sales_user" ON "public"."pending_sales" USING "btree" ("user_email");



CREATE INDEX "idx_questions_status" ON "public"."questions" USING "btree" ("status");



CREATE INDEX "idx_shipping_orders_created_by" ON "public"."shipping_orders" USING "btree" ("created_by");



CREATE INDEX "idx_shipping_orders_status" ON "public"."shipping_orders" USING "btree" ("status");



CREATE INDEX "idx_shipping_orders_tracking" ON "public"."shipping_orders" USING "btree" ("tracking_number");



CREATE INDEX "idx_transfer_requests_token" ON "public"."transfer_requests" USING "btree" ("token");



CREATE INDEX "morph_id_usage_user_month_idx" ON "public"."morph_id_usage" USING "btree" ("user_id", "month_key" DESC);



CREATE INDEX "notifications_created_date_idx" ON "public"."notifications" USING "btree" ("created_date" DESC);



CREATE INDEX "notifications_user_email_is_read_idx" ON "public"."notifications" USING "btree" ("user_email", "is_read");



CREATE INDEX "ownership_records_animal_id_idx" ON "public"."ownership_records" USING "btree" ("animal_id");



CREATE INDEX "profiles_paid_started_idx" ON "public"."profiles" USING "btree" ("paid_membership_started_at") WHERE ("paid_membership_started_at" IS NOT NULL);



CREATE UNIQUE INDEX "profiles_referral_code_key" ON "public"."profiles" USING "btree" ("referral_code");



CREATE INDEX "profiles_referral_grant_until_idx" ON "public"."profiles" USING "btree" ("referral_grant_until") WHERE ("referral_grant_until" IS NOT NULL);



CREATE INDEX "profiles_referred_by_idx" ON "public"."profiles" USING "btree" ("referred_by");



CREATE INDEX "promote_images_tags_idx" ON "public"."promote_images" USING "gin" ("label_tags");



CREATE INDEX "promote_images_user_idx" ON "public"."promote_images" USING "btree" ("user_id", "created_date" DESC);



CREATE INDEX "push_subscriptions_last_seen_idx" ON "public"."push_subscriptions" USING "btree" ("last_seen_at" DESC);



CREATE INDEX "push_subscriptions_user_email_idx" ON "public"."push_subscriptions" USING "btree" ("user_email");



CREATE INDEX "referral_rewards_referrer_idx" ON "public"."referral_rewards" USING "btree" ("referrer_email");



CREATE INDEX "revenuecat_entitlements_active_idx" ON "public"."revenuecat_entitlements" USING "btree" ("entitlement_identifier", "is_active") WHERE ("is_active" = true);



CREATE INDEX "revenuecat_entitlements_app_user_id_idx" ON "public"."revenuecat_entitlements" USING "btree" ("app_user_id");



CREATE INDEX "revenuecat_webhook_events_received_at_idx" ON "public"."revenuecat_webhook_events" USING "btree" ("received_at" DESC);



CREATE INDEX "shed_records_animal_id_idx" ON "public"."shed_records" USING "btree" ("animal_id");



CREATE INDEX "social_generation_log_post_idx" ON "public"."social_generation_log" USING "btree" ("post_id");



CREATE INDEX "social_generation_log_user_idx" ON "public"."social_generation_log" USING "btree" ("user_id", "created_date" DESC);



CREATE INDEX "social_platform_connections_user_idx" ON "public"."social_platform_connections" USING "btree" ("user_id");



CREATE INDEX "social_post_photo_usage_gecko_idx" ON "public"."social_post_photo_usage" USING "btree" ("gecko_id");



CREATE INDEX "social_post_photo_usage_image_idx" ON "public"."social_post_photo_usage" USING "btree" ("gecko_image_id");



CREATE INDEX "social_post_photo_usage_user_idx" ON "public"."social_post_photo_usage" USING "btree" ("user_id");



CREATE INDEX "social_post_usage_unreported_overage_idx" ON "public"."social_post_usage" USING "btree" ("month_key") WHERE (("overage_posts" > 0) AND ("stripe_usage_record_id" IS NULL));



CREATE INDEX "social_post_usage_user_month_idx" ON "public"."social_post_usage" USING "btree" ("user_id", "month_key" DESC);



CREATE INDEX "social_post_variants_platform_status_idx" ON "public"."social_post_variants" USING "btree" ("platform", "status");



CREATE INDEX "social_post_variants_post_idx" ON "public"."social_post_variants" USING "btree" ("post_id");



CREATE INDEX "social_posts_gecko_idx" ON "public"."social_posts" USING "btree" ("gecko_id");



CREATE INDEX "social_posts_status_idx" ON "public"."social_posts" USING "btree" ("status");



CREATE INDEX "social_posts_user_idx" ON "public"."social_posts" USING "btree" ("created_by_user_id", "created_date" DESC);



CREATE INDEX "social_referral_bonuses_referred_idx" ON "public"."social_referral_bonuses" USING "btree" ("referred_user_id");



CREATE INDEX "social_referral_bonuses_referrer_idx" ON "public"."social_referral_bonuses" USING "btree" ("referrer_user_id");



CREATE INDEX "store_affiliate_clicks_created_idx" ON "public"."store_affiliate_clicks" USING "btree" ("created_date");



CREATE INDEX "store_affiliate_clicks_product_idx" ON "public"."store_affiliate_clicks" USING "btree" ("product_id");



CREATE INDEX "store_affiliate_clicks_user_idx" ON "public"."store_affiliate_clicks" USING "btree" ("user_id");



CREATE INDEX "store_affiliate_clicks_vendor_idx" ON "public"."store_affiliate_clicks" USING "btree" ("vendor_id");



CREATE INDEX "store_cart_items_cart_idx" ON "public"."store_cart_items" USING "btree" ("cart_id");



CREATE UNIQUE INDEX "store_cart_items_cart_product_uniq" ON "public"."store_cart_items" USING "btree" ("cart_id", "product_id") WHERE ("customization" IS NULL);



CREATE INDEX "store_cart_items_customization_idx" ON "public"."store_cart_items" USING "gin" ("customization") WHERE ("customization" IS NOT NULL);



CREATE INDEX "store_carts_session_idx" ON "public"."store_carts" USING "btree" ("session_token");



CREATE INDEX "store_carts_status_idx" ON "public"."store_carts" USING "btree" ("status");



CREATE INDEX "store_carts_user_idx" ON "public"."store_carts" USING "btree" ("owner_user_id");



CREATE INDEX "store_categories_gift_idx" ON "public"."store_categories" USING "btree" ("is_gift_category") WHERE "is_gift_category";



CREATE INDEX "store_categories_parent_idx" ON "public"."store_categories" USING "btree" ("parent_id");



CREATE INDEX "store_fulfillments_order_idx" ON "public"."store_fulfillments" USING "btree" ("order_id");



CREATE INDEX "store_order_items_customization_idx" ON "public"."store_order_items" USING "gin" ("customization") WHERE ("customization" IS NOT NULL);



CREATE INDEX "store_order_items_order_idx" ON "public"."store_order_items" USING "btree" ("order_id");



CREATE INDEX "store_order_items_status_idx" ON "public"."store_order_items" USING "btree" ("fulfillment_status");



CREATE INDEX "store_orders_email_idx" ON "public"."store_orders" USING "btree" ("customer_email");



CREATE INDEX "store_orders_status_idx" ON "public"."store_orders" USING "btree" ("status");



CREATE INDEX "store_orders_stripe_idx" ON "public"."store_orders" USING "btree" ("stripe_checkout_session_id");



CREATE INDEX "store_orders_user_idx" ON "public"."store_orders" USING "btree" ("owner_user_id");



CREATE INDEX "store_products_audience_idx" ON "public"."store_products" USING "gin" ("gift_audience");



CREATE INDEX "store_products_category_idx" ON "public"."store_products" USING "btree" ("category_id");



CREATE INDEX "store_products_food_idx" ON "public"."store_products" USING "btree" ("is_consumable_food") WHERE "is_consumable_food";



CREATE INDEX "store_products_fulfillment_idx" ON "public"."store_products" USING "btree" ("fulfillment_mode");



CREATE INDEX "store_products_gift_idx" ON "public"."store_products" USING "btree" ("gift_friendly") WHERE "gift_friendly";



CREATE INDEX "store_products_lifecycle_idx" ON "public"."store_products" USING "gin" ("lifecycle_stage_tags");



CREATE INDEX "store_products_search_idx" ON "public"."store_products" USING "gin" ("search_vector");



CREATE INDEX "store_products_status_idx" ON "public"."store_products" USING "btree" ("status");



CREATE INDEX "store_products_vendor_idx" ON "public"."store_products" USING "btree" ("vendor_id");



CREATE INDEX "store_signup_grants_email_idx" ON "public"."store_signup_grants" USING "btree" ("granted_email");



CREATE INDEX "store_signup_grants_token_idx" ON "public"."store_signup_grants" USING "btree" ("token");



CREATE INDEX "support_messages_source_idx" ON "public"."support_messages" USING "btree" ("source", "created_date" DESC);



CREATE INDEX "support_messages_status_idx" ON "public"."support_messages" USING "btree" ("status", "created_date" DESC);



CREATE INDEX "support_messages_user_email_idx" ON "public"."support_messages" USING "btree" ("user_email");



CREATE INDEX "testimonials_approved_idx" ON "public"."testimonials" USING "btree" ("approved", "sort_order", "created_at" DESC) WHERE ("approved" = true);



CREATE INDEX "user_brand_voice_user_idx" ON "public"."user_brand_voice" USING "btree" ("user_id");



CREATE INDEX "user_events_created_date_idx" ON "public"."user_events" USING "btree" ("created_date" DESC);



CREATE INDEX "user_events_event_name_idx" ON "public"."user_events" USING "btree" ("event_name", "created_date" DESC);



CREATE INDEX "user_events_page_idx" ON "public"."user_events" USING "btree" ("page", "created_date" DESC);



CREATE INDEX "user_events_user_email_idx" ON "public"."user_events" USING "btree" ("user_email", "created_date" DESC);



CREATE INDEX "vet_records_animal_id_idx" ON "public"."vet_records" USING "btree" ("animal_id");



CREATE INDEX "weight_records_created_by_idx" ON "public"."weight_records" USING "btree" ("created_by");



CREATE INDEX "weight_records_gecko_id_idx" ON "public"."weight_records" USING "btree" ("gecko_id");



CREATE OR REPLACE TRIGGER "clutches_default_hatch_tr" BEFORE INSERT ON "geck_data"."clutches" FOR EACH ROW EXECUTE FUNCTION "geck_data"."clutches_default_hatch"();



CREATE OR REPLACE TRIGGER "runtime_config_audit_trigger" AFTER INSERT OR UPDATE ON "geck_data"."runtime_config" FOR EACH ROW EXECUTE FUNCTION "geck_data"."runtime_config_audit"();



CREATE OR REPLACE TRIGGER "admin_tasks_touch" BEFORE UPDATE ON "public"."admin_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."admin_tasks_touch_updated_at"();



CREATE OR REPLACE TRIGGER "app_settings_touch" BEFORE UPDATE ON "public"."app_settings" FOR EACH ROW EXECUTE FUNCTION "public"."app_settings_touch_updated_at"();



CREATE OR REPLACE TRIGGER "blog_categories_touch" BEFORE UPDATE ON "public"."blog_categories" FOR EACH ROW EXECUTE FUNCTION "public"."_blog_touch_updated_date"();



CREATE OR REPLACE TRIGGER "blog_posts_touch" BEFORE UPDATE ON "public"."blog_posts" FOR EACH ROW EXECUTE FUNCTION "public"."_blog_touch_updated_date"();



CREATE OR REPLACE TRIGGER "blog_settings_touch" BEFORE UPDATE ON "public"."blog_settings" FOR EACH ROW EXECUTE FUNCTION "public"."_blog_touch_updated_date"();



CREATE OR REPLACE TRIGGER "blog_tags_touch" BEFORE UPDATE ON "public"."blog_tags" FOR EACH ROW EXECUTE FUNCTION "public"."_blog_touch_updated_date"();



CREATE OR REPLACE TRIGGER "collection_members_bump_parent" AFTER INSERT OR DELETE OR UPDATE ON "public"."collection_members" FOR EACH ROW EXECUTE FUNCTION "public"."bump_collection_updated_at"();



CREATE OR REPLACE TRIGGER "error_logs_throttle" BEFORE INSERT ON "public"."error_logs" FOR EACH ROW EXECUTE FUNCTION "public"."throttle_error_logs"();



CREATE OR REPLACE TRIGGER "gecko_images_bump_parent" AFTER INSERT OR DELETE OR UPDATE ON "public"."gecko_images" FOR EACH ROW EXECUTE FUNCTION "public"."trg_bump_gecko_from_image"();



CREATE OR REPLACE TRIGGER "geckos_bump_change_ts" BEFORE UPDATE ON "public"."geckos" FOR EACH ROW EXECUTE FUNCTION "public"."bump_gecko_change_ts_self"();



CREATE OR REPLACE TRIGGER "geckos_set_default_collection_trg" BEFORE INSERT ON "public"."geckos" FOR EACH ROW EXECUTE FUNCTION "public"."geckos_set_default_collection"();



CREATE OR REPLACE TRIGGER "notifications_guard_user_insert" BEFORE INSERT ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."guard_notification_insert"();



CREATE OR REPLACE TRIGGER "notifications_send_dispatch" AFTER INSERT ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."notify_dispatch_on_insert"();



CREATE OR REPLACE TRIGGER "profiles_protect_privileged_columns" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_profile_privileged_columns"();



CREATE OR REPLACE TRIGGER "profiles_protect_referral_columns" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_profile_referral_columns"();



CREATE OR REPLACE TRIGGER "profiles_set_referral_code" BEFORE INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_default_referral_code"();



CREATE OR REPLACE TRIGGER "store_products_search_trg" BEFORE INSERT OR UPDATE ON "public"."store_products" FOR EACH ROW EXECUTE FUNCTION "public"."store_products_update_search_vector"();



CREATE OR REPLACE TRIGGER "testimonials_set_updated_at" BEFORE UPDATE ON "public"."testimonials" FOR EACH ROW EXECUTE FUNCTION "public"."set_testimonials_updated_at"();



CREATE OR REPLACE TRIGGER "trg_cleanup_transfer_requests" AFTER DELETE ON "public"."geckos" FOR EACH ROW EXECUTE FUNCTION "public"."cleanup_transfer_requests_on_animal_delete"('gecko');



CREATE OR REPLACE TRIGGER "trg_cleanup_transfer_requests" AFTER DELETE ON "public"."other_reptiles" FOR EACH ROW EXECUTE FUNCTION "public"."cleanup_transfer_requests_on_animal_delete"('other_reptile');



CREATE OR REPLACE TRIGGER "weight_records_bump_parent" AFTER INSERT OR DELETE OR UPDATE ON "public"."weight_records" FOR EACH ROW EXECUTE FUNCTION "public"."trg_bump_gecko_from_weight"();



ALTER TABLE ONLY "geck_data"."alert_delivery_attempts"
    ADD CONSTRAINT "alert_delivery_attempts_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "geck_data"."user_notification_channels"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "geck_data"."alert_delivery_attempts"
    ADD CONSTRAINT "alert_delivery_attempts_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "geck_data"."alert_matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "geck_data"."alert_matches"
    ADD CONSTRAINT "alert_matches_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "geck_data"."alerts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "geck_data"."alert_matches"
    ADD CONSTRAINT "alert_matches_cross_platform_listing_id_fkey" FOREIGN KEY ("cross_platform_listing_id") REFERENCES "geck_data"."cross_platform_listings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "geck_data"."alert_matches"
    ADD CONSTRAINT "alert_matches_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "geck_data"."market_listings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "geck_data"."alerts"
    ADD CONSTRAINT "alerts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "geck_data"."auction_results"
    ADD CONSTRAINT "auction_results_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "geck_data"."market_listings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "geck_data"."auction_state"
    ADD CONSTRAINT "auction_state_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "geck_data"."market_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "geck_data"."batch_jobs"
    ADD CONSTRAINT "batch_jobs_invocation_id_fkey" FOREIGN KEY ("invocation_id") REFERENCES "geck_data"."model_invocations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "geck_data"."batch_jobs"
    ADD CONSTRAINT "batch_jobs_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "geck_data"."market_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "geck_data"."breeding_pairs"
    ADD CONSTRAINT "breeding_pairs_combo_name_fkey" FOREIGN KEY ("combo_name") REFERENCES "geck_data"."combo_catalog"("combo_name");



ALTER TABLE ONLY "geck_data"."breeding_pairs"
    ADD CONSTRAINT "breeding_pairs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "geck_data"."clutches"
    ADD CONSTRAINT "clutches_pair_id_fkey" FOREIGN KEY ("pair_id") REFERENCES "geck_data"."breeding_pairs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "geck_data"."cross_platform_listing_images"
    ADD CONSTRAINT "cross_platform_listing_images_cross_platform_listing_id_fkey" FOREIGN KEY ("cross_platform_listing_id") REFERENCES "geck_data"."cross_platform_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "geck_data"."error_logs"
    ADD CONSTRAINT "error_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "geck_data"."error_logs"
    ADD CONSTRAINT "error_logs_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "geck_data"."hatchlings"
    ADD CONSTRAINT "hatchlings_clutch_id_fkey" FOREIGN KEY ("clutch_id") REFERENCES "geck_data"."clutches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "geck_data"."hatchlings"
    ADD CONSTRAINT "hatchlings_morph_guess_fkey" FOREIGN KEY ("morph_guess") REFERENCES "geck_data"."combo_catalog"("combo_name");



ALTER TABLE ONLY "geck_data"."listing_favorites"
    ADD CONSTRAINT "listing_favorites_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "geck_data"."market_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "geck_data"."listing_images"
    ADD CONSTRAINT "listing_images_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "geck_data"."market_listings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "geck_data"."listing_images"
    ADD CONSTRAINT "listing_images_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "geck_data"."listing_lineage"
    ADD CONSTRAINT "listing_lineage_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "geck_data"."market_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "geck_data"."listing_status_events"
    ADD CONSTRAINT "listing_status_events_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "geck_data"."market_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "geck_data"."listing_views"
    ADD CONSTRAINT "listing_views_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "geck_data"."market_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "geck_data"."listings_history"
    ADD CONSTRAINT "listings_history_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "geck_data"."listings"("listing_id") ON DELETE CASCADE;



ALTER TABLE ONLY "geck_data"."listings_history"
    ADD CONSTRAINT "listings_history_scrape_run_id_fkey" FOREIGN KEY ("scrape_run_id") REFERENCES "geck_data"."scrape_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "geck_data"."morph_human_labels"
    ADD CONSTRAINT "morph_human_labels_invocation_id_fkey" FOREIGN KEY ("invocation_id") REFERENCES "geck_data"."model_invocations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "geck_data"."morph_human_labels"
    ADD CONSTRAINT "morph_human_labels_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "geck_data"."market_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "geck_data"."price_drops"
    ADD CONSTRAINT "price_drops_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "geck_data"."market_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "geck_data"."price_history"
    ADD CONSTRAINT "price_history_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "geck_data"."market_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "geck_data"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "geck_data"."seller_snapshots"
    ADD CONSTRAINT "seller_snapshots_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "geck_data"."market_sellers"("seller_id") ON DELETE CASCADE;



ALTER TABLE ONLY "geck_data"."show_mentions"
    ADD CONSTRAINT "show_mentions_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "geck_data"."market_listings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "geck_data"."show_mentions"
    ADD CONSTRAINT "show_mentions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "geck_data"."market_sellers"("seller_id") ON DELETE SET NULL;



ALTER TABLE ONLY "geck_data"."user_events"
    ADD CONSTRAINT "user_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "geck_data"."user_notification_channels"
    ADD CONSTRAINT "user_notification_channels_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_tasks"
    ADD CONSTRAINT "admin_tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_tasks"
    ADD CONSTRAINT "admin_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."answers"
    ADD CONSTRAINT "answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."blog_categories"
    ADD CONSTRAINT "blog_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blog_logs"
    ADD CONSTRAINT "blog_logs_related_post_id_fkey" FOREIGN KEY ("related_post_id") REFERENCES "public"."blog_posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."blog_logs"
    ADD CONSTRAINT "blog_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."blog_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blog_settings"
    ADD CONSTRAINT "blog_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blog_tags"
    ADD CONSTRAINT "blog_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."breeder_reviews"
    ADD CONSTRAINT "breeder_reviews_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "public"."geckos"("id");



ALTER TABLE ONLY "public"."breeding_loans"
    ADD CONSTRAINT "breeding_loans_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "public"."geckos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."breeding_loans"
    ADD CONSTRAINT "breeding_loans_breeding_project_id_fkey" FOREIGN KEY ("breeding_project_id") REFERENCES "public"."breeding_projects"("id");



ALTER TABLE ONLY "public"."breeding_projects"
    ADD CONSTRAINT "breeding_projects_dam_animal_id_fkey" FOREIGN KEY ("dam_animal_id") REFERENCES "public"."geckos"("id");



ALTER TABLE ONLY "public"."breeding_projects"
    ADD CONSTRAINT "breeding_projects_sire_animal_id_fkey" FOREIGN KEY ("sire_animal_id") REFERENCES "public"."geckos"("id");



ALTER TABLE ONLY "public"."classification_votes"
    ADD CONSTRAINT "classification_votes_gecko_image_fk" FOREIGN KEY ("gecko_image_id") REFERENCES "public"."gecko_images"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clutches"
    ADD CONSTRAINT "clutches_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."breeding_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collection_members"
    ADD CONSTRAINT "collection_members_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feature_usage"
    ADD CONSTRAINT "feature_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feeding_records"
    ADD CONSTRAINT "feeding_records_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "public"."geckos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gecko_waitlist_signups"
    ADD CONSTRAINT "gecko_waitlist_signups_waitlist_id_fkey" FOREIGN KEY ("waitlist_id") REFERENCES "public"."gecko_waitlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gecko_waitlists"
    ADD CONSTRAINT "gecko_waitlists_breeder_user_id_fkey" FOREIGN KEY ("breeder_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gecko_waitlists"
    ADD CONSTRAINT "gecko_waitlists_gecko_id_fkey" FOREIGN KEY ("gecko_id") REFERENCES "public"."geckos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."geckos"
    ADD CONSTRAINT "geckos_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."genetic_outcome_predictions"
    ADD CONSTRAINT "genetic_outcome_predictions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."breeding_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."giveaway_entries"
    ADD CONSTRAINT "giveaway_entries_giveaway_id_fkey" FOREIGN KEY ("giveaway_id") REFERENCES "public"."giveaways"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."iot_connections"
    ADD CONSTRAINT "iot_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mentor_offers"
    ADD CONSTRAINT "mentor_offers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."morph_id_usage"
    ADD CONSTRAINT "morph_id_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ownership_records"
    ADD CONSTRAINT "ownership_records_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "public"."geckos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promote_images"
    ADD CONSTRAINT "promote_images_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."question_votes"
    ADD CONSTRAINT "question_votes_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "public"."answers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."question_votes"
    ADD CONSTRAINT "question_votes_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shed_records"
    ADD CONSTRAINT "shed_records_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "public"."geckos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_generation_log"
    ADD CONSTRAINT "social_generation_log_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."social_generation_log"
    ADD CONSTRAINT "social_generation_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_platform_connections"
    ADD CONSTRAINT "social_platform_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_post_photo_usage"
    ADD CONSTRAINT "social_post_photo_usage_gecko_id_fkey" FOREIGN KEY ("gecko_id") REFERENCES "public"."geckos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_post_photo_usage"
    ADD CONSTRAINT "social_post_photo_usage_gecko_image_id_fkey" FOREIGN KEY ("gecko_image_id") REFERENCES "public"."gecko_images"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_post_photo_usage"
    ADD CONSTRAINT "social_post_photo_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_post_photo_usage"
    ADD CONSTRAINT "social_post_photo_usage_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."social_post_variants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."social_post_usage"
    ADD CONSTRAINT "social_post_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_post_variants"
    ADD CONSTRAINT "social_post_variants_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."social_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_posts"
    ADD CONSTRAINT "social_posts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."social_posts"
    ADD CONSTRAINT "social_posts_gecko_id_fkey" FOREIGN KEY ("gecko_id") REFERENCES "public"."geckos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."social_posts"
    ADD CONSTRAINT "social_posts_primary_variant_fk" FOREIGN KEY ("primary_variant_id") REFERENCES "public"."social_post_variants"("id") ON DELETE SET NULL NOT VALID;



ALTER TABLE ONLY "public"."social_referral_bonuses"
    ADD CONSTRAINT "social_referral_bonuses_referred_user_id_fkey" FOREIGN KEY ("referred_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."social_referral_bonuses"
    ADD CONSTRAINT "social_referral_bonuses_referrer_user_id_fkey" FOREIGN KEY ("referrer_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."store_affiliate_clicks"
    ADD CONSTRAINT "store_affiliate_clicks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."store_affiliate_clicks"
    ADD CONSTRAINT "store_affiliate_clicks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."store_affiliate_clicks"
    ADD CONSTRAINT "store_affiliate_clicks_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."store_vendors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."store_cart_items"
    ADD CONSTRAINT "store_cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "public"."store_carts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_cart_items"
    ADD CONSTRAINT "store_cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."store_carts"
    ADD CONSTRAINT "store_carts_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_categories"
    ADD CONSTRAINT "store_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."store_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."store_fulfillments"
    ADD CONSTRAINT "store_fulfillments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."store_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_fulfillments"
    ADD CONSTRAINT "store_fulfillments_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."store_order_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_order_items"
    ADD CONSTRAINT "store_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."store_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_order_items"
    ADD CONSTRAINT "store_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."store_order_items"
    ADD CONSTRAINT "store_order_items_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."store_vendors"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."store_orders"
    ADD CONSTRAINT "store_orders_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."store_orders"
    ADD CONSTRAINT "store_orders_signup_grant_fk" FOREIGN KEY ("signup_grant_id") REFERENCES "public"."store_signup_grants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."store_products"
    ADD CONSTRAINT "store_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."store_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."store_products"
    ADD CONSTRAINT "store_products_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."store_vendors"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."store_signup_grants"
    ADD CONSTRAINT "store_signup_grants_redeemed_by_user_id_fkey" FOREIGN KEY ("redeemed_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."store_signup_grants"
    ADD CONSTRAINT "store_signup_grants_source_order_id_fkey" FOREIGN KEY ("source_order_id") REFERENCES "public"."store_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."testimonials"
    ADD CONSTRAINT "testimonials_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_brand_voice"
    ADD CONSTRAINT "user_brand_voice_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vet_records"
    ADD CONSTRAINT "vet_records_animal_id_fkey" FOREIGN KEY ("animal_id") REFERENCES "public"."geckos"("id") ON DELETE CASCADE;



ALTER TABLE "geck_data"."_backup_0028_trait_rows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin delete error_logs" ON "geck_data"."error_logs" FOR DELETE USING ("geck_data"."is_admin"());



CREATE POLICY "admin delete ingest_audit" ON "geck_data"."ingest_audit" FOR DELETE USING ("geck_data"."is_admin"());



CREATE POLICY "admin delete user_events" ON "geck_data"."user_events" FOR DELETE USING ("geck_data"."is_admin"());



CREATE POLICY "admin read breeding_pairs" ON "geck_data"."breeding_pairs" FOR SELECT USING ("geck_data"."is_admin"());



CREATE POLICY "admin read clutches" ON "geck_data"."clutches" FOR SELECT USING ("geck_data"."is_admin"());



CREATE POLICY "admin read error_logs" ON "geck_data"."error_logs" FOR SELECT USING ("geck_data"."is_admin"());



CREATE POLICY "admin read hatchlings" ON "geck_data"."hatchlings" FOR SELECT USING ("geck_data"."is_admin"());



CREATE POLICY "admin read ingest_audit" ON "geck_data"."ingest_audit" FOR SELECT USING ("geck_data"."is_admin"());



CREATE POLICY "admin read profiles" ON "geck_data"."profiles" FOR SELECT USING ("geck_data"."is_admin"());



CREATE POLICY "admin read user_events" ON "geck_data"."user_events" FOR SELECT USING ("geck_data"."is_admin"());



CREATE POLICY "admin update error_logs" ON "geck_data"."error_logs" FOR UPDATE USING ("geck_data"."is_admin"());



CREATE POLICY "admin update profiles" ON "geck_data"."profiles" FOR UPDATE USING ("geck_data"."is_admin"());



CREATE POLICY "admin update user_events" ON "geck_data"."user_events" FOR UPDATE USING ("geck_data"."is_admin"());



ALTER TABLE "geck_data"."alert_delivery_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."alert_matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."anthropic_billing_daily" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anyone insert error_logs" ON "geck_data"."error_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "anyone insert user_events" ON "geck_data"."user_events" FOR INSERT WITH CHECK (true);



ALTER TABLE "geck_data"."auction_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."auction_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."batch_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."breeding_pairs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."clutches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."combo_catalog" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."crested_morph_taxonomy" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."cross_platform_listing_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."cross_platform_listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."error_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."external_reference_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."hatchlings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."ingest_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."ingest_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."listing_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."listing_image_phash_pairs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."listing_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."listing_lineage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."listing_status_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."listing_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."listings_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."market_auctions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."market_galleries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."market_lineage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."market_listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."market_raw_captures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."market_sellers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."model_invocations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."morph_eval_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."morph_human_labels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."morph_taxonomy" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."morph_taxonomy_synonyms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."morphs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "morphs_read_authenticated" ON "geck_data"."morphs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "owner crud breeding_pairs" ON "geck_data"."breeding_pairs" USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "owner crud clutches" ON "geck_data"."clutches" USING ((EXISTS ( SELECT 1
   FROM "geck_data"."breeding_pairs" "p"
  WHERE (("p"."id" = "clutches"."pair_id") AND ("p"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "geck_data"."breeding_pairs" "p"
  WHERE (("p"."id" = "clutches"."pair_id") AND ("p"."owner_id" = "auth"."uid"())))));



CREATE POLICY "owner crud hatchlings" ON "geck_data"."hatchlings" USING ((EXISTS ( SELECT 1
   FROM ("geck_data"."clutches" "c"
     JOIN "geck_data"."breeding_pairs" "p" ON (("p"."id" = "c"."pair_id")))
  WHERE (("c"."id" = "hatchlings"."clutch_id") AND ("p"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("geck_data"."clutches" "c"
     JOIN "geck_data"."breeding_pairs" "p" ON (("p"."id" = "c"."pair_id")))
  WHERE (("c"."id" = "hatchlings"."clutch_id") AND ("p"."owner_id" = "auth"."uid"())))));



CREATE POLICY "owner delete alerts" ON "geck_data"."alerts" FOR DELETE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "owner delete channels" ON "geck_data"."user_notification_channels" FOR DELETE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "owner insert alerts" ON "geck_data"."alerts" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "owner insert channels" ON "geck_data"."user_notification_channels" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "owner read alert_matches" ON "geck_data"."alert_matches" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "geck_data"."alerts" "a"
  WHERE (("a"."id" = "alert_matches"."alert_id") AND ("a"."owner_id" = "auth"."uid"())))));



CREATE POLICY "owner read alerts" ON "geck_data"."alerts" FOR SELECT USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "owner read channels" ON "geck_data"."user_notification_channels" FOR SELECT USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "owner read delivery attempts" ON "geck_data"."alert_delivery_attempts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("geck_data"."alert_matches" "m"
     JOIN "geck_data"."alerts" "a" ON (("a"."id" = "m"."alert_id")))
  WHERE (("m"."id" = "alert_delivery_attempts"."match_id") AND ("a"."owner_id" = "auth"."uid"())))));



CREATE POLICY "owner read profile" ON "geck_data"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "owner update alerts" ON "geck_data"."alerts" FOR UPDATE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "owner update channels" ON "geck_data"."user_notification_channels" FOR UPDATE USING (("auth"."uid"() = "owner_id"));



ALTER TABLE "geck_data"."price_adjustment_factors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."price_drops" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."price_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."price_history_dupes_archive" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public read anthropic_billing_daily" ON "geck_data"."anthropic_billing_daily" FOR SELECT USING (true);



CREATE POLICY "public read auction_results" ON "geck_data"."auction_results" FOR SELECT USING (true);



CREATE POLICY "public read auction_state" ON "geck_data"."auction_state" FOR SELECT USING (true);



CREATE POLICY "public read batch_jobs" ON "geck_data"."batch_jobs" FOR SELECT USING (true);



CREATE POLICY "public read combo_catalog" ON "geck_data"."combo_catalog" FOR SELECT USING (true);



CREATE POLICY "public read crested_morph_taxonomy" ON "geck_data"."crested_morph_taxonomy" FOR SELECT USING (true);



CREATE POLICY "public read cross_platform_listing_images" ON "geck_data"."cross_platform_listing_images" FOR SELECT USING (true);



CREATE POLICY "public read cross_platform_listings" ON "geck_data"."cross_platform_listings" FOR SELECT USING (true);



CREATE POLICY "public read external_reference_images" ON "geck_data"."external_reference_images" FOR SELECT USING (true);



CREATE POLICY "public read human labels" ON "geck_data"."morph_human_labels" FOR SELECT USING (true);



CREATE POLICY "public read listing_favorites" ON "geck_data"."listing_favorites" FOR SELECT USING (true);



CREATE POLICY "public read listing_images" ON "geck_data"."listing_images" FOR SELECT USING (true);



CREATE POLICY "public read listing_lineage" ON "geck_data"."listing_lineage" FOR SELECT USING (true);



CREATE POLICY "public read listing_status_events" ON "geck_data"."listing_status_events" FOR SELECT USING (true);



CREATE POLICY "public read listing_views" ON "geck_data"."listing_views" FOR SELECT USING (true);



CREATE POLICY "public read listings" ON "geck_data"."listings" FOR SELECT USING (true);



CREATE POLICY "public read listings_history" ON "geck_data"."listings_history" FOR SELECT USING (true);



CREATE POLICY "public read market_listings" ON "geck_data"."market_listings" FOR SELECT USING (true);



CREATE POLICY "public read market_sellers" ON "geck_data"."market_sellers" FOR SELECT USING (true);



CREATE POLICY "public read model_invocations" ON "geck_data"."model_invocations" FOR SELECT USING (true);



CREATE POLICY "public read morph_eval_runs" ON "geck_data"."morph_eval_runs" FOR SELECT USING (true);



CREATE POLICY "public read morph_taxonomy" ON "geck_data"."morph_taxonomy" FOR SELECT USING (true);



CREATE POLICY "public read phash pairs" ON "geck_data"."listing_image_phash_pairs" FOR SELECT USING (true);



CREATE POLICY "public read price factors" ON "geck_data"."price_adjustment_factors" FOR SELECT USING (true);



CREATE POLICY "public read price_drops" ON "geck_data"."price_drops" FOR SELECT USING (true);



CREATE POLICY "public read price_history" ON "geck_data"."price_history" FOR SELECT USING (true);



CREATE POLICY "public read runtime_config" ON "geck_data"."runtime_config" FOR SELECT USING (true);



CREATE POLICY "public read runtime_config_history" ON "geck_data"."runtime_config_history" FOR SELECT USING (true);



CREATE POLICY "public read scrape_runs" ON "geck_data"."scrape_runs" FOR SELECT USING (true);



CREATE POLICY "public read seller_snapshots" ON "geck_data"."seller_snapshots" FOR SELECT USING (true);



CREATE POLICY "public read sellers" ON "geck_data"."sellers" FOR SELECT USING (true);



CREATE POLICY "public read show_mentions" ON "geck_data"."show_mentions" FOR SELECT USING (true);



CREATE POLICY "public read synonyms" ON "geck_data"."morph_taxonomy_synonyms" FOR SELECT USING (true);



CREATE POLICY "public read trait_tiers" ON "geck_data"."trait_tiers" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "geck_data"."runtime_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."runtime_config_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."scrape_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."seller_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."sellers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."show_mentions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."trait_relations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trait_relations_public_read" ON "geck_data"."trait_relations" FOR SELECT USING (true);



ALTER TABLE "geck_data"."trait_tiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."user_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "geck_data"."user_notification_channels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Admins read affiliate clicks" ON "public"."store_affiliate_clicks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "Admins read signup grants" ON "public"."store_signup_grants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "Admins write tasks" ON "public"."admin_tasks" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "Anyone can browse active mentor offers" ON "public"."mentor_offers" FOR SELECT USING ((("is_active" = true) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Anyone can sign up to a waitlist" ON "public"."gecko_waitlist_signups" FOR INSERT TO "authenticated", "anon" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."gecko_waitlists" "w"
  WHERE (("w"."id" = "gecko_waitlist_signups"."waitlist_id") AND ("w"."is_open" = true) AND (("w"."closes_at" IS NULL) OR ("w"."closes_at" > "now"()))))));



CREATE POLICY "Anyone logs affiliate clicks" ON "public"."store_affiliate_clicks" FOR INSERT WITH CHECK (true);



CREATE POLICY "Breeders read their waitlist signups" ON "public"."gecko_waitlist_signups" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."gecko_waitlists" "w"
  WHERE (("w"."id" = "gecko_waitlist_signups"."waitlist_id") AND ("w"."breeder_user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Owners manage their iot connections" ON "public"."iot_connections" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Public read answers" ON "public"."answers" FOR SELECT USING (true);



CREATE POLICY "Public read breeder profiles" ON "public"."breeder_profiles" FOR SELECT USING (true);



CREATE POLICY "Public read breeder reviews" ON "public"."breeder_reviews" FOR SELECT USING (true);



CREATE POLICY "Public read breeding projects" ON "public"."breeding_projects" FOR SELECT USING (true);



CREATE POLICY "Public read clutches" ON "public"."clutches" FOR SELECT USING (true);



CREATE POLICY "Public read genetic outcomes" ON "public"."genetic_outcome_predictions" FOR SELECT USING (true);



CREATE POLICY "Public read morph prices" ON "public"."morph_price_entries" FOR SELECT USING (true);



CREATE POLICY "Public read question votes" ON "public"."question_votes" FOR SELECT USING (true);



CREATE POLICY "Public read questions" ON "public"."questions" FOR SELECT USING (true);



CREATE POLICY "Public read waitlists by slug" ON "public"."gecko_waitlists" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Referrers read their bonuses" ON "public"."social_referral_bonuses" FOR SELECT USING (("referrer_user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Referrers read their rewards" ON "public"."referral_rewards" FOR SELECT TO "authenticated" USING (("referrer_email" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "Sender and recipient read transfer requests" ON "public"."transfer_requests" FOR SELECT TO "authenticated" USING ((("created_by" = (( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text")) OR ("lower"("to_email") = "lower"(COALESCE((( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text"), ''::"text")))));



CREATE POLICY "Trait overrides are public to read" ON "public"."genetics_trait_overrides" FOR SELECT USING (("enabled" = true));



CREATE POLICY "Users can create shipping orders" ON "public"."shipping_orders" FOR INSERT WITH CHECK (("created_by" = (( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text")));



CREATE POLICY "Users can manage their own pending sales" ON "public"."pending_sales" USING (("user_email" = (( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text"))) WITH CHECK (("user_email" = (( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text")));



CREATE POLICY "Users can update own shipping orders" ON "public"."shipping_orders" FOR UPDATE USING (("created_by" = (( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text")));



CREATE POLICY "Users can view own shipping orders" ON "public"."shipping_orders" FOR SELECT USING (("created_by" = (( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text")));



CREATE POLICY "Users delete their own connections" ON "public"."social_platform_connections" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users manage own cart" ON "public"."store_carts" USING (("owner_user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("owner_user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users manage own cart items" ON "public"."store_cart_items" USING (("cart_id" IN ( SELECT "store_carts"."id"
   FROM "public"."store_carts"
  WHERE ("store_carts"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("cart_id" IN ( SELECT "store_carts"."id"
   FROM "public"."store_carts"
  WHERE ("store_carts"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users manage their brand voices" ON "public"."user_brand_voice" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users manage their own outcome logs" ON "public"."pairing_outcome_logs" USING (("created_by" = (( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text"))) WITH CHECK (("created_by" = (( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text")));



CREATE POLICY "Users manage their own posts" ON "public"."social_posts" USING (("created_by_user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("created_by_user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users manage their promote images" ON "public"."promote_images" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users manage variants of their posts" ON "public"."social_post_variants" USING ((EXISTS ( SELECT 1
   FROM "public"."social_posts" "p"
  WHERE (("p"."id" = "social_post_variants"."post_id") AND ("p"."created_by_user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."social_posts" "p"
  WHERE (("p"."id" = "social_post_variants"."post_id") AND ("p"."created_by_user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users read their own connections" ON "public"."social_platform_connections" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users read their own feature usage" ON "public"."feature_usage" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users read their own generation log" ON "public"."social_generation_log" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users read their own morph id usage" ON "public"."morph_id_usage" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users read their own usage" ON "public"."social_post_usage" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users read their photo usage" ON "public"."social_post_photo_usage" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."admin_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admins can delete error logs" ON "public"."error_logs" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."email" = (( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text")) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admins can read error logs" ON "public"."error_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."email" = (( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text")) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admins can read events" ON "public"."user_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."email" = (( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text")) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admins can update error logs" ON "public"."error_logs" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."email" = (( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text")) AND ("profiles"."role" = 'admin'::"text")))));



ALTER TABLE "public"."answers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "answers_delete_own" ON "public"."answers" FOR DELETE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "answers_insert_own" ON "public"."answers" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "answers_update_own" ON "public"."answers" FOR UPDATE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email"))) WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "anyone can record events" ON "public"."user_events" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "anyone can report errors" ON "public"."error_logs" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "anyone_can_create_inquiry" ON "public"."breeder_inquiries" FOR INSERT WITH CHECK (true);



CREATE POLICY "anyone_can_subscribe" ON "public"."newsletter_subscribers" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_settings_delete_admin" ON "public"."app_settings" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "app_settings_insert_admin" ON "public"."app_settings" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "app_settings_select" ON "public"."app_settings" FOR SELECT TO "authenticated", "anon" USING ((("is_public" = true) OR "public"."is_admin"()));



CREATE POLICY "app_settings_update_admin" ON "public"."app_settings" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."blog_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "blog_categories_delete_admin" ON "public"."blog_categories" FOR DELETE TO "authenticated" USING ("public"."is_blog_admin"());



CREATE POLICY "blog_categories_insert_admin" ON "public"."blog_categories" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_blog_admin"());



CREATE POLICY "blog_categories_select" ON "public"."blog_categories" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) OR "public"."is_blog_admin"()));



CREATE POLICY "blog_categories_update_admin" ON "public"."blog_categories" FOR UPDATE TO "authenticated" USING ("public"."is_blog_admin"()) WITH CHECK ("public"."is_blog_admin"());



ALTER TABLE "public"."blog_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "blog_logs_admin_insert" ON "public"."blog_logs" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_blog_admin"());



CREATE POLICY "blog_logs_admin_select" ON "public"."blog_logs" FOR SELECT TO "authenticated" USING ("public"."is_blog_admin"());



ALTER TABLE "public"."blog_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "blog_posts_delete_admin" ON "public"."blog_posts" FOR DELETE TO "authenticated" USING ("public"."is_blog_admin"());



CREATE POLICY "blog_posts_insert_admin" ON "public"."blog_posts" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_blog_admin"());



CREATE POLICY "blog_posts_select" ON "public"."blog_posts" FOR SELECT TO "authenticated", "anon" USING (((("status" = 'published'::"public"."blog_post_status") AND (("published_at" IS NULL) OR ("published_at" <= "now"()))) OR "public"."is_blog_admin"()));



CREATE POLICY "blog_posts_update_admin" ON "public"."blog_posts" FOR UPDATE TO "authenticated" USING ("public"."is_blog_admin"()) WITH CHECK ("public"."is_blog_admin"());



ALTER TABLE "public"."blog_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "blog_settings_admin_all" ON "public"."blog_settings" TO "authenticated" USING ("public"."is_blog_admin"()) WITH CHECK ("public"."is_blog_admin"());



ALTER TABLE "public"."blog_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "blog_tags_delete_admin" ON "public"."blog_tags" FOR DELETE TO "authenticated" USING ("public"."is_blog_admin"());



CREATE POLICY "blog_tags_insert_admin" ON "public"."blog_tags" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_blog_admin"());



CREATE POLICY "blog_tags_select" ON "public"."blog_tags" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) OR "public"."is_blog_admin"()));



CREATE POLICY "blog_tags_update_admin" ON "public"."blog_tags" FOR UPDATE TO "authenticated" USING ("public"."is_blog_admin"()) WITH CHECK ("public"."is_blog_admin"());



ALTER TABLE "public"."breeder_inquiries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."breeder_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "breeder_profiles_delete_own" ON "public"."breeder_profiles" FOR DELETE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "breeder_profiles_insert_own" ON "public"."breeder_profiles" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "breeder_profiles_update_own" ON "public"."breeder_profiles" FOR UPDATE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email"))) WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "breeder_reads_own_inquiries" ON "public"."breeder_inquiries" FOR SELECT USING (("breeder_email" = ( SELECT "profiles"."email"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = (( SELECT "auth"."uid"() AS "uid"))::"text"))));



ALTER TABLE "public"."breeder_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "breeder_reviews_delete_own" ON "public"."breeder_reviews" FOR DELETE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "breeder_reviews_insert_own" ON "public"."breeder_reviews" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "breeder_reviews_update_own" ON "public"."breeder_reviews" FOR UPDATE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email"))) WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



ALTER TABLE "public"."breeder_store_pages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "breeder_store_pages_delete_own" ON "public"."breeder_store_pages" FOR DELETE USING ((( SELECT "auth"."email"() AS "email") = "owner_email"));



CREATE POLICY "breeder_store_pages_insert_own" ON "public"."breeder_store_pages" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "owner_email"));



CREATE POLICY "breeder_store_pages_read" ON "public"."breeder_store_pages" FOR SELECT USING (("is_published" OR (( SELECT "auth"."email"() AS "email") = "owner_email")));



CREATE POLICY "breeder_store_pages_update_own" ON "public"."breeder_store_pages" FOR UPDATE USING ((( SELECT "auth"."email"() AS "email") = "owner_email"));



CREATE POLICY "breeder_updates_own_inquiries" ON "public"."breeder_inquiries" FOR UPDATE USING (("breeder_email" = ( SELECT "profiles"."email"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = (( SELECT "auth"."uid"() AS "uid"))::"text"))));



ALTER TABLE "public"."breeding_loans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "breeding_loans_delete_own" ON "public"."breeding_loans" FOR DELETE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "breeding_loans_insert_own" ON "public"."breeding_loans" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "breeding_loans_select" ON "public"."breeding_loans" FOR SELECT TO "authenticated" USING ((("created_by" = ( SELECT "auth"."email"() AS "email")) OR ("lender_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("borrower_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("lower"("borrower_email") = "lower"(COALESCE(( SELECT "auth"."email"() AS "email"), ''::"text"))) OR "public"."is_admin"()));



CREATE POLICY "breeding_loans_update_own" ON "public"."breeding_loans" FOR UPDATE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email"))) WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



ALTER TABLE "public"."breeding_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "breeding_plans_delete_own" ON "public"."breeding_plans" FOR DELETE USING (((( SELECT "auth"."email"() AS "email") = "created_by") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "breeding_plans_insert_own" ON "public"."breeding_plans" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "breeding_plans_read" ON "public"."breeding_plans" FOR SELECT USING (((( SELECT "auth"."email"() AS "email") = "created_by") OR ("is_public" = true) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "breeding_plans_update_own" ON "public"."breeding_plans" FOR UPDATE USING (((( SELECT "auth"."email"() AS "email") = "created_by") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))));



ALTER TABLE "public"."breeding_projects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "breeding_projects_delete_own" ON "public"."breeding_projects" FOR DELETE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "breeding_projects_insert_own" ON "public"."breeding_projects" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "breeding_projects_update_own" ON "public"."breeding_projects" FOR UPDATE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email"))) WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "care_guide_read_all" ON "public"."care_guide_sections" FOR SELECT USING (true);



ALTER TABLE "public"."care_guide_sections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "care_guide_sections_delete_admin" ON "public"."care_guide_sections" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "care_guide_sections_insert_admin" ON "public"."care_guide_sections" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "care_guide_sections_update_admin" ON "public"."care_guide_sections" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "cer_delete_own" ON "public"."community_event_reactions" FOR DELETE USING ((( SELECT "auth"."email"() AS "email") = "user_email"));



CREATE POLICY "cer_insert_own" ON "public"."community_event_reactions" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "user_email"));



CREATE POLICY "cer_read_all" ON "public"."community_event_reactions" FOR SELECT USING (true);



ALTER TABLE "public"."change_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "change_logs_delete_admin" ON "public"."change_logs" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "change_logs_insert_admin" ON "public"."change_logs" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "change_logs_read" ON "public"."change_logs" FOR SELECT USING ((("is_published" = true) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "change_logs_update_admin" ON "public"."change_logs" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."classification_votes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "classification_votes_delete_own" ON "public"."classification_votes" FOR DELETE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "classification_votes_insert" ON "public"."classification_votes" FOR INSERT TO "authenticated" WITH CHECK ((("reviewer_email" = ( SELECT "auth"."email"() AS "email")) OR ("created_by" = ( SELECT "auth"."email"() AS "email"))));



CREATE POLICY "classification_votes_select" ON "public"."classification_votes" FOR SELECT TO "authenticated" USING ((("reviewer_email" = ( SELECT "auth"."email"() AS "email")) OR ("created_by" = ( SELECT "auth"."email"() AS "email")) OR "public"."is_expert_reviewer"()));



CREATE POLICY "classification_votes_update_own" ON "public"."classification_votes" FOR UPDATE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



ALTER TABLE "public"."clutches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clutches_delete_own" ON "public"."clutches" FOR DELETE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "clutches_insert_own" ON "public"."clutches" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "clutches_update_own" ON "public"."clutches" FOR UPDATE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email"))) WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



ALTER TABLE "public"."collection_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "collection_members_delete_owner" ON "public"."collection_members" FOR DELETE TO "authenticated" USING ("public"."is_collection_owner"("collection_id", ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "collection_members_insert_owner" ON "public"."collection_members" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_collection_owner"("collection_id", ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "collection_members_select" ON "public"."collection_members" FOR SELECT TO "authenticated" USING ((("lower"("member_email") = "lower"(COALESCE(( SELECT "auth"."email"() AS "email"), ''::"text"))) OR "public"."is_collection_owner"("collection_id", ( SELECT "auth"."email"() AS "email"))));



CREATE POLICY "collection_members_update" ON "public"."collection_members" FOR UPDATE TO "authenticated" USING ((("lower"("member_email") = "lower"(COALESCE(( SELECT "auth"."email"() AS "email"), ''::"text"))) OR "public"."is_collection_owner"("collection_id", ( SELECT "auth"."email"() AS "email")))) WITH CHECK ((("lower"("member_email") = "lower"(COALESCE(( SELECT "auth"."email"() AS "email"), ''::"text"))) OR "public"."is_collection_owner"("collection_id", ( SELECT "auth"."email"() AS "email"))));



ALTER TABLE "public"."collection_valuations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "collection_valuations_delete_own" ON "public"."collection_valuations" FOR DELETE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "collection_valuations_insert_own" ON "public"."collection_valuations" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "collection_valuations_select" ON "public"."collection_valuations" FOR SELECT TO "authenticated" USING ((("created_by" = ( SELECT "auth"."email"() AS "email")) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "collection_valuations_update_own" ON "public"."collection_valuations" FOR UPDATE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email"))) WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



ALTER TABLE "public"."collections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "collections_delete_owner" ON "public"."collections" FOR DELETE TO "authenticated" USING (("lower"("owner_email") = "lower"(COALESCE(( SELECT "auth"."email"() AS "email"), ''::"text"))));



CREATE POLICY "collections_insert_owner" ON "public"."collections" FOR INSERT TO "authenticated" WITH CHECK (("lower"("owner_email") = "lower"(COALESCE(( SELECT "auth"."email"() AS "email"), ''::"text"))));



CREATE POLICY "collections_select" ON "public"."collections" FOR SELECT TO "authenticated" USING ((("lower"("owner_email") = "lower"(COALESCE(( SELECT "auth"."email"() AS "email"), ''::"text"))) OR "public"."is_collection_member"("id", ( SELECT "auth"."email"() AS "email"))));



CREATE POLICY "collections_update_owner" ON "public"."collections" FOR UPDATE TO "authenticated" USING (("lower"("owner_email") = "lower"(COALESCE(( SELECT "auth"."email"() AS "email"), ''::"text")))) WITH CHECK (("lower"("owner_email") = "lower"(COALESCE(( SELECT "auth"."email"() AS "email"), ''::"text"))));



ALTER TABLE "public"."community_event_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."direct_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "direct_messages_delete_own" ON "public"."direct_messages" FOR DELETE TO "authenticated" USING (((( SELECT "auth"."email"() AS "email") = "sender_email") OR (( SELECT "auth"."email"() AS "email") = "recipient_email") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "direct_messages_insert" ON "public"."direct_messages" FOR INSERT WITH CHECK (((( SELECT "auth"."email"() AS "email") = "sender_email") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "direct_messages_read_own" ON "public"."direct_messages" FOR SELECT USING (((( SELECT "auth"."email"() AS "email") = "sender_email") OR (( SELECT "auth"."email"() AS "email") = "recipient_email")));



CREATE POLICY "direct_messages_update_own" ON "public"."direct_messages" FOR UPDATE USING (((( SELECT "auth"."email"() AS "email") = "sender_email") OR (( SELECT "auth"."email"() AS "email") = "recipient_email")));



ALTER TABLE "public"."eggs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "eggs_delete_own" ON "public"."eggs" FOR DELETE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "eggs_read" ON "public"."eggs" FOR SELECT USING (((( SELECT "auth"."email"() AS "email") = "created_by") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "eggs_update_own" ON "public"."eggs" FOR UPDATE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "eggs_write_own" ON "public"."eggs" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "created_by"));



ALTER TABLE "public"."error_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expert_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expert_actions_delete_admin" ON "public"."expert_actions" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "expert_actions_insert_admin" ON "public"."expert_actions" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "expert_actions_read" ON "public"."expert_actions" FOR SELECT USING (((( SELECT "auth"."email"() AS "email") = "expert_email") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "expert_actions_update_admin" ON "public"."expert_actions" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "expert_verification_insert_own" ON "public"."expert_verification_requests" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "user_email"));



CREATE POLICY "expert_verification_read_own" ON "public"."expert_verification_requests" FOR SELECT USING (((( SELECT "auth"."email"() AS "email") = "user_email") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))));



ALTER TABLE "public"."expert_verification_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expert_verification_update_admin" ON "public"."expert_verification_requests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."feature_credit_allotments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feature_credit_allotments public read" ON "public"."feature_credit_allotments" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."feature_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feeding_groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feeding_groups_delete_own" ON "public"."feeding_groups" FOR DELETE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "feeding_groups_read_own" ON "public"."feeding_groups" FOR SELECT USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "feeding_groups_update_own" ON "public"."feeding_groups" FOR UPDATE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "feeding_groups_write_own" ON "public"."feeding_groups" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "created_by"));



ALTER TABLE "public"."feeding_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feeding_records_delete_own" ON "public"."feeding_records" FOR DELETE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "feeding_records_insert_own" ON "public"."feeding_records" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "feeding_records_read" ON "public"."feeding_records" FOR SELECT TO "authenticated", "anon" USING ((("created_by" = ( SELECT "auth"."email"() AS "email")) OR ("logged_by" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"() OR "public"."gecko_passport_is_public"("animal_id")));



CREATE POLICY "feeding_records_update_own" ON "public"."feeding_records" FOR UPDATE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email"))) WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



ALTER TABLE "public"."forum_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "forum_categories_delete_admin" ON "public"."forum_categories" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "forum_categories_insert_admin" ON "public"."forum_categories" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "forum_categories_read_all" ON "public"."forum_categories" FOR SELECT USING (true);



CREATE POLICY "forum_categories_update_admin" ON "public"."forum_categories" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."forum_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "forum_comments_delete_own" ON "public"."forum_comments" FOR DELETE USING (((( SELECT "auth"."email"() AS "email") = "created_by") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "forum_comments_insert_own" ON "public"."forum_comments" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "forum_comments_read_all" ON "public"."forum_comments" FOR SELECT USING (true);



CREATE POLICY "forum_comments_update_own" ON "public"."forum_comments" FOR UPDATE USING (((( SELECT "auth"."email"() AS "email") = "created_by") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))));



ALTER TABLE "public"."forum_likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "forum_likes_delete_own" ON "public"."forum_likes" FOR DELETE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "forum_likes_insert_own" ON "public"."forum_likes" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "forum_likes_read_all" ON "public"."forum_likes" FOR SELECT USING (true);



ALTER TABLE "public"."forum_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "forum_posts_delete_own" ON "public"."forum_posts" FOR DELETE USING (((( SELECT "auth"."email"() AS "email") = "created_by") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "forum_posts_insert_own" ON "public"."forum_posts" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "forum_posts_read_all" ON "public"."forum_posts" FOR SELECT USING (true);



CREATE POLICY "forum_posts_update_own" ON "public"."forum_posts" FOR UPDATE USING (((( SELECT "auth"."email"() AS "email") = "created_by") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))));



ALTER TABLE "public"."future_breeding_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "future_plans_delete_own" ON "public"."future_breeding_plans" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "future_plans_insert_own" ON "public"."future_breeding_plans" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "future_plans_read_own" ON "public"."future_breeding_plans" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "future_plans_update_own" ON "public"."future_breeding_plans" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



ALTER TABLE "public"."gecko_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gecko_events_delete_own" ON "public"."gecko_events" FOR DELETE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "gecko_events_read_own" ON "public"."gecko_events" FOR SELECT USING (((( SELECT "auth"."email"() AS "email") = "created_by") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "gecko_events_update_own" ON "public"."gecko_events" FOR UPDATE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "gecko_events_write_own" ON "public"."gecko_events" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "created_by"));



ALTER TABLE "public"."gecko_images" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gecko_images_delete" ON "public"."gecko_images" FOR DELETE TO "authenticated" USING ((("created_by" = ( SELECT "auth"."email"() AS "email")) OR "public"."is_admin"()));



CREATE POLICY "gecko_images_insert" ON "public"."gecko_images" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = ( SELECT "auth"."email"() AS "email")) AND ("verified" IS NOT TRUE)));



CREATE POLICY "gecko_images_select" ON "public"."gecko_images" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "gecko_images_update" ON "public"."gecko_images" FOR UPDATE TO "authenticated" USING (((("created_by" = ( SELECT "auth"."email"() AS "email")) AND ("verified" IS NOT TRUE)) OR "public"."is_expert_reviewer"())) WITH CHECK (((("created_by" = ( SELECT "auth"."email"() AS "email")) AND ("verified" IS NOT TRUE)) OR "public"."is_expert_reviewer"()));



ALTER TABLE "public"."gecko_likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gecko_likes_delete_own" ON "public"."gecko_likes" FOR DELETE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "gecko_likes_read_all" ON "public"."gecko_likes" FOR SELECT USING (true);



CREATE POLICY "gecko_likes_write_own" ON "public"."gecko_likes" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "gecko_of_day_read_all" ON "public"."gecko_of_the_day" FOR SELECT USING (true);



ALTER TABLE "public"."gecko_of_the_day" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gecko_of_the_day_delete_admin" ON "public"."gecko_of_the_day" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "gecko_of_the_day_insert_admin" ON "public"."gecko_of_the_day" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "gecko_of_the_day_update_admin" ON "public"."gecko_of_the_day" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."gecko_waitlist_signups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gecko_waitlists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gecko_waitlists_delete_owner" ON "public"."gecko_waitlists" FOR DELETE TO "authenticated" USING (("breeder_user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "gecko_waitlists_insert_owner" ON "public"."gecko_waitlists" FOR INSERT TO "authenticated" WITH CHECK (("breeder_user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "gecko_waitlists_update_owner" ON "public"."gecko_waitlists" FOR UPDATE TO "authenticated" USING (("breeder_user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("breeder_user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."geckos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "geckos_delete_own" ON "public"."geckos" FOR DELETE USING (((( SELECT "auth"."email"() AS "email") = "created_by") OR "public"."is_collection_editor"("collection_id", ( SELECT "auth"."email"() AS "email"))));



CREATE POLICY "geckos_insert_own" ON "public"."geckos" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "geckos_read_all" ON "public"."geckos" FOR SELECT USING (true);



CREATE POLICY "geckos_update_own" ON "public"."geckos" FOR UPDATE USING (((( SELECT "auth"."email"() AS "email") = "created_by") OR "public"."is_collection_editor"("collection_id", ( SELECT "auth"."email"() AS "email")))) WITH CHECK (((( SELECT "auth"."email"() AS "email") = "created_by") OR "public"."is_collection_editor"("collection_id", ( SELECT "auth"."email"() AS "email"))));



ALTER TABLE "public"."genetic_outcome_predictions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "genetic_outcome_predictions_delete_own" ON "public"."genetic_outcome_predictions" FOR DELETE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "genetic_outcome_predictions_insert_own" ON "public"."genetic_outcome_predictions" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "genetic_outcome_predictions_update_own" ON "public"."genetic_outcome_predictions" FOR UPDATE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email"))) WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



ALTER TABLE "public"."genetics_trait_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."giveaway_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "giveaway_entries_delete_own" ON "public"."giveaway_entries" FOR DELETE USING ((( SELECT "auth"."email"() AS "email") = "user_email"));



CREATE POLICY "giveaway_entries_insert_own" ON "public"."giveaway_entries" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "user_email"));



CREATE POLICY "giveaway_entries_read" ON "public"."giveaway_entries" FOR SELECT USING (((( SELECT "auth"."email"() AS "email") = "user_email") OR (( SELECT "auth"."email"() AS "email") IN ( SELECT "g"."created_by"
   FROM "public"."giveaways" "g"
  WHERE ("g"."id" = "giveaway_entries"."giveaway_id")))));



ALTER TABLE "public"."giveaways" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "giveaways_delete_own" ON "public"."giveaways" FOR DELETE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "giveaways_insert_own" ON "public"."giveaways" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "giveaways_read_all" ON "public"."giveaways" FOR SELECT USING (true);



CREATE POLICY "giveaways_update_own" ON "public"."giveaways" FOR UPDATE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



ALTER TABLE "public"."iot_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lineage_placeholders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lineage_placeholders_delete_own" ON "public"."lineage_placeholders" FOR DELETE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "lineage_placeholders_read_own" ON "public"."lineage_placeholders" FOR SELECT USING (((( SELECT "auth"."email"() AS "email") = "created_by") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "lineage_placeholders_update_own" ON "public"."lineage_placeholders" FOR UPDATE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "lineage_placeholders_write_own" ON "public"."lineage_placeholders" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "created_by"));



ALTER TABLE "public"."marketplace_costs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketplace_costs_delete_own" ON "public"."marketplace_costs" FOR DELETE USING ((( SELECT "auth"."email"() AS "email") = "user_email"));



CREATE POLICY "marketplace_costs_read_own" ON "public"."marketplace_costs" FOR SELECT USING ((( SELECT "auth"."email"() AS "email") = "user_email"));



CREATE POLICY "marketplace_costs_update_own" ON "public"."marketplace_costs" FOR UPDATE USING ((( SELECT "auth"."email"() AS "email") = "user_email"));



CREATE POLICY "marketplace_costs_write_own" ON "public"."marketplace_costs" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "user_email"));



ALTER TABLE "public"."marketplace_likes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketplace_likes_delete_own" ON "public"."marketplace_likes" FOR DELETE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "marketplace_likes_insert_own" ON "public"."marketplace_likes" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "marketplace_likes_read" ON "public"."marketplace_likes" FOR SELECT USING (((( SELECT "auth"."email"() AS "email") = "user_email") OR (( SELECT "auth"."email"() AS "email") = "created_by")));



ALTER TABLE "public"."mentor_offers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mentor_offers_delete_owner" ON "public"."mentor_offers" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "mentor_offers_insert_owner" ON "public"."mentor_offers" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "mentor_offers_update_owner" ON "public"."mentor_offers" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."morph_guide_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "morph_guide_comments_insert_own" ON "public"."morph_guide_comments" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "user_email"));



CREATE POLICY "morph_guide_comments_read_all" ON "public"."morph_guide_comments" FOR SELECT USING (true);



CREATE POLICY "morph_guide_comments_update_admin" ON "public"."morph_guide_comments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."morph_guides" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "morph_guides_delete_admin" ON "public"."morph_guides" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "morph_guides_insert_admin" ON "public"."morph_guides" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "morph_guides_read_all" ON "public"."morph_guides" FOR SELECT USING (true);



CREATE POLICY "morph_guides_update_admin" ON "public"."morph_guides" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."morph_id_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."morph_price_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "morph_price_cache_delete_admin" ON "public"."morph_price_cache" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "morph_price_cache_insert_admin" ON "public"."morph_price_cache" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "morph_price_cache_read_all" ON "public"."morph_price_cache" FOR SELECT USING (true);



CREATE POLICY "morph_price_cache_update_admin" ON "public"."morph_price_cache" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."morph_price_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "morph_price_entries_delete_own" ON "public"."morph_price_entries" FOR DELETE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "morph_price_entries_insert_own" ON "public"."morph_price_entries" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "morph_price_entries_update_own" ON "public"."morph_price_entries" FOR UPDATE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email"))) WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



ALTER TABLE "public"."morph_reference_images" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "morph_reference_images_read_all" ON "public"."morph_reference_images" FOR SELECT USING (true);



CREATE POLICY "morph_reference_images_update" ON "public"."morph_reference_images" FOR UPDATE USING (((( SELECT "auth"."email"() AS "email") = "created_by") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "morph_reference_images_write_own" ON "public"."morph_reference_images" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "created_by"));



ALTER TABLE "public"."morph_traits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "morph_traits_delete_admin" ON "public"."morph_traits" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "morph_traits_insert_admin" ON "public"."morph_traits" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "morph_traits_read_all" ON "public"."morph_traits" FOR SELECT USING (true);



CREATE POLICY "morph_traits_update_admin" ON "public"."morph_traits" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."newsletter_subscribers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "no_select_for_users" ON "public"."newsletter_subscribers" FOR SELECT USING (false);



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_delete_admin" ON "public"."notifications" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "notifications_insert_any_authed" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."email"() AS "email") IS NOT NULL) AND (("created_by" = ( SELECT "auth"."email"() AS "email")) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text")))))));



CREATE POLICY "notifications_read_own" ON "public"."notifications" FOR SELECT USING ((( SELECT "auth"."email"() AS "email") = "user_email"));



CREATE POLICY "notifications_update_own" ON "public"."notifications" FOR UPDATE USING ((( SELECT "auth"."email"() AS "email") = "user_email"));



ALTER TABLE "public"."other_reptiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "other_reptiles_delete_own" ON "public"."other_reptiles" FOR DELETE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "other_reptiles_read_own" ON "public"."other_reptiles" FOR SELECT USING (((( SELECT "auth"."email"() AS "email") = "created_by") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "other_reptiles_update_own" ON "public"."other_reptiles" FOR UPDATE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "other_reptiles_write_own" ON "public"."other_reptiles" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "created_by"));



ALTER TABLE "public"."ownership_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ownership_records_delete_own" ON "public"."ownership_records" FOR DELETE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "ownership_records_insert_own" ON "public"."ownership_records" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "ownership_records_read" ON "public"."ownership_records" FOR SELECT TO "authenticated", "anon" USING ((("created_by" = ( SELECT "auth"."email"() AS "email")) OR ("owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"() OR "public"."gecko_passport_is_public"("animal_id")));



CREATE POLICY "ownership_records_update_own" ON "public"."ownership_records" FOR UPDATE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email"))) WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



ALTER TABLE "public"."page_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "page_config_delete_admin" ON "public"."page_config" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "page_config_insert_admin" ON "public"."page_config" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "page_config_read_all" ON "public"."page_config" FOR SELECT USING (true);



CREATE POLICY "page_config_update_admin" ON "public"."page_config" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."pairing_outcome_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_events_delete_admin" ON "public"."payment_events" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "payment_events_insert_admin" ON "public"."payment_events" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "payment_events_read" ON "public"."payment_events" FOR SELECT USING (((( SELECT "auth"."email"() AS "email") = "user_email") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "payment_events_update_admin" ON "public"."payment_events" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."pending_sales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."price_alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "price_alerts_delete_own" ON "public"."price_alerts" FOR DELETE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "price_alerts_insert_own" ON "public"."price_alerts" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "price_alerts_select" ON "public"."price_alerts" FOR SELECT TO "authenticated" USING ((("created_by" = ( SELECT "auth"."email"() AS "email")) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "price_alerts_update_own" ON "public"."price_alerts" FOR UPDATE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email"))) WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_delete_admin" ON "public"."profiles" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT WITH CHECK (((( SELECT "auth"."email"() AS "email") = "email") OR (( SELECT "auth"."email"() AS "email") = "created_by")));



CREATE POLICY "profiles_read_all" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "profiles_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("email" = ( SELECT "auth"."email"() AS "email")) OR ("created_by" = ( SELECT "auth"."email"() AS "email")) OR "public"."is_admin"())) WITH CHECK ((("email" = ( SELECT "auth"."email"() AS "email")) OR ("created_by" = ( SELECT "auth"."email"() AS "email")) OR "public"."is_admin"()));



ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "projects_delete_own" ON "public"."projects" FOR DELETE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "projects_read_own" ON "public"."projects" FOR SELECT USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "projects_update_own" ON "public"."projects" FOR UPDATE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "projects_write_own" ON "public"."projects" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "created_by"));



ALTER TABLE "public"."promote_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_subscriptions_delete_own" ON "public"."push_subscriptions" FOR DELETE USING (((( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text") = "user_email"));



CREATE POLICY "push_subscriptions_insert_own" ON "public"."push_subscriptions" FOR INSERT WITH CHECK (((( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text") = "user_email"));



CREATE POLICY "push_subscriptions_select_own" ON "public"."push_subscriptions" FOR SELECT USING (((( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text") = "user_email"));



CREATE POLICY "push_subscriptions_update_own" ON "public"."push_subscriptions" FOR UPDATE USING (((( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text") = "user_email")) WITH CHECK (((( SELECT "auth"."jwt"() AS "jwt") ->> 'email'::"text") = "user_email"));



ALTER TABLE "public"."question_votes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "question_votes_delete_own" ON "public"."question_votes" FOR DELETE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "question_votes_insert_own" ON "public"."question_votes" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "question_votes_update_own" ON "public"."question_votes" FOR UPDATE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email"))) WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



ALTER TABLE "public"."questions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "questions_delete_own" ON "public"."questions" FOR DELETE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "questions_insert_own" ON "public"."questions" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "questions_update_own" ON "public"."questions" FOR UPDATE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email"))) WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



ALTER TABLE "public"."referral_rewards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reptile_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reptile_events_delete_own" ON "public"."reptile_events" FOR DELETE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "reptile_events_read_own" ON "public"."reptile_events" FOR SELECT USING (((( SELECT "auth"."email"() AS "email") = "created_by") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "reptile_events_update_own" ON "public"."reptile_events" FOR UPDATE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "reptile_events_write_own" ON "public"."reptile_events" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "created_by"));



ALTER TABLE "public"."revenuecat_entitlements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "revenuecat_entitlements_select_self" ON "public"."revenuecat_entitlements" FOR SELECT USING (("app_user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."revenuecat_webhook_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "scraped_data_admin" ON "public"."scraped_training_data" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."scraped_training_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shed_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shed_records_delete_own" ON "public"."shed_records" FOR DELETE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "shed_records_insert_own" ON "public"."shed_records" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "shed_records_read" ON "public"."shed_records" FOR SELECT TO "authenticated", "anon" USING ((("created_by" = ( SELECT "auth"."email"() AS "email")) OR "public"."is_admin"() OR "public"."gecko_passport_is_public"("animal_id")));



CREATE POLICY "shed_records_update_own" ON "public"."shed_records" FOR UPDATE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email"))) WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



ALTER TABLE "public"."shipping_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_generation_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_platform_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_post_photo_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_post_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_post_variants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."social_referral_bonuses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."store_affiliate_clicks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."store_cart_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."store_carts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."store_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "store_categories_delete_admin" ON "public"."store_categories" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "store_categories_insert_admin" ON "public"."store_categories" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "store_categories_select" ON "public"."store_categories" FOR SELECT TO "authenticated", "anon" USING (("is_active" OR "public"."is_admin"()));



CREATE POLICY "store_categories_update_admin" ON "public"."store_categories" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."store_fulfillments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "store_fulfillments_delete_admin" ON "public"."store_fulfillments" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "store_fulfillments_insert_admin" ON "public"."store_fulfillments" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "store_fulfillments_select" ON "public"."store_fulfillments" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("order_id" IN ( SELECT "o"."id"
   FROM "public"."store_orders" "o"
  WHERE (("o"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("o"."customer_email" = ( SELECT "auth"."email"() AS "email")))))));



CREATE POLICY "store_fulfillments_update_admin" ON "public"."store_fulfillments" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."store_order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "store_order_items_select" ON "public"."store_order_items" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("order_id" IN ( SELECT "o"."id"
   FROM "public"."store_orders" "o"
  WHERE (("o"."owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("o"."customer_email" = ( SELECT "auth"."email"() AS "email")))))));



ALTER TABLE "public"."store_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "store_orders_delete_admin" ON "public"."store_orders" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "store_orders_insert_admin" ON "public"."store_orders" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "store_orders_select" ON "public"."store_orders" FOR SELECT TO "authenticated" USING ((("owner_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("customer_email" = ( SELECT "auth"."email"() AS "email")) OR "public"."is_admin"()));



CREATE POLICY "store_orders_update_admin" ON "public"."store_orders" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."store_products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "store_products_delete_admin" ON "public"."store_products" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "store_products_insert_admin" ON "public"."store_products" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "store_products_select" ON "public"."store_products" FOR SELECT TO "authenticated", "anon" USING ((("status" = 'active'::"public"."store_product_status") OR "public"."is_admin"()));



CREATE POLICY "store_products_update_admin" ON "public"."store_products" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."store_promo_codes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "store_promo_codes_delete_admin" ON "public"."store_promo_codes" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "store_promo_codes_insert_admin" ON "public"."store_promo_codes" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "store_promo_codes_select" ON "public"."store_promo_codes" FOR SELECT TO "authenticated", "anon" USING ((("is_active" AND (("starts_at" IS NULL) OR ("starts_at" <= "now"())) AND (("ends_at" IS NULL) OR ("ends_at" >= "now"()))) OR "public"."is_admin"()));



CREATE POLICY "store_promo_codes_update_admin" ON "public"."store_promo_codes" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."store_signup_grants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."store_vendors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "store_vendors_delete_admin" ON "public"."store_vendors" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "store_vendors_insert_admin" ON "public"."store_vendors" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "store_vendors_select" ON "public"."store_vendors" FOR SELECT TO "authenticated", "anon" USING (("is_active" OR "public"."is_admin"()));



CREATE POLICY "store_vendors_update_admin" ON "public"."store_vendors" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "stripe_logs_admin" ON "public"."stripe_webhook_logs" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."stripe_webhook_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "support_messages_delete_admin" ON "public"."support_messages" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text")))));



CREATE POLICY "support_messages_insert_anyone" ON "public"."support_messages" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "support_messages_read_own_or_admin" ON "public"."support_messages" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."email"() AS "email") = "user_email") OR (( SELECT "auth"."email"() AS "email") = "created_by") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "support_messages_update_admin" ON "public"."support_messages" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text")))));



ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tasks_delete_own" ON "public"."tasks" FOR DELETE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "tasks_read_own" ON "public"."tasks" FOR SELECT USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "tasks_update_own" ON "public"."tasks" FOR UPDATE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "tasks_write_own" ON "public"."tasks" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "created_by"));



ALTER TABLE "public"."testimonials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "testimonials_delete_admin" ON "public"."testimonials" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "testimonials_insert_admin" ON "public"."testimonials" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "testimonials_select" ON "public"."testimonials" FOR SELECT TO "authenticated", "anon" USING ((("approved" = true) OR "public"."is_admin"()));



CREATE POLICY "testimonials_update_admin" ON "public"."testimonials" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."transfer_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transfer_requests_delete_own" ON "public"."transfer_requests" FOR DELETE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "transfer_requests_insert_own" ON "public"."transfer_requests" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "transfer_requests_update_own" ON "public"."transfer_requests" FOR UPDATE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email"))) WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



ALTER TABLE "public"."user_activity" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_activity_read_all" ON "public"."user_activity" FOR SELECT USING (true);



CREATE POLICY "user_activity_write_own" ON "public"."user_activity" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "created_by"));



ALTER TABLE "public"."user_badges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_badges_delete_admin" ON "public"."user_badges" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "user_badges_insert_admin" ON "public"."user_badges" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "user_badges_read_all" ON "public"."user_badges" FOR SELECT USING (true);



CREATE POLICY "user_badges_update_admin" ON "public"."user_badges" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."user_brand_voice" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_follows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_follows_delete_own" ON "public"."user_follows" FOR DELETE USING ((( SELECT "auth"."email"() AS "email") = "follower_email"));



CREATE POLICY "user_follows_read_own" ON "public"."user_follows" FOR SELECT USING (((( SELECT "auth"."email"() AS "email") = "follower_email") OR (( SELECT "auth"."email"() AS "email") = "following_email")));



CREATE POLICY "user_follows_write_own" ON "public"."user_follows" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "follower_email"));



ALTER TABLE "public"."vet_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vet_records_delete_own" ON "public"."vet_records" FOR DELETE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "vet_records_insert_own" ON "public"."vet_records" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



CREATE POLICY "vet_records_read" ON "public"."vet_records" FOR SELECT TO "authenticated", "anon" USING ((("created_by" = ( SELECT "auth"."email"() AS "email")) OR "public"."is_admin"() OR "public"."gecko_passport_is_public"("animal_id")));



CREATE POLICY "vet_records_update_own" ON "public"."vet_records" FOR UPDATE TO "authenticated" USING (("created_by" = ( SELECT "auth"."email"() AS "email"))) WITH CHECK (("created_by" = ( SELECT "auth"."email"() AS "email")));



ALTER TABLE "public"."weight_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "weight_records_delete_own" ON "public"."weight_records" FOR DELETE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "weight_records_read" ON "public"."weight_records" FOR SELECT USING (((( SELECT "auth"."email"() AS "email") = "created_by") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."email" = ( SELECT "auth"."email"() AS "email")) AND ("p"."role" = 'admin'::"text"))))));



CREATE POLICY "weight_records_update_own" ON "public"."weight_records" FOR UPDATE USING ((( SELECT "auth"."email"() AS "email") = "created_by"));



CREATE POLICY "weight_records_write_own" ON "public"."weight_records" FOR INSERT WITH CHECK ((( SELECT "auth"."email"() AS "email") = "created_by"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "geck_data" TO "anon";
GRANT USAGE ON SCHEMA "geck_data" TO "authenticated";
GRANT USAGE ON SCHEMA "geck_data" TO "service_role";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

































































































































































































































































































































































































































































































































REVOKE ALL ON FUNCTION "geck_data"."_combo_id_from_traits"("traits" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."_combo_id_from_traits"("traits" "text") TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."_looks_like_group_lot"("title" "text", "is_auction" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."_looks_like_group_lot"("title" "text", "is_auction" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."_normalize_trait_csv"("raw" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."_normalize_trait_csv"("raw" "text") TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."_sanitize_cached_traits"("input" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."_sanitize_cached_traits"("input" "text") TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."_sanitize_norm_traits"("input" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."_sanitize_norm_traits"("input" "text") TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."_trait_root"("label" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."_trait_root"("label" "text") TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."_traits_are_redundant"("a" "text", "b" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."_traits_are_redundant"("a" "text", "b" "text") TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."canonical_trait"("p_trait" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."canonical_trait"("p_trait" "text") TO "service_role";



GRANT SELECT ON TABLE "geck_data"."batch_jobs" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."batch_jobs" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."batch_jobs" TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."claim_batch_jobs"("p_limit" integer, "p_worker" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."claim_batch_jobs"("p_limit" integer, "p_worker" "text") TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."clutches_default_hatch"() FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."clutches_default_hatch"() TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."combo_index_health"() FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."combo_index_health"() TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."combo_index_movers"("lookback_days" integer, "min_n" integer, "max_rows" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."combo_index_movers"("lookback_days" integer, "min_n" integer, "max_rows" integer) TO "anon";
GRANT ALL ON FUNCTION "geck_data"."combo_index_movers"("lookback_days" integer, "min_n" integer, "max_rows" integer) TO "authenticated";
GRANT ALL ON FUNCTION "geck_data"."combo_index_movers"("lookback_days" integer, "min_n" integer, "max_rows" integer) TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."combo_match"("p_traits" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."combo_match"("p_traits" "text") TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."combo_maturity_baselines"("fresh_hours" integer, "window_days" integer, "min_fresh" integer, "min_sellers" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."combo_maturity_baselines"("fresh_hours" integer, "window_days" integer, "min_fresh" integer, "min_sellers" integer) TO "anon";
GRANT ALL ON FUNCTION "geck_data"."combo_maturity_baselines"("fresh_hours" integer, "window_days" integer, "min_fresh" integer, "min_sellers" integer) TO "authenticated";
GRANT ALL ON FUNCTION "geck_data"."combo_maturity_baselines"("fresh_hours" integer, "window_days" integer, "min_fresh" integer, "min_sellers" integer) TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."combo_weekly_prices"("p_trait_a" "text", "p_trait_b" "text", "window_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."combo_weekly_prices"("p_trait_a" "text", "p_trait_b" "text", "window_days" integer) TO "anon";
GRANT ALL ON FUNCTION "geck_data"."combo_weekly_prices"("p_trait_a" "text", "p_trait_b" "text", "window_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "geck_data"."combo_weekly_prices"("p_trait_a" "text", "p_trait_b" "text", "window_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."extract_listing_image_urls"("raw" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."extract_listing_image_urls"("raw" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."extract_listing_traits"("raw" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."extract_listing_traits"("raw" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."is_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."is_training_trait"("p_trait" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."is_training_trait"("p_trait" "text") TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."listings_needing_detail_scrape"("stale_after_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."listings_needing_detail_scrape"("stale_after_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."listings_needing_image_download"() FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."listings_needing_image_download"() TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."mark_unseen_listings_inactive"("target_run_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."mark_unseen_listings_inactive"("target_run_id" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."market_coverage"("fresh_hours" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."market_coverage"("fresh_hours" integer) TO "anon";
GRANT ALL ON FUNCTION "geck_data"."market_coverage"("fresh_hours" integer) TO "authenticated";
GRANT ALL ON FUNCTION "geck_data"."market_coverage"("fresh_hours" integer) TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."market_price_summary"("fresh_hours" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."market_price_summary"("fresh_hours" integer) TO "anon";
GRANT ALL ON FUNCTION "geck_data"."market_price_summary"("fresh_hours" integer) TO "authenticated";
GRANT ALL ON FUNCTION "geck_data"."market_price_summary"("fresh_hours" integer) TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."normalize_trait_name"("raw" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."normalize_trait_name"("raw" "text") TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."observation_span"() FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."observation_span"() TO "anon";
GRANT ALL ON FUNCTION "geck_data"."observation_span"() TO "authenticated";
GRANT ALL ON FUNCTION "geck_data"."observation_span"() TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."prune_ingest_audit"("p_keep_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."prune_ingest_audit"("p_keep_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."refresh_combo_index_daily"() FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."refresh_combo_index_daily"() TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."region_of"("p_loc" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."region_of"("p_loc" "text") TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."runtime_config_audit"() FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."runtime_config_audit"() TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."sold_activity_weekly"("p_weeks" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."sold_activity_weekly"("p_weeks" integer) TO "anon";
GRANT ALL ON FUNCTION "geck_data"."sold_activity_weekly"("p_weeks" integer) TO "authenticated";
GRANT ALL ON FUNCTION "geck_data"."sold_activity_weekly"("p_weeks" integer) TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."sold_price_band"("p_traits" "text"[], "p_lookback_days" integer, "p_include_inferred" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."sold_price_band"("p_traits" "text"[], "p_lookback_days" integer, "p_include_inferred" boolean) TO "anon";
GRANT ALL ON FUNCTION "geck_data"."sold_price_band"("p_traits" "text"[], "p_lookback_days" integer, "p_include_inferred" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "geck_data"."sold_price_band"("p_traits" "text"[], "p_lookback_days" integer, "p_include_inferred" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."touch_listing_seen"("p_id" "text", "p_observed" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."touch_listing_seen"("p_id" "text", "p_observed" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."trends_arrivals_weekly"("window_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."trends_arrivals_weekly"("window_days" integer) TO "anon";
GRANT ALL ON FUNCTION "geck_data"."trends_arrivals_weekly"("window_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "geck_data"."trends_arrivals_weekly"("window_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."trends_maturity_mix"("window_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."trends_maturity_mix"("window_days" integer) TO "anon";
GRANT ALL ON FUNCTION "geck_data"."trends_maturity_mix"("window_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "geck_data"."trends_maturity_mix"("window_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."trends_weekly_prices"("window_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."trends_weekly_prices"("window_days" integer) TO "anon";
GRANT ALL ON FUNCTION "geck_data"."trends_weekly_prices"("window_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "geck_data"."trends_weekly_prices"("window_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."v_breeder_concentration"("top_n" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."v_breeder_concentration"("top_n" integer) TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."v_combo_profitability"("p_window_days" integer, "p_min_top_trait_n" integer, "p_min_pair_listings" integer, "p_min_sold_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."v_combo_profitability"("p_window_days" integer, "p_min_top_trait_n" integer, "p_min_pair_listings" integer, "p_min_sold_count" integer) TO "anon";
GRANT ALL ON FUNCTION "geck_data"."v_combo_profitability"("p_window_days" integer, "p_min_top_trait_n" integer, "p_min_pair_listings" integer, "p_min_sold_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "geck_data"."v_combo_profitability"("p_window_days" integer, "p_min_top_trait_n" integer, "p_min_pair_listings" integer, "p_min_sold_count" integer) TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."v_combo_rollups"("window_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."v_combo_rollups"("window_days" integer) TO "anon";
GRANT ALL ON FUNCTION "geck_data"."v_combo_rollups"("window_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "geck_data"."v_combo_rollups"("window_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."v_combo_source_blend"("p_combo" "text", "window_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."v_combo_source_blend"("p_combo" "text", "window_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."v_market_index"("window_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."v_market_index"("window_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."v_market_sub_index"("window_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."v_market_sub_index"("window_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "geck_data"."v_regional_heatmap"("window_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "geck_data"."v_regional_heatmap"("window_days" integer) TO "anon";
GRANT ALL ON FUNCTION "geck_data"."v_regional_heatmap"("window_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "geck_data"."v_regional_heatmap"("window_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."_blog_touch_updated_date"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_blog_touch_updated_date"() TO "service_role";



GRANT ALL ON TABLE "public"."collection_members" TO "anon";
GRANT ALL ON TABLE "public"."collection_members" TO "authenticated";
GRANT ALL ON TABLE "public"."collection_members" TO "service_role";



REVOKE ALL ON FUNCTION "public"."accept_collection_invite"("token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_collection_invite"("token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_collection_invite"("token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_tasks_touch_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_tasks_touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_verify_gecko_image"("p_image_id" "text", "p_primary_morph" "text", "p_secondary_traits" "text"[], "p_genetic_traits" "text"[], "p_base_color" "text", "p_pattern_intensity" "text", "p_white_amount" "text", "p_fired_state" "text", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_verify_gecko_image"("p_image_id" "text", "p_primary_morph" "text", "p_secondary_traits" "text"[], "p_genetic_traits" "text"[], "p_base_color" "text", "p_pattern_intensity" "text", "p_white_amount" "text", "p_fired_state" "text", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."app_settings_touch_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."app_settings_touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_referral_code"("p_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_referral_code"("p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_referral_code"("p_code" "text") TO "service_role";



GRANT ALL ON TABLE "public"."referral_rewards" TO "authenticated";
GRANT ALL ON TABLE "public"."referral_rewards" TO "service_role";



REVOKE ALL ON FUNCTION "public"."award_referral_reward"("p_referred_email" "text", "p_referred_tier" "text", "p_stripe_invoice_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."award_referral_reward"("p_referred_email" "text", "p_referred_tier" "text", "p_stripe_invoice_id" "text") TO "service_role";



GRANT ALL ON TABLE "public"."social_referral_bonuses" TO "anon";
GRANT ALL ON TABLE "public"."social_referral_bonuses" TO "authenticated";
GRANT ALL ON TABLE "public"."social_referral_bonuses" TO "service_role";



REVOKE ALL ON FUNCTION "public"."award_referral_signup_bonus"("p_referred_user_id" "uuid", "p_referred_email" "text", "p_referred_tier" "text", "p_stripe_invoice_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."award_referral_signup_bonus"("p_referred_user_id" "uuid", "p_referred_email" "text", "p_referred_tier" "text", "p_stripe_invoice_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."bump_collection_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bump_collection_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."bump_gecko_change_ts_for"("p_gecko_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bump_gecko_change_ts_for"("p_gecko_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."bump_gecko_change_ts_self"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bump_gecko_change_ts_self"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cgd_reorder_reminder_run"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cgd_reorder_reminder_run"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."charge_social_publish"("p_user_id" "uuid", "p_tier" "text", "p_posts_included" integer, "p_overage_cents_per_post" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."charge_social_publish"("p_user_id" "uuid", "p_tier" "text", "p_posts_included" integer, "p_overage_cents_per_post" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_transfer"("p_token" "text", "p_contribute" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_transfer"("p_token" "text", "p_contribute" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_transfer"("p_token" "text", "p_contribute" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_transfer_requests_on_animal_delete"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_transfer_requests_on_animal_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."community_feed"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."community_feed"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."community_feed"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."community_gecko_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."community_gecko_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."community_gecko_counts"() TO "service_role";



GRANT ALL ON TABLE "public"."feature_usage" TO "anon";
GRANT ALL ON TABLE "public"."feature_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_usage" TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_feature_credit"("p_feature" "text", "p_tier" "text", "p_included" integer, "p_cost" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_feature_credit"("p_feature" "text", "p_tier" "text", "p_included" integer, "p_cost" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_feature_credit"("p_feature" "text", "p_tier" "text", "p_included" integer, "p_cost" integer) TO "service_role";



GRANT ALL ON TABLE "public"."morph_id_usage" TO "anon";
GRANT ALL ON TABLE "public"."morph_id_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."morph_id_usage" TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_morph_id_credit"("p_user_id" "uuid", "p_tier" "text", "p_credits_included" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_morph_id_credit"("p_user_id" "uuid", "p_tier" "text", "p_credits_included" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."effective_tier_for_current_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."effective_tier_for_current_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."effective_tier_for_current_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_hatch_alerts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_hatch_alerts"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_weighin_reminders"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_weighin_reminders"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."estimate_food_runout"("p_user_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."estimate_food_runout"("p_user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."estimate_food_runout"("p_user_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."estimate_food_runout_unscoped"("p_user_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."estimate_food_runout_unscoped"("p_user_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."expire_referral_grants"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expire_referral_grants"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gecko_image_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."gecko_image_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gecko_image_stats"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."gecko_passport_is_public"("p_animal_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."gecko_passport_is_public"("p_animal_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."gecko_passport_is_public"("p_animal_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gecko_passport_is_public"("p_animal_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."geckos_set_default_collection"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."geckos_set_default_collection"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_referral_code"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_referral_code"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_transfer_preview"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_transfer_preview"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_transfer_preview"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_transfer_preview"("p_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_storage_bytes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_storage_bytes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_storage_bytes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_notification_insert"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_notification_insert"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_auth_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_social_usage_spend"("p_user_id" "uuid", "p_month_key" "text", "p_cents" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_social_usage_spend"("p_user_id" "uuid", "p_month_key" "text", "p_cents" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_blog_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_blog_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_blog_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_collection_editor"("p_collection_id" "uuid", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_collection_editor"("p_collection_id" "uuid", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_collection_editor"("p_collection_id" "uuid", "p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_collection_member"("p_collection_id" "uuid", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_collection_member"("p_collection_id" "uuid", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_collection_member"("p_collection_id" "uuid", "p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_collection_owner"("p_collection_id" "uuid", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_collection_owner"("p_collection_id" "uuid", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_collection_owner"("p_collection_id" "uuid", "p_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_expert_reviewer"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_expert_reviewer"() TO "service_role";
GRANT ALL ON FUNCTION "public"."is_expert_reviewer"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_expert_reviewer"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."landing_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."landing_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."landing_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."landing_stats"() TO "service_role";



GRANT SELECT ON TABLE "geck_data"."listing_images" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."listing_images" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."listing_images" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."market_listings" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."market_listings" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."market_listings" TO "service_role";



GRANT ALL ON TABLE "public"."listing_images" TO "service_role";
GRANT SELECT ON TABLE "public"."listing_images" TO "anon";
GRANT SELECT ON TABLE "public"."listing_images" TO "authenticated";



GRANT ALL ON TABLE "public"."market_listings" TO "service_role";
GRANT SELECT ON TABLE "public"."market_listings" TO "anon";
GRANT SELECT ON TABLE "public"."market_listings" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."listing_images"("public"."market_listings") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."listing_images"("public"."market_listings") TO "anon";
GRANT ALL ON FUNCTION "public"."listing_images"("public"."market_listings") TO "authenticated";
GRANT ALL ON FUNCTION "public"."listing_images"("public"."market_listings") TO "service_role";



GRANT ALL ON FUNCTION "public"."month_key_now"() TO "anon";
GRANT ALL ON FUNCTION "public"."month_key_now"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."month_key_now"() TO "service_role";









REVOKE ALL ON FUNCTION "public"."next_unvoted_id_candidates"("reviewer" "text", "lim" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."next_unvoted_id_candidates"("reviewer" "text", "lim" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."next_unvoted_id_candidates"("reviewer" "text", "lim" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_dispatch_on_insert"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_dispatch_on_insert"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."process_scheduled_blog_posts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."process_scheduled_blog_posts"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."protect_profile_privileged_columns"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."protect_profile_privileged_columns"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."protect_profile_referral_columns"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."protect_profile_referral_columns"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prune_stale_push_subscriptions"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prune_stale_push_subscriptions"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."publish_due_scheduled_posts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."publish_due_scheduled_posts"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."redeem_signup_grant"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."redeem_signup_grant"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redeem_signup_grant"("p_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."refund_morph_id_credit"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refund_morph_id_credit"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."review_gecko_image"("p_image_id" "text", "p_verdict" "text", "p_primary_morph" "text", "p_secondary_traits" "text"[], "p_edits" "jsonb", "p_notes" "text", "p_genetic_traits" "text"[], "p_base_color" "text", "p_pattern_intensity" "text", "p_white_amount" "text", "p_fired_state" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."review_gecko_image"("p_image_id" "text", "p_verdict" "text", "p_primary_morph" "text", "p_secondary_traits" "text"[], "p_edits" "jsonb", "p_notes" "text", "p_genetic_traits" "text"[], "p_base_color" "text", "p_pattern_intensity" "text", "p_white_amount" "text", "p_fired_state" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."review_gecko_image"("p_image_id" "text", "p_verdict" "text", "p_primary_morph" "text", "p_secondary_traits" "text"[], "p_edits" "jsonb", "p_notes" "text", "p_genetic_traits" "text"[], "p_base_color" "text", "p_pattern_intensity" "text", "p_white_amount" "text", "p_fired_state" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_default_referral_code"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_default_referral_code"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_testimonials_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_testimonials_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."similar_gecko_images_by_url"("p_image_url" "text", "match_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."similar_gecko_images_by_url"("p_image_url" "text", "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."similar_gecko_images_by_url"("p_image_url" "text", "match_count" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."store_products_update_search_vector"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."store_products_update_search_vector"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."throttle_error_logs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."throttle_error_logs"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_bump_gecko_from_image"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_bump_gecko_from_image"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trg_bump_gecko_from_weight"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trg_bump_gecko_from_weight"() TO "service_role";



GRANT ALL ON TABLE "public"."social_post_usage" TO "anon";
GRANT ALL ON TABLE "public"."social_post_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."social_post_usage" TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_social_usage"("p_user_id" "uuid", "p_tier" "text", "p_posts_included" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_social_usage"("p_user_id" "uuid", "p_tier" "text", "p_posts_included" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."verify_notification_dispatch_secret"("p_secret" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_notification_dispatch_secret"("p_secret" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."welcome_shelf"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."welcome_shelf"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."welcome_shelf"("p_limit" integer) TO "service_role";




































GRANT SELECT ON TABLE "geck_data"."_backup_0028_trait_rows" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."_backup_0028_trait_rows" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."_backup_0028_trait_rows" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."alert_delivery_attempts" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."alert_delivery_attempts" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."alert_delivery_attempts" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "geck_data"."alert_delivery_attempts_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "geck_data"."alert_delivery_attempts_id_seq" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."alert_matches" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."alert_matches" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."alert_matches" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."alerts" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."alerts" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."alerts" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."anthropic_billing_daily" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."anthropic_billing_daily" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."anthropic_billing_daily" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."auction_results" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."auction_results" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."auction_results" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."auction_state" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."auction_state" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."auction_state" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "geck_data"."auction_state_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "geck_data"."auction_state_id_seq" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "geck_data"."batch_jobs_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "geck_data"."batch_jobs_id_seq" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."breeding_pairs" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."breeding_pairs" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."breeding_pairs" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."clutches" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."clutches" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."clutches" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."combo_catalog" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."combo_catalog" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."combo_catalog" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."price_history" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."price_history" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."price_history" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."combo_index_daily" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."combo_index_daily" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."combo_index_daily" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."crested_morph_taxonomy" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."crested_morph_taxonomy" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."crested_morph_taxonomy" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."cross_platform_listing_images" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."cross_platform_listing_images" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."cross_platform_listing_images" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."cross_platform_listings" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."cross_platform_listings" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."cross_platform_listings" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."error_logs" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."error_logs" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."error_logs" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."external_reference_images" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."external_reference_images" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."external_reference_images" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."hatchlings" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."hatchlings" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."hatchlings" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."ingest_audit" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."ingest_audit" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."ingest_audit" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."ingest_events" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."ingest_events" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."ingest_events" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "geck_data"."ingest_events_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "geck_data"."ingest_events_id_seq" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."listing_favorites" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."listing_favorites" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."listing_favorites" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "geck_data"."listing_favorites_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "geck_data"."listing_favorites_id_seq" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."listing_image_phash_pairs" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."listing_image_phash_pairs" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."listing_image_phash_pairs" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "geck_data"."listing_image_phash_pairs_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "geck_data"."listing_image_phash_pairs_id_seq" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."listing_lineage" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."listing_lineage" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."listing_lineage" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."listing_status_events" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."listing_status_events" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."listing_status_events" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."listing_views" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."listing_views" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."listing_views" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "geck_data"."listing_views_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "geck_data"."listing_views_id_seq" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."listings" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."listings" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."listings" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."listings_history" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."listings_history" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."listings_history" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "geck_data"."listings_history_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "geck_data"."listings_history_id_seq" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."market_auctions" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."market_auctions" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."market_auctions" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."market_galleries" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."market_galleries" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."market_galleries" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."market_lineage" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."market_lineage" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."market_lineage" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."market_raw_captures" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."market_raw_captures" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."market_raw_captures" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "geck_data"."market_raw_captures_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "geck_data"."market_raw_captures_id_seq" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."market_sellers" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."market_sellers" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."market_sellers" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."model_invocations" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."model_invocations" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."model_invocations" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "geck_data"."model_invocations_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "geck_data"."model_invocations_id_seq" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."morph_eval_runs" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."morph_eval_runs" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."morph_eval_runs" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "geck_data"."morph_eval_runs_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "geck_data"."morph_eval_runs_id_seq" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."morph_human_labels" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."morph_human_labels" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."morph_human_labels" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "geck_data"."morph_human_labels_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "geck_data"."morph_human_labels_id_seq" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."morph_taxonomy" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."morph_taxonomy" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."morph_taxonomy" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."morph_taxonomy_synonyms" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."morph_taxonomy_synonyms" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."morph_taxonomy_synonyms" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "geck_data"."morph_taxonomy_synonyms_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "geck_data"."morph_taxonomy_synonyms_id_seq" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."morphs" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."morphs" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."morphs" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "geck_data"."morphs_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "geck_data"."morphs_id_seq" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."price_adjustment_factors" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."price_adjustment_factors" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."price_adjustment_factors" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "geck_data"."price_adjustment_factors_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "geck_data"."price_adjustment_factors_id_seq" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."price_drops" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."price_drops" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."price_drops" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."price_history_dupes_archive" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."price_history_dupes_archive" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."price_history_dupes_archive" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."profiles" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."profiles" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."profiles" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."runtime_config" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."runtime_config" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."runtime_config" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."runtime_config_history" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."runtime_config_history" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."runtime_config_history" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "geck_data"."runtime_config_history_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "geck_data"."runtime_config_history_id_seq" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."scrape_runs" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."scrape_runs" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."scrape_runs" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "geck_data"."scrape_runs_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "geck_data"."scrape_runs_id_seq" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."seller_snapshots" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."seller_snapshots" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."seller_snapshots" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."sellers" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."sellers" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."sellers" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."sellers_needing_scrape" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."sellers_needing_scrape" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."sellers_needing_scrape" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."show_mentions" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."show_mentions" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."show_mentions" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."sold_listings_v" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."sold_listings_v" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."sold_listings_v" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."trait_relations" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."trait_relations" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."trait_relations" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."trait_tiers" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."trait_tiers" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."trait_tiers" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."user_events" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."user_events" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."user_events" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."user_notification_channels" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."user_notification_channels" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."user_notification_channels" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_combo_breadth" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_combo_breadth" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_combo_breadth" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_combo_index_summary" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_combo_index_summary" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_combo_index_summary" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_combo_price_distribution" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_combo_price_distribution" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_combo_price_distribution" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_cross_platform_arbitrage_pairs" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_cross_platform_arbitrage_pairs" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_cross_platform_arbitrage_pairs" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_daily_activity" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_daily_activity" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_daily_activity" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_demand_index" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_demand_index" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_demand_index" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_ingest_daily" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_ingest_daily" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_ingest_daily" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_ingest_health_24h" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_ingest_health_24h" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_ingest_health_24h" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_listing_labels" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_listing_labels" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_listing_labels" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_listing_week_price" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_listing_week_price" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_listing_week_price" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_market_sub_index_weekly" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_market_sub_index_weekly" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_market_sub_index_weekly" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_market_temperature" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_market_temperature" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_market_temperature" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_model_spend_7d" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_model_spend_7d" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_model_spend_7d" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_morph_training" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_morph_training" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_morph_training" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_morph_training_canonical" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_morph_training_canonical" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_morph_training_canonical" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_morph_training_stats" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_morph_training_stats" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_morph_training_stats" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_observed_combos" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_observed_combos" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_observed_combos" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_observed_traits" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_observed_traits" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_observed_traits" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_recent_combo_sales" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_recent_combo_sales" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_recent_combo_sales" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_seller_reputation" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_seller_reputation" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_seller_reputation" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_sold_reconciled" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_sold_reconciled" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_sold_reconciled" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_supply_pipeline_monthly" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_supply_pipeline_monthly" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_supply_pipeline_monthly" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_training_pairs" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_training_pairs" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_training_pairs" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_trait_frequencies" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_trait_frequencies" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_trait_frequencies" TO "service_role";



GRANT SELECT ON TABLE "geck_data"."v_trait_recognition_metrics" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_trait_recognition_metrics" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "geck_data"."v_trait_recognition_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."admin_tasks" TO "anon";
GRANT ALL ON TABLE "public"."admin_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."answers" TO "anon";
GRANT ALL ON TABLE "public"."answers" TO "authenticated";
GRANT ALL ON TABLE "public"."answers" TO "service_role";



GRANT ALL ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."app_settings" TO "service_role";



GRANT ALL ON TABLE "public"."blog_categories" TO "anon";
GRANT ALL ON TABLE "public"."blog_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_categories" TO "service_role";



GRANT ALL ON TABLE "public"."blog_logs" TO "anon";
GRANT ALL ON TABLE "public"."blog_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_logs" TO "service_role";



GRANT ALL ON TABLE "public"."blog_posts" TO "anon";
GRANT ALL ON TABLE "public"."blog_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_posts" TO "service_role";



GRANT ALL ON TABLE "public"."blog_settings" TO "anon";
GRANT ALL ON TABLE "public"."blog_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_settings" TO "service_role";



GRANT ALL ON TABLE "public"."blog_tags" TO "anon";
GRANT ALL ON TABLE "public"."blog_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_tags" TO "service_role";



GRANT ALL ON TABLE "public"."breeder_inquiries" TO "anon";
GRANT ALL ON TABLE "public"."breeder_inquiries" TO "authenticated";
GRANT ALL ON TABLE "public"."breeder_inquiries" TO "service_role";



GRANT ALL ON TABLE "public"."breeder_profiles" TO "anon";
GRANT ALL ON TABLE "public"."breeder_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."breeder_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."breeder_reviews" TO "anon";
GRANT ALL ON TABLE "public"."breeder_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."breeder_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."breeder_store_pages" TO "anon";
GRANT ALL ON TABLE "public"."breeder_store_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."breeder_store_pages" TO "service_role";



GRANT ALL ON TABLE "public"."breeding_loans" TO "anon";
GRANT ALL ON TABLE "public"."breeding_loans" TO "authenticated";
GRANT ALL ON TABLE "public"."breeding_loans" TO "service_role";



GRANT ALL ON TABLE "public"."breeding_plans" TO "anon";
GRANT ALL ON TABLE "public"."breeding_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."breeding_plans" TO "service_role";



GRANT ALL ON TABLE "public"."breeding_projects" TO "anon";
GRANT ALL ON TABLE "public"."breeding_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."breeding_projects" TO "service_role";



GRANT ALL ON TABLE "public"."care_guide_sections" TO "anon";
GRANT ALL ON TABLE "public"."care_guide_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."care_guide_sections" TO "service_role";



GRANT ALL ON TABLE "public"."change_logs" TO "anon";
GRANT ALL ON TABLE "public"."change_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."change_logs" TO "service_role";



GRANT ALL ON TABLE "public"."classification_votes" TO "anon";
GRANT ALL ON TABLE "public"."classification_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."classification_votes" TO "service_role";



GRANT ALL ON TABLE "public"."clutches" TO "anon";
GRANT ALL ON TABLE "public"."clutches" TO "authenticated";
GRANT ALL ON TABLE "public"."clutches" TO "service_role";



GRANT ALL ON TABLE "public"."collection_valuations" TO "anon";
GRANT ALL ON TABLE "public"."collection_valuations" TO "authenticated";
GRANT ALL ON TABLE "public"."collection_valuations" TO "service_role";



GRANT ALL ON TABLE "public"."collections" TO "anon";
GRANT ALL ON TABLE "public"."collections" TO "authenticated";
GRANT ALL ON TABLE "public"."collections" TO "service_role";



GRANT ALL ON TABLE "public"."community_event_reactions" TO "anon";
GRANT ALL ON TABLE "public"."community_event_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."community_event_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."direct_messages" TO "anon";
GRANT ALL ON TABLE "public"."direct_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."direct_messages" TO "service_role";



GRANT ALL ON TABLE "public"."eggs" TO "anon";
GRANT ALL ON TABLE "public"."eggs" TO "authenticated";
GRANT ALL ON TABLE "public"."eggs" TO "service_role";



GRANT ALL ON TABLE "public"."error_logs" TO "anon";
GRANT ALL ON TABLE "public"."error_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."error_logs" TO "service_role";



GRANT ALL ON TABLE "public"."expert_actions" TO "anon";
GRANT ALL ON TABLE "public"."expert_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."expert_actions" TO "service_role";



GRANT ALL ON TABLE "public"."expert_verification_requests" TO "anon";
GRANT ALL ON TABLE "public"."expert_verification_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."expert_verification_requests" TO "service_role";



GRANT ALL ON TABLE "public"."external_reference_images" TO "service_role";
GRANT SELECT ON TABLE "public"."external_reference_images" TO "anon";
GRANT SELECT ON TABLE "public"."external_reference_images" TO "authenticated";



GRANT ALL ON TABLE "public"."feature_credit_allotments" TO "anon";
GRANT ALL ON TABLE "public"."feature_credit_allotments" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_credit_allotments" TO "service_role";



GRANT ALL ON TABLE "public"."feeding_groups" TO "anon";
GRANT ALL ON TABLE "public"."feeding_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."feeding_groups" TO "service_role";



GRANT ALL ON TABLE "public"."feeding_records" TO "anon";
GRANT ALL ON TABLE "public"."feeding_records" TO "authenticated";
GRANT ALL ON TABLE "public"."feeding_records" TO "service_role";



GRANT ALL ON TABLE "public"."forum_categories" TO "anon";
GRANT ALL ON TABLE "public"."forum_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."forum_categories" TO "service_role";



GRANT ALL ON TABLE "public"."forum_comments" TO "anon";
GRANT ALL ON TABLE "public"."forum_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."forum_comments" TO "service_role";



GRANT ALL ON TABLE "public"."forum_likes" TO "anon";
GRANT ALL ON TABLE "public"."forum_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."forum_likes" TO "service_role";



GRANT ALL ON TABLE "public"."forum_posts" TO "anon";
GRANT ALL ON TABLE "public"."forum_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."forum_posts" TO "service_role";



GRANT ALL ON TABLE "public"."future_breeding_plans" TO "anon";
GRANT ALL ON TABLE "public"."future_breeding_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."future_breeding_plans" TO "service_role";



GRANT ALL ON TABLE "public"."gecko_events" TO "anon";
GRANT ALL ON TABLE "public"."gecko_events" TO "authenticated";
GRANT ALL ON TABLE "public"."gecko_events" TO "service_role";



GRANT ALL ON TABLE "public"."gecko_images" TO "anon";
GRANT ALL ON TABLE "public"."gecko_images" TO "authenticated";
GRANT ALL ON TABLE "public"."gecko_images" TO "service_role";



GRANT ALL ON TABLE "public"."gecko_likes" TO "anon";
GRANT ALL ON TABLE "public"."gecko_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."gecko_likes" TO "service_role";



GRANT ALL ON TABLE "public"."gecko_of_the_day" TO "anon";
GRANT ALL ON TABLE "public"."gecko_of_the_day" TO "authenticated";
GRANT ALL ON TABLE "public"."gecko_of_the_day" TO "service_role";



GRANT ALL ON TABLE "public"."gecko_waitlist_signups" TO "anon";
GRANT ALL ON TABLE "public"."gecko_waitlist_signups" TO "authenticated";
GRANT ALL ON TABLE "public"."gecko_waitlist_signups" TO "service_role";



GRANT ALL ON TABLE "public"."gecko_waitlists" TO "anon";
GRANT ALL ON TABLE "public"."gecko_waitlists" TO "authenticated";
GRANT ALL ON TABLE "public"."gecko_waitlists" TO "service_role";



GRANT ALL ON TABLE "public"."geckos" TO "anon";
GRANT ALL ON TABLE "public"."geckos" TO "authenticated";
GRANT ALL ON TABLE "public"."geckos" TO "service_role";



GRANT ALL ON TABLE "public"."genetic_outcome_predictions" TO "anon";
GRANT ALL ON TABLE "public"."genetic_outcome_predictions" TO "authenticated";
GRANT ALL ON TABLE "public"."genetic_outcome_predictions" TO "service_role";



GRANT ALL ON TABLE "public"."genetics_trait_overrides" TO "anon";
GRANT ALL ON TABLE "public"."genetics_trait_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."genetics_trait_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."giveaway_entries" TO "anon";
GRANT ALL ON TABLE "public"."giveaway_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."giveaway_entries" TO "service_role";



GRANT ALL ON TABLE "public"."giveaways" TO "anon";
GRANT ALL ON TABLE "public"."giveaways" TO "authenticated";
GRANT ALL ON TABLE "public"."giveaways" TO "service_role";



GRANT ALL ON TABLE "public"."iot_connections" TO "anon";
GRANT ALL ON TABLE "public"."iot_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."iot_connections" TO "service_role";



GRANT ALL ON TABLE "public"."lineage_placeholders" TO "anon";
GRANT ALL ON TABLE "public"."lineage_placeholders" TO "authenticated";
GRANT ALL ON TABLE "public"."lineage_placeholders" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_costs" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_costs" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_costs" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_likes" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_likes" TO "service_role";



GRANT ALL ON TABLE "public"."mentor_offers" TO "anon";
GRANT ALL ON TABLE "public"."mentor_offers" TO "authenticated";
GRANT ALL ON TABLE "public"."mentor_offers" TO "service_role";



GRANT ALL ON TABLE "public"."morph_guide_comments" TO "anon";
GRANT ALL ON TABLE "public"."morph_guide_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."morph_guide_comments" TO "service_role";



GRANT ALL ON TABLE "public"."morph_guides" TO "anon";
GRANT ALL ON TABLE "public"."morph_guides" TO "authenticated";
GRANT ALL ON TABLE "public"."morph_guides" TO "service_role";



GRANT ALL ON TABLE "public"."morph_price_cache" TO "anon";
GRANT ALL ON TABLE "public"."morph_price_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."morph_price_cache" TO "service_role";



GRANT ALL ON TABLE "public"."morph_price_entries" TO "anon";
GRANT ALL ON TABLE "public"."morph_price_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."morph_price_entries" TO "service_role";



GRANT ALL ON TABLE "public"."morph_reference_images" TO "anon";
GRANT ALL ON TABLE "public"."morph_reference_images" TO "authenticated";
GRANT ALL ON TABLE "public"."morph_reference_images" TO "service_role";



GRANT ALL ON TABLE "public"."morph_taxonomy" TO "service_role";
GRANT SELECT ON TABLE "public"."morph_taxonomy" TO "anon";
GRANT SELECT ON TABLE "public"."morph_taxonomy" TO "authenticated";



GRANT ALL ON TABLE "public"."morph_traits" TO "anon";
GRANT ALL ON TABLE "public"."morph_traits" TO "authenticated";
GRANT ALL ON TABLE "public"."morph_traits" TO "service_role";



GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "anon";
GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_subscribers" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."other_reptiles" TO "anon";
GRANT ALL ON TABLE "public"."other_reptiles" TO "authenticated";
GRANT ALL ON TABLE "public"."other_reptiles" TO "service_role";



GRANT ALL ON TABLE "public"."ownership_records" TO "anon";
GRANT ALL ON TABLE "public"."ownership_records" TO "authenticated";
GRANT ALL ON TABLE "public"."ownership_records" TO "service_role";



GRANT ALL ON TABLE "public"."page_config" TO "anon";
GRANT ALL ON TABLE "public"."page_config" TO "authenticated";
GRANT ALL ON TABLE "public"."page_config" TO "service_role";



GRANT ALL ON TABLE "public"."pairing_outcome_logs" TO "anon";
GRANT ALL ON TABLE "public"."pairing_outcome_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."pairing_outcome_logs" TO "service_role";



GRANT ALL ON TABLE "public"."payment_events" TO "anon";
GRANT ALL ON TABLE "public"."payment_events" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_events" TO "service_role";



GRANT ALL ON TABLE "public"."pending_sales" TO "anon";
GRANT ALL ON TABLE "public"."pending_sales" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_sales" TO "service_role";



GRANT ALL ON TABLE "public"."price_alerts" TO "anon";
GRANT ALL ON TABLE "public"."price_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."price_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."promote_images" TO "anon";
GRANT ALL ON TABLE "public"."promote_images" TO "authenticated";
GRANT ALL ON TABLE "public"."promote_images" TO "service_role";



GRANT ALL ON TABLE "public"."promote_image_usage" TO "anon";
GRANT ALL ON TABLE "public"."promote_image_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."promote_image_usage" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."question_votes" TO "anon";
GRANT ALL ON TABLE "public"."question_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."question_votes" TO "service_role";



GRANT ALL ON TABLE "public"."questions" TO "anon";
GRANT ALL ON TABLE "public"."questions" TO "authenticated";
GRANT ALL ON TABLE "public"."questions" TO "service_role";



GRANT ALL ON TABLE "public"."reptile_events" TO "anon";
GRANT ALL ON TABLE "public"."reptile_events" TO "authenticated";
GRANT ALL ON TABLE "public"."reptile_events" TO "service_role";



GRANT ALL ON TABLE "public"."revenuecat_entitlements" TO "anon";
GRANT ALL ON TABLE "public"."revenuecat_entitlements" TO "authenticated";
GRANT ALL ON TABLE "public"."revenuecat_entitlements" TO "service_role";



GRANT ALL ON TABLE "public"."revenuecat_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."revenuecat_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."revenuecat_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."scraped_training_data" TO "anon";
GRANT ALL ON TABLE "public"."scraped_training_data" TO "authenticated";
GRANT ALL ON TABLE "public"."scraped_training_data" TO "service_role";



GRANT ALL ON TABLE "public"."shed_records" TO "anon";
GRANT ALL ON TABLE "public"."shed_records" TO "authenticated";
GRANT ALL ON TABLE "public"."shed_records" TO "service_role";



GRANT ALL ON TABLE "public"."shipping_orders" TO "anon";
GRANT ALL ON TABLE "public"."shipping_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."shipping_orders" TO "service_role";



GRANT ALL ON TABLE "public"."social_generation_log" TO "anon";
GRANT ALL ON TABLE "public"."social_generation_log" TO "authenticated";
GRANT ALL ON TABLE "public"."social_generation_log" TO "service_role";



GRANT ALL ON TABLE "public"."social_platform_connections" TO "anon";
GRANT ALL ON TABLE "public"."social_platform_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."social_platform_connections" TO "service_role";



GRANT ALL ON TABLE "public"."social_post_photo_usage" TO "anon";
GRANT ALL ON TABLE "public"."social_post_photo_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."social_post_photo_usage" TO "service_role";



GRANT ALL ON TABLE "public"."social_post_variants" TO "anon";
GRANT ALL ON TABLE "public"."social_post_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."social_post_variants" TO "service_role";



GRANT ALL ON TABLE "public"."social_posts" TO "anon";
GRANT ALL ON TABLE "public"."social_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."social_posts" TO "service_role";



GRANT ALL ON TABLE "public"."store_affiliate_clicks" TO "anon";
GRANT ALL ON TABLE "public"."store_affiliate_clicks" TO "authenticated";
GRANT ALL ON TABLE "public"."store_affiliate_clicks" TO "service_role";



GRANT ALL ON TABLE "public"."store_cart_items" TO "anon";
GRANT ALL ON TABLE "public"."store_cart_items" TO "authenticated";
GRANT ALL ON TABLE "public"."store_cart_items" TO "service_role";



GRANT ALL ON TABLE "public"."store_carts" TO "anon";
GRANT ALL ON TABLE "public"."store_carts" TO "authenticated";
GRANT ALL ON TABLE "public"."store_carts" TO "service_role";



GRANT ALL ON TABLE "public"."store_categories" TO "anon";
GRANT ALL ON TABLE "public"."store_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."store_categories" TO "service_role";



GRANT ALL ON TABLE "public"."store_fulfillments" TO "anon";
GRANT ALL ON TABLE "public"."store_fulfillments" TO "authenticated";
GRANT ALL ON TABLE "public"."store_fulfillments" TO "service_role";



GRANT ALL ON TABLE "public"."store_order_items" TO "anon";
GRANT ALL ON TABLE "public"."store_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."store_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."store_orders" TO "anon";
GRANT ALL ON TABLE "public"."store_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."store_orders" TO "service_role";



GRANT ALL ON TABLE "public"."store_products" TO "anon";
GRANT ALL ON TABLE "public"."store_products" TO "authenticated";
GRANT ALL ON TABLE "public"."store_products" TO "service_role";



GRANT ALL ON TABLE "public"."store_promo_codes" TO "anon";
GRANT ALL ON TABLE "public"."store_promo_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."store_promo_codes" TO "service_role";



GRANT ALL ON TABLE "public"."store_signup_grants" TO "anon";
GRANT ALL ON TABLE "public"."store_signup_grants" TO "authenticated";
GRANT ALL ON TABLE "public"."store_signup_grants" TO "service_role";



GRANT ALL ON TABLE "public"."store_vendors" TO "anon";
GRANT ALL ON TABLE "public"."store_vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."store_vendors" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_webhook_logs" TO "anon";
GRANT ALL ON TABLE "public"."stripe_webhook_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_webhook_logs" TO "service_role";



GRANT ALL ON TABLE "public"."support_messages" TO "anon";
GRANT ALL ON TABLE "public"."support_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."support_messages" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."testimonials" TO "anon";
GRANT ALL ON TABLE "public"."testimonials" TO "authenticated";
GRANT ALL ON TABLE "public"."testimonials" TO "service_role";



GRANT ALL ON TABLE "public"."transfer_requests" TO "anon";
GRANT ALL ON TABLE "public"."transfer_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."transfer_requests" TO "service_role";



GRANT ALL ON TABLE "public"."user_activity" TO "anon";
GRANT ALL ON TABLE "public"."user_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."user_activity" TO "service_role";



GRANT ALL ON TABLE "public"."user_badges" TO "anon";
GRANT ALL ON TABLE "public"."user_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."user_badges" TO "service_role";



GRANT ALL ON TABLE "public"."user_brand_voice" TO "anon";
GRANT ALL ON TABLE "public"."user_brand_voice" TO "authenticated";
GRANT ALL ON TABLE "public"."user_brand_voice" TO "service_role";



GRANT ALL ON TABLE "public"."user_events" TO "anon";
GRANT ALL ON TABLE "public"."user_events" TO "authenticated";
GRANT ALL ON TABLE "public"."user_events" TO "service_role";



GRANT ALL ON TABLE "public"."user_follows" TO "anon";
GRANT ALL ON TABLE "public"."user_follows" TO "authenticated";
GRANT ALL ON TABLE "public"."user_follows" TO "service_role";



GRANT ALL ON TABLE "public"."v_daily_activity" TO "anon";
GRANT ALL ON TABLE "public"."v_daily_activity" TO "authenticated";
GRANT ALL ON TABLE "public"."v_daily_activity" TO "service_role";



GRANT ALL ON TABLE "public"."vet_records" TO "anon";
GRANT ALL ON TABLE "public"."vet_records" TO "authenticated";
GRANT ALL ON TABLE "public"."vet_records" TO "service_role";



GRANT ALL ON TABLE "public"."weight_records" TO "anon";
GRANT ALL ON TABLE "public"."weight_records" TO "authenticated";
GRANT ALL ON TABLE "public"."weight_records" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

-- End of production schema baseline.
