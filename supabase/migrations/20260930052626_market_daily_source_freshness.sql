-- Daily market snapshot: judge freshness per source (30 Sep 2026).
--
-- The first backfill of geck_data.market_daily showed two false signals:
--   1. The first full MorphMarket check (11 May) counted 4,431 "new"
--      listings. That was the initial import, so a market's first full
--      check is now its starting point and has no flows.
--   2. Korea combines Feedle and the Korean shops. A Feedle run that read
--      12 listings (27 Sep) was hidden inside the shops' 426, and the next
--      day counted 739 Feedle listings as new. Each source is now checked
--      against its own recent size: a new listing, a listing that
--      vanished, a cut or a raise only counts when that source had a full
--      check today and on its previous check day.
-- A market's full_check also compares against the 45 days before it
-- instead of 14, so a source that was down for two weeks cannot pass a
-- tiny run as a full one.

create or replace function geck_data.snapshot_market_day(p_day date)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_d0 timestamptz := p_day::timestamp at time zone 'UTC';
  v_d1 timestamptz := (p_day + 1)::timestamp at time zone 'UTC';
  v_rows integer;
begin
  delete from geck_data.market_daily where day = p_day;

  -- MorphMarket, USD listings, group lots left out.
  insert into geck_data.market_daily
    (day, market, trait, checked, for_sale, p25, p50, p75,
     new_listings, new_low, came_down, cuts, raises, median_cut_pct)
  with us as (
    select l.listing_id, l.first_seen_at, l.last_seen_at, l.sold_at, l.price, l.position,
           f.morphs, f.first_listed_at
    from geck_data.listing_market_mv l
    join geck_data.listing_facts_mv f using (listing_id)
    where l.currency = 'USD' and not l.is_lot
  ),
  ph as (
    select regexp_replace(h.listing_id, '^mm_', '') as listing_id,
           h.observed_at,
           h.price,
           lag(h.price) over (partition by h.listing_id order by h.observed_at) as prev
    from geck_data.price_history h
    where h.currency = 'USD'
      and h.price > 0 and h.price < 100000
      and h.observed_at < v_d1
  ),
  day_obs as (
    select ph.listing_id,
           bool_or(ph.prev is not null and ph.price < ph.prev) as cut,
           bool_or(ph.prev is not null and ph.price > ph.prev) as raised,
           max(case when ph.prev is not null and ph.price < ph.prev
                    then (ph.prev - ph.price) / ph.prev end) as cut_pct
    from ph
    where ph.observed_at >= v_d0
    group by ph.listing_id
  ),
  last_price as (
    select distinct on (ph.listing_id) ph.listing_id, ph.price
    from ph
    order by ph.listing_id, ph.observed_at desc
  ),
  flags as (
    select u.morphs,
           (u.first_seen_at >= v_d0 and u.first_seen_at < v_d1
             and (u.first_listed_at is null or u.first_listed_at >= v_d0 - interval '3 days')) as is_new,
           (u.sold_at >= v_d0 and u.sold_at < v_d1) as is_down,
           coalesce(o.cut, false) as cut,
           coalesce(o.raised, false) as raised,
           o.cut_pct,
           (o.listing_id is not null
             or (u.last_seen_at >= v_d0 and u.last_seen_at < v_d1)
             or (u.first_seen_at >= v_d0 and u.first_seen_at < v_d1)) as checked,
           (u.first_seen_at < v_d1 and u.last_seen_at >= v_d0
             and (u.sold_at is null or u.sold_at >= v_d1)) as for_sale,
           coalesce(lp.price, u.price) as price_at,
           u.position
    from us u
    left join day_obs o using (listing_id)
    left join last_price lp using (listing_id)
  )
  select p_day, 'US', t.trait,
         count(*) filter (where f.checked),
         count(*) filter (where f.for_sale),
         round((percentile_cont(0.25) within group (order by f.price_at) filter (where f.for_sale))::numeric, 0),
         round((percentile_cont(0.50) within group (order by f.price_at) filter (where f.for_sale))::numeric, 0),
         round((percentile_cont(0.75) within group (order by f.price_at) filter (where f.for_sale))::numeric, 0),
         count(*) filter (where f.is_new),
         count(*) filter (where f.is_new and f.position = 'low'),
         count(*) filter (where f.is_down),
         count(*) filter (where f.cut),
         count(*) filter (where f.raised),
         round((percentile_cont(0.5) within group (order by f.cut_pct) filter (where f.cut))::numeric, 3)
  from flags f
  cross join lateral unnest(array[''] || f.morphs) t(trait)
  group by t.trait
  having t.trait = ''
      or count(*) filter (where f.checked or f.for_sale or f.is_new or f.is_down) > 0;

  -- Korea, Japan and Europe from the cross-platform daily observations,
  -- read over the last 60 days.
  insert into geck_data.market_daily
    (day, market, trait, checked, for_sale, p25, p50, p75,
     new_listings, new_low, came_down, cuts, raises, median_cut_pct)
  with obs as (
    select o.platform, o.external_id, o.observed_on, o.price, o.currency, o.sold,
           case when o.platform in ('feedle_kr', 'kr_shops') then 'KR'
                when o.platform = 'repsuki' then 'JP'
                else 'EU' end as market,
           lag(o.price) over w as prev_price,
           lag(o.sold) over w as prev_sold,
           lag(o.observed_on) over w as prev_on,
           min(o.observed_on) over (partition by o.platform, o.external_id) as first_on
    from geck_data.cross_platform_observations o
    where o.platform in ('feedle_kr', 'kr_shops', 'repsuki', 'terraristik')
      and o.observed_on <= p_day
      and o.observed_on > p_day - 60
    window w as (partition by o.platform, o.external_id order by o.observed_on)
  ),
  plat_days as (
    select ob.platform, ob.observed_on, count(*) as n
    from obs ob
    group by ob.platform, ob.observed_on
  ),
  plat_full as (
    -- A source's check is full when it read at least half of what it read
    -- at its biggest in the 45 days before (or it has no history yet).
    select pd.platform, pd.observed_on,
           pd.n >= 0.5 * coalesce((
             select max(p2.n) from plat_days p2
             where p2.platform = pd.platform
               and p2.observed_on < pd.observed_on
               and p2.observed_on >= pd.observed_on - 45
           ), 0) as full_check
    from plat_days pd
  ),
  plat as (
    select pd.platform,
           min(pd.observed_on) as first_day,
           max(pd.observed_on) filter (where pd.observed_on < p_day) as prev_day
    from plat_days pd
    group by pd.platform
  ),
  plat_state as (
    select p.platform, p.first_day, p.prev_day,
           coalesce((select f.full_check from plat_full f
                      where f.platform = p.platform and f.observed_on = p_day), false) as today_full,
           coalesce((select f.full_check from plat_full f
                      where f.platform = p.platform and f.observed_on = p.prev_day), false) as prev_full,
           exists (select 1 from plat_days d where d.platform = p.platform and d.observed_on = p_day) as seen_today
    from plat p
  ),
  cp_morphs as (
    select tr.platform, tr.external_id,
           geck_data._drop_contained(array_agg(distinct mp.canon)) as morphs
    from geck_data.cross_platform_traits_mv tr
    cross join lateral unnest(tr.traits) x(t)
    join geck_data.morph_term_map mp on mp.term = lower(x.t)
    group by tr.platform, tr.external_id
  ),
  excluded as (
    select c.platform, c.external_id
    from geck_data.cross_platform_listings c
    where c.platform in ('feedle_kr', 'kr_shops', 'repsuki', 'terraristik')
      and (coalesce(c.species, 'crested') <> 'crested'
           or coalesce((c.payload ->> 'is_group_lot')::boolean, false))
  ),
  today as (
    select ob.* from obs ob where ob.observed_on = p_day
  ),
  vanished as (
    select ob.market, ob.platform, ob.external_id
    from obs ob
    join plat_state p on p.platform = ob.platform
    where p.seen_today and p.today_full and p.prev_full
      and ob.observed_on = p.prev_day
      and not ob.sold
      and not exists (
        select 1 from today t2
        where t2.platform = ob.platform and t2.external_id = ob.external_id
      )
  ),
  flags as (
    select t.market, t.platform, t.external_id,
           true as checked,
           not t.sold as for_sale,
           (t.first_on = p_day and p_day > p.first_day and p.today_full and p.prev_full) as is_new,
           (t.sold and t.prev_sold is false and t.prev_on = p.prev_day) as is_down,
           (t.prev_on = p.prev_day and t.price < t.prev_price) as cut,
           (t.prev_on = p.prev_day and t.price > t.prev_price) as raised,
           case when t.prev_on = p.prev_day and t.price < t.prev_price
                then (t.prev_price - t.price) / t.prev_price end as cut_pct,
           t.price / nullif(fx.per_usd, 0) as price_usd
    from today t
    join plat_state p on p.platform = t.platform
    left join geck_data.fx_rates fx on fx.currency = t.currency
    union all
    select v.market, v.platform, v.external_id,
           false, false, false, true, false, false, null::numeric, null::numeric
    from vanished v
  ),
  scoped as (
    select f.*, coalesce(m.morphs, '{}'::text[]) as morphs
    from flags f
    left join cp_morphs m on m.platform = f.platform and m.external_id = f.external_id
    where not exists (
      select 1 from excluded e
      where e.platform = f.platform and e.external_id = f.external_id
    )
  )
  select p_day, s.market, t.trait,
         count(*) filter (where s.checked),
         count(*) filter (where s.for_sale),
         round((percentile_cont(0.25) within group (order by s.price_usd) filter (where s.for_sale))::numeric, 0),
         round((percentile_cont(0.50) within group (order by s.price_usd) filter (where s.for_sale))::numeric, 0),
         round((percentile_cont(0.75) within group (order by s.price_usd) filter (where s.for_sale))::numeric, 0),
         count(*) filter (where s.is_new),
         null::integer,
         count(*) filter (where s.is_down),
         count(*) filter (where s.cut),
         count(*) filter (where s.raised),
         round((percentile_cont(0.5) within group (order by s.cut_pct) filter (where s.cut))::numeric, 3)
  from scoped s
  cross join lateral unnest(array[''] || s.morphs) t(trait)
  group by s.market, t.trait;

  -- Freshness flags per market, read from each market's all-morph row and
  -- the days before it, then applied to every morph row of that market.
  with m as (
    select md.market, md.checked, md.for_sale,
           (select max(p.day) from geck_data.market_daily p
             where p.market = md.market and p.trait = '' and p.day < p_day and p.checked > 0) as prev_check_day,
           (select max(p.day) from geck_data.market_daily p
             where p.market = md.market and p.trait = '' and p.day < p_day and p.full_check) as prev_full_day,
           (select max(p.for_sale) from geck_data.market_daily p
             where p.market = md.market and p.trait = '' and p.full_check
               and p.day < p_day and p.day >= p_day - 45) as recent_for_sale,
           (select max(p.checked) from geck_data.market_daily p
             where p.market = md.market and p.trait = ''
               and p.day < p_day and p.day >= p_day - 45) as recent_checked
    from geck_data.market_daily md
    where md.day = p_day and md.trait = ''
  ),
  f as (
    select m.market, m.checked as market_checked, m.prev_check_day, m.prev_full_day,
           case
             when m.checked = 0 then false
             when m.market = 'US'
               then m.checked >= greatest(1000, 0.5 * coalesce(m.recent_for_sale, 0))
             else m.checked >= 0.5 * coalesce(m.recent_checked, m.checked)
           end as full_check,
           (m.prev_check_day is null or p_day - m.prev_check_day > 3) as after_gap
    from m
  ),
  g as (
    -- A market's first full check is its starting point, not a day of news.
    select f.*, (f.full_check and f.prev_full_day is null) as baseline
    from f
  )
  update geck_data.market_daily md
     set full_check = g.full_check,
         prev_check_day = g.prev_check_day,
         prev_full_day = g.prev_full_day,
         after_gap = g.after_gap,
         for_sale = case when g.full_check then md.for_sale end,
         p25 = case when g.full_check then md.p25 end,
         p50 = case when g.full_check then md.p50 end,
         p75 = case when g.full_check then md.p75 end,
         new_listings = case when g.market_checked > 0 and not g.after_gap and not g.baseline then md.new_listings end,
         new_low = case when g.market_checked > 0 and not g.after_gap and not g.baseline then md.new_low end,
         came_down = case when g.full_check and not g.after_gap and not g.baseline then md.came_down end,
         cuts = case when g.full_check and not g.after_gap and not g.baseline then md.cuts end,
         raises = case when g.full_check and not g.after_gap and not g.baseline then md.raises end,
         median_cut_pct = case when g.full_check and not g.after_gap and not g.baseline then md.median_cut_pct end,
         computed_at = now()
    from g
   where md.day = p_day and md.market = g.market;

  select count(*) into v_rows from geck_data.market_daily where day = p_day;
  return v_rows;
end;
$$;

revoke all on function geck_data.snapshot_market_day(date) from public, anon, authenticated;
grant execute on function geck_data.snapshot_market_day(date) to service_role;
