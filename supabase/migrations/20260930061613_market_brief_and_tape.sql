-- The daily market brief and the live market tape (30 Sep 2026).
--
-- Brief: geck_data.market_brief_for(email, uid) assembles one member's
-- brief from geck_data.market_daily, the listings and the member's own
-- data: what the latest check found (new listings, cuts, came down, and a
-- word for the day against a typical day), the member's morphs, rare
-- morphs just listed, the market value of the member's crested geckos,
-- watchlist matches, and one fact worth knowing. public.market_brief()
-- returns it to the signed-in member for the Market page.
--
-- public.enqueue_market_briefs() sends it as a 'market_brief' notification
-- to members who switched it on (profiles.market_brief_enabled). It runs
-- hourly from 13:35 to 20:35 UTC and sends at most one a day, only after
-- MorphMarket was checked that day, and only when the brief has something
-- for that member. A quiet day sends nothing.
--
-- Tape: public.market_tape() lists market events newest first (new
-- MorphMarket listings, price cuts, and new listings in Korea, Japan and
-- Europe), with each listing's price position among similar geckos. A
-- catch-up after an outage (a source's first check after a gap) is left
-- out, so the tape never shows weeks of listings as if they were new.

-- Morphs named for their color alone are common and not news on their own.
create or replace function geck_data._is_color_only(p_trait text)
returns boolean
language sql
immutable
set search_path to ''
as $$
  select lower(coalesce(p_trait, '')) in (
    'cream', 'red', 'yellow', 'orange', 'olive', 'dark', 'lavender', 'tangerine',
    'buckskin', 'red base', 'dark base', 'yellow base', 'drippy', 'portholes'
  );
$$;

create or replace function geck_data.market_brief_for(p_email text, p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_email text := lower(coalesce(p_email, ''));
  v_us geck_data.market_daily%rowtype;
  v_full geck_data.market_daily%rowtype;
  v_typ_new numeric;
  v_typ_cuts numeric;
  v_typ_down numeric;
  v_word text;
  v_d0 timestamptz;
  v_d1 timestamptz;
  v_mine text[];
  v_us_json jsonb;
  v_intl jsonb;
  v_morphs jsonb;
  v_new jsonb;
  v_rare jsonb;
  v_value jsonb;
  v_watch jsonb;
  v_fact jsonb;
begin
  -- The latest day MorphMarket was checked, and the latest full check.
  select * into v_us from geck_data.market_daily d
   where d.market = 'US' and d.trait = '' and d.checked > 0
   order by d.day desc limit 1;
  select * into v_full from geck_data.market_daily d
   where d.market = 'US' and d.trait = '' and d.full_check
   order by d.day desc limit 1;
  v_d0 := v_us.day::timestamp at time zone 'UTC';
  v_d1 := (v_us.day + 1)::timestamp at time zone 'UTC';

  -- A typical day: the middle of the 28 days before (new listings) and of
  -- the full checks in the 8 weeks before (cuts and came down).
  select percentile_cont(0.5) within group (order by d.new_listings) into v_typ_new
    from geck_data.market_daily d
   where d.market = 'US' and d.trait = '' and d.new_listings is not null
     and d.day < v_us.day and d.day >= v_us.day - 28;
  select percentile_cont(0.5) within group (order by d.cuts),
         percentile_cont(0.5) within group (order by d.came_down)
    into v_typ_cuts, v_typ_down
    from geck_data.market_daily d
   where d.market = 'US' and d.trait = '' and d.full_check and d.cuts is not null
     and d.day < v_us.day and d.day >= v_us.day - 56;

  v_word := case
    when v_us.new_listings is null or coalesce(v_typ_new, 0) = 0 then null
    when v_us.new_listings >= 1.3 * v_typ_new then 'busy'
    when v_us.new_listings <= 0.7 * v_typ_new then 'slow'
    else 'normal'
  end;

  v_us_json := jsonb_build_object(
    'day', v_us.day,
    'prev_day', v_us.prev_check_day,
    'full_check', v_us.full_check,
    'after_gap', v_us.after_gap,
    'last_full_day', v_full.day,
    'fresh', coalesce(v_us.day >= (now() at time zone 'UTC')::date - 1, false),
    'new_listings', v_us.new_listings,
    'new_low', v_us.new_low,
    'came_down', v_us.came_down,
    'cuts', v_us.cuts,
    'raises', v_us.raises,
    'median_cut_pct', v_us.median_cut_pct,
    'for_sale', v_full.for_sale,
    'p50', v_full.p50,
    'typical_new', round(v_typ_new),
    'typical_cuts', round(v_typ_cuts),
    'typical_came_down', round(v_typ_down),
    'word', v_word
  );

  -- Korea, Japan and Europe: each market's latest check.
  select coalesce(jsonb_agg(jsonb_build_object(
           'market', x.market, 'day', x.day, 'full_check', x.full_check,
           'new_listings', x.new_listings, 'came_down', x.came_down,
           'cuts', x.cuts, 'raises', x.raises, 'for_sale', x.for_sale, 'p50', x.p50,
           'fresh', x.day >= (now() at time zone 'UTC')::date - 1)
         order by x.market), '[]'::jsonb)
    into v_intl
    from (
      select distinct on (d.market) d.*
      from geck_data.market_daily d
      where d.market in ('KR', 'JP', 'EU') and d.trait = '' and d.checked > 0
      order by d.market, d.day desc
    ) x;

  -- The member's morphs: the traits behind their priced geckos, then the
  -- morphs on their watchlist.
  select coalesce(array_agg(t.trait order by t.weight desc), '{}') into v_mine
    from (
      select mp.canon as trait, sum((x ->> 'value')::numeric) + 100000 as weight
        from public.market_value_daily d
        cross join lateral jsonb_array_elements(d.details) x
        join geck_data.morph_term_map mp on mp.term = lower(x ->> 'trait')
       where d.user_email = v_email
         and d.day = (select max(d2.day) from public.market_value_daily d2 where d2.user_email = v_email)
       group by mp.canon
      union all
      select mp.canon, 1
        from geck_data.alerts a
        cross join lateral jsonb_array_elements_text(
          case when jsonb_typeof(a.query -> 'trait_all') = 'array' then a.query -> 'trait_all' else '[]'::jsonb end) t(v)
        join geck_data.morph_term_map mp on mp.term = lower(t.v)
       where a.owner_id = p_uid and a.active
    ) t;
  select coalesce(array_agg(distinct m), '{}') into v_mine
    from (select unnest(v_mine[1:6]) m) s;

  with mine as (
    select unnest(v_mine) as trait
  ),
  today as (
    select d.trait, d.new_listings, d.new_low, d.cuts
    from geck_data.market_daily d join mine using (trait)
    where d.market = 'US' and d.day = v_us.day
  ),
  latest as (
    select distinct on (d.trait) d.trait, d.day, d.p50, d.for_sale
    from geck_data.market_daily d join mine using (trait)
    where d.market = 'US' and d.full_check and d.p50 is not null
    order by d.trait, d.day desc
  ),
  earlier as (
    select distinct on (d.trait) d.trait, d.day, d.p50
    from geck_data.market_daily d join latest l using (trait)
    where d.market = 'US' and d.full_check and d.p50 is not null and d.day <= l.day - 21
    order by d.trait, d.day desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'trait', m.trait,
           'new_listings', t.new_listings, 'new_low', t.new_low, 'cuts', t.cuts,
           'p50', l.p50, 'day', l.day, 'for_sale', l.for_sale,
           'p50_before', e.p50, 'day_before', e.day)
         order by coalesce(t.new_listings, 0) desc, m.trait), '[]'::jsonb)
    into v_morphs
    from mine m
    left join today t using (trait)
    left join latest l using (trait)
    left join earlier e using (trait);

  -- New listings from the latest check in the member's morphs, the ones
  -- priced low for their kind first.
  select coalesce(jsonb_agg(to_jsonb(x) order by x.rank_low, x.ratio nulls last), '[]'::jsonb)
    into v_new
    from (
      select l.listing_id, l.name as title, f.morphs, l.sex_class, l.age_class, l.weight_grams,
             l.price, l.position, l.ratio, l.similar_p25, l.similar_p50, l.similar_p75,
             l.primary_image_url as image_url, l.listing_url, l.first_seen_at,
             case l.position when 'low' then 0 when 'typical' then 1 else 2 end as rank_low
        from geck_data.listing_market_mv l
        join geck_data.listing_facts_mv f using (listing_id)
       where l.currency = 'USD' and not l.is_lot and l.for_sale
         and l.first_seen_at >= v_d0 and l.first_seen_at < v_d1
         and (f.first_listed_at is null or f.first_listed_at >= l.first_seen_at - interval '3 days')
         and not coalesce(v_us.after_gap, true)
         and f.morphs && v_mine
       order by case l.position when 'low' then 0 when 'typical' then 1 else 2 end, l.ratio nulls last
       limit 6
    ) x;

  -- Rare sightings: new listings carrying a morph that makes up under 2%
  -- of the market at the latest full check (color-only names left out),
  -- or a Luwak (Cappuccino with Sable).
  with rare_traits as (
    select d.trait
    from geck_data.market_daily d
    where d.market = 'US' and d.day = v_full.day and d.trait <> ''
      and d.for_sale is not null and v_full.for_sale > 0
      and d.for_sale::numeric / v_full.for_sale < 0.02
      and not geck_data._is_color_only(d.trait)
  )
  select coalesce(jsonb_agg(to_jsonb(x) order by x.price desc), '[]'::jsonb)
    into v_rare
    from (
      select l.listing_id, l.name as title, f.morphs,
             case when f.morphs @> array['Cappuccino', 'Sable'] then 'Luwak' end as combo,
             array(select r.trait from rare_traits r where r.trait = any (f.morphs)) as rare_morphs,
             l.sex_class, l.age_class, l.price, l.position,
             l.primary_image_url as image_url, l.listing_url
        from geck_data.listing_market_mv l
        join geck_data.listing_facts_mv f using (listing_id)
       where l.currency = 'USD' and not l.is_lot and l.for_sale
         and l.first_seen_at >= v_d0 and l.first_seen_at < v_d1
         and (f.first_listed_at is null or f.first_listed_at >= l.first_seen_at - interval '3 days')
         and not coalesce(v_us.after_gap, true)
         and (f.morphs && array(select r.trait from rare_traits r)
              or f.morphs @> array['Cappuccino', 'Sable'])
       order by l.price desc
       limit 4
    ) x;

  -- The market value of the member's crested geckos.
  select jsonb_build_object(
           'day', d.day, 'geckos', d.geckos, 'priced', d.priced,
           'value', d.value, 'value_low', d.value_low, 'value_high', d.value_high,
           'value_7d', (select p.value from public.market_value_daily p
                         where p.user_email = v_email and p.day <= d.day - 7
                         order by p.day desc limit 1),
           'value_30d', (select p.value from public.market_value_daily p
                          where p.user_email = v_email and p.day <= d.day - 30
                          order by p.day desc limit 1))
    into v_value
    from public.market_value_daily d
   where d.user_email = v_email
   order by d.day desc
   limit 1;

  select jsonb_build_object(
           'alerts', (select count(*) from geck_data.alerts a where a.owner_id = p_uid and a.active),
           'matches_24h', (select count(*) from geck_data.alert_matches m
                             join geck_data.alerts a on a.id = m.alert_id
                            where a.owner_id = p_uid and m.matched_at > now() - interval '24 hours'))
    into v_watch;

  -- One fact worth knowing, the first that applies:
  --   1. a full check with more than twice the usual price cuts
  --   2. the morph whose middle asking price moved most in about 4 weeks
  --   3. the widest gap between Korea and the US for one morph
  if v_full.cuts is not null and coalesce(v_typ_cuts, 0) > 0 and v_full.cuts > 2 * v_typ_cuts then
    v_fact := jsonb_build_object('kind', 'cut_wave', 'day', v_full.day,
      'cuts', v_full.cuts, 'typical_cuts', round(v_typ_cuts), 'median_cut_pct', v_full.median_cut_pct);
  end if;

  if v_fact is null then
    select jsonb_build_object('kind', 'mover', 'trait', a.trait, 'day', a.day, 'p50', a.p50,
                              'day_before', b.day, 'p50_before', b.p50, 'for_sale', a.for_sale)
      into v_fact
      from geck_data.market_daily a
      join lateral (
        select b.* from geck_data.market_daily b
         where b.market = 'US' and b.trait = a.trait and b.full_check and b.p50 is not null
           and b.day <= a.day - 21 and b.day >= a.day - 42
         order by b.day desc limit 1
      ) b on true
     where a.market = 'US' and a.day = v_full.day and a.trait <> ''
       and a.for_sale >= 30 and b.for_sale >= 30 and a.p50 is not null
       and not geck_data._is_color_only(a.trait)
       and abs(a.p50 - b.p50) / b.p50 >= 0.10
     order by abs(a.p50 - b.p50) / b.p50 desc
     limit 1;
  end if;

  if v_fact is null then
    select jsonb_build_object('kind', 'korea_gap', 'trait', k.trait, 'kr_p50', k.p50, 'us_p50', u.p50,
                              'kr_n', k.n, 'us_n', u.n)
      into v_fact
      from geck_data.market_compare(8) k
      join geck_data.market_compare(8) u on u.trait = k.trait and u.market = 'US'
     where k.market = 'KR' and k.trait is not null and u.p50 > 0
       and abs(k.p50 - u.p50) / u.p50 >= 0.3
     order by abs(k.p50 - u.p50) / u.p50 desc
     limit 1;
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'us', v_us_json,
    'intl', v_intl,
    'morphs', v_morphs,
    'new_for_you', v_new,
    'rare', v_rare,
    'value', v_value,
    'watch', v_watch,
    'fact', v_fact
  );
end;
$$;

revoke all on function geck_data.market_brief_for(text, uuid) from public, anon, authenticated;
grant execute on function geck_data.market_brief_for(text, uuid) to service_role;

create or replace function public.market_brief()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select case when auth.uid() is null then null
              else geck_data.market_brief_for((select auth.jwt()) ->> 'email', auth.uid()) end;
$$;

revoke all on function public.market_brief() from public, anon;
grant execute on function public.market_brief() to authenticated;

-- The morning notification.
create or replace function public.enqueue_market_briefs()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  r record;
  b jsonb;
  v_parts text[];
  v_count integer := 0;
  v_top jsonb;
  v_rare jsonb;
  v_value numeric;
  v_week numeric;
  v_matches integer;
  v_word text;
  v_meaningful boolean;
begin
  -- Only after MorphMarket was checked today, and not on a catch-up day.
  if not exists (
    select 1 from geck_data.market_daily d
     where d.market = 'US' and d.trait = '' and d.checked > 0
       and not d.after_gap
       and d.day = (now() at time zone 'UTC')::date
  ) then
    return 0;
  end if;

  for r in
    -- One row per account: legacy profile rows can share an email.
    select distinct on (lower(p.email)) p.email, u.id as uid
      from public.profiles p
      join auth.users u on lower(u.email) = lower(p.email)
     where p.market_brief_enabled
       and not exists (
         select 1 from public.notifications n
          where n.user_email = p.email
            and n.type = 'market_brief'
            and n.created_date >= (now() at time zone 'UTC')::date
       )
  loop
    b := geck_data.market_brief_for(r.email, r.uid);
    v_parts := '{}';
    v_meaningful := false;

    v_word := b #>> '{us,word}';
    if (b #>> '{us,new_listings}') is not null then
      v_parts := v_parts || format('%s new crested listings%s%s.',
        b #>> '{us,new_listings}',
        case when v_word in ('busy', 'slow') then format(' (a %s day)', v_word) else '' end,
        case when (b #>> '{us,cuts}') is not null
             then format(', %s price cuts', b #>> '{us,cuts}') else '' end);
    end if;

    select x into v_top
      from jsonb_array_elements(b -> 'morphs') x
     where coalesce((x ->> 'new_listings')::int, 0) > 0
     order by (x ->> 'new_listings')::int desc
     limit 1;
    if v_top is not null then
      v_meaningful := true;
      v_parts := v_parts || format('Your morphs: %s new %s%s.',
        v_top ->> 'new_listings', v_top ->> 'trait',
        case when coalesce((v_top ->> 'new_low')::int, 0) > 0
             then format(', %s priced low for their kind', v_top ->> 'new_low') else '' end);
    end if;

    v_rare := b -> 'rare' -> 0;
    if v_rare is not null then
      v_meaningful := true;
      v_parts := v_parts || format('Rare today: %s at $%s.',
        coalesce(v_rare ->> 'combo',
                 (select string_agg(m, ' ') from jsonb_array_elements_text(v_rare -> 'morphs') m),
                 'a crested gecko'),
        to_char((v_rare ->> 'price')::numeric, 'FM999,999'));
    end if;

    v_value := (b #>> '{value,value}')::numeric;
    v_week := (b #>> '{value,value_7d}')::numeric;
    if v_value is not null and v_value > 0 then
      v_parts := v_parts || format('Your crested geckos: about $%s to $%s%s.',
        to_char((b #>> '{value,value_low}')::numeric, 'FM999,999'),
        to_char((b #>> '{value,value_high}')::numeric, 'FM999,999'),
        case when v_week > 0 and abs(v_value - v_week) / v_week >= 0.01
             then format(', %s %s%% in a week',
                         case when v_value > v_week then 'up' else 'down' end,
                         round(abs(v_value - v_week) / v_week * 100, 1))
             else '' end);
      if v_week > 0 and abs(v_value - v_week) / v_week >= 0.02 then
        v_meaningful := true;
      end if;
    end if;

    v_matches := coalesce((b #>> '{watch,matches_24h}')::int, 0);
    if v_matches > 0 then
      v_meaningful := true;
      v_parts := v_parts || format('%s new %s.', v_matches,
        case when v_matches = 1 then 'watchlist match' else 'watchlist matches' end);
    end if;

    if b #>> '{fact,kind}' = 'cut_wave' then
      v_meaningful := true;
    end if;

    if v_meaningful then
      insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
      values (r.email, 'market_brief', left(array_to_string(v_parts, ' '), 480), '/Market',
              jsonb_build_object('source', 'cron', 'day', b #>> '{us,day}'), false, r.email);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.enqueue_market_briefs() from public, anon, authenticated;
grant execute on function public.enqueue_market_briefs() to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'market-brief-morning') then
    perform cron.unschedule('market-brief-morning');
  end if;
  perform cron.schedule('market-brief-morning', '35 13-20 * * *',
    $cron$ select public.enqueue_market_briefs(); $cron$);
end
$$;

-- The tape.
create or replace function public.market_tape(
  p_before timestamptz default null,
  p_limit integer default 40,
  p_scope text default 'all'
)
returns table (
  event_id text, at timestamptz, kind text, market text, listing_id text,
  title text, morphs text[], sex_class text, age_class text, weight_grams numeric,
  price numeric, was_price numeric, currency text, price_local numeric,
  price_position text, similar_p25 numeric, similar_p50 numeric, similar_p75 numeric,
  image_url text, listing_url text
)
language sql
stable
security definer
set search_path to ''
as $$
  with bounds as (
    select coalesce(p_before, now() + interval '1 minute') as before_at
  ),
  us_new as (
    select 'us-new-' || l.listing_id as event_id, l.first_seen_at as at, 'new'::text as kind,
           'US'::text as market, l.listing_id, l.name as title, f.morphs,
           l.sex_class, l.age_class, l.weight_grams,
           l.price, null::numeric as was_price, 'USD'::text as currency, l.price as price_local,
           l.position as price_position, l.similar_p25, l.similar_p50, l.similar_p75,
           l.primary_image_url as image_url, l.listing_url
    from geck_data.listing_market_mv l
    join geck_data.listing_facts_mv f using (listing_id)
    cross join bounds b
    where p_scope in ('all', 'US')
      and l.currency = 'USD' and not l.is_lot
      and l.first_seen_at < b.before_at
      and l.first_seen_at > b.before_at - interval '120 days'
      and (f.first_listed_at is null or f.first_listed_at >= l.first_seen_at - interval '3 days')
      -- Leave out a day that was a catch-up after an outage.
      and not exists (
        select 1 from geck_data.market_daily d
         where d.market = 'US' and d.trait = '' and d.after_gap
           and d.day = (l.first_seen_at at time zone 'UTC')::date
      )
      -- And MorphMarket's first import.
      and l.first_seen_at >= (
        select min(d.day)::timestamp at time zone 'UTC' + interval '3 days'
          from geck_data.market_daily d where d.market = 'US' and d.trait = '' and d.full_check
      )
  ),
  us_ph as (
    select regexp_replace(h.listing_id, '^mm_', '') as listing_id, h.observed_at, h.price,
           lag(h.price) over (partition by h.listing_id order by h.observed_at) as prev
    from geck_data.price_history h
    cross join bounds b
    where p_scope in ('all', 'US')
      and h.currency = 'USD'
      and h.observed_at < b.before_at
      and h.observed_at > b.before_at - interval '150 days'
  ),
  us_cuts as (
    select 'us-cut-' || c.listing_id || '-' || extract(epoch from c.observed_at)::bigint,
           c.observed_at, 'cut'::text, 'US'::text, l.listing_id, l.name, f.morphs,
           l.sex_class, l.age_class, l.weight_grams,
           c.price, c.prev, 'USD'::text, c.price,
           l.position, l.similar_p25, l.similar_p50, l.similar_p75,
           l.primary_image_url, l.listing_url
    from us_ph c
    cross join bounds b
    join geck_data.listing_market_mv l on l.listing_id = c.listing_id
    join geck_data.listing_facts_mv f on f.listing_id = c.listing_id
    where c.prev is not null and c.price < c.prev
      and c.observed_at > b.before_at - interval '120 days'
      and not l.is_lot
      and not exists (
        select 1 from geck_data.market_daily d
         where d.market = 'US' and d.trait = '' and d.after_gap
           and d.day = (c.observed_at at time zone 'UTC')::date
      )
  ),
  obs as (
    select o.platform, o.external_id, o.observed_on
    from geck_data.cross_platform_observations o
    where o.platform in ('feedle_kr', 'kr_shops', 'repsuki', 'terraristik')
      and o.observed_on > current_date - 120
  ),
  plat_days as (
    select platform, observed_on, count(*) as n from obs group by platform, observed_on
  ),
  plat_full as (
    select pd.platform, pd.observed_on,
           pd.n >= 0.5 * coalesce((
             select max(p2.n) from plat_days p2
              where p2.platform = pd.platform and p2.observed_on < pd.observed_on
                and p2.observed_on >= pd.observed_on - 45), 0) as full_check,
           lag(pd.observed_on) over (partition by pd.platform order by pd.observed_on) as prev_on,
           min(pd.observed_on) over (partition by pd.platform) as first_on
    from plat_days pd
  ),
  good_days as (
    -- A day counts when the source had a full check that day and on its
    -- previous check day, and it was not the source's first day.
    select pf.platform, pf.observed_on
    from plat_full pf
    join plat_full pp on pp.platform = pf.platform and pp.observed_on = pf.prev_on
    where pf.full_check and pp.full_check and pf.observed_on > pf.first_on
  ),
  first_obs as (
    select platform, external_id, min(observed_on) as first_on
    from obs group by platform, external_id
  ),
  intl_new as (
    select 'cp-new-' || c.id::text, c.first_seen_at, 'new'::text,
           case when c.platform in ('feedle_kr', 'kr_shops') then 'KR'
                when c.platform = 'repsuki' then 'JP' else 'EU' end,
           c.platform || ':' || c.external_id, c.title,
           coalesce(tr.traits, '{}'::text[]),
           case lower(coalesce(c.payload ->> 'sex', ''))
             when 'male' then 'male' when 'female' then 'female' else 'unsexed' end,
           null::text, null::numeric,
           round(c.price / nullif(fx.per_usd, 0)), null::numeric, c.currency, c.price,
           null::text, null::numeric, null::numeric, null::numeric,
           (select i.image_url from geck_data.cross_platform_listing_images i
             where i.cross_platform_listing_id = c.id limit 1),
           c.url
    from geck_data.cross_platform_listings c
    join first_obs fo on fo.platform = c.platform and fo.external_id = c.external_id
    join good_days gd on gd.platform = c.platform and gd.observed_on = fo.first_on
    left join geck_data.cross_platform_traits_mv tr on tr.platform = c.platform and tr.external_id = c.external_id
    left join geck_data.fx_rates fx on fx.currency = c.currency
    cross join bounds b
    where p_scope in ('all', 'KR', 'JP', 'EU')
      and (p_scope = 'all' or p_scope = case when c.platform in ('feedle_kr', 'kr_shops') then 'KR'
                                             when c.platform = 'repsuki' then 'JP' else 'EU' end)
      and coalesce(c.species, 'crested') = 'crested'
      and not coalesce((c.payload ->> 'is_group_lot')::boolean, false)
      and c.price > 0
      and c.first_seen_at < b.before_at
  )
  select * from (
    select * from us_new
    union all
    select * from us_cuts
    union all
    select * from intl_new
  ) e
  order by e.at desc, e.event_id desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

revoke all on function public.market_tape(timestamptz, integer, text) from public, anon;
grant execute on function public.market_tape(timestamptz, integer, text) to authenticated;
