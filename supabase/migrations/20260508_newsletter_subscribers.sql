-- Newsletter subscribers — captured via the homepage lead-magnet form.
-- The email-capture flow promises a Care Guide + Genetics Guide PDF in
-- return for an email; the `subscribe-and-send-guides` edge function
-- inserts here and then sends the PDFs via Resend.
--
-- We store source so we can attribute conversions later (homepage hero,
-- blog post, footer, etc) and a confirmation flag so future
-- double-opt-in flows have a place to record consent.

create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,                            -- e.g. 'homepage', 'blog', 'careguide-pdf'
  user_id uuid,                           -- optional: filled if subscriber is also a logged-in user
  consent_marketing boolean not null default true,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_newsletter_subscribers_created
  on newsletter_subscribers (created_at desc);

create index if not exists idx_newsletter_subscribers_unsub
  on newsletter_subscribers (unsubscribed_at)
  where unsubscribed_at is null;

alter table newsletter_subscribers enable row level security;

-- The public can insert their own email. Spam protection is in the
-- edge function (honeypot + length checks + rate limiting downstream).
drop policy if exists "anyone_can_subscribe" on newsletter_subscribers;
create policy "anyone_can_subscribe" on newsletter_subscribers
  for insert
  with check (true);

-- Subscribers cannot read the list. Admins access via service role.
drop policy if exists "no_select_for_users" on newsletter_subscribers;
create policy "no_select_for_users" on newsletter_subscribers
  for select
  using (false);

grant insert on newsletter_subscribers to anon, authenticated;
