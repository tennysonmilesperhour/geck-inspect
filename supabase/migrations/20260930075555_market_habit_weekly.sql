-- The market habit number (30 Sep 2026).
--
-- The goal of the Market page work is a habit: members who open something
-- market-related on at least two different days a week. Per week (Monday
-- to Sunday, Denver time) this counts the signed-in members who did
-- anything in Geck Inspect or on the Geck Data site, how many of them
-- opened a market surface on at least one day, and how many on two or
-- more days.
--
-- Market surfaces: the Market page (every tab), the market lines on the
-- Today card, Guess the Price, Market Pricing, the Portfolio, and any
-- signed-in visit to the Geck Data site. Admins only.

create or replace function public.market_habit_weekly(p_weeks integer default 8)
returns table (
  week_start date,
  active_members bigint,
  market_members bigint,
  habit_members bigint,
  habit_share numeric
)
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_weeks integer := least(greatest(coalesce(p_weeks, 8), 1), 52);
  v_this_week date := (date_trunc('week', (now() at time zone 'America/Denver')))::date;
  v_first date := v_this_week - 7 * (v_weeks - 1);
  v_since timestamptz := v_first::timestamp at time zone 'America/Denver';
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  return query
  with events as (
    select lower(e.user_email) as email,
           (e.created_date at time zone 'America/Denver')::date as event_day,
           (e.event_name in ('market_view', 'market_today_click', 'price_game_guess',
                             'price_game_complete', 'price_game_share')
            or (e.event_name = 'page_view'
                and coalesce(e.page, e.properties ->> 'page') in ('Market', 'MarketPricing', 'Portfolio'))) as is_market
    from public.user_events e
    where e.created_date >= v_since
      and e.user_email is not null
      and e.user_email <> 'guest@local'
    union all
    select lower(g.user_email), (g.created_date at time zone 'America/Denver')::date, true
    from geck_data.user_events g
    where g.created_date >= v_since
      and g.user_email is not null
  ),
  per_member as (
    select (date_trunc('week', ev.event_day::timestamp))::date as wk,
           ev.email,
           count(distinct ev.event_day) filter (where ev.is_market) as market_days
    from events ev
    group by 1, 2
  ),
  weeks as (
    select gs::date as wk
    from generate_series(v_first::timestamp, v_this_week::timestamp, interval '7 days') gs
  )
  select w.wk,
         count(pm.email),
         count(pm.email) filter (where pm.market_days >= 1),
         count(pm.email) filter (where pm.market_days >= 2),
         round(count(pm.email) filter (where pm.market_days >= 2)::numeric
               / nullif(count(pm.email), 0), 3)
  from weeks w
  left join per_member pm on pm.wk = w.wk
  group by w.wk
  order by w.wk desc;
end;
$$;

revoke all on function public.market_habit_weekly(integer) from public, anon;
grant execute on function public.market_habit_weekly(integer) to authenticated;
