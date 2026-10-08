-- Guess the Price, and the seller view for Breeder plan members
-- (30 Sep 2026).
--
-- Guess the Price: five real crested gecko listings a day, the same five
-- for everyone. A member sees the photo, morphs, sex, age and weight,
-- guesses the asking price, and then sees the real price, where it sits
-- among similar geckos, and a score. Picks come from listings with a
-- photo and at least 8 similar listings to compare against, one per morph
-- so the day has variety, chosen by a hash of the date so the set is
-- stable all day. The day turns over at midnight US Eastern.
--
-- Score: 100 for the exact price, falling with the ratio between guess and
-- price, 0 at three times too high or too low:
--   100 * (1 - |ln(guess / price)| / ln 3)
-- so a guess 10% off scores about 91 and one 50% off about 63.
--
-- A second question, "sells within 14 days?", is asked only while
-- MorphMarket is checked daily, and resolves itself later from the
-- listing's came-down date.
--
-- Answers never leave the database before a guess: the rounds table has
-- no client access, and price_game_today() leaves the price out of
-- unguessed rounds.
--
-- Seller view: seller_market_view() shows a Breeder plan member's own
-- MorphMarket listings (their store link from My Profile) with where each
-- price sits among similar geckos, how long it has been listed, and the
-- similar geckos other breeders listed for less since the day before the
-- latest check.

create table if not exists public.price_game_rounds (
  day date not null,
  slot smallint not null check (slot between 1 and 5),
  listing_id text not null,
  title text,
  morphs text[] not null default '{}',
  sex_class text,
  age_class text,
  weight_grams numeric,
  image_url text,
  listing_url text,
  price numeric not null,
  similar_p25 numeric,
  similar_p50 numeric,
  similar_p75 numeric,
  price_position text,
  compared_trait text,
  compared_n bigint,
  created_date timestamptz not null default now(),
  primary key (day, slot)
);

alter table public.price_game_rounds enable row level security;
revoke all on public.price_game_rounds from anon, authenticated;
grant select, insert, update, delete on public.price_game_rounds to service_role;

create table if not exists public.price_game_guesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  slot smallint not null,
  guess numeric not null check (guess > 0),
  score integer not null check (score between 0 and 100),
  predicted_sells boolean,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (user_id, day, slot),
  foreign key (day, slot) references public.price_game_rounds (day, slot) on delete cascade
);

alter table public.price_game_guesses enable row level security;
drop policy if exists "Members read their own guesses" on public.price_game_guesses;
create policy "Members read their own guesses"
  on public.price_game_guesses for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.price_game_guesses from anon, authenticated;
grant select on public.price_game_guesses to authenticated;
grant select, insert, update, delete on public.price_game_guesses to service_role;

create or replace function public._price_game_day()
returns date
language sql
stable
set search_path to ''
as $$
  select (now() at time zone 'America/New_York')::date;
$$;

-- Pick the day's five listings once; later callers read the same rows.
create or replace function public._price_game_ensure(p_day date)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_latest timestamptz;
begin
  if exists (select 1 from public.price_game_rounds r where r.day = p_day) then
    return;
  end if;
  select max(l.last_seen_at) into v_latest from geck_data.listings l;

  insert into public.price_game_rounds
    (day, slot, listing_id, title, morphs, sex_class, age_class, weight_grams,
     image_url, listing_url, price, similar_p25, similar_p50, similar_p75,
     price_position, compared_trait, compared_n)
  select p_day, (row_number() over (order by c.pick))::smallint,
         c.listing_id, c.name, c.morphs, c.sex_class, c.age_class, c.weight_grams,
         c.primary_image_url, c.listing_url, c.price, c.similar_p25, c.similar_p50, c.similar_p75,
         c.position, c.compared_trait, c.compared_n
  from (
    select distinct on (l.compared_trait)
           l.*, f.morphs, md5(p_day::text || l.listing_id) as pick
    from geck_data.listing_market_mv l
    join geck_data.listing_facts_mv f using (listing_id)
    where l.currency = 'USD' and not l.is_lot
      and l.price between 40 and 5000
      and l.primary_image_url is not null
      and l.compared_n >= 8
      and l.basis in ('trait_age_sex', 'trait_age', 'trait')
      and cardinality(f.morphs) > 0
      and l.last_seen_at >= v_latest - interval '90 days'
    order by l.compared_trait, md5(p_day::text || l.listing_id)
  ) c
  order by c.pick
  limit 5
  on conflict do nothing;
end;
$$;

revoke all on function public._price_game_ensure(date) from public, anon, authenticated;
grant execute on function public._price_game_ensure(date) to service_role;

create or replace function public._price_game_score(p_guess numeric, p_price numeric)
returns integer
language sql
immutable
set search_path to ''
as $$
  select greatest(0, round(100 * (1 - abs(ln(p_guess / p_price)) / ln(3))))::integer;
$$;

-- Whether the "sells within 14 days?" question can be answered later:
-- only while MorphMarket gets a full check at least every 3 days.
create or replace function public._price_game_sells_open()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(max(d.day) >= (now() at time zone 'UTC')::date - 3, false)
    from geck_data.market_daily d
   where d.market = 'US' and d.trait = '' and d.full_check;
$$;

create or replace function public._price_game_stats(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  with days as (
    select g.day, sum(g.score) as total, count(*) as n
    from public.price_game_guesses g
    where g.user_id = p_uid
    group by g.day
  ),
  today as (select public._price_game_day() as d),
  -- A streak counts back from today, or from yesterday when today has
  -- not been played yet.
  run as (
    -- Consecutive days, counted newest first, share day + position.
    select d.day, d.day + (row_number() over (order by d.day desc))::int as grp
    from days d
  ),
  streak as (
    select count(*) as n
    from run r, today t
    where r.grp = (
      select r2.grp from run r2
       where r2.day = (select max(day) from days)
         and r2.day >= t.d - 1
    )
  ),
  predictions as (
    select g.predicted_sells,
           case
             when l.sold_at is not null and l.sold_at::date <= g.day + 14 then true
             when l.last_seen_at::date >= g.day + 14
                  and (l.sold_at is null or l.sold_at::date > g.day + 14) then false
           end as sold
    from public.price_game_guesses g
    join public.price_game_rounds r on r.day = g.day and r.slot = g.slot
    left join geck_data.listings l on l.listing_id = r.listing_id
    where g.user_id = p_uid and g.predicted_sells is not null
  )
  select jsonb_build_object(
    'days_played', (select count(*) from days),
    'streak', coalesce((select n from streak), 0),
    'best_day', (select max(total) from days where n = 5),
    'average_score', (select round(avg(g.score)) from public.price_game_guesses g
                       where g.user_id = p_uid and g.day > public._price_game_day() - 30),
    'today_total', (select total from days, today where days.day = today.d),
    'predictions_right', (select count(*) from predictions where sold is not null and sold = predicted_sells),
    'predictions_wrong', (select count(*) from predictions where sold is not null and sold <> predicted_sells),
    'predictions_pending', (select count(*) from predictions where sold is null)
  );
$$;

revoke all on function public._price_game_stats(uuid) from public, anon, authenticated;

create or replace function public._price_game_round_json(r public.price_game_rounds, g public.price_game_guesses)
returns jsonb
language sql
stable
set search_path to ''
as $$
  select jsonb_build_object(
    'slot', r.slot,
    'title', trim(regexp_replace(coalesce(r.title, ''), '(\$|usd\s*)\s?[0-9][0-9,.]*', '', 'gi')),
    'morphs', to_jsonb(r.morphs),
    'sex_class', r.sex_class,
    'age_class', r.age_class,
    'weight_grams', r.weight_grams,
    'image_url', r.image_url,
    'guessed', g.id is not null,
    'guess', g.guess,
    'score', g.score,
    'predicted_sells', g.predicted_sells
  ) || case when g.id is null then '{}'::jsonb else jsonb_build_object(
    'price', r.price,
    'similar_p25', r.similar_p25,
    'similar_p50', r.similar_p50,
    'similar_p75', r.similar_p75,
    'price_position', r.price_position,
    'compared_trait', r.compared_trait,
    'compared_n', r.compared_n,
    'listing_url', r.listing_url
  ) end;
$$;

create or replace function public.price_game_today()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_day date := public._price_game_day();
  v_rounds jsonb;
begin
  if v_uid is null then
    raise exception 'Sign in to play' using errcode = '42501';
  end if;
  perform public._price_game_ensure(v_day);

  select coalesce(jsonb_agg(public._price_game_round_json(r, g) order by r.slot), '[]'::jsonb)
    into v_rounds
    from public.price_game_rounds r
    left join public.price_game_guesses g
      on g.day = r.day and g.slot = r.slot and g.user_id = v_uid
   where r.day = v_day;

  return jsonb_build_object(
    'day', v_day,
    'rounds', v_rounds,
    'sells_question', public._price_game_sells_open(),
    'stats', public._price_game_stats(v_uid)
  );
end;
$$;

create or replace function public.price_game_guess(p_slot integer, p_guess numeric)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_day date := public._price_game_day();
  v_round public.price_game_rounds;
  v_guess public.price_game_guesses;
begin
  if v_uid is null then
    raise exception 'Sign in to play' using errcode = '42501';
  end if;
  if p_guess is null or p_guess < 1 or p_guess > 100000 then
    raise exception 'Guess a price between $1 and $100,000' using errcode = '22023';
  end if;
  perform public._price_game_ensure(v_day);
  select * into v_round from public.price_game_rounds r where r.day = v_day and r.slot = p_slot;
  if v_round.day is null then
    raise exception 'No such round today' using errcode = 'P0002';
  end if;

  insert into public.price_game_guesses (user_id, day, slot, guess, score)
  values (v_uid, v_day, p_slot::smallint, round(p_guess), public._price_game_score(round(p_guess), v_round.price))
  on conflict (user_id, day, slot) do nothing;

  select * into v_guess from public.price_game_guesses g
   where g.user_id = v_uid and g.day = v_day and g.slot = p_slot;

  return jsonb_build_object(
    'round', public._price_game_round_json(v_round, v_guess),
    'stats', public._price_game_stats(v_uid)
  );
end;
$$;

create or replace function public.price_game_predict(p_slot integer, p_sells boolean)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_day date := public._price_game_day();
begin
  if v_uid is null then
    raise exception 'Sign in to play' using errcode = '42501';
  end if;
  update public.price_game_guesses g
     set predicted_sells = p_sells, updated_date = now()
   where g.user_id = v_uid and g.day = v_day and g.slot = p_slot;
  return public._price_game_stats(v_uid);
end;
$$;

revoke all on function public.price_game_today() from public, anon;
revoke all on function public.price_game_guess(integer, numeric) from public, anon;
revoke all on function public.price_game_predict(integer, boolean) from public, anon;
grant execute on function public.price_game_today() to authenticated;
grant execute on function public.price_game_guess(integer, numeric) to authenticated;
grant execute on function public.price_game_predict(integer, boolean) to authenticated;

-- Seller view.
create or replace function public.seller_market_view(p_slug text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_tier text;
  v_slug text;
  v_url text;
  v_as_of date;
  v_since timestamptz;
  v_store jsonb;
  v_listings jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to see your listings' using errcode = '42501';
  end if;
  v_tier := public.effective_tier_for_current_user();
  if coalesce(v_tier, 'free') not in ('breeder', 'enterprise') then
    return jsonb_build_object('allowed', false, 'tier', v_tier);
  end if;

  v_slug := nullif(lower(trim(both '/' from coalesce(p_slug, ''))), '');
  if v_slug is null then
    select p.morphmarket_url into v_url
      from public.profiles p
     where lower(p.email) = lower((select auth.jwt()) ->> 'email')
       and coalesce(p.morphmarket_url, '') <> ''
     limit 1;
    v_slug := nullif(lower(substring(v_url from '/stores/([^/?#]+)')), '');
  end if;
  if v_slug is null then
    return jsonb_build_object('allowed', true, 'slug', null);
  end if;

  select max(d.day) into v_as_of
    from geck_data.market_daily d
   where d.market = 'US' and d.trait = '' and d.checked > 0;
  v_since := (v_as_of - 1)::timestamp at time zone 'UTC';

  select to_jsonb(b) into v_store
    from geck_data.breeder_market_v b
   where lower(b.seller_slug) = v_slug;

  with mine as (
    select l.*, f.morphs, f.first_listed_at
    from geck_data.listing_market_mv l
    join geck_data.listing_facts_mv f using (listing_id)
    where lower(l.seller_slug) = v_slug and l.for_sale and l.currency = 'USD' and not l.is_lot
  ),
  rivals as (
    select m.listing_id as mine_id, o.listing_id, o.name, o.price, o.position,
           o.first_seen_at, o.listing_url, o.primary_image_url
    from mine m
    join geck_data.listing_market_mv o
      on o.compared_trait = m.compared_trait
     and o.age_class is not distinct from m.age_class
     and o.sex_class = m.sex_class
    where o.for_sale and o.currency = 'USD' and not o.is_lot
      and o.price < m.price
      and coalesce(lower(o.seller_slug), '') <> v_slug
      and o.first_seen_at >= v_as_of - 7
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'listing_id', m.listing_id,
           'title', m.name,
           'morphs', to_jsonb(m.morphs),
           'sex_class', m.sex_class,
           'age_class', m.age_class,
           'weight_grams', m.weight_grams,
           'price', m.price,
           'price_position', m.position,
           'ratio', m.ratio,
           'similar_p25', m.similar_p25,
           'similar_p50', m.similar_p50,
           'similar_p75', m.similar_p75,
           'compared_trait', m.compared_trait,
           'compared_n', m.compared_n,
           'days_listed', v_as_of - coalesce(m.first_listed_at, m.first_seen_at)::date,
           'image_url', m.primary_image_url,
           'listing_url', m.listing_url,
           'under_since_yesterday', (select count(*) from rivals r
                                      where r.mine_id = m.listing_id and r.first_seen_at >= v_since),
           'under_7d', (select count(*) from rivals r where r.mine_id = m.listing_id),
           'cheapest_new', (select coalesce(jsonb_agg(jsonb_build_object(
                                     'listing_id', r.listing_id, 'title', r.name, 'price', r.price,
                                     'first_seen_at', r.first_seen_at, 'listing_url', r.listing_url)
                                   order by r.price), '[]'::jsonb)
                              from (select * from rivals r2 where r2.mine_id = m.listing_id
                                     order by r2.price limit 3) r)
         ) order by case m.position when 'high' then 0 when 'typical' then 1 else 2 end,
                    m.ratio desc nulls last), '[]'::jsonb)
    into v_listings
    from mine m;

  return jsonb_build_object(
    'allowed', true,
    'slug', v_slug,
    'as_of', v_as_of,
    'store', v_store,
    'listings', v_listings
  );
end;
$$;

-- A fresh replay does not have every geck_data object this statement
-- uses, because the archived placeholders create nothing. Run the
-- original statement only when those objects exist. Production already
-- applied this version and will not run the file again.
do $do$
begin
  if to_regclass('geck_data.breeder_market_v') is not null then
    execute $stmt$
create or replace function public.seller_market_find(p_query text)
returns table (seller_slug text, name text, location text, for_sale bigint)
language sql
stable
security definer
set search_path to ''
as $$
  select b.seller_slug, b.name, b.location, b.for_sale
  from geck_data.breeder_market_v b
  where length(trim(coalesce(p_query, ''))) >= 2
    and (b.seller_slug ilike '%' || trim(p_query) || '%' or b.name ilike '%' || trim(p_query) || '%')
  order by b.for_sale desc nulls last
  limit 10;
$$;
$stmt$;
    execute $stmt$
revoke all on function public.seller_market_find(text) from public, anon;
$stmt$;
    execute $stmt$
grant execute on function public.seller_market_find(text) to authenticated;
$stmt$;
  end if;
end
$do$;

revoke all on function public.seller_market_view(text) from public, anon;
grant execute on function public.seller_market_view(text) to authenticated;
