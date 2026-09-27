-- Run by hand on 27 Sep 2026 (VIP audit, docs/planning/vip-audit-2026-09-27.md).

-- 1. Navigation focus: "Train Model" had one signed-in visitor in 90 days and
--    is admin work. Hidden from the sidebar; the URL still works.
update public.page_config set is_enabled = false, updated_date = now()
 where page_name = 'Training' and is_enabled is true;

-- 2. Card weights: the gecko detail view's "Add weight" saved the weigh-in but
--    never updated geckos.weight_grams, so 18 cards showed an older weight than
--    the chart. The code is fixed in GeckoDetailModal.jsx; this realigns the
--    existing rows with each gecko's latest weigh-in.
with latest as (
  select distinct on (gecko_id) gecko_id, weight_grams
    from public.weight_records
   order by gecko_id, record_date desc, created_date desc
)
update public.geckos g
   set weight_grams = l.weight_grams
  from latest l
 where l.gecko_id = g.id
   and g.weight_grams is not null
   and abs(g.weight_grams - l.weight_grams) > 0.5;
