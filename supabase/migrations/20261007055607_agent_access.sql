-- Agent access: an AI-traffic log and the open crested gecko price index.
--
-- 1. public.agent_hits records requests from AI crawlers, AI assistants and
--    other automation to the public reference pages and data files. The
--    Vercel routing middleware (middleware.js) calls log_agent_hit() for
--    requests whose user agent matches a known bot. The weekly agent review
--    reads it to see which bots read what. Nobody but the service role and
--    admins can read the rows; signed-out callers can only add one through
--    the function, which trims every field.
--
-- 2. public.open_price_index() returns aggregate asking prices (counts and
--    quartiles, never single listings) from geck_data.market_daily for the
--    public dataset at /data/price-index.json. Only full catalog checks
--    count, and a trait needs at least 5 listings to be shown.

create table if not exists public.agent_hits (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  agent text not null,
  kind text not null default 'unknown',
  path text not null,
  ua text
);

create index if not exists agent_hits_at_idx on public.agent_hits (at desc);
create index if not exists agent_hits_agent_at_idx on public.agent_hits (agent, at desc);

alter table public.agent_hits enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'agent_hits' and policyname = 'agent_hits_admin_read'
  ) then
    create policy agent_hits_admin_read on public.agent_hits
      for select to authenticated
      using (exists (
        select 1 from public.profiles p
        where p.email = (auth.jwt() ->> 'email') and p.role = 'admin'
      ));
  end if;
end $$;

create or replace function public.log_agent_hit(p_agent text, p_kind text, p_path text, p_ua text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.agent_hits (agent, kind, path, ua)
  select left(coalesce(nullif(trim(p_agent), ''), 'unknown'), 40),
         case when p_kind in ('training', 'search', 'assistant', 'seo', 'tool') then p_kind else 'unknown' end,
         left(coalesce(p_path, '/'), 300),
         left(p_ua, 300)
  where p_path is not null;
$$;

grant execute on function public.log_agent_hit(text, text, text, text) to anon, authenticated;

create or replace function public.open_price_index()
returns jsonb
language sql
stable
security definer
set search_path = public, geck_data
as $$
  with full_days as (
    select market, max(day) as last_day
    from geck_data.market_daily
    where full_check
    group by market
  ),
  latest as (
    select d.market, d.day, nullif(d.trait, '') as trait, d.for_sale, d.p25, d.p50, d.p75,
           d.new_listings, d.cuts
    from geck_data.market_daily d
    join full_days f on f.market = d.market and f.last_day = d.day
    where d.full_check and d.for_sale >= 5
  ),
  monthly as (
    select market,
           to_char(date_trunc('month', day), 'YYYY-MM') as month,
           nullif(trait, '') as trait,
           count(*) as full_checks,
           round(percentile_cont(0.5) within group (order by p50)::numeric) as median_p50,
           round(avg(for_sale)) as avg_for_sale
    from geck_data.market_daily
    where full_check and for_sale >= 5 and p50 is not null
    group by 1, 2, 3
  )
  select jsonb_build_object(
    'generated_at', now(),
    'latest', coalesce((
      select jsonb_agg(jsonb_build_object(
        'market', market, 'checked_on', day, 'trait', trait, 'listings', for_sale,
        'p25', p25, 'median', p50, 'p75', p75, 'new_listings', new_listings, 'price_cuts', cuts
      ) order by market, trait nulls first)
      from latest
    ), '[]'::jsonb),
    'monthly', coalesce((
      select jsonb_agg(jsonb_build_object(
        'market', market, 'month', month, 'trait', trait, 'full_checks', full_checks,
        'median', median_p50, 'avg_listings', avg_for_sale
      ) order by market, month, trait nulls first)
      from monthly
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.open_price_index() to anon, authenticated;
