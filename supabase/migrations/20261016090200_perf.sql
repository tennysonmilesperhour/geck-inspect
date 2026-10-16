-- Newest weigh-ins per gecko, for My Geckos.
--
-- Why: My Geckos read every weight record the member had ever saved, then
-- worked out each card's latest weight in the browser. The API returns at
-- most 1,000 rows per request, newest first, so once a breeder passes
-- 1,000 weigh-ins the geckos whose last weigh-in is older than the
-- 1,000th newest record silently lose their weight, their weight sort and
-- their breeding-readiness check. (On 16 Oct 2026 the largest collection
-- had 293 records; a breeder weighing 100 geckos monthly passes 1,000 in
-- under a year.)
--
-- recent_weight_records(p_per_gecko) returns only the newest few records
-- of each gecko (default 8: the card needs the latest, the weight-trend
-- badge the last six), so the size of the answer follows the number of
-- geckos, not years of history. The app pages through it.
--
-- Safe with the app already open: this only adds a function and an
-- index. The new app falls back to the old read when the function is not
-- there yet (src/lib/recentWeights.js).
--
-- SECURITY INVOKER: it runs as the member, so the weight_records read
-- policies still decide what comes back, and it only asks for the
-- member's own records (created_by = their email), the same rows the old
-- read asked for.

create index if not exists weight_records_owner_gecko_date_idx
  on public.weight_records (created_by, gecko_id, record_date desc);

create or replace function public.recent_weight_records(p_per_gecko integer default 8)
returns setof public.weight_records
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select (ranked.r).*
  from (
    select wr as r,
           row_number() over (
             partition by wr.gecko_id
             order by wr.record_date desc, wr.created_date desc nulls last, wr.id desc
           ) as rn
    from public.weight_records wr
    where wr.created_by = auth.email()
  ) ranked
  where ranked.rn <= least(greatest(coalesce(p_per_gecko, 8), 1), 50)
  order by (ranked.r).gecko_id, (ranked.r).record_date desc, (ranked.r).id desc;
$$;

comment on function public.recent_weight_records(integer) is
  'The signed-in member''s newest p_per_gecko (1 to 50, default 8) weight records for each of their geckos. My Geckos uses it instead of reading every record (20261016090200_perf.sql).';

revoke all on function public.recent_weight_records(integer) from public, anon;
grant execute on function public.recent_weight_records(integer) to authenticated, service_role;
