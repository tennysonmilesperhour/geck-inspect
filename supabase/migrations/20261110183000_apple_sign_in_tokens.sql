-- Apple refresh tokens, kept so deleting an account can revoke the
-- member's Sign in with Apple link (App Store Review Guideline 5.1.1(v)).
--
-- Written by the apple-token edge function after an iPhone sign-in, read
-- by delete-my-account, admin-delete-account and discard-empty-account just
-- before they delete the login. Only the service role touches it: row
-- level security is on with no policies, and the member roles get no
-- grants, so the token never reaches a browser.
--
-- The row goes with the login (on delete cascade). Additive and
-- idempotent: the app open in members' browsers never reads this table.

create table if not exists public.apple_sign_in_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  apple_sub text not null,
  refresh_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.apple_sign_in_tokens is
  'Apple refresh token per login, for revoking Sign in with Apple when the account is deleted. Service role only.';

alter table public.apple_sign_in_tokens enable row level security;

revoke all on table public.apple_sign_in_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.apple_sign_in_tokens to service_role;
