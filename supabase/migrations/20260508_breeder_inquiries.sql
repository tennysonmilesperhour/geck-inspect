-- Breeder inquiries — buyer-to-breeder contact form on the public
-- storefront. Anyone (logged in or not) can submit an inquiry. Only the
-- target breeder can read or update their own inquiries.
--
-- This table is the foundation for the future Stripe Connect checkout
-- flow: when a payment is completed, an inquiry row will be auto-marked
-- 'paid' and linked to the order. For now it captures buyer intent so
-- the breeder can complete the sale off-platform.

create table if not exists breeder_inquiries (
  id uuid primary key default gen_random_uuid(),

  -- Recipient: the breeder who owns the storefront (matched by email
  -- since geckos.created_by and breeder_profiles.created_by are both
  -- email-keyed in this codebase).
  breeder_email text not null,
  breeder_slug text,

  -- Buyer contact (anonymous: not required to have an account).
  buyer_email text not null,
  buyer_name text,
  buyer_phone text,

  -- What they're asking about. gecko_id is the geckos.id (text PK in
  -- this schema). passport_code is denormalized so the breeder can
  -- still see what the inquiry was about even if the gecko was later
  -- transferred or hidden.
  gecko_id text,
  gecko_name text,
  gecko_passport_code text,

  message text not null,
  status text not null default 'new',  -- new | read | replied | archived

  created_at timestamptz not null default now(),
  read_at timestamptz,
  replied_at timestamptz
);

create index if not exists idx_breeder_inquiries_breeder_created
  on breeder_inquiries (breeder_email, created_at desc);

create index if not exists idx_breeder_inquiries_status
  on breeder_inquiries (status, created_at desc);

alter table breeder_inquiries enable row level security;

-- Public can submit inquiries (this is the whole point of the form).
-- Spam protection is downstream: a rate limit in the edge function and
-- email-based notification deliverability.
drop policy if exists "anyone_can_create_inquiry" on breeder_inquiries;
create policy "anyone_can_create_inquiry" on breeder_inquiries
  for insert
  with check (true);

-- Only the breeder can read their own inquiries. Profiles are keyed by
-- email in this codebase, so we resolve auth.uid() -> profiles.email
-- and compare to breeder_email.
drop policy if exists "breeder_reads_own_inquiries" on breeder_inquiries;
create policy "breeder_reads_own_inquiries" on breeder_inquiries
  for select
  using (
    breeder_email = (
      select email from profiles where id::text = auth.uid()::text
    )
  );

-- Only the breeder can update (mark read / replied / archived).
drop policy if exists "breeder_updates_own_inquiries" on breeder_inquiries;
create policy "breeder_updates_own_inquiries" on breeder_inquiries
  for update
  using (
    breeder_email = (
      select email from profiles where id::text = auth.uid()::text
    )
  );

grant select, insert, update on breeder_inquiries to authenticated;
grant insert on breeder_inquiries to anon;
