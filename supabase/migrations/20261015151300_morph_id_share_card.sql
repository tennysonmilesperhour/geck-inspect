-- Morph ID share card and one free identification a month (plan item
-- E2 17, docs/planning/comprehensive-review-2026-10-14.md).
--
-- 1. Free gets one identification every calendar month (UTC), not one
--    ever. The review (B8) found Free had one lifetime try while the
--    closest competitor's identifier is free and unlimited, and asked for
--    "one free identification a month" so the share card has a steady
--    stream of results to share. Keeper 3, Breeder 6 and Enterprise 15 are
--    unchanged. Bonus grants (morph_id_bonus_credits) still sit on top and
--    are used only after the month's plan scan. The server ignores the
--    number the edge function passes for Free and uses 1, so the change
--    works before or after recognize-gecko-morph is redeployed.
--
-- 2. morph_id_shares: a result card the member chose to make public by
--    tapping Share. Private by default (nothing is shared until then), the
--    owner can delete it, anyone with the link can read that one card, and
--    nothing lists other members' cards. The card is copied on the server
--    from the stored Morph ID answer (morph_id_requests), never from the
--    browser, so a card cannot claim a result Morph ID did not give.
--
-- 3. Measurement. Card created, share page viewed (by a person, counted by
--    the share page server) and sign-up from a card each write one row to
--    public.user_events (morph_share_created, morph_share_viewed,
--    morph_share_signup) and bump a counter on the card.
--
-- Idempotent: safe to run twice.

-- ---------------------------------------------------------------------
-- 1. One free identification a month
-- ---------------------------------------------------------------------

create or replace function public.consume_morph_id_credit(p_user_id uuid, p_tier text, p_credits_included integer)
returns public.morph_id_usage
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  rec public.morph_id_usage%rowtype;
  mk text := public.month_key_now();
  v_free boolean := coalesce(p_tier, 'free') = 'free';
  -- Free is 1 a month whatever the caller passes (an edge function that
  -- has not been redeployed still sends 0). Paid plans pass their own.
  v_monthly integer := case
    when v_free then 1
    else greatest(coalesce(p_credits_included, 0), 0)
  end;
  v_bonus_left integer;
  v_existing_consumed integer := 0;
  v_existing_included integer := 0;
  v_existing_tier text := 'free';
  v_row_exists boolean := false;
  v_cap integer := 0;
begin
  if p_user_id is null then
    raise exception 'morph_id_credits_exhausted'
      using errcode = 'P0001';
  end if;

  v_bonus_left := public.morph_id_bonus_left(p_user_id);

  select u.credits_consumed, u.credits_included, u.tier_at_start
    into v_existing_consumed, v_existing_included, v_existing_tier
    from public.morph_id_usage u
   where u.user_id = p_user_id
     and u.month_key = mk;
  v_row_exists := found;

  if v_row_exists then
    v_cap := greatest(v_existing_included, v_monthly);
    -- First paid call after a free scan in the same month: the free scan
    -- does not count against the paid allowance (5 Oct 2026). Only for a
    -- paid caller: applied to a Free caller it would never run out.
    if not v_free and coalesce(v_existing_tier, 'free') = 'free' then
      v_cap := greatest(v_cap, v_monthly + v_existing_consumed);
    end if;
  else
    v_cap := v_monthly;
  end if;

  -- Room in this month's plan, or bonus scans still unused.
  if not (
    (v_row_exists and v_existing_consumed < v_cap)
    or (not v_row_exists and v_monthly > 0)
    or v_bonus_left > 0
  ) then
    raise exception 'morph_id_credits_exhausted'
      using errcode = 'P0001';
  end if;

  insert into public.morph_id_usage (
    user_id, month_key, tier_at_start, credits_included, credits_consumed
  )
  values (p_user_id, mk, p_tier, v_monthly, 1)
  on conflict (user_id, month_key) do update
    set tier_at_start = excluded.tier_at_start,
        credits_included = greatest(
          public.morph_id_usage.credits_included,
          excluded.credits_included
            + case
                when coalesce(public.morph_id_usage.tier_at_start, 'free') = 'free'
                     and coalesce(excluded.tier_at_start, 'free') <> 'free'
                then public.morph_id_usage.credits_consumed
                else 0
              end
        ),
        credits_consumed = public.morph_id_usage.credits_consumed + 1,
        updated_date = now()
    returning * into rec;

  -- Only a scan past the plan cap can overdraw the bonus (8 Oct 2026).
  if rec.credits_consumed > rec.credits_included
     and public.morph_id_bonus_overdrawn(p_user_id) then
    update public.morph_id_usage
      set credits_consumed = greatest(rec.credits_consumed - 1, 0),
          updated_date = now()
      where id = rec.id;
    raise exception 'morph_id_credits_exhausted'
      using errcode = 'P0001';
  end if;

  return rec;
end;
$function$;

revoke all on function public.consume_morph_id_credit(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.consume_morph_id_credit(uuid, text, integer) to service_role;

-- Scans the member can run right now: this month's plan scans still
-- unused, plus unused unexpired bonus. Free counts as a plan of 1 a month.
create or replace function public.morph_id_scans_remaining(
  p_user_id uuid default null,
  p_tier text default null,
  p_monthly integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_privileged boolean;
  v_uid uuid;
  v_tier text;
  v_free boolean;
  v_monthly integer;
  v_bonus integer;
  v_bonus_left integer;
  v_consumed integer;
  v_included integer;
  v_tier_at_start text;
  v_cap integer;
  v_monthly_left integer;
begin
  -- Same caller rule as the 8 Oct version: anon and authenticated may
  -- only read their own number; the service role and the SQL editor may
  -- look up anyone.
  v_privileged := coalesce(auth.role(), '') = 'service_role'
    or coalesce(nullif(current_setting('role', true), 'none'), session_user::text)
       not in ('anon', 'authenticated');

  if not v_privileged
     and p_user_id is not null
     and p_user_id is distinct from auth.uid() then
    raise exception 'morph_id_scans_remaining'
      using errcode = '42501';
  end if;

  if v_privileged then
    v_uid := coalesce(p_user_id, auth.uid());
  else
    v_uid := auth.uid();
  end if;

  if v_uid is null then
    return jsonb_build_object('remaining', 0, 'bonus', 0, 'bonus_left', 0);
  end if;

  if v_privileged and nullif(btrim(coalesce(p_tier, '')), '') is not null then
    v_tier := btrim(p_tier);
  elsif auth.uid() is not null then
    v_tier := public.effective_tier_for_current_user();
  else
    v_tier := 'free';
  end if;
  v_free := coalesce(v_tier, 'free') = 'free';

  if v_free then
    v_monthly := 1;
  elsif v_privileged and p_monthly is not null then
    v_monthly := greatest(p_monthly, 0);
  else
    v_monthly := case v_tier
      when 'keeper' then 3
      when 'breeder' then 6
      when 'enterprise' then 15
      else 1
    end;
  end if;

  select coalesce(sum(b.credits), 0)
    into v_bonus
    from public.morph_id_bonus_credits b
   where b.user_id = v_uid
     and (b.expires_at is null or b.expires_at > now());

  v_bonus_left := public.morph_id_bonus_left(v_uid);

  select u.credits_consumed, u.credits_included, u.tier_at_start
    into v_consumed, v_included, v_tier_at_start
    from public.morph_id_usage u
   where u.user_id = v_uid
     and u.month_key = public.month_key_now();

  if not found then
    v_monthly_left := v_monthly;
  else
    v_cap := greatest(v_included, v_monthly);
    if not v_free and coalesce(v_tier_at_start, 'free') = 'free' then
      v_cap := greatest(v_cap, v_monthly + v_consumed);
    end if;
    v_monthly_left := greatest(0, v_cap - v_consumed);
  end if;

  return jsonb_build_object(
    'remaining', v_monthly_left + v_bonus_left,
    'bonus', v_bonus,
    'bonus_left', v_bonus_left
  );
end;
$function$;

revoke all on function public.morph_id_scans_remaining(uuid, text, integer) from public, anon;
grant execute on function public.morph_id_scans_remaining(uuid, text, integer) to authenticated, service_role;

-- This month's Free rows written by the old rule have a plan cap of 0
-- when the member had used their try in an earlier month, so a scan this
-- month was counted as a bonus scan. Under the new rule that scan was
-- this month's free one: give the row its plan cap of 1, which hands the
-- bonus scan back. Running it again changes nothing.
update public.morph_id_usage
   set credits_included = 1,
       updated_date = now()
 where month_key = public.month_key_now()
   and coalesce(tier_at_start, 'free') = 'free'
   and credits_included < 1;

-- ---------------------------------------------------------------------
-- 2. Share cards
-- ---------------------------------------------------------------------

create table if not exists public.morph_id_shares (
  -- 16 lowercase hex characters (64 random bits): short enough for a
  -- Facebook comment, too long to guess.
  id text primary key check (id ~ '^[0-9a-f]{16}$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  -- The Morph ID request the card was copied from. Null only for an
  -- admin card (admin scans are not stored in morph_id_requests).
  request_key text,
  -- Path inside the public geck-inspect-media bucket, always under the
  -- owner's own folder. The share page builds the photo address from it.
  image_path text not null check (char_length(image_path) <= 300),
  -- The trimmed Morph ID answer: pattern ids, trait ids, scores and the
  -- evidence status. No free text, no names, no email.
  card jsonb not null,
  view_count integer not null default 0,
  signup_count integer not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create unique index if not exists morph_id_shares_owner_request_idx
  on public.morph_id_shares (owner_id, request_key)
  where request_key is not null;
create index if not exists morph_id_shares_owner_created_idx
  on public.morph_id_shares (owner_id, created_date desc);

comment on table public.morph_id_shares is
  'Morph ID result cards a member chose to share. Created only through create_morph_id_share(); read publicly one at a time through get_morph_id_share(); the owner can list and delete their own.';

alter table public.morph_id_shares enable row level security;

drop policy if exists morph_id_shares_owner_read on public.morph_id_shares;
create policy morph_id_shares_owner_read
  on public.morph_id_shares
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists morph_id_shares_owner_delete on public.morph_id_shares;
create policy morph_id_shares_owner_delete
  on public.morph_id_shares
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- No insert or update policy: a card is written only by
-- create_morph_id_share(), which copies the answer from the server.
-- anon gets nothing on the table, so it cannot list cards.
revoke all on table public.morph_id_shares from public, anon, authenticated;
grant select, delete on table public.morph_id_shares to authenticated;
grant all on table public.morph_id_shares to service_role;

-- Who signed up from which card, one row per new account, so a card's
-- sign-up count cannot be bumped twice by the same person.
create table if not exists public.morph_id_share_signups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  share_id text not null references public.morph_id_shares(id) on delete cascade,
  created_date timestamptz not null default now()
);

alter table public.morph_id_share_signups enable row level security;
revoke all on table public.morph_id_share_signups from public, anon, authenticated;
grant all on table public.morph_id_share_signups to service_role;

-- Keep only what the card shows, and only well-formed ids, from a Morph
-- ID answer. Used for the server copy and for an admin card.
create or replace function public.morph_id_share_card_from(p_analysis jsonb)
returns jsonb
language sql
immutable
set search_path to 'public'
as $function$
  with a as (
    select case when jsonb_typeof(p_analysis) = 'object' then p_analysis else '{}'::jsonb end as v
  ),
  ids as (
    select
      (select coalesce(jsonb_agg(t order by ord), '[]'::jsonb)
         from a, jsonb_array_elements_text(
                case when jsonb_typeof(a.v->'genetic_traits') = 'array' then a.v->'genetic_traits' else '[]'::jsonb end
              ) with ordinality as g(t, ord)
        where t ~ '^[a-z][a-z0-9_]{0,39}$' and ord <= 6) as genetic_traits,
      (select coalesce(jsonb_agg(jsonb_build_object(
                'morph', c->>'morph',
                'score', least(100, greatest(0, round(coalesce((c->>'score')::numeric, 0))))
              ) order by ord), '[]'::jsonb)
         from a, jsonb_array_elements(
                case when jsonb_typeof(a.v->'candidate_morphs') = 'array' then a.v->'candidate_morphs' else '[]'::jsonb end
              ) with ordinality as cm(c, ord)
        where jsonb_typeof(c) = 'object'
          and coalesce(c->>'morph', '') ~ '^[a-z][a-z0-9_]{0,39}$'
          and coalesce(c->>'score', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
          and ord <= 5) as candidates
  )
  select jsonb_build_object(
    'primary_morph', case when (a.v->>'primary_morph') ~ '^[a-z][a-z0-9_]{0,39}$' then a.v->>'primary_morph' end,
    'genetic_traits', ids.genetic_traits,
    'candidate_morphs', ids.candidates,
    'assessment_status', case
      when a.v->>'assessment_status' in ('best_match', 'tentative', 'insufficient_evidence')
      then a.v->>'assessment_status' else 'tentative' end,
    'confidence_score', least(100, greatest(0, round(
      case when (a.v->>'confidence_score') ~ '^-?[0-9]+(\.[0-9]+)?$' then (a.v->>'confidence_score')::numeric else 0 end
    ))),
    'taxonomy_version', left(coalesce(a.v->>'taxonomy_version', ''), 40)
  )
  from a, ids;
$function$;

revoke all on function public.morph_id_share_card_from(jsonb) from public, anon, authenticated;
grant execute on function public.morph_id_share_card_from(jsonb) to service_role;

-- Tap Share: make a card from one of the caller's own Morph ID answers.
-- Returns {id, created}. Sharing the same answer twice returns the same
-- card. Raises morph_share_* errors the page turns into plain words.
create or replace function public.create_morph_id_share(
  p_request_key text,
  p_image_url text,
  p_analysis jsonb default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_admin boolean := coalesce(public.is_admin(), false);
  v_existing text;
  v_response jsonb;
  v_card jsonb;
  v_path text;
  v_match text[];
  v_id text;
  v_hex text;
  v_recent integer;
begin
  if v_uid is null then
    raise exception 'morph_share_auth_required' using errcode = '42501';
  end if;

  if p_request_key is not null and p_request_key !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception 'morph_share_bad_request' using errcode = '22023';
  end if;

  -- The photo must be in the caller's own folder of the public media
  -- bucket: {folder}/{auth uid}/{uuid}.{ext} or {auth uid}/{uuid}.{ext},
  -- the shape src/lib/imageStoragePath.js writes. Nobody can put a
  -- stranger's photo, or a picture from another site, on a card.
  v_match := regexp_match(
    coalesce(p_image_url, ''),
    '^https://[A-Za-z0-9.-]+/storage/v1/object/public/geck-inspect-media/((?:[A-Za-z0-9_-]+/)?([0-9a-f-]{36})/[0-9a-f-]{36}\.(?:jpg|png|webp|gif|avif))$'
  );
  if v_match is null or v_match[2] <> v_uid::text then
    raise exception 'morph_share_bad_photo' using errcode = '22023';
  end if;
  v_path := v_match[1];

  if p_request_key is not null then
    select s.id into v_existing
      from public.morph_id_shares s
     where s.owner_id = v_uid and s.request_key = p_request_key;
    if v_existing is not null then
      return jsonb_build_object('id', v_existing, 'created', false);
    end if;

    select r.response into v_response
      from public.morph_id_requests r
     where r.user_id = v_uid
       and r.request_key = p_request_key
       and r.status = 'done';
  end if;

  if v_response is not null and jsonb_typeof(v_response->'analysis') = 'object' then
    v_card := public.morph_id_share_card_from(v_response->'analysis');
  elsif v_admin and p_analysis is not null then
    -- Admin scans skip the request store, so an admin card is built from
    -- the answer the page holds. Members never get this path.
    v_card := public.morph_id_share_card_from(p_analysis);
  else
    raise exception 'morph_share_no_result' using errcode = 'P0002';
  end if;

  if v_card->>'assessment_status' = 'insufficient_evidence'
     or (v_card->>'primary_morph' is null and jsonb_array_length(v_card->'candidate_morphs') = 0) then
    raise exception 'morph_share_nothing_to_share' using errcode = '22023';
  end if;

  -- 30 cards a day is far more than a person shares; it stops a script
  -- from filling the table.
  select count(*) into v_recent
    from public.morph_id_shares s
   where s.owner_id = v_uid and s.created_date > now() - interval '1 day';
  if v_recent >= 30 then
    raise exception 'morph_share_rate_limited' using errcode = 'P0001';
  end if;

  loop
    v_hex := replace(gen_random_uuid()::text, '-', '');
    -- Skip the version nibble (13) and the variant bits (17): 64 random bits.
    v_id := substr(v_hex, 1, 12) || substr(v_hex, 18, 4);
    begin
      insert into public.morph_id_shares (id, owner_id, request_key, image_path, card)
      values (v_id, v_uid, p_request_key, v_path, v_card);
      exit;
    exception
      when unique_violation then
        -- Same answer shared twice at once: hand back the first card.
        if p_request_key is not null then
          select s.id into v_existing
            from public.morph_id_shares s
           where s.owner_id = v_uid and s.request_key = p_request_key;
          if v_existing is not null then
            return jsonb_build_object('id', v_existing, 'created', false);
          end if;
        end if;
        -- Otherwise an id collision: draw again.
    end;
  end loop;

  insert into public.user_events (event_name, user_email, page, properties, created_by)
  values (
    'morph_share_created',
    auth.email(),
    'Recognition',
    jsonb_strip_nulls(jsonb_build_object(
      'share_id', v_id,
      'assessment_status', v_card->>'assessment_status',
      'primary_morph', v_card->>'primary_morph',
      'is_admin', case when v_admin then true end
    )),
    auth.email()
  );

  return jsonb_build_object('id', v_id, 'created', true);
end;
$function$;

revoke all on function public.create_morph_id_share(text, text, jsonb) from public, anon;
grant execute on function public.create_morph_id_share(text, text, jsonb) to authenticated, service_role;

-- Read one card by its id, for the public share page. Returns null for an
-- unknown or deleted id. With p_count_view the page has decided a person
-- (not a link-preview robot) opened it: the view is counted and logged.
-- Nothing here names the owner.
create or replace function public.get_morph_id_share(p_id text, p_count_view boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_row public.morph_id_shares%rowtype;
begin
  if p_id is null or p_id !~ '^[0-9a-f]{16}$' then
    return null;
  end if;

  if coalesce(p_count_view, false) then
    update public.morph_id_shares s
       set view_count = s.view_count + 1
     where s.id = p_id
    returning * into v_row;
    if found then
      insert into public.user_events (event_name, page, properties)
      values ('morph_share_viewed', 'morph-id/r', jsonb_build_object('share_id', p_id));
    end if;
  else
    select * into v_row from public.morph_id_shares s where s.id = p_id;
  end if;

  if v_row.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'image_path', v_row.image_path,
    'card', v_row.card,
    'created_date', v_row.created_date
  );
end;
$function$;

revoke all on function public.get_morph_id_share(text, boolean) from public;
grant execute on function public.get_morph_id_share(text, boolean) to anon, authenticated, service_role;

-- A new account that arrived from a card. Counted once per account, only
-- for an account made in the last 2 days, never for the card's owner.
-- Returns true when this call counted the sign-up.
create or replace function public.record_morph_id_share_signup(p_share_id text)
returns boolean
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_created timestamptz;
  v_owner uuid;
begin
  if v_uid is null or p_share_id is null or p_share_id !~ '^[0-9a-f]{16}$' then
    return false;
  end if;

  select u.created_at into v_created from auth.users u where u.id = v_uid;
  if v_created is null or v_created < now() - interval '2 days' then
    return false;
  end if;

  select s.owner_id into v_owner from public.morph_id_shares s where s.id = p_share_id;
  if v_owner is null or v_owner = v_uid then
    return false;
  end if;

  insert into public.morph_id_share_signups (user_id, share_id)
  values (v_uid, p_share_id)
  on conflict (user_id) do nothing;
  if not found then
    return false;
  end if;

  update public.morph_id_shares
     set signup_count = signup_count + 1
   where id = p_share_id;

  insert into public.user_events (event_name, user_email, page, properties, created_by)
  values ('morph_share_signup', auth.email(), 'morph-id/r',
          jsonb_build_object('share_id', p_share_id), auth.email());

  return true;
end;
$function$;

revoke all on function public.record_morph_id_share_signup(text) from public, anon;
grant execute on function public.record_morph_id_share_signup(text) to authenticated, service_role;
