-- Compare optimized RPC output with the established public-view definition.
-- Read-only fixtures; transaction prevents observation changes between checks.
begin isolation level repeatable read;
do $test$
declare c record; expected jsonb; actual jsonb;
begin
  for c in select * from (values
    ('Lilly White','Harlequin',180), ('Axanthic','',730), ('','',1),
    ('not-a-trait','',180), (null::text,'',180)
  ) cases(a,b,days) loop
    select coalesce(jsonb_agg(to_jsonb(r) order by r.week_start),'[]') into actual
      from geck_data.combo_weekly_prices(c.a,c.b,c.days) r;
    select coalesce(jsonb_agg(to_jsonb(r) order by r.week_start),'[]') into expected from (
      select w.week_start,
        round(percentile_cont(0.5) within group(order by w.price)::numeric,2) as median_price,
        count(distinct w.listing_id)::bigint as n_listings,
        count(distinct w.observed_day)::bigint as observed_days
      from geck_data.v_listing_week_price w join geck_data.market_listings m on m.id=w.listing_id
      where m.species in ('crested','unknown') and not m.is_group_lot
        and m.cached_traits ilike '%' || c.a || '%' and m.cached_traits ilike '%' || c.b || '%'
        and w.week_start >= date_trunc('week',timezone('UTC',now())-make_interval(days=>c.days))::date
      group by w.week_start
    ) r;
    if actual is distinct from expected then raise exception 'Weekly combo contract changed for %, %, %',c.a,c.b,c.days; end if;
  end loop;
end $test$;
rollback;
