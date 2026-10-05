-- Morph ID: no lost credits on retries, and the free try no longer eats
-- into the first paid month (5 Oct 2026).
--
-- 1. morph_id_requests: one row per (member, request key). The browser
--    sends a key per set of photos. recognize-gecko-morph uses it so a
--    retry after a lost connection, or a double tap, gets the stored
--    answer back (or "still running") instead of a second paid analysis.
--    Only the edge function (service role) reads or writes it: row level
--    security is on and there are no policies. Rows older than a day are
--    of no use; the function only replays answers less than an hour old.
--    The function works without this table and simply skips the check.
--
-- 2. consume_morph_id_credit: when a Free member used the lifetime free
--    try and then upgraded in the same month, the free try stayed in that
--    month's count, so a new Breeder got 5 of the 6 monthly
--    identifications (seen on 1 Oct 2026). The first paid call of that
--    month now adds the free use to the month's included credits. The
--    lifetime free-try check is unchanged (it still sums credits_consumed)
--    and no allowance changes: Keeper 3, Breeder 6, Enterprise 15.

create table if not exists public.morph_id_requests (
  user_id uuid not null,
  request_key text not null,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, request_key)
);

alter table public.morph_id_requests enable row level security;

create index if not exists morph_id_requests_updated_at_idx
  on public.morph_id_requests (updated_at);

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
  v_included integer := case when coalesce(p_tier, 'free') = 'free' then 0 else p_credits_included end;
  v_lifetime integer;
begin
  if v_free then
    select coalesce(sum(u.credits_consumed), 0)
      into v_lifetime
      from public.morph_id_usage u
     where u.user_id = p_user_id;
    if v_lifetime = 0 then
      v_included := 1;
    end if;
  end if;

  if v_included <= 0 then
    raise exception 'morph_id_credits_exhausted'
      using errcode = 'P0001';
  end if;

  insert into public.morph_id_usage (
    user_id, month_key, tier_at_start, credits_included, credits_consumed
  )
  values (p_user_id, mk, p_tier, v_included, 1)
  on conflict (user_id, month_key) do update
    set tier_at_start = excluded.tier_at_start,
        credits_included = greatest(
          public.morph_id_usage.credits_included,
          excluded.credits_included
            -- First paid call after a free try in the same month: the
            -- free use does not count against the paid allowance.
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

  if rec.credits_consumed > rec.credits_included then
    update public.morph_id_usage
      set credits_consumed = rec.credits_included,
          updated_date = now()
      where id = rec.id;
    raise exception 'morph_id_credits_exhausted'
      using errcode = 'P0001';
  end if;

  return rec;
end;
$function$;
