-- =============================================================================
-- Referral program
-- =============================================================================
-- Every profile gets a unique short `referral_code`. Sharing a link of the form
-- `/?ref=<code>` records `referred_by` on the new profile at signup, linking the
-- new user back to the referrer. The referrer earns 10% of all subscription
-- revenue from referred users for life — a separate Stripe webhook writes
-- entries into `referral_payouts` whenever a referred user pays.
-- =============================================================================

alter table public.profiles
  add column if not exists referral_code text unique,
  add column if not exists referred_by text,
  add column if not exists referrer_user_id uuid references auth.users(id) on delete set null,
  add column if not exists referral_signup_count integer not null default 0,
  add column if not exists referral_earnings_cents bigint not null default 0;

create index if not exists profiles_referral_code_idx
  on public.profiles(referral_code);
create index if not exists profiles_referred_by_idx
  on public.profiles(referred_by);

-- Generate an 8-char lowercase alphanumeric code. Collision space is ~2.8e12,
-- but we still loop on rare collisions so the unique index never raises.
create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  candidate text;
  attempt int := 0;
begin
  loop
    candidate := lower(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
    perform 1 from public.profiles where referral_code = candidate;
    if not found then
      return candidate;
    end if;
    attempt := attempt + 1;
    if attempt > 10 then
      raise exception 'generate_referral_code: failed to find unique code after 10 attempts';
    end if;
  end loop;
end;
$$;

create or replace function public.set_default_referral_code()
returns trigger
language plpgsql
as $$
begin
  if new.referral_code is null or new.referral_code = '' then
    new.referral_code := public.generate_referral_code();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_set_referral_code on public.profiles;
create trigger profiles_set_referral_code
  before insert on public.profiles
  for each row
  execute function public.set_default_referral_code();

-- Backfill existing profiles that pre-date this migration.
update public.profiles
   set referral_code = public.generate_referral_code()
 where referral_code is null;

-- =============================================================================
-- referral_payouts — ledger of revenue-share entries
-- =============================================================================
-- One row per Stripe charge attributable to a referred user. The Stripe
-- webhook handler is responsible for inserting these and crediting
-- `profiles.referral_earnings_cents` on the referrer. RLS lets a referrer
-- read their own incoming payouts; writes are server-side only (service
-- role bypasses RLS).
-- =============================================================================

create table if not exists public.referral_payouts (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid references auth.users(id) on delete set null,
  referrer_email text,
  referred_user_id uuid references auth.users(id) on delete set null,
  referred_email text,
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'usd',
  source_event_type text not null default 'subscription_payment',
  stripe_event_id text unique,
  stripe_invoice_id text,
  created_date timestamptz default now()
);

create index if not exists referral_payouts_referrer_idx
  on public.referral_payouts(referrer_user_id);
create index if not exists referral_payouts_referred_idx
  on public.referral_payouts(referred_user_id);

alter table public.referral_payouts enable row level security;

drop policy if exists "Referrers read their payouts" on public.referral_payouts;
create policy "Referrers read their payouts"
  on public.referral_payouts
  for select
  using (referrer_user_id = auth.uid());

comment on column public.profiles.referral_code is
  'Unique short code for this profile''s referral link. Auto-generated on insert.';
comment on column public.profiles.referred_by is
  'referral_code of the profile that referred this user, set once at signup.';
comment on column public.profiles.referrer_user_id is
  'auth.users.id of the referrer (denormalized from referred_by for joins).';
comment on table public.referral_payouts is
  'Ledger of 10%-revenue-share entries. Populated server-side by the Stripe webhook on each subscription invoice payment from a referred user.';
