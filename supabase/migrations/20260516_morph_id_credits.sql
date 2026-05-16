-- ============================================================================
-- MorphID monthly credit system
-- ============================================================================
-- Mirrors the social_post_usage pattern (see 20260510_social_media_manager.sql).
-- Each AI Morph ID call costs 1 credit, debited atomically before the
-- expensive Anthropic + Replicate work runs. Tier-level monthly allotments
-- live in src/lib/tierLimits.js (monthlyMorphIDCredits): free=1, keeper=3,
-- breeder=6, enterprise=15. Hard limit, no overage; when the row hits
-- credits_included the edge function returns 402 and the UI shows an upgrade
-- CTA. Admins bypass the check entirely.
-- ============================================================================

create table if not exists public.morph_id_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_key text not null,
  tier_at_start text not null default 'free',
  credits_included integer not null default 1,
  credits_consumed integer not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (user_id, month_key)
);

create index if not exists morph_id_usage_user_month_idx
  on public.morph_id_usage(user_id, month_key desc);

alter table public.morph_id_usage enable row level security;

drop policy if exists "Users read their own morph id usage" on public.morph_id_usage;
create policy "Users read their own morph id usage"
  on public.morph_id_usage
  for select
  using (user_id = auth.uid());
-- writes go through the service-role RPC only

-- consume_morph_id_credit
-- Atomically reserve one MorphID credit for the calling auth user.
-- Returns the row after the increment so the edge function can pass the
-- remaining count back to the client for the in-app "X of Y left" hint.
-- Raises 'morph_id_credits_exhausted' when credits_consumed would exceed
-- credits_included; the edge function maps that to HTTP 402.
create or replace function public.consume_morph_id_credit(
  p_user_id uuid,
  p_tier text,
  p_credits_included integer
)
returns public.morph_id_usage
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.morph_id_usage%rowtype;
  mk text := public.month_key_now();
begin
  insert into public.morph_id_usage (
    user_id, month_key, tier_at_start, credits_included, credits_consumed
  )
  values (p_user_id, mk, p_tier, p_credits_included, 1)
  on conflict (user_id, month_key) do update
    set tier_at_start = excluded.tier_at_start,
        credits_included = greatest(public.morph_id_usage.credits_included, excluded.credits_included),
        credits_consumed = public.morph_id_usage.credits_consumed + 1,
        updated_date = now()
    returning * into rec;

  if rec.credits_consumed > rec.credits_included then
    -- Roll back the increment so the user can be told exactly where they
    -- stand without us having silently burned a credit on a refused call.
    update public.morph_id_usage
      set credits_consumed = rec.credits_included,
          updated_date = now()
      where id = rec.id;
    raise exception 'morph_id_credits_exhausted'
      using errcode = 'P0001';
  end if;

  return rec;
end;
$$;

-- Lock the RPC to service_role. Supabase auto-grants execute to anon and
-- authenticated when a function is created in the public schema, so revoke
-- explicitly from those roles too — the advisor flags this otherwise.
revoke execute on function public.consume_morph_id_credit(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.consume_morph_id_credit(uuid, text, integer) to service_role;

-- ============================================================================
-- Profile preference: show estimated value in MorphID reasoning
-- ============================================================================
-- Off by default. The Recognition flow opts paid users in via Settings;
-- free users never see the toggle so the column stays false for them. The
-- recognize-gecko-morph edge function re-checks tier server-side before
-- honoring the flag.
-- ============================================================================

alter table public.profiles
  add column if not exists morph_id_show_value_estimate boolean not null default false;
