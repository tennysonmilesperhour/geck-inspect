-- =============================================================================
-- Food consumption tracking + reorder reminder
-- =============================================================================
-- Adds the columns and helper function that power the "your CGD runs
-- out around <date>" widget on the cart and the daily-cron-driven
-- reorder reminder notification.
--
-- The estimate is intentionally simple: total grams purchased minus
-- daily consumption (gecko_count * grams_per_gecko_per_week / 7) since
-- the last food order. We calibrate the per-gecko weekly rate by
-- comparing the user's actual time between food orders to what the
-- naive estimate predicted; the calibrated rate lives in the profile
-- so subsequent estimates honor what we've learned about this keeper.
-- =============================================================================

alter table public.store_products
  add column if not exists is_consumable_food boolean not null default false,
  add column if not exists food_grams_per_gecko_per_week numeric(8,2),
  add column if not exists food_quantity_grams integer,
  add column if not exists food_brand_canonical text;

create index if not exists store_products_food_idx
  on public.store_products(is_consumable_food)
  where is_consumable_food;

comment on column public.store_products.is_consumable_food is
  'True for CGD / food products. Drives the reorder-runout estimate and reminder notification.';
comment on column public.store_products.food_grams_per_gecko_per_week is
  'Default consumption rate. Calibrated per-user by comparing actual reorder cadence; this value is the new-user baseline.';
comment on column public.store_products.food_quantity_grams is
  'Net weight of one unit of this product. Used to convert qty=2 of a 57g bag into 114g for the runout math.';
comment on column public.store_products.food_brand_canonical is
  'Canonical brand-name slug (e.g. ''pangea_cgd'') so different SKUs of the same brand share a consumption pool. Empty falls back to vendor_id.';

-- Backfill the seeded Pangea / Repashy CGD rows so the estimate has
-- something to work with as soon as the catalog goes live.
-- 8oz Pangea ~= 227g; per-gecko per-week ~10g is a sane baseline
-- (most keepers feed 2-3x/week with a few grams per visit).
update public.store_products
   set is_consumable_food = true,
       food_grams_per_gecko_per_week = 10,
       food_quantity_grams = 227,
       food_brand_canonical = 'pangea_cgd'
 where slug in ('aff-pangea-watermelon-mango', 'aff-pangea-with-insects');

update public.store_products
   set is_consumable_food = true,
       food_grams_per_gecko_per_week = 10,
       food_quantity_grams = 113,
       food_brand_canonical = 'repashy_cgd'
 where slug = 'aff-repashy-mrp';

-- =============================================================================
-- profiles.cgd_reorder_reminders_enabled
-- =============================================================================
alter table public.profiles
  add column if not exists cgd_reorder_reminders_enabled boolean not null default true,
  add column if not exists cgd_reorder_grams_per_gecko_per_week numeric(8,2),
  add column if not exists cgd_reorder_last_reminder_at timestamptz,
  add column if not exists cgd_reorder_last_estimated_runout_at timestamptz;

comment on column public.profiles.cgd_reorder_reminders_enabled is
  'When true, the daily reorder-check cron sends a notification ~14 days before estimated CGD runout. Toggle from Settings.';
comment on column public.profiles.cgd_reorder_grams_per_gecko_per_week is
  'Per-user calibrated consumption rate. NULL = use the product baseline; populated after we observe the user''s reorder cadence.';

-- =============================================================================
-- Estimate function
-- =============================================================================
-- Returns the calling user's most recent food-runout estimate. The
-- function is SECURITY DEFINER so it can join across orders, items,
-- products, and the user's gecko count even when RLS would otherwise
-- restrict cross-table joins for the auth role.
--
-- Input:  p_user_email defaults to the calling user's email.
-- Output: jsonb {
--   has_food_history: bool,
--   gecko_count: int,
--   grams_remaining: int,        -- naive: total_grams_paid - days_since_last * daily_consumption
--   daily_consumption_grams: float,
--   runs_out_at: timestamptz,
--   days_until_runout: int,
--   last_food_order_at: timestamptz,
--   last_food_grams_total: int
-- }
-- =============================================================================
create or replace function public.estimate_food_runout(p_user_email text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := coalesce(p_user_email, (auth.jwt() ->> 'email'));
  v_gecko_count int;
  v_last_order_at timestamptz;
  v_last_grams int := 0;
  v_calibrated numeric;
  v_per_gecko_per_week numeric := 10;  -- product-baseline fallback
  v_daily numeric;
  v_days_since_last int;
  v_grams_remaining int;
  v_runs_out_at timestamptz;
begin
  if v_email is null then
    return jsonb_build_object('has_food_history', false, 'reason', 'no_user');
  end if;

  -- Gecko count for this keeper. Crested + others both count for food
  -- planning; if the schema changes shape we'll revisit.
  select count(*) into v_gecko_count
    from public.geckos g
   where g.created_by = v_email and (g.is_archived is not true);

  if coalesce(v_gecko_count, 0) = 0 then
    return jsonb_build_object('has_food_history', false, 'reason', 'no_geckos');
  end if;

  -- Aggregate the user's most recent food order: total grams_paid that
  -- contributed to the food pool, plus the order timestamp. We pick the
  -- single latest paid order so a single shipment date drives the math
  -- (mixed-cart orders count proportionally to the food line items).
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
    return jsonb_build_object(
      'has_food_history', false,
      'reason', 'no_food_orders',
      'gecko_count', v_gecko_count
    );
  end if;

  -- Calibration: average grams_per_gecko_per_week across the two most
  -- recent food orders, weighted by their gap. Falls back to product
  -- baseline if we only have one order.
  select cgd_reorder_grams_per_gecko_per_week into v_calibrated
    from public.profiles where email = v_email;
  if v_calibrated is not null and v_calibrated > 0 then
    v_per_gecko_per_week := v_calibrated;
  else
    -- Use the per-product baseline from this user's most recent food line.
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

grant execute on function public.estimate_food_runout(text) to authenticated;

comment on function public.estimate_food_runout(text) is
  'Returns the calling user''s estimated CGD runout based on their gecko count, last food order, and (if available) their calibrated per-gecko consumption rate. Drives the cart widget and the reorder-reminder cron.';

-- =============================================================================
-- Reorder reminder cron
-- =============================================================================
-- Daily scan: for every user with cgd_reorder_reminders_enabled, food
-- order history, and a runout date 14 days out, insert a notification.
-- Idempotent on cgd_reorder_last_estimated_runout_at — once we've
-- alerted for a given runout estimate, we don't alert again until the
-- next reorder shifts the estimate.
--
-- pg_cron: the schedule call is wrapped in a do-block so re-running this
-- migration doesn't error if the job already exists.
-- =============================================================================
create extension if not exists pg_cron with schema extensions;

create or replace function public.cgd_reorder_reminder_run()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_estimate jsonb;
  v_runs_out_at timestamptz;
  v_days_left int;
begin
  for r in
    select p.id, p.email
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
      -- Skip if we already alerted for this estimated runout date
      perform 1
        from public.profiles p2
       where p2.id = r.id
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
        jsonb_build_object(
          'days_left', v_days_left,
          'runs_out_at', v_runs_out_at,
          'gecko_count', v_estimate->'gecko_count'
        ),
        false
      );

      update public.profiles
         set cgd_reorder_last_reminder_at = now(),
             cgd_reorder_last_estimated_runout_at = v_runs_out_at
       where id = r.id;
    end if;
  end loop;
end;
$$;

comment on function public.cgd_reorder_reminder_run() is
  'Daily cron entry point: scans every user with reorder reminders enabled and inserts a notification when their estimated CGD runout is ~14 days out. Idempotent per estimated runout date.';

-- Schedule the daily run at 09:00 UTC. Wrapped in a do-block so
-- re-running this migration is safe.
do $cron$
begin
  perform extensions.cron.unschedule('cgd_reorder_reminder_daily');
exception when others then null;
end;
$cron$;

select extensions.cron.schedule(
  'cgd_reorder_reminder_daily',
  '0 9 * * *',
  $$ select public.cgd_reorder_reminder_run(); $$
);
