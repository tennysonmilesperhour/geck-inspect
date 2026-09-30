-- Market watchlist alerts after each scrape, and the market lines on the
-- Today card and in the Sunday digest (30 Sep 2026).
--
-- Watchlists: geck_data.alerts already holds "tell me when a Lilly White is
-- listed under $400" style alerts (the Geck Data site's Alert me buttons),
-- but they were only matched against events from the browser extension,
-- which has been silent since May, and only delivered to Discord or a
-- webhook. geck_data.match_alerts() now runs after every scrape (inside
-- geck_data.after_scrape), matches new listings and price cuts, records
-- each match once in alert_matches, and sends one 'market_alert'
-- notification per member per run through the normal notifications
-- pipeline (bell, email, push, each by the member's own settings).
--
-- Geck Inspect members manage their watchlist through the market_watch_*
-- functions below. Each alert keeps the query shape the Geck Data site
-- already writes (trait_all, min_price, max_price, seller_ids,
-- must_be_drop) plus an optional sex.
--
-- Notification types: 'market_alert' (a watchlist match) and
-- 'market_brief' (the daily brief, sent only to members who switch it on
-- with profiles.market_brief_enabled). Both are on by default in the email
-- and push type lists, so they follow the member's master switches.

-- 1. Titles for the two new types.
create or replace function public.notify_dispatch_on_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
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
    when 'weighin_reminder'       then 'Weigh-in reminder'
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
    when 'referral_reward'        then 'Your referral paid off'
    when 'referral_grant_ended'   then 'Your free month of Keeper has ended'
    when 'weekly_digest'          then 'Your week on Geck Inspect'
    when 'waitlist_signup'        then 'New waitlist signup'
    when 'market_alert'           then 'Watchlist match'
    when 'market_brief'           then 'Your crested gecko market today'
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
$function$;

-- 2. Preferences. The send-email and send-push functions use a type's own
--    name when it has no alias, so adding the names to the lists is enough.
alter table public.profiles
  add column if not exists market_brief_enabled boolean not null default false;

alter table public.profiles
  alter column email_notification_types set default array[
    'level_up', 'expert_status', 'new_message', 'new_follower', 'following_activity',
    'gecko_of_day', 'forum_replies', 'breeding_updates', 'announcements',
    'market_alert', 'market_brief'
  ]::text[];

alter table public.profiles
  alter column push_notification_types set default array[
    'new_message', 'marketplace_inquiry', 'hatch_alert', 'feeding_due',
    'new_comment', 'new_reply', 'announcement', 'market_alert', 'market_brief'
  ]::text[];

update public.profiles
   set email_notification_types = email_notification_types || array['market_alert']::text[]
 where email_notification_types is not null
   and not ('market_alert' = any (email_notification_types));
update public.profiles
   set email_notification_types = email_notification_types || array['market_brief']::text[]
 where email_notification_types is not null
   and not ('market_brief' = any (email_notification_types));
update public.profiles
   set push_notification_types = push_notification_types || array['market_alert']::text[]
 where push_notification_types is not null
   and not ('market_alert' = any (push_notification_types));
update public.profiles
   set push_notification_types = push_notification_types || array['market_brief']::text[]
 where push_notification_types is not null
   and not ('market_brief' = any (push_notification_types));

-- 3. Matching.
create table if not exists geck_data.alert_matcher_state (
  id smallint primary key default 1 check (id = 1),
  last_run_at timestamptz not null
);

alter table geck_data.alert_matcher_state enable row level security;
revoke all on geck_data.alert_matcher_state from anon, authenticated;
grant select, insert, update on geck_data.alert_matcher_state to service_role;

-- A listing matches an alert once per trigger and price, so overlapping
-- runs never send the same match twice.
create unique index if not exists alert_matches_once
  on geck_data.alert_matches (alert_id, listing_id, (payload ->> 'trigger'), (payload ->> 'price'))
  where listing_id is not null;

create or replace function geck_data._num(p text)
returns numeric
language sql
immutable
set search_path to ''
as $$
  select case when p ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' then trim(p)::numeric end;
$$;

create or replace function geck_data._trait_token(p text)
returns text
language sql
immutable
set search_path to ''
as $$
  select regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]+', '', 'g');
$$;

create or replace function geck_data.match_alerts()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_state timestamptz;
  -- Look back 6 hours past the last run and stop 5 minutes short of now:
  -- a listing written while the market views were refreshing is caught
  -- on the next run, and the unique index drops repeats.
  v_from timestamptz;
  v_to timestamptz := now() - interval '5 minutes';
  v_catchup boolean;
  v_matches integer := 0;
  v_notified integer := 0;
begin
  select s.last_run_at into v_state
    from geck_data.alert_matcher_state s where s.id = 1 for update;
  if v_state is null then
    -- First run: start from now instead of matching months of history.
    insert into geck_data.alert_matcher_state (id, last_run_at) values (1, now())
    on conflict (id) do update set last_run_at = excluded.last_run_at;
    return jsonb_build_object('matches', 0, 'first_run', true);
  end if;
  v_from := v_state - interval '6 hours';

  -- After an outage the first full walk finds weeks of listings at once.
  -- Those are not news, so new-listing matches wait for a normal day.
  select d.after_gap into v_catchup
    from geck_data.market_daily d
   where d.market = 'US' and d.trait = '' and d.day = (now() at time zone 'UTC')::date;

  with new_listings as (
    select l.listing_id, 'new'::text as trigger, l.price, null::numeric as was_price
    from geck_data.listing_market_mv l
    join geck_data.listing_facts_mv f using (listing_id)
    where l.first_seen_at > v_from and l.first_seen_at <= v_to
      and not coalesce(v_catchup, false)
      and (f.first_listed_at is null or f.first_listed_at >= l.first_seen_at - interval '3 days')
  ),
  recent_ids as (
    select distinct h.listing_id
    from geck_data.price_history h
    where h.observed_at > v_from and h.observed_at <= v_to and h.currency = 'USD'
  ),
  cuts as (
    select regexp_replace(x.listing_id, '^mm_', '') as listing_id, 'cut'::text as trigger,
           x.price, x.prev as was_price
    from (
      select h.listing_id, h.observed_at, h.price,
             lag(h.price) over (partition by h.listing_id order by h.observed_at) as prev
      from geck_data.price_history h
      join recent_ids ri using (listing_id)
      where h.currency = 'USD'
    ) x
    where x.observed_at > v_from and x.observed_at <= v_to
      and x.prev is not null and x.price < x.prev
  ),
  events as (
    select * from new_listings
    union all
    select * from cuts
  ),
  candidates as (
    select e.listing_id, e.trigger, e.price, e.was_price,
           l.name as title, l.seller_slug, l.sex_class, l.age_class, l.position,
           f.morphs,
           array(
             select geck_data._trait_token(t)
             from unnest(coalesce(l.trait_array, '{}'::text[]) || f.morphs) t
           ) as tokens
    from events e
    join geck_data.listing_market_mv l using (listing_id)
    join geck_data.listing_facts_mv f using (listing_id)
    where l.for_sale and not l.is_lot and l.currency = 'USD'
      and exists (select 1 from geck_data.market_listings ml where ml.id = 'mm_' || l.listing_id)
  ),
  hits as (
    select a.id as alert_id, a.owner_id, a.name as alert_name, c.*
    from geck_data.alerts a
    join candidates c on true
    where a.active
      and a.owner_id is not null
      and coalesce(a.query ->> 'species', 'crested') in ('crested', 'unknown', 'any')
      and (not coalesce((a.query ->> 'must_be_drop')::boolean, false) or c.trigger = 'cut')
      and (jsonb_typeof(a.query -> 'trait_all') is distinct from 'array' or not exists (
            select 1 from jsonb_array_elements_text(a.query -> 'trait_all') t(v)
            where geck_data._trait_token(t.v) <> ''
              and not (geck_data._trait_token(t.v) = any (c.tokens))))
      and (jsonb_typeof(a.query -> 'trait_any') is distinct from 'array'
           or jsonb_array_length(a.query -> 'trait_any') = 0
           or exists (
            select 1 from jsonb_array_elements_text(a.query -> 'trait_any') t(v)
            where geck_data._trait_token(t.v) = any (c.tokens)))
      and (geck_data._num(a.query ->> 'min_price') is null or c.price >= geck_data._num(a.query ->> 'min_price'))
      and (geck_data._num(a.query ->> 'max_price') is null or c.price <= geck_data._num(a.query ->> 'max_price'))
      and (jsonb_typeof(a.query -> 'seller_ids') is distinct from 'array'
           or jsonb_array_length(a.query -> 'seller_ids') = 0
           or c.seller_slug in (select jsonb_array_elements_text(a.query -> 'seller_ids')))
      and (jsonb_typeof(a.query -> 'regions') is distinct from 'array'
           or jsonb_array_length(a.query -> 'regions') = 0
           or 'US' in (select jsonb_array_elements_text(a.query -> 'regions')))
      and (coalesce(a.query ->> 'sex', '') = '' or c.sex_class = a.query ->> 'sex')
  ),
  -- Record each match once; only rows inserted now go on to a notification.
  ins as (
    insert into geck_data.alert_matches (alert_id, listing_id, matched_at, payload)
    select h.alert_id, 'mm_' || h.listing_id, now(),
           jsonb_build_object(
             'trigger', h.trigger,
             'price', h.price,
             'was_price', h.was_price,
             'position', h.position,
             'source', 'after_scrape'
           )
    from hits h
    on conflict do nothing
    returning alert_id, listing_id, payload
  ),
  fresh as (
    select h.*
    from ins
    join hits h
      on h.alert_id = ins.alert_id
     and 'mm_' || h.listing_id = ins.listing_id
     and h.trigger = ins.payload ->> 'trigger'
     and h.price = (ins.payload ->> 'price')::numeric
  ),
  per_member as (
    select lower(u.email) as email,
           count(*) as n,
           jsonb_agg(jsonb_build_object(
             'alert', f.alert_name,
             'listing_id', f.listing_id,
             'trigger', f.trigger,
             'price', f.price,
             'was_price', f.was_price,
             'title', f.title,
             'morphs', to_jsonb(f.morphs),
             'position', f.position
           ) order by (f.trigger = 'cut') desc, f.price) as items,
           array_agg(
             concat_ws(', ',
               coalesce(nullif(array_to_string(f.morphs, ' '), ''), nullif(f.title, ''), 'Crested gecko'),
               nullif(concat_ws(' ', initcap(nullif(f.sex_class, 'unsexed')), f.age_class), ''),
               '$' || to_char(f.price, 'FM999,999') ||
                 case when f.trigger = 'cut' and f.was_price is not null
                      then ' (cut from $' || to_char(f.was_price, 'FM999,999') || ')' else '' end,
               case when f.position = 'low' then 'low for its kind' end
             )
             order by (f.trigger = 'cut') desc, f.price
           ) as lines
    from fresh f
    join auth.users u on u.id = f.owner_id
    where u.email is not null
    group by lower(u.email)
  ),
  notified as (
    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    select pm.email, 'market_alert',
           left(case
             when pm.n = 1 then 'On your watchlist: ' || pm.lines[1] || '.'
             when pm.n = 2 then '2 listings match your watchlist: ' || pm.lines[1] || '; ' || pm.lines[2] || '.'
             else pm.n || ' listings match your watchlist, including ' || pm.lines[1] || '; ' || pm.lines[2] || '.'
           end, 480),
           '/Market?tab=watchlist',
           jsonb_build_object('count', pm.n, 'matches', pm.items, 'source', 'after_scrape'),
           false, pm.email
    from per_member pm
    returning 1
  )
  select (select count(*) from fresh), (select count(*) from notified)
    into v_matches, v_notified;

  update geck_data.alert_matcher_state set last_run_at = v_to where id = 1;
  return jsonb_build_object('matches', v_matches, 'notified', v_notified, 'catchup', coalesce(v_catchup, false));
end;
$$;

revoke all on function geck_data.match_alerts() from public, anon, authenticated;
grant execute on function geck_data.match_alerts() to service_role;

-- 4. after_scrape runs the matcher after the snapshot.
create or replace function geck_data.after_scrape(p_trigger text default 'manual')
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_run bigint;
  v_today date := (now() at time zone 'UTC')::date;
  v_rows integer;
  v_result jsonb;
begin
  -- One run at a time; a second caller waits for the first to finish.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('geck_data.after_scrape'));

  insert into geck_data.after_scrape_runs (trigger) values (left(coalesce(p_trigger, 'manual'), 40))
  returning id into v_run;

  perform geck_data.refresh_market_matviews();

  -- A failed snapshot must not undo the refresh the site depends on, so
  -- it runs in its own block and reports the error instead.
  begin
    -- A scrape that runs past midnight UTC still belongs to the day it
    -- started, so yesterday is rebuilt during the first hours of a day.
    if extract(hour from now() at time zone 'UTC') < 6 then
      perform geck_data.snapshot_market_day(v_today - 1);
    end if;
    v_rows := geck_data.snapshot_market_day(v_today);
    v_result := jsonb_build_object('snapshot_rows', v_rows);
  exception when others then
    v_result := jsonb_build_object('snapshot_error', sqlerrm);
  end;

  begin
    v_result := v_result || jsonb_build_object('alerts', geck_data.match_alerts());
  exception when others then
    v_result := v_result || jsonb_build_object('alerts_error', sqlerrm);
  end;

  if p_trigger = 'requested' then
    begin
      perform public.request_market_value_snapshot();
      v_result := v_result || jsonb_build_object('value_snapshot', 'requested');
    exception when others then
      v_result := v_result || jsonb_build_object('value_snapshot_error', sqlerrm);
    end;
  end if;

  update geck_data.after_scrape_runs
     set finished_at = now(), result = v_result
   where id = v_run;
  return v_result;
end;
$$;

revoke all on function geck_data.after_scrape(text) from public, anon, authenticated;
grant execute on function geck_data.after_scrape(text) to service_role;

-- 5. Watchlist functions for signed-in members. Each alert belongs to the
--    caller (auth.uid()); a member keeps at most 25.
create or replace function public.market_watch_list()
returns table (
  id uuid, name text, query jsonb, active boolean, created_at timestamptz,
  matches_7d bigint, last_match_at timestamptz
)
language sql
stable
security definer
set search_path to ''
as $$
  select a.id, a.name, a.query, a.active, a.created_at,
         (select count(*) from geck_data.alert_matches m
           where m.alert_id = a.id and m.matched_at > now() - interval '7 days'),
         (select max(m.matched_at) from geck_data.alert_matches m where m.alert_id = a.id)
  from geck_data.alerts a
  where a.owner_id = auth.uid()
  order by a.created_at desc;
$$;

create or replace function public.market_watch_save(
  p_id uuid default null,
  p_traits text[] default null,
  p_max_price numeric default null,
  p_min_price numeric default null,
  p_sex text default null,
  p_cuts_only boolean default false,
  p_seller_slug text default null,
  p_name text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid := auth.uid();
  v_traits text[];
  v_query jsonb;
  v_name text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Sign in to keep a watchlist' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct left(trim(t), 60)) filter (where trim(t) <> ''), '{}')
    into v_traits
    from unnest(coalesce(p_traits, '{}'::text[])) t;
  if cardinality(v_traits) > 6 then
    raise exception 'Pick up to 6 morphs' using errcode = '22023';
  end if;
  if p_max_price is not null and (p_max_price <= 0 or p_max_price > 100000) then
    raise exception 'Max price must be between $1 and $100,000' using errcode = '22023';
  end if;
  if p_min_price is not null and (p_min_price < 0 or p_min_price > 100000) then
    raise exception 'Min price must be between $0 and $100,000' using errcode = '22023';
  end if;
  if p_sex is not null and p_sex not in ('male', 'female', 'unsexed') then
    raise exception 'Sex must be male, female or unsexed' using errcode = '22023';
  end if;
  if cardinality(v_traits) = 0 and nullif(trim(coalesce(p_seller_slug, '')), '') is null
     and p_max_price is null then
    raise exception 'Pick a morph, a breeder or a price' using errcode = '22023';
  end if;

  v_query := jsonb_strip_nulls(jsonb_build_object(
    'species', 'crested',
    'trait_all', case when cardinality(v_traits) > 0 then to_jsonb(v_traits) end,
    'max_price', p_max_price,
    'min_price', p_min_price,
    'sex', p_sex,
    'must_be_drop', case when p_cuts_only then true end,
    'seller_ids', case when nullif(trim(coalesce(p_seller_slug, '')), '') is not null
                       then jsonb_build_array(trim(p_seller_slug)) end
  ));

  v_name := left(coalesce(nullif(trim(p_name), ''), concat_ws(' ',
    coalesce(nullif(array_to_string(v_traits, ' + '), ''), 'Any crested gecko'),
    case when p_sex is not null then '(' || p_sex || ')' end,
    case when p_max_price is not null then 'under $' || to_char(p_max_price, 'FM999,999') end,
    case when p_cuts_only then 'price cuts' end
  )), 120);

  if p_id is null then
    if (select count(*) from geck_data.alerts a where a.owner_id = v_uid) >= 25 then
      raise exception 'A watchlist holds up to 25 alerts' using errcode = '22023';
    end if;
    insert into geck_data.alerts (owner_id, name, query, active)
    values (v_uid, v_name, v_query, true)
    returning id into v_id;
  else
    update geck_data.alerts a
       set name = v_name, query = v_query
     where a.id = p_id and a.owner_id = v_uid
    returning a.id into v_id;
    if v_id is null then
      raise exception 'Alert not found' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.market_watch_set_active(p_id uuid, p_active boolean)
returns void
language sql
security definer
set search_path to ''
as $$
  update geck_data.alerts a set active = coalesce(p_active, a.active)
   where a.id = p_id and a.owner_id = auth.uid();
$$;

create or replace function public.market_watch_remove(p_id uuid)
returns void
language sql
security definer
set search_path to ''
as $$
  delete from geck_data.alerts a where a.id = p_id and a.owner_id = auth.uid();
$$;

create or replace function public.market_watch_matches(p_limit integer default 30)
returns table (
  match_id uuid, alert_id uuid, alert_name text, matched_at timestamptz,
  trigger text, price numeric, was_price numeric,
  listing_id text, title text, morphs text[], sex_class text, age_class text,
  weight_grams numeric, price_position text, similar_p25 numeric, similar_p50 numeric,
  similar_p75 numeric, image_url text, listing_url text, for_sale boolean
)
language sql
stable
security definer
set search_path to ''
as $$
  select m.id, a.id, a.name, m.matched_at,
         m.payload ->> 'trigger', (m.payload ->> 'price')::numeric, (m.payload ->> 'was_price')::numeric,
         l.listing_id, l.name, f.morphs, l.sex_class, l.age_class, l.weight_grams,
         l.position, l.similar_p25, l.similar_p50, l.similar_p75,
         l.primary_image_url, l.listing_url, l.for_sale
  from geck_data.alert_matches m
  join geck_data.alerts a on a.id = m.alert_id
  left join geck_data.listing_market_mv l on l.listing_id = regexp_replace(m.listing_id, '^mm_', '')
  left join geck_data.listing_facts_mv f on f.listing_id = l.listing_id
  where a.owner_id = auth.uid()
  order by m.matched_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

revoke all on function public.market_watch_list() from public, anon;
revoke all on function public.market_watch_save(uuid, text[], numeric, numeric, text, boolean, text, text) from public, anon;
revoke all on function public.market_watch_set_active(uuid, boolean) from public, anon;
revoke all on function public.market_watch_remove(uuid) from public, anon;
revoke all on function public.market_watch_matches(integer) from public, anon;
grant execute on function public.market_watch_list() to authenticated;
grant execute on function public.market_watch_save(uuid, text[], numeric, numeric, text, boolean, text, text) to authenticated;
grant execute on function public.market_watch_set_active(uuid, boolean) to authenticated;
grant execute on function public.market_watch_remove(uuid) to authenticated;
grant execute on function public.market_watch_matches(integer) to authenticated;

-- 6. The member's market at a glance, for the Today card.
create or replace function public.my_market_today()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  v_uid uuid := auth.uid();
  v_value jsonb;
  v_market jsonb;
  v_watch jsonb;
  v_morphs jsonb;
begin
  if v_email = '' or v_uid is null then
    return null;
  end if;

  select jsonb_build_object(
           'day', d.day, 'geckos', d.geckos, 'priced', d.priced,
           'value', d.value, 'value_low', d.value_low, 'value_high', d.value_high,
           'value_7d', w.value, 'day_7d', w.day,
           'value_30d', m.value, 'day_30d', m.day)
    into v_value
    from public.market_value_daily d
    left join lateral (
      select p.value, p.day from public.market_value_daily p
       where p.user_email = v_email and p.day <= d.day - 7
       order by p.day desc limit 1) w on true
    left join lateral (
      select p.value, p.day from public.market_value_daily p
       where p.user_email = v_email and p.day <= d.day - 30
       order by p.day desc limit 1) m on true
   where d.user_email = v_email
   order by d.day desc
   limit 1;

  select jsonb_build_object(
           'last_check_day', max(d.day) filter (where d.checked > 0),
           'last_full_day', max(d.day) filter (where d.full_check),
           'fresh', coalesce(max(d.day) filter (where d.checked > 0) >= (now() at time zone 'UTC')::date - 2, false))
    into v_market
    from geck_data.market_daily d
   where d.market = 'US' and d.trait = '';

  select jsonb_build_object(
           'alerts', (select count(*) from geck_data.alerts a where a.owner_id = v_uid and a.active),
           'matches_24h', (select count(*) from geck_data.alert_matches m
                             join geck_data.alerts a on a.id = m.alert_id
                            where a.owner_id = v_uid and m.matched_at > now() - interval '24 hours'),
           'matches_7d', (select count(*) from geck_data.alert_matches m
                            join geck_data.alerts a on a.id = m.alert_id
                           where a.owner_id = v_uid and m.matched_at > now() - interval '7 days'))
    into v_watch;

  -- The member's morphs, strongest value first, with the latest full-check
  -- middle asking price and the one about 30 days before it.
  with mine as (
    select mp.canon as trait, sum((x ->> 'value')::numeric) as held_value, count(*) as held
    from public.market_value_daily d
    cross join lateral jsonb_array_elements(d.details) x
    join geck_data.morph_term_map mp on mp.term = lower(x ->> 'trait')
    where d.user_email = v_email
      and d.day = (select max(d2.day) from public.market_value_daily d2 where d2.user_email = v_email)
    group by mp.canon
  ),
  latest as (
    select distinct on (md.trait) md.trait, md.day, md.p50, md.for_sale
    from geck_data.market_daily md
    join mine on mine.trait = md.trait
    where md.market = 'US' and md.full_check and md.p50 is not null
    order by md.trait, md.day desc
  ),
  earlier as (
    select distinct on (md.trait) md.trait, md.day, md.p50
    from geck_data.market_daily md
    join latest l on l.trait = md.trait
    where md.market = 'US' and md.full_check and md.p50 is not null
      and md.day <= l.day - 21
    order by md.trait, md.day desc
  ),
  news as (
    select md.trait, sum(md.new_listings) as new_7d
    from geck_data.market_daily md
    join mine on mine.trait = md.trait
    where md.market = 'US' and md.day > (now() at time zone 'UTC')::date - 7
    group by md.trait
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'trait', mine.trait, 'held', mine.held,
           'p50', l.p50, 'day', l.day, 'for_sale', l.for_sale,
           'p50_before', e.p50, 'day_before', e.day,
           'new_7d', n.new_7d)
         order by mine.held_value desc), '[]'::jsonb)
    into v_morphs
    from mine
    left join latest l on l.trait = mine.trait
    left join earlier e on e.trait = mine.trait
    left join news n on n.trait = mine.trait;

  return jsonb_build_object(
    'value', v_value,
    'market', v_market,
    'watch', v_watch,
    'morphs', v_morphs
  );
end;
$$;

revoke all on function public.my_market_today() from public, anon;
grant execute on function public.my_market_today() to authenticated;

-- 7. The Sunday digest gains a market sentence: the market value of the
--    member's crested geckos and how it moved in a week, and how many
--    watchlist matches the week brought.
create or replace function public.enqueue_weekly_digest()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count integer := 0;
  v_uploads integer;
  v_posts integer;
  v_parts text[];
  v_content text;
  v_value record;
  v_week_ago numeric;
  v_matches integer;
  v_market text;
begin
  select count(*) into v_uploads
    from public.gecko_images
   where created_by is not null
     and created_date > now() - interval '7 days';
  select count(*) into v_posts
    from public.forum_posts
   where created_date > now() - interval '7 days';

  for r in
    select g.created_by as email,
           count(*) as geckos,
           coalesce(e.incubating, 0) as incubating,
           coalesce(e.due_soon, 0) as due_soon,
           coalesce(w.stale, 0) as stale
      from public.geckos g
      left join lateral (
        select count(*) filter (where eg.status = 'Incubating' and coalesce(eg.archived, false) = false) as incubating,
               count(*) filter (where eg.status = 'Incubating' and coalesce(eg.archived, false) = false
                                  and eg.hatch_date_expected between current_date and current_date + 7) as due_soon
          from public.eggs eg
         where eg.created_by = g.created_by
      ) e on true
      left join lateral (
        select count(*) as stale
          from public.geckos g2
          join lateral (
            select max(wr.record_date) as last_weighed
              from public.weight_records wr
             where wr.gecko_id = g2.id
          ) lw on true
         where g2.created_by = g.created_by
           and coalesce(g2.archived, false) = false
           and coalesce(g2.status, '') not in ('Sold')
           and lw.last_weighed is not null
           and lw.last_weighed < current_date - 30
      ) w on true
     where coalesce(g.archived, false) = false
       and g.created_by is not null
       and coalesce(g.status, '') not in ('Sold')
       and not exists (
         select 1 from public.notifications n
          where n.user_email = g.created_by
            and n.type = 'weekly_digest'
            and n.created_date > now() - interval '6 days'
       )
     group by g.created_by, e.incubating, e.due_soon, w.stale
  loop
    v_parts := array[
      format('%s %s in your collection', r.geckos, case when r.geckos = 1 then 'crested gecko' else 'crested geckos' end)
    ];
    if r.incubating > 0 then
      v_parts := v_parts || format('%s %s incubating%s',
        r.incubating,
        case when r.incubating = 1 then 'egg' else 'eggs' end,
        case when r.due_soon > 0
             then format(' (%s due to hatch this week)', r.due_soon)
             else '' end);
    end if;
    if r.stale > 0 then
      v_parts := v_parts || format('%s not weighed in over 30 days', r.stale);
    end if;

    v_content := 'Your week on Geck Inspect: ' || array_to_string(v_parts, ', ') || '.';

    -- Market value of the member's crested geckos, and the change since a
    -- week ago when both days were valued.
    v_market := null;
    v_week_ago := null;
    select d.value, d.value_low, d.value_high, d.priced, d.day
      into v_value
      from public.market_value_daily d
     where d.user_email = lower(r.email)
     order by d.day desc
     limit 1;
    if v_value.priced is not null and v_value.priced > 0
       and v_value.day >= current_date - 2 then
      select p.value into v_week_ago
        from public.market_value_daily p
       where p.user_email = lower(r.email)
         and p.day <= v_value.day - 7
       order by p.day desc
       limit 1;
      v_market := format('Your crested geckos are worth about $%s to $%s at current asking prices',
        to_char(v_value.value_low, 'FM999,999'), to_char(v_value.value_high, 'FM999,999'));
      if v_week_ago is not null and v_week_ago > 0 and v_value.value <> v_week_ago then
        v_market := v_market || format(', %s %s%% from last week',
          case when v_value.value > v_week_ago then 'up' else 'down' end,
          round(abs(v_value.value - v_week_ago) / v_week_ago * 100, 1));
      end if;
      v_market := v_market || '.';
    end if;

    select count(*) into v_matches
      from geck_data.alert_matches m
      join geck_data.alerts a on a.id = m.alert_id
      join auth.users u on u.id = a.owner_id
     where lower(u.email) = lower(r.email)
       and m.matched_at > now() - interval '7 days';
    if v_matches > 0 then
      v_market := concat_ws(' ', v_market, format('%s %s matched your watchlist this week.',
        v_matches, case when v_matches = 1 then 'listing' else 'listings' end));
    end if;

    if v_market is not null then
      v_content := v_content || ' ' || v_market;
    end if;

    if v_uploads > 0 or v_posts > 0 then
      v_content := v_content || format(' The community added %s %s and %s %s this week.',
        v_uploads, case when v_uploads = 1 then 'photo' else 'photos' end,
        v_posts, case when v_posts = 1 then 'forum post' else 'forum posts' end);
    end if;

    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.email, 'weekly_digest', v_content, '/Dashboard',
      jsonb_build_object(
        'geckos', r.geckos, 'incubating', r.incubating, 'due_soon', r.due_soon,
        'stale_weighins', r.stale, 'community_uploads', v_uploads, 'community_posts', v_posts,
        'market_value', v_value.value, 'market_value_week_ago', v_week_ago,
        'watchlist_matches', v_matches,
        'source', 'cron'
      ),
      false, r.email
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.enqueue_weekly_digest() from public, anon, authenticated;
