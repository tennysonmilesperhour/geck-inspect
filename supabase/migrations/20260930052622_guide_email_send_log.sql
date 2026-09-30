-- The free guide email (subscribe-and-send-guides) needs no sign-in, so a
-- script could send it to any address as often as it liked. Each send is
-- logged here so the function can allow one per address per day and a few
-- per network per hour. Only the function (service role) reads or writes
-- it, and the caller's IP is stored only as a keyed hash.
create table if not exists public.guide_email_sends (
  id bigint generated always as identity primary key,
  email text not null,
  ip_hash text,
  created_at timestamptz not null default now()
);
alter table public.guide_email_sends enable row level security;
revoke all on public.guide_email_sends from anon, authenticated;
create index if not exists guide_email_sends_email_created_idx
  on public.guide_email_sends (email, created_at desc);
create index if not exists guide_email_sends_ip_created_idx
  on public.guide_email_sends (ip_hash, created_at desc) where ip_hash is not null;
